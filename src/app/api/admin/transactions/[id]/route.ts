import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { hasVerifiedPayDunyaClientPayment } from "@/lib/payment-security";

async function isAdmin() {
  const session = await getServerSession(authOptions);
  return !!session?.user && (session.user as any).role === "ADMIN";
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
  }
  const { id } = await params;
  const body = await req.json();
  const action: string = body.action;

  const tx = await db.transaction.findUnique({ where: { id } });
  if (!tx) return NextResponse.json({ error: "Transaction introuvable" }, { status: 404 });

  const now = new Date();
  if (action === "pay") {
    if (tx.type !== "TEACHER_PAYOUT") {
      return NextResponse.json({
        error: "Cette action ne peut pas transformer une transaction client en paiement professeur. Utilisez le module Comptabilité professeur.",
      }, { status: 400 });
    }
    const booking = await db.booking.findUnique({
      where: { id: tx.bookingId },
      include: { transactions: { where: { type: "CLIENT_PAYMENT" } } },
    });
    if (!booking) {
      return NextResponse.json({ error: "Réservation introuvable pour cette transaction." }, { status: 404 });
    }
    if (!["TO_PAY_TEACHER", "TEACHER_PAID"].includes(booking.paymentStatus)) {
      return NextResponse.json({ error: "Cette réservation n'est pas payable côté professeur." }, { status: 400 });
    }
    if (!hasVerifiedPayDunyaClientPayment(booking)) {
      return NextResponse.json({
        error: "Impossible de solder cette transaction: aucun paiement client PayDunya vérifié n'est rattaché à la réservation.",
      }, { status: 409 });
    }
    await db.transaction.update({
      where: { id },
      data: { status: "TEACHER_PAID", paidAt: now },
    });
    if (booking.paymentStatus === "TO_PAY_TEACHER") {
      await db.booking.update({
        where: { id: booking.id },
        data: { status: "TEACHER_PAID", paymentStatus: "TEACHER_PAID", teacherPaidAt: now },
      });
    }
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ error: "Action inconnue" }, { status: 400 });
}
