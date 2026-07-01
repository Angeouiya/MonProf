import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

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
    await db.transaction.update({
      where: { id },
      data: { status: "TEACHER_PAID", paidAt: now },
    });
    // Si c'est un paiement prof, marquer booking aussi
    if (tx.type === "TEACHER_PAYOUT" || tx.type === "CLIENT_PAYMENT") {
      const booking = await db.booking.findUnique({ where: { id: tx.bookingId } });
      if (booking && booking.paymentStatus === "TO_PAY_TEACHER") {
        await db.booking.update({
          where: { id: booking.id },
          data: { status: "TEACHER_PAID", paymentStatus: "TEACHER_PAID", teacherPaidAt: now },
        });
      }
    }
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ error: "Action inconnue" }, { status: 400 });
}
