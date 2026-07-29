import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { DisputeStatus, Prisma } from "@prisma/client";
import { hasVerifiedClientFunds, hasVerifiedPayDunyaClientPayment } from "@/lib/payment-security";
import { PAID_CLIENT_TRANSACTION_STATUSES } from "@/lib/cancellation-policy";
import { isBookingFinanciallyTerminal, isBookingRefundInProgressOrFinal } from "@/lib/booking-financial-state";
import {
  assertBookingRefundPayoutSafetyInTransaction,
  BookingRefundWorkflowError,
} from "@/lib/booking-refund-finalization";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  if ((session.user as any).role !== "CLIENT") {
    return NextResponse.json({ error: "Accès réservé aux clients." }, { status: 403 });
  }
  const userId = (session.user as any).id;

  const disputes = await db.dispute.findMany({
    where: { openedById: userId },
    orderBy: { createdAt: "desc" },
    include: {
      booking: {
        select: {
          id: true, reference: true, subjectName: true, levelName: true,
          teacher: { select: { id: true, fullName: true, professionalName: true, photoUrl: true } },
        },
      },
    },
  });

  return NextResponse.json({ items: disputes });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  const userId = (session.user as any).id;
  if ((session.user as any).role !== "CLIENT") {
    return NextResponse.json({ error: "Réservé aux clients" }, { status: 403 });
  }

  const body = await req.json();
  const { bookingId, reason, description } = body;
  const cleanReason = typeof reason === "string" ? reason.trim().slice(0, 180) : "";
  const cleanDescription = typeof description === "string" ? description.trim().slice(0, 2_000) : "";
  if (typeof bookingId !== "string" || !bookingId.trim() || !cleanReason || !cleanDescription) {
    return NextResponse.json({ error: "Champs requis manquants" }, { status: 400 });
  }

  const booking = await db.booking.findUnique({
    where: { id: bookingId },
    include: { transactions: { where: { type: "CLIENT_PAYMENT" }, orderBy: { createdAt: "desc" } } },
  });
  if (!booking) return NextResponse.json({ error: "Réservation introuvable" }, { status: 404 });
  if (booking.clientId !== userId) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }
  if (booking.status === "DISPUTED") {
    return NextResponse.json({ error: "Un litige est déjà ouvert sur cette réservation" }, { status: 400 });
  }
  if (isBookingFinanciallyTerminal(booking) || isBookingRefundInProgressOrFinal(booking)) {
    return NextResponse.json({ error: "Cette réservation est financièrement clôturée et ne peut plus être remise en litige." }, { status: 409 });
  }
  if (!hasVerifiedClientFunds(booking.paymentStatus) || !hasVerifiedPayDunyaClientPayment(booking)) {
    return NextResponse.json({
      error: "Un litige financier ne peut être ouvert qu'après confirmation serveur du paiement.",
    }, { status: 409 });
  }

  try {
    const dispute = await db.$transaction(async (tx) => {
      await assertBookingRefundPayoutSafetyInTransaction(tx, bookingId);
      const current = await tx.booking.findUnique({
        where: { id: bookingId },
        include: { transactions: { where: { type: "CLIENT_PAYMENT" }, orderBy: { createdAt: "desc" } } },
      });
      if (!current) {
        throw new BookingRefundWorkflowError("Réservation introuvable", 404, "BOOKING_NOT_FOUND");
      }
      if (current.clientId !== userId) {
        throw new BookingRefundWorkflowError("Accès refusé", 403, "BOOKING_ACCESS_DENIED");
      }
      if (current.status === "DISPUTED" || await tx.dispute.findFirst({
        where: { bookingId, status: { in: ["OPEN", "INVESTIGATING"] } },
        select: { id: true },
      })) {
        throw new BookingRefundWorkflowError(
          "Un litige est déjà ouvert sur cette réservation",
          409,
          "DISPUTE_ALREADY_OPEN",
        );
      }
      if (isBookingFinanciallyTerminal(current) || isBookingRefundInProgressOrFinal(current)) {
        throw new BookingRefundWorkflowError(
          "Cette réservation est financièrement clôturée et ne peut plus être remise en litige.",
          409,
          "BOOKING_FINANCIALLY_TERMINAL",
        );
      }
      if (!hasVerifiedClientFunds(current.paymentStatus) || !hasVerifiedPayDunyaClientPayment(current)) {
        throw new BookingRefundWorkflowError(
          "Un litige financier ne peut être ouvert qu'après confirmation serveur du paiement.",
          409,
          "CLIENT_PAYMENT_NOT_VERIFIED",
        );
      }

      const transitioned = await tx.booking.updateMany({
        where: { id: bookingId, status: current.status, paymentStatus: current.paymentStatus },
        data: { status: "DISPUTED", paymentStatus: "DISPUTED" },
      });
      if (transitioned.count !== 1) {
        throw new BookingRefundWorkflowError(
          "La réservation vient de changer. Rechargez-la avant d'ouvrir le litige.",
          409,
          "BOOKING_STATE_CONFLICT",
        );
      }
      await tx.transaction.updateMany({
        where: {
          bookingId,
          type: "CLIENT_PAYMENT",
          status: { in: [...PAID_CLIENT_TRANSACTION_STATUSES] },
        },
        data: { status: "DISPUTED" },
      });
      const created = await tx.dispute.create({
        data: {
          bookingId,
          openedById: userId,
          reason: cleanReason,
          description: cleanDescription,
          status: "OPEN" as DisputeStatus,
        },
      });
      await tx.notification.create({
        data: {
          userId: null,
          title: "Litige ouvert",
          message: `Litige ouvert sur ${current.reference}. Raison: ${cleanReason}. Paiement bloqué en attente de résolution.`,
          type: "DISPUTE_OPENED",
          link: `/admin/litiges/${created.id}`,
          actionLabel: "Traiter litige",
        },
      });
      return created;
    }, { isolationLevel: "Serializable" });

    return NextResponse.json({ dispute }, { status: 201 });
  } catch (error) {
    if (error instanceof BookingRefundWorkflowError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") {
      return NextResponse.json({
        error: "La réservation vient de changer. Rechargez-la avant d'ouvrir le litige.",
        code: "DISPUTE_SERIALIZATION_CONFLICT",
      }, { status: 409 });
    }
    console.error("client/disputes POST error", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
