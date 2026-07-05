import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { generateReference } from "@/lib/format";
import { requireAdminApi } from "@/lib/admin-api";
import {
  hasRefundableClientFunds,
  hasVerifiedPayDunyaClientPayment,
} from "@/lib/payment-security";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdminApi();
  if (!admin) return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
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
  const admin = await requireAdminApi();
  if (!admin) return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
  const { id } = await params;
  const body = await req.json();
  const action: string = body.action;
  const resolution: string | undefined = body.resolution;

  const dispute = await db.dispute.findUnique({
    where: { id },
    include: {
      booking: {
        include: {
          teacher: { select: { id: true, fullName: true, professionalName: true } },
          client: { select: { id: true, name: true } },
          transactions: { where: { type: "CLIENT_PAYMENT" }, orderBy: { createdAt: "desc" } },
        },
      },
    },
  });
  if (!dispute) return NextResponse.json({ error: "Litige introuvable" }, { status: 404 });

  const adminUser = admin;
  const activeDispute = dispute;
  const now = new Date();
  const teacherName = activeDispute.booking.teacher.professionalName || activeDispute.booking.teacher.fullName;
  const decisionText = resolution?.trim() || activeDispute.resolution || "Décision enregistrée par le service client.";
  const verifiedClientPaymentExists = hasVerifiedPayDunyaClientPayment(activeDispute.booking);

  async function recordDecision(label: string, status: string, clientMessage: string) {
    await db.adminActionLog.create({
      data: {
        adminId: adminUser.id,
        action: label,
        entityType: "Dispute",
        entityId: activeDispute.id,
        detail: `${adminUser.name} a traité le litige ${activeDispute.booking.reference} (${activeDispute.reason}) concernant ${teacherName}. Décision : ${decisionText}`,
        oldStatus: activeDispute.status,
        newStatus: status,
      },
    });
    await db.notification.create({
      data: {
        userId: activeDispute.booking.client.id,
        title: label,
        message: clientMessage,
        type: "DISPUTE_DECISION",
        recipientType: "CLIENT",
        recipientName: activeDispute.booking.client.name,
        channel: "INTERNAL",
        status: "SENT",
        priority: status === "REFUNDED" ? "IMPORTANT" : "NORMAL",
        bookingId: activeDispute.bookingId,
        teacherId: activeDispute.booking.teacherId,
        clientId: activeDispute.booking.client.id,
        adminId: adminUser.id,
        sentAt: now,
        link: `/client/reservations/${activeDispute.bookingId}`,
        actionLabel: "Voir la réservation",
      },
    });
    await db.notification.create({
      data: {
        userId: null,
        title: label,
        message: `${label} pour ${activeDispute.booking.reference}. Professeur : ${teacherName}.`,
        type: "DISPUTE_DECISION",
        recipientType: "ADMIN",
        channel: "INTERNAL",
        status: "CONFIRMED",
        priority: "NORMAL",
        bookingId: activeDispute.bookingId,
        teacherId: activeDispute.booking.teacherId,
        clientId: activeDispute.booking.client.id,
        adminId: adminUser.id,
        sentAt: now,
        confirmedAt: now,
        read: true,
        readAt: now,
        link: `/admin/litiges/${activeDispute.id}`,
        actionLabel: "Voir litige",
      },
    });
  }

  try {
    switch (action) {
      case "investigate":
        await db.dispute.update({
          where: { id },
          data: { status: "INVESTIGATING", resolution: resolution ?? dispute.resolution },
        });
        await recordDecision(
          "Litige en investigation",
          "INVESTIGATING",
          `Bonjour ${dispute.booking.client.name}, votre litige sur la réservation ${dispute.booking.reference} est en cours d'investigation. Votre paiement reste sécurisé pendant le traitement.`
        );
        return NextResponse.json({ ok: true });
      case "resolve":
        if (!verifiedClientPaymentExists) {
          return NextResponse.json({
            error: "Impossible de libérer un paiement: aucun paiement client PayDunya vérifié n'existe pour cette réservation.",
          }, { status: 409 });
        }
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
        await recordDecision(
          "Litige résolu - paiement à libérer",
          "RESOLVED",
          `Bonjour ${dispute.booking.client.name}, votre litige sur ${dispute.booking.reference} est clôturé. Le service client a validé la suite du traitement selon la décision enregistrée.`
        );
        return NextResponse.json({ ok: true });
      case "refund": {
        if (!verifiedClientPaymentExists || !hasRefundableClientFunds(activeDispute.booking.paymentStatus)) {
          return NextResponse.json({
            error: "Impossible de rembourser: aucun paiement PayDunya remboursable n'est vérifié sur cette réservation.",
          }, { status: 409 });
        }
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
        await recordDecision(
          "Litige remboursé",
          "REFUNDED",
          `Bonjour ${dispute.booking.client.name}, votre litige sur ${dispute.booking.reference} a été traité avec remboursement. La décision est enregistrée dans votre réservation.`
        );
        return NextResponse.json({ ok: true });
      }
      case "reject":
        if (!verifiedClientPaymentExists) {
          return NextResponse.json({
            error: "Impossible de libérer un paiement: aucun paiement client PayDunya vérifié n'existe pour cette réservation.",
          }, { status: 409 });
        }
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
        await recordDecision(
          "Litige rejeté",
          "REJECTED",
          `Bonjour ${dispute.booking.client.name}, votre litige sur ${dispute.booking.reference} a été examiné et rejeté par le service client. La décision est disponible dans votre réservation.`
        );
        return NextResponse.json({ ok: true });
      default:
        return NextResponse.json({ error: "Action inconnue" }, { status: 400 });
    }
  } catch (e: any) {
    console.error("admin/dispute PATCH error", e);
    return NextResponse.json({ error: e.message || "Erreur serveur" }, { status: 500 });
  }
}
