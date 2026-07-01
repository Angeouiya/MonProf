import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { generateReference } from "@/lib/format";

async function isAdmin() {
  const session = await getServerSession(authOptions);
  return !!session?.user && (session.user as any).role === "ADMIN";
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
  }
  const { id } = await params;
  const dispute = await db.dispute.findUnique({
    where: { id },
    include: {
      booking: {
        include: {
          teacher: { select: { id: true, fullName: true, professionalName: true, phone: true, email: true } },
          client: { select: { id: true, name: true, phone: true, email: true } },
          transactions: { orderBy: { createdAt: "desc" } },
        },
      },
      openedBy: { select: { id: true, name: true, email: true } },
    },
  });
  if (!dispute) return NextResponse.json({ error: "Litige introuvable" }, { status: 404 });
  return NextResponse.json(dispute);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
  }
  const { id } = await params;
  const body = await req.json();
  const action: string = body.action;
  const resolution: string | undefined = body.resolution;

  const dispute = await db.dispute.findUnique({ where: { id }, include: { booking: true } });
  if (!dispute) return NextResponse.json({ error: "Litige introuvable" }, { status: 404 });

  const now = new Date();
  try {
    switch (action) {
      case "investigate":
        await db.dispute.update({
          where: { id },
          data: { status: "INVESTIGATING", resolution: resolution ?? dispute.resolution },
        });
        return NextResponse.json({ ok: true });
      case "resolve":
        await db.dispute.update({
          where: { id },
          data: { status: "RESOLVED", resolution: resolution ?? dispute.resolution, resolvedAt: now },
        });
        // Replacer le booking en paiement à libérer
        await db.booking.update({
          where: { id: dispute.bookingId },
          data: { status: "PAYMENT_TO_RELEASE", paymentStatus: "TO_PAY_TEACHER" },
        });
        await db.transaction.updateMany({
          where: { bookingId: dispute.bookingId, type: "CLIENT_PAYMENT" },
          data: { status: "TO_PAY_TEACHER" },
        });
        return NextResponse.json({ ok: true });
      case "refund": {
        await db.dispute.update({
          where: { id },
          data: { status: "REFUNDED", resolution: resolution ?? dispute.resolution, resolvedAt: now },
        });
        const booking = await db.booking.findUnique({ where: { id: dispute.bookingId } });
        if (booking) {
          await db.booking.update({
            where: { id: booking.id },
            data: { status: "REFUNDED", paymentStatus: "REFUNDED" },
          });
          await db.transaction.updateMany({
            where: { bookingId: booking.id, type: "CLIENT_PAYMENT" },
            data: { status: "REFUNDED" },
          });
          await db.transaction.create({
            data: {
              reference: generateReference("TX"),
              bookingId: booking.id,
              teacherId: booking.teacherId,
              amount: booking.totalPrice,
              commission: 0,
              teacherNet: 0,
              type: "REFUND",
              status: "REFUNDED",
              method: booking.paymentMethod,
              paidAt: now,
            },
          });
        }
        return NextResponse.json({ ok: true });
      }
      case "reject":
        await db.dispute.update({
          where: { id },
          data: { status: "REJECTED", resolution: resolution ?? dispute.resolution, resolvedAt: now },
        });
        // Replacer le booking à son statut précédent (payment_to_release)
        await db.booking.update({
          where: { id: dispute.bookingId },
          data: { status: "PAYMENT_TO_RELEASE", paymentStatus: "TO_PAY_TEACHER" },
        });
        await db.transaction.updateMany({
          where: { bookingId: dispute.bookingId, type: "CLIENT_PAYMENT" },
          data: { status: "TO_PAY_TEACHER" },
        });
        return NextResponse.json({ ok: true });
      default:
        return NextResponse.json({ error: "Action inconnue" }, { status: 400 });
    }
  } catch (e: any) {
    console.error("admin/dispute PATCH error", e);
    return NextResponse.json({ error: e.message || "Erreur serveur" }, { status: 500 });
  }
}
