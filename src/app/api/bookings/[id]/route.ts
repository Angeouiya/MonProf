import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { DisputeStatus } from "@prisma/client";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  const userId = (session.user as any).id;
  const role = (session.user as any).role;
  const { id } = await params;

  const booking = await db.booking.findUnique({
    where: { id },
    include: {
      teacher: {
        select: {
          id: true, fullName: true, professionalName: true, photoUrl: true,
          jobTitle: true, commune: true, phone: true, email: true,
        },
      },
      client: { select: { id: true, name: true, email: true, phone: true, commune: true, quartier: true } },
      transactions: { orderBy: { createdAt: "asc" } },
      reviews: true,
      disputes: { orderBy: { createdAt: "desc" } },
    },
  });

  if (!booking) return NextResponse.json({ error: "Réservation introuvable" }, { status: 404 });

  if (role !== "ADMIN" && booking.clientId !== userId) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  return NextResponse.json({
    ...booking,
    preferredDays: booking.preferredDays ? JSON.parse(booking.preferredDays) : [],
  });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  const userId = (session.user as any).id;
  const { id } = await params;

  const booking = await db.booking.findUnique({ where: { id } });
  if (!booking) return NextResponse.json({ error: "Réservation introuvable" }, { status: 404 });
  if (booking.clientId !== userId) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const body = await req.json();
  const { action, reason, description, rescheduleMessage } = body;

  const now = new Date();

  switch (action) {
    case "confirm": {
      if (booking.status !== "PENDING_CLIENT_VALIDATION") {
        return NextResponse.json({ error: "Action non autorisée pour ce statut" }, { status: 400 });
      }
      const updated = await db.booking.update({
        where: { id },
        data: {
          status: "PAYMENT_TO_RELEASE",
          paymentStatus: "TO_PAY_TEACHER",
          clientValidatedAt: now,
        },
      });
      await db.notification.create({
        data: {
          userId: null,
          title: "Paiement à libérer",
          message: `Le client a confirmé le cours ${booking.reference}. Paiement de ${booking.teacherNetAmount.toLocaleString("fr-FR")} FCFA net à libérer au professeur.`,
          type: "PAYMENT_TO_RELEASE",
          link: "/admin/paiements-a-liberer",
        },
      });
      return NextResponse.json({ booking: updated });
    }

    case "report":
    case "open_dispute": {
      const r = reason || "Problème signalé par le client";
      const d = description || (action === "report" ? "Le client signale un problème sur ce cours." : "Litige ouvert par le client.");
      const dispute = await db.dispute.create({
        data: {
          bookingId: id,
          openedById: userId,
          reason: r,
          description: d,
          status: "OPEN" as DisputeStatus,
        },
      });
      const updated = await db.booking.update({
        where: { id },
        data: { status: "DISPUTED", paymentStatus: "DISPUTED" },
      });
      await db.notification.create({
        data: {
          userId: null,
          title: "Litige ouvert",
          message: `Litige ouvert sur ${booking.reference}. Raison: ${r}. Paiement bloqué en attente de résolution.`,
          type: "DISPUTE_OPENED",
          link: "/admin/litiges",
        },
      });
      return NextResponse.json({ booking: updated, dispute });
    }

    case "reschedule": {
      const updated = await db.booking.update({
        where: { id },
        data: {
          status: "PENDING_ADMIN_VALIDATION",
          message: rescheduleMessage
            ? `${booking.message ?? ""}\n\n[Report demandé]: ${rescheduleMessage}`.trim()
            : booking.message,
        },
      });
      await db.notification.create({
        data: {
          userId: null,
          title: "Report demandé",
          message: `Le client demande un report pour ${booking.reference}.${rescheduleMessage ? ` Motif: ${rescheduleMessage}` : ""}`,
          type: "RESCHEDULE_REQUEST",
          link: "/admin/reservations",
        },
      });
      return NextResponse.json({ booking: updated });
    }

    case "cancel": {
      const wasPaid = ["PAID", "PENDING_ADMIN_VALIDATION", "CONFIRMED", "ASSIGNED", "PENDING_CLIENT_VALIDATION"].includes(
        booking.status
      );
      const updated = await db.booking.update({
        where: { id },
        data: {
          status: "CANCELLED",
          paymentStatus: wasPaid ? "REFUNDED" : booking.paymentStatus,
        },
      });
      if (wasPaid) {
        await db.transaction.create({
          data: {
            reference: `TX-REF-${Math.floor(1000 + Math.random() * 9000)}`,
            bookingId: id,
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
      await db.notification.create({
        data: {
          userId: null,
          title: "Réservation annulée",
          message: `Le client a annulé la réservation ${booking.reference}.${wasPaid ? " Remboursement à traiter." : ""}`,
          type: "BOOKING_CANCELLED",
          link: "/admin/reservations",
        },
      });
      return NextResponse.json({ booking: updated });
    }

    default:
      return NextResponse.json({ error: "Action inconnue" }, { status: 400 });
  }
}
