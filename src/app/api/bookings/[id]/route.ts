import { randomBytes } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { DisputeStatus } from "@prisma/client";
import { generateReference } from "@/lib/format";
import { PAID_CLIENT_TRANSACTION_STATUSES, cancellationPolicySummary, getCancellationPenaltySplit, getCancellationPolicy } from "@/lib/cancellation-policy";
import { PLATFORM_COMMISSION_PERCENT, TEACHER_PERCENT, parsePricingSnapshot, pricingSnapshotToJson } from "@/lib/pricing";
import { createPayDunyaCheckoutInvoice, createPayDunyaRescheduleFeeInvoice, getPayDunyaPublicBaseUrl } from "@/lib/paydunya";
import { reconcilePayDunyaBookingPayment } from "@/lib/paydunya-reconciliation";
import { createRescheduleAwaitingTeacherNotifications, reconcilePayDunyaReschedulePayment } from "@/lib/paydunya-reschedule-reconciliation";
import { isActivePaymentMethod, paymentMethodLabel } from "@/lib/payment-methods";
import { findReplacementCandidatesForBooking } from "@/lib/teacher-replacement-matching";
import { absoluteAppUrl } from "@/lib/public-url";
import { getReschedulePolicy, reschedulePolicySummary } from "@/lib/reschedule-policy";
import {
  hasVerifiedClientFunds,
  hasVerifiedPayDunyaClientPayment,
  isPaymentReadyForCourseProgressWithProof,
  PAYDUNYA_PROOF_REQUIRED_ERROR,
  requiresVerifiedPayDunyaForOperationalAction,
} from "@/lib/payment-security";

function parsePreferredDays(value?: string | null) {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function publicBookingDetailPayload(booking: any) {
  const pricingSnapshot = parsePricingSnapshot(booking.pricingSnapshot);
  const unitSessionAmount = pricingSnapshot?.unitSessionAmount ?? booking.unitPrice;
  const courseAmount = pricingSnapshot?.courseAmount ?? booking.courseAmount;
  const totalClientPays = pricingSnapshot?.totalClientPays ?? booking.totalClientPays ?? booking.totalPrice;
  const verifiedClientPayment = hasVerifiedPayDunyaClientPayment(booking);
  return {
    id: booking.id,
    reference: booking.reference,
    clientId: booking.clientId,
    teacherId: booking.teacherId,
    subjectName: booking.subjectName,
    levelName: booking.levelName,
    objective: booking.objective,
    schoolProgram: booking.schoolProgram,
    needDescription: booking.needDescription,
    courseFormat: booking.courseFormat,
    groupType: booking.groupType,
    participantsCount: booking.participantsCount,
    commune: booking.commune,
    quartier: booking.quartier,
    addressHint: booking.addressHint,
    onlineLink: booking.onlineLink,
    preferredDays: parsePreferredDays(booking.preferredDays),
    preferredTime: booking.preferredTime,
    startDate: booking.startDate,
    scheduledDate: booking.scheduledDate,
    scheduledTime: booking.scheduledTime,
    sessionsCount: booking.sessionsCount,
    packType: booking.packType,
    message: booking.message,
    unitPrice: unitSessionAmount,
    totalPrice: totalClientPays,
    priceTierKey: booking.priceTierKey,
    courseAmount,
    transportFee: pricingSnapshot?.transportFee ?? booking.transportFee,
    transportFeeKey: booking.transportFeeKey,
    transportFeeLabel: pricingSnapshot?.transportFeeLabel ?? null,
    transportRouteLabel: pricingSnapshot?.transportRouteLabel ?? null,
    transportRuleLabel: pricingSnapshot?.transportRuleLabel ?? null,
    materialFee: pricingSnapshot?.materialFee ?? booking.materialFee,
    discountAmount: pricingSnapshot?.discountAmount ?? booking.discountAmount,
    paymentServiceFeeRate: pricingSnapshot?.paymentServiceFeeRate ?? booking.paymentServiceFeeRate ?? 0,
    paymentServiceFeeAmount: pricingSnapshot?.paymentServiceFeeAmount ?? booking.paymentServiceFeeAmount ?? 0,
    paymentServiceFeeLabel: pricingSnapshot?.paymentServiceFeeLabel ?? booking.paymentServiceFeeLabel ?? null,
    totalBeforePaymentServiceFee: pricingSnapshot?.totalBeforePaymentServiceFee
      ?? Math.max(0, totalClientPays - (pricingSnapshot?.paymentServiceFeeAmount ?? booking.paymentServiceFeeAmount ?? 0)),
    totalClientPays,
    isQuoteOnly: booking.isQuoteOnly,
    status: booking.status,
    paymentStatus: booking.paymentStatus,
    paymentMethod: booking.paymentMethod,
    cancellationWindow: booking.cancellationWindow,
    cancellationFeeRate: booking.cancellationFeeRate,
    cancellationFeeAmount: booking.cancellationFeeAmount,
    cancellationPenaltyTeacherRate: booking.cancellationPenaltyTeacherRate,
    cancellationPenaltyTeacherAmount: booking.cancellationPenaltyTeacherAmount,
    cancellationPenaltyPlatformRate: booking.cancellationPenaltyPlatformRate,
    cancellationPenaltyPlatformAmount: booking.cancellationPenaltyPlatformAmount,
    cancellationRefundAmount: booking.cancellationRefundAmount,
    cancellationReason: booking.cancellationReason,
    cancellationDetail: booking.cancellationDetail,
    cancelledAt: booking.cancelledAt,
    createdAt: booking.createdAt,
    confirmedAt: booking.confirmedAt,
    assignedAt: booking.assignedAt,
    courseDoneAt: booking.courseDoneAt,
    clientValidatedAt: booking.clientValidatedAt,
    teacherPaidAt: booking.teacherPaidAt,
    teacher: booking.teacher,
    client: booking.client,
    reviews: booking.reviews,
    disputes: booking.disputes,
    clientRefundRequests: Array.isArray(booking.clientRefundRequests)
      ? booking.clientRefundRequests.map((request: any) => ({
          id: request.id,
          reference: request.reference,
          amount: request.amount,
          paymentServiceFeeNonRefunded: request.paymentServiceFeeNonRefunded,
          method: request.method,
          paymentPhone: request.paymentPhone,
          accountName: request.accountName,
          note: request.note,
          status: request.status,
          processedAt: request.processedAt,
          externalReference: request.externalReference,
          createdAt: request.createdAt,
        }))
      : [],
    scheduleProposals: Array.isArray(booking.scheduleProposals)
      ? booking.scheduleProposals.map((proposal: any) => ({
          id: proposal.id,
          bookingId: proposal.bookingId,
          teacherId: proposal.teacherId,
          proposedDate: proposal.proposedDate,
          proposedTime: proposal.proposedTime,
          reason: proposal.reason,
          status: proposal.status,
          clientResponse: proposal.clientResponse,
          createdAt: proposal.createdAt,
          respondedAt: proposal.respondedAt,
          teacher: proposal.teacher,
        }))
      : [],
    transactions: Array.isArray(booking.transactions)
      ? booking.transactions
          .filter((transaction: any) => (
            transaction.type === "REFUND"
            || (transaction.type === "CLIENT_PAYMENT" && verifiedClientPayment)
          ))
          .map((transaction: any) => ({
            id: transaction.id,
            reference: transaction.reference,
            amount: transaction.amount,
            type: transaction.type,
            status: transaction.status,
            method: transaction.method,
            paidAt: transaction.paidAt,
            createdAt: transaction.createdAt,
          }))
      : [],
  };
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  const userId = (session.user as any).id;
  const role = (session.user as any).role;
  if (role !== "CLIENT" && role !== "ADMIN") {
    return NextResponse.json({ error: "Accès réservé aux clients et à l'équipe Compétence." }, { status: 403 });
  }
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
      clientRefundRequests: { orderBy: { createdAt: "desc" } },
      scheduleProposals: {
        orderBy: { createdAt: "desc" },
        include: {
          teacher: { select: { id: true, fullName: true, professionalName: true, photoUrl: true } },
        },
      },
    },
  });

  if (!booking) return NextResponse.json({ error: "Réservation introuvable" }, { status: 404 });

  if (role !== "ADMIN" && booking.clientId !== userId) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  if (role === "ADMIN") {
    return NextResponse.json({
      ...booking,
      preferredDays: parsePreferredDays(booking.preferredDays),
    });
  }

  return NextResponse.json(publicBookingDetailPayload(booking));
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  const userId = (session.user as any).id;
  if ((session.user as any).role !== "CLIENT") {
    return NextResponse.json({ error: "Action réservée au client propriétaire de la réservation." }, { status: 403 });
  }
  const { id } = await params;

  const booking = await db.booking.findUnique({
    where: { id },
    include: {
      transactions: { where: { type: "CLIENT_PAYMENT" }, orderBy: { createdAt: "desc" } },
      teacher: { select: { id: true, fullName: true, professionalName: true } },
      client: { select: { id: true, name: true, email: true, phone: true } },
    },
  });
  if (!booking) return NextResponse.json({ error: "Réservation introuvable" }, { status: 404 });
  if (booking.clientId !== userId) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const body = await req.json();
  const {
    action,
    reason,
    description,
    rescheduleMessage,
    rescheduleDate,
    rescheduleTime,
    rescheduleRequestId,
    proposalId,
    replacementId,
    clientResponse,
  } = body;

  const now = new Date();

  switch (action) {
    case "paydunya_checkout": {
      if (booking.isQuoteOnly) {
        return NextResponse.json({ error: "Cette réservation nécessite un contrôle du prix. Le paiement sera disponible après validation du service client." }, { status: 400 });
      }
      if (booking.status !== "PENDING_PAYMENT" || booking.paymentStatus !== "FAILED") {
        return NextResponse.json({ error: "Cette réservation n'est pas en attente de paiement PayDunya." }, { status: 400 });
      }

      const reusablePayDunyaStatus = (booking.paydunyaStatus ?? "").toUpperCase();
      const canReusePayDunyaCheckout = Boolean(
        booking.paydunyaCheckoutUrl
        && !["COMPLETED", "FAILED", "CANCELLED", "CANCELED", "REJECTED", "CREATE_FAILED"].includes(reusablePayDunyaStatus)
      );
      if (canReusePayDunyaCheckout) {
        return NextResponse.json({
          payment: {
            provider: "PAYDUNYA",
            configured: true,
            checkoutUrl: booking.paydunyaCheckoutUrl,
            status: booking.paydunyaStatus ?? "PENDING",
            message: "Lien PayDunya existant réutilisé.",
          },
        });
      }

      const detailedBooking = await db.booking.findUnique({
        where: { id },
        include: {
          client: { select: { id: true, name: true, email: true, phone: true } },
          teacher: { select: { id: true, fullName: true, professionalName: true } },
        },
      });
      if (!detailedBooking) {
        return NextResponse.json({ error: "Réservation introuvable" }, { status: 404 });
      }

      const pricingSnapshot = parsePricingSnapshot(detailedBooking.pricingSnapshot);
      let payment: Awaited<ReturnType<typeof createPayDunyaCheckoutInvoice>>;
      try {
        payment = await createPayDunyaCheckoutInvoice({
          origin: getPayDunyaPublicBaseUrl(req),
          booking: {
            id: detailedBooking.id,
            reference: detailedBooking.reference,
            subjectName: detailedBooking.subjectName,
            levelName: detailedBooking.levelName,
            sessionsCount: pricingSnapshot?.numberOfSessions ?? detailedBooking.sessionsCount,
            totalClientPays: pricingSnapshot?.totalClientPays ?? detailedBooking.totalClientPays ?? detailedBooking.totalPrice,
            courseAmount: pricingSnapshot?.courseAmount ?? detailedBooking.courseAmount,
            transportFee: pricingSnapshot?.transportFee ?? detailedBooking.transportFee,
            paymentServiceFeeAmount: pricingSnapshot?.paymentServiceFeeAmount ?? detailedBooking.paymentServiceFeeAmount,
            paymentServiceFeeLabel: pricingSnapshot?.paymentServiceFeeLabel ?? detailedBooking.paymentServiceFeeLabel,
          },
          client: {
            id: detailedBooking.client.id,
            name: detailedBooking.client.name,
            email: detailedBooking.client.email,
            phone: detailedBooking.client.phone,
          },
          teacher: {
            id: detailedBooking.teacher.id,
            name: detailedBooking.teacher.professionalName || detailedBooking.teacher.fullName,
          },
        });
      } catch (error: any) {
        const errorMessage = error?.message || "PayDunya a refusé la création du lien de paiement.";
        await db.booking.update({
          where: { id: booking.id },
          data: {
            paydunyaStatus: "CREATE_FAILED",
            paydunyaFailureReason: errorMessage,
            paydunyaLastCheckedAt: new Date(),
            paydunyaLastPayload: errorMessage,
          },
        });
        return NextResponse.json({
          error: errorMessage,
          payment: {
            provider: "PAYDUNYA",
            configured: true,
            checkoutUrl: null,
          },
        }, { status: 503 });
      }

      if (!payment.configured || !payment.checkoutUrl) {
        await db.booking.update({
          where: { id: booking.id },
          data: {
            paydunyaStatus: payment.configured ? "CREATE_FAILED" : "NOT_CONFIGURED",
            paydunyaFailureReason: payment.configured
              ? "PayDunya n'a pas retourné de lien de paiement."
              : "PayDunya n'est pas encore configuré sur cette installation.",
            paydunyaLastCheckedAt: new Date(),
            paydunyaLastPayload: compactPayDunyaCreatePayload(payment.raw ?? payment.responseText),
          },
        });
        return NextResponse.json({
          error: payment.configured
            ? "PayDunya n'a pas retourné de lien de paiement."
            : "PayDunya n'est pas encore configuré sur cette installation.",
          payment: {
            provider: "PAYDUNYA",
            configured: payment.configured,
            checkoutUrl: payment.checkoutUrl,
          },
        }, { status: 503 });
      }

      await db.booking.update({
        where: { id: booking.id },
        data: {
          paydunyaToken: payment.token,
          paydunyaCheckoutUrl: payment.checkoutUrl,
          paydunyaStatus: "PENDING",
          paydunyaFailureReason: null,
          paydunyaLastCheckedAt: new Date(),
          paydunyaLastPayload: compactPayDunyaCreatePayload(payment.raw ?? payment.responseText),
        },
      });

      await db.adminActionLog.create({
        data: {
          adminId: null,
          action: "Relance paiement PayDunya",
          entityType: "Booking",
          entityId: booking.id,
          detail: `Le client a demandé un nouveau lien PayDunya pour ${booking.reference}. Référence PayDunya créée côté serveur.`,
          oldStatus: booking.paymentStatus,
          newStatus: "PAYDUNYA_CHECKOUT_CREATED",
        },
      });

      return NextResponse.json({
        payment: {
          provider: "PAYDUNYA",
          configured: payment.configured,
          checkoutUrl: payment.checkoutUrl,
        },
      });
    }

    case "paydunya_verify": {
      if (booking.isQuoteOnly) {
        return NextResponse.json({ error: "Cette réservation nécessite un contrôle du prix et ne possède pas de paiement PayDunya à vérifier." }, { status: 400 });
      }
      const result = await reconcilePayDunyaBookingPayment({
        bookingId: booking.id,
        expectedClientId: userId,
        source: "client_manual",
      });
      const statusCode = result.action === "not_configured"
        ? 503
        : result.action === "rejected"
          ? 409
          : 200;
      return NextResponse.json({
        payment: {
          provider: "PAYDUNYA",
          verified: result.verified,
          status: result.status,
          action: result.action,
          message: result.message,
          checkoutUrl: result.verified ? null : result.checkoutUrl,
        },
      }, { status: statusCode });
    }

    case "confirm": {
      if (booking.status !== "PENDING_CLIENT_VALIDATION") {
        return NextResponse.json({ error: "Action non autorisée pour ce statut" }, { status: 400 });
      }
      if (!isPaymentReadyForCourseProgressWithProof(booking)) {
        return NextResponse.json({
          error: "Impossible de confirmer ce cours: le paiement PayDunya n'est pas vérifié et bloqué.",
        }, { status: 409 });
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
          recipientType: "ADMIN",
          channel: "INTERNAL",
          status: "SENT",
          priority: "IMPORTANT",
          bookingId: booking.id,
          teacherId: booking.teacherId,
          clientId: booking.clientId,
          sentAt: now,
          link: "/admin/paiements-a-liberer",
          actionLabel: "Libérer paiement",
        },
      });
      return NextResponse.json({ booking: publicBookingDetailPayload(updated) });
    }

    case "accept_schedule_proposal":
    case "reject_schedule_proposal": {
      if (requiresVerifiedPayDunyaForOperationalAction(booking)) {
        return NextResponse.json({ error: PAYDUNYA_PROOF_REQUIRED_ERROR }, { status: 409 });
      }
      if (typeof proposalId !== "string" || !proposalId) {
        return NextResponse.json({ error: "Proposition de créneau introuvable." }, { status: 400 });
      }
      const proposal = await db.bookingScheduleProposal.findUnique({
        where: { id: proposalId },
        include: { teacher: true },
      });
      if (!proposal || proposal.bookingId !== booking.id || proposal.teacherId !== booking.teacherId) {
        return NextResponse.json({ error: "Cette proposition ne correspond pas à votre réservation." }, { status: 404 });
      }
      if (proposal.status !== "PENDING") {
        return NextResponse.json({ error: "Cette proposition a déjà été traitée." }, { status: 409 });
      }
      const cleanClientResponse = typeof clientResponse === "string" ? clientResponse.trim().slice(0, 700) : "";
      const teacherName = proposal.teacher.professionalName || proposal.teacher.fullName;
      const formattedDate = proposal.proposedDate.toLocaleDateString("fr-FR", {
        weekday: "long",
        day: "2-digit",
        month: "long",
        year: "numeric",
      });

      if (action === "accept_schedule_proposal") {
        await db.$transaction(async (tx) => {
          await tx.bookingScheduleProposal.update({
            where: { id: proposal.id },
            data: {
              status: "ACCEPTED",
              clientResponse: cleanClientResponse || "Créneau accepté par le client.",
              respondedAt: now,
            },
          });
          await tx.booking.update({
            where: { id: booking.id },
            data: {
              scheduledDate: proposal.proposedDate,
              startDate: proposal.proposedDate,
              scheduledTime: proposal.proposedTime,
              preferredTime: proposal.proposedTime,
              status: ["PAID", "PENDING_ADMIN_VALIDATION", "CONFIRMED", "ASSIGNED"].includes(booking.status)
                ? "ASSIGNED"
                : booking.status,
              assignedAt: booking.assignedAt ?? now,
            },
          });
          await tx.notification.create({
            data: {
              userId: null,
              title: "Créneau accepté par le client",
              message: `${booking.client.name} a accepté le créneau proposé par ${teacherName} pour ${booking.reference}: ${formattedDate} à ${proposal.proposedTime}.`,
              type: "CLIENT_ACCEPTED_RESCHEDULE",
              recipientType: "ADMIN",
              channel: "INTERNAL",
              status: "CONFIRMED",
              priority: "IMPORTANT",
              bookingId: booking.id,
              teacherId: booking.teacherId,
              clientId: booking.clientId,
              sentAt: now,
              confirmedAt: now,
              response: cleanClientResponse || null,
              link: `/admin/reservations/${booking.id}`,
              actionLabel: "Voir réservation",
            },
          });
          await tx.notification.create({
            data: {
              userId: booking.clientId,
              title: "Nouveau créneau confirmé",
              message: `Votre cours avec ${teacherName} est désormais prévu le ${formattedDate} à ${proposal.proposedTime}.`,
              type: "RESCHEDULE_ACCEPTED",
              recipientType: "CLIENT",
              channel: "INTERNAL",
              status: "CONFIRMED",
              priority: "IMPORTANT",
              bookingId: booking.id,
              teacherId: booking.teacherId,
              clientId: booking.clientId,
              sentAt: now,
              confirmedAt: now,
              link: `/client/reservations/${booking.id}`,
              actionLabel: "Voir réservation",
            },
          });
          await tx.teacherNotification.create({
            data: {
              teacherId: booking.teacherId,
              bookingId: booking.id,
              title: `Créneau accepté - ${booking.reference}`,
              message: `Le client a accepté votre proposition.\nDate: ${formattedDate}\nHeure: ${proposal.proposedTime}${cleanClientResponse ? `\nMessage client: ${cleanClientResponse}` : ""}`,
              channel: "PRIVATE_LINK",
              sent: true,
              status: "CONFIRMED",
              readAt: now,
            },
          });
          await tx.teacherTask.updateMany({
            where: {
              teacherId: booking.teacherId,
              bookingId: booking.id,
              type: "ADMIN_ACTION",
              title: { contains: "Créneau proposé" },
              status: { in: ["TODO", "SENT_TO_TEACHER", "LATE"] },
            },
            data: { status: "DONE", completedAt: now },
          });
          await tx.adminActionLog.create({
            data: {
              action: "Créneau professeur accepté",
              entityType: "BookingScheduleProposal",
              entityId: proposal.id,
              detail: `${booking.client.name} a accepté ${formattedDate} à ${proposal.proposedTime} pour ${booking.reference}.`,
              oldStatus: "PENDING",
              newStatus: "ACCEPTED",
            },
          });
        });
        return NextResponse.json({ ok: true });
      }

      await db.$transaction(async (tx) => {
        await tx.bookingScheduleProposal.update({
          where: { id: proposal.id },
          data: {
            status: "REJECTED",
            clientResponse: cleanClientResponse || "Créneau refusé par le client.",
            respondedAt: now,
          },
        });
        await tx.notification.create({
          data: {
            userId: null,
            title: "Créneau refusé par le client",
            message: `${booking.client.name} a refusé le créneau proposé par ${teacherName} pour ${booking.reference}. Remplacement ou annulation par le service client à décider.`,
            type: "CLIENT_REJECTED_RESCHEDULE",
            recipientType: "ADMIN",
            channel: "INTERNAL",
            status: "SENT",
            priority: "CRITICAL",
            bookingId: booking.id,
            teacherId: booking.teacherId,
            clientId: booking.clientId,
            sentAt: now,
            response: cleanClientResponse || null,
            link: `/admin/reservations/${booking.id}?action=replace`,
            actionLabel: "Remplacer ou annuler",
            actionType: "REPLACE_TEACHER",
          },
        });
        await tx.notification.create({
          data: {
            userId: booking.clientId,
            title: "Créneau refusé",
            message: "Votre refus est transmis au service client. Vous pourrez choisir un autre professeur ou un autre créneau selon les options proposées.",
            type: "RESCHEDULE_REJECTED",
            recipientType: "CLIENT",
            channel: "INTERNAL",
            status: "SENT",
            priority: "IMPORTANT",
            bookingId: booking.id,
            teacherId: booking.teacherId,
            clientId: booking.clientId,
            sentAt: now,
            link: `/client/reservations/${booking.id}`,
            actionLabel: "Voir réservation",
          },
        });
        await tx.teacherNotification.create({
          data: {
            teacherId: booking.teacherId,
            bookingId: booking.id,
            title: `Créneau refusé - ${booking.reference}`,
            message: `Le client a refusé le créneau proposé (${formattedDate}, ${proposal.proposedTime}). Le service client décidera remplacement, annulation ou nouveau créneau.${cleanClientResponse ? `\nMessage client: ${cleanClientResponse}` : ""}`,
            channel: "PRIVATE_LINK",
            sent: true,
            status: "SENT",
            readAt: now,
          },
        });
        await tx.teacherTask.create({
          data: {
            teacherId: booking.teacherId,
            bookingId: booking.id,
            type: "ADMIN_ACTION",
            title: `Décision requise - créneau refusé ${booking.reference}`,
            description: `Le client a refusé la proposition de ${teacherName}. Décider: remplacer le professeur, proposer un nouveau créneau ou confirmer l'annulation au client.`,
            priority: "CRITICAL",
            status: "TODO",
            dueAt: now,
          },
        });
        await tx.adminActionLog.create({
          data: {
            action: "Créneau professeur refusé",
            entityType: "BookingScheduleProposal",
            entityId: proposal.id,
            detail: `${booking.client.name} a refusé ${formattedDate} à ${proposal.proposedTime} pour ${booking.reference}. ${cleanClientResponse || ""}`.trim(),
            oldStatus: "PENDING",
            newStatus: "REJECTED",
          },
        });
      });
      return NextResponse.json({ ok: true });
    }

    case "accept_replacement_proposal":
    case "reject_replacement_proposal": {
      if (requiresVerifiedPayDunyaForOperationalAction(booking)) {
        return NextResponse.json({ error: PAYDUNYA_PROOF_REQUIRED_ERROR }, { status: 409 });
      }
      if (typeof replacementId !== "string" || !replacementId) {
        return NextResponse.json({ error: "Proposition de professeur introuvable." }, { status: 400 });
      }
      const replacement = await db.teacherReplacement.findUnique({
        where: { id: replacementId },
        include: { oldTeacher: true, newTeacher: true },
      });
      if (!replacement || replacement.bookingId !== booking.id) {
        return NextResponse.json({ error: "Cette proposition ne correspond pas à votre réservation." }, { status: 404 });
      }
      if (!["DRAFT", "CLIENT_NOTIFIED"].includes(replacement.status)) {
        return NextResponse.json({ error: "Cette proposition a déjà été traitée." }, { status: 409 });
      }
      if (booking.teacherId !== replacement.oldTeacherId) {
        return NextResponse.json({ error: "Le professeur de la réservation a déjà changé." }, { status: 409 });
      }
      const cleanClientResponse = typeof clientResponse === "string" ? clientResponse.trim().slice(0, 700) : "";
      const oldTeacherName = replacement.oldTeacher.professionalName || replacement.oldTeacher.fullName;
      const newTeacherName = replacement.newTeacher.professionalName || replacement.newTeacher.fullName;

      if (action === "reject_replacement_proposal") {
        await db.$transaction(async (tx) => {
          await tx.teacherReplacement.update({
            where: { id: replacement.id },
            data: {
              status: "CANCELLED",
              details: `${replacement.details || ""}\nClient a refusé la proposition.${cleanClientResponse ? ` Motif: ${cleanClientResponse}` : ""}`.trim(),
            },
          });
          await tx.notification.create({
            data: {
              userId: null,
              title: "Remplaçant automatique refusé",
              message: `${booking.client.name} a refusé ${newTeacherName} pour ${booking.reference}. Le service client doit proposer un autre professeur, un autre créneau ou confirmer l'annulation/remboursement.`,
              type: "AUTO_REPLACEMENT_REJECTED",
              recipientType: "ADMIN",
              channel: "INTERNAL",
              status: "SENT",
              priority: "CRITICAL",
              bookingId: booking.id,
              teacherId: replacement.newTeacherId,
              clientId: booking.clientId,
              sentAt: now,
              response: cleanClientResponse || null,
              link: `/admin/reservations/${booking.id}?action=replace`,
              actionLabel: "Proposer une solution",
              actionType: "REPLACE_TEACHER",
            },
          });
          await tx.notification.create({
            data: {
              userId: booking.clientId,
              title: "Proposition refusée",
              message: "Votre refus est transmis au service client. Nous vous proposerons un autre professeur, un autre créneau ou une solution de remboursement selon votre dossier.",
              type: "AUTO_REPLACEMENT_REJECTED",
              recipientType: "CLIENT",
              recipientName: booking.client.name,
              channel: "INTERNAL",
              status: "SENT",
              priority: "IMPORTANT",
              bookingId: booking.id,
              teacherId: replacement.newTeacherId,
              clientId: booking.clientId,
              sentAt: now,
              link: `/client/reservations/${booking.id}`,
              actionLabel: "Voir réservation",
            },
          });
          await tx.clientCommunication.create({
            data: {
              clientId: booking.clientId,
              bookingId: booking.id,
              type: "TEACHER_CHANGE",
              channel: "INTERNAL",
              subject: `Proposition professeur refusée - ${booking.reference}`,
              content: `Vous avez refusé ${newTeacherName}. Le service client reprend le dossier pour proposer une autre solution.`,
              priority: "IMPORTANT",
              status: "SENT",
            },
          });
          await tx.teacherTask.create({
            data: {
              teacherId: booking.teacherId,
              bookingId: booking.id,
              type: "ADMIN_ACTION",
              title: `Remplacement refusé par client ${booking.reference}`,
              description: `Le client a refusé ${newTeacherName}. Action requise: proposer un autre professeur, proposer un autre créneau ou confirmer l'annulation/remboursement.`,
              priority: "CRITICAL",
              status: "TODO",
              dueAt: now,
            },
          });
          await tx.adminActionLog.create({
            data: {
              action: "Remplacement automatique refusé",
              entityType: "TeacherReplacement",
              entityId: replacement.id,
              detail: `${booking.client.name} a refusé ${newTeacherName} pour ${booking.reference}. ${cleanClientResponse || ""}`.trim(),
              oldStatus: "CLIENT_NOTIFIED",
              newStatus: "CANCELLED",
            },
          });
        });
        return NextResponse.json({ ok: true });
      }

      const candidateResult = await findReplacementCandidatesForBooking(booking.id, 30);
      const candidate = candidateResult.items.find((item) => item.teacher.id === replacement.newTeacherId);
      if (!candidate) {
        return NextResponse.json({
          error: "Ce professeur n'est plus disponible ou ne répond plus aux critères. Le service client va proposer une autre solution.",
        }, { status: 409 });
      }

      const dateLabel = booking.scheduledDate?.toLocaleDateString("fr-FR") ?? "À confirmer";
      const timeLabel = booking.scheduledTime || booking.preferredTime || "À confirmer";
      const formatLabel = booking.courseFormat === "ONLINE" ? "En ligne" : "À domicile";
      const locationLabel = booking.courseFormat === "ONLINE"
        ? (booking.onlineLink || "Lien en ligne à confirmer")
        : [booking.commune, booking.quartier, booking.addressHint].filter(Boolean).join(" / ") || "Adresse à confirmer";
      const nextCommission = booking.commissionAmount || Math.round(((booking.courseAmount || 0) * PLATFORM_COMMISSION_PERCENT) / 100);
      const nextTeacherCoursePayout = candidate.teacherCourseShare;
      const nextTransportFee = candidate.transportFee;
      const nextNet = candidate.netAmount;
      const financialImpact = nextNet - booking.teacherNetAmount;
      const existingSnapshot = parsePricingSnapshot(booking.pricingSnapshot);
      const nextPricingSnapshot = existingSnapshot
        ? pricingSnapshotToJson({
            ...existingSnapshot,
            transportFee: nextTransportFee,
            transportFeeLabel: candidate.transportFee > 0 ? "Déplacement remplaçant" : existingSnapshot.transportFeeLabel,
            transportRouteLabel: candidate.transportRouteLabel ?? existingSnapshot.transportRouteLabel,
            transportRuleLabel: candidate.transportRuleLabel ?? existingSnapshot.transportRuleLabel,
            totalTeacherReceives: nextNet,
            isQuoteOnly: false,
          })
        : booking.pricingSnapshot;
      const missionToken = randomBytes(32).toString("hex");
      const missionUrl = `/mission/${missionToken}`;
      const absoluteMissionUrl = absoluteAppUrl(missionUrl, req);
      const missionExpiresAt = new Date(now.getTime() + 48 * 60 * 60 * 1000);
      const clientMessage = [
        `Bonjour ${booking.client.name},`,
        "",
        `Vous avez accepté ${newTeacherName} pour remplacer ${oldTeacherName} sur votre cours de ${booking.subjectName}.`,
        `Date : ${dateLabel}`,
        `Heure : ${timeLabel}`,
        `Format : ${formatLabel}`,
        "",
        "Votre réservation reste confirmée et votre paiement reste sécurisé.",
      ].join("\n");
      const oldTeacherMessage = [
        `Bonjour ${oldTeacherName},`,
        "",
        "Vous avez été retiré de la réservation suivante :",
        `Client : ${booking.client.name}`,
        `Cours : ${booking.subjectName}`,
        `Niveau : ${booking.levelName}`,
        `Date : ${dateLabel}`,
        `Heure : ${timeLabel}`,
        "",
        "Merci de contacter le service client si nécessaire.",
      ].join("\n");
      const newTeacherMessage = [
        `Bonjour ${newTeacherName},`,
        "",
        "Un cours vous a été attribué en remplacement après acceptation du client.",
        `Client : ${booking.client.name}`,
        `Contact : ${booking.client.phone ?? "à confirmer par le service client"}`,
        `Cours : ${booking.subjectName}`,
        `Niveau : ${booking.levelName}`,
        `Date : ${dateLabel}`,
        `Heure : ${timeLabel}`,
        `Lieu : ${locationLabel}`,
        `Format : ${formatLabel}`,
        candidate.transportRouteLabel ? `Trajet : ${candidate.transportRouteLabel}` : "",
        nextTransportFee > 0 ? `Frais déplacement : ${nextTransportFee.toLocaleString("fr-FR")} FCFA` : "",
        `Montant net à recevoir : ${nextNet.toLocaleString("fr-FR")} FCFA`,
        "",
        `Lien mission sécurisé : ${absoluteMissionUrl}`,
        "",
        "Merci de confirmer rapidement votre disponibilité.",
      ].filter(Boolean).join("\n");

      await db.$transaction(async (tx) => {
        await tx.booking.update({
          where: { id: booking.id },
          data: {
            teacherId: replacement.newTeacherId,
            status: ["PAID", "PENDING_ADMIN_VALIDATION", "CONFIRMED", "ASSIGNED"].includes(booking.status) ? "ASSIGNED" : booking.status,
            assignedAt: booking.assignedAt ?? now,
            commissionRate: PLATFORM_COMMISSION_PERCENT,
            commissionAmount: nextCommission,
            teacherRate: TEACHER_PERCENT,
            teacherPayoutAmount: nextTeacherCoursePayout,
            transportFee: nextTransportFee,
            totalTeacherReceives: nextNet,
            teacherNetAmount: nextNet,
            pricingSnapshot: nextPricingSnapshot,
          },
        });
        await tx.transaction.updateMany({
          where: { bookingId: booking.id, type: "CLIENT_PAYMENT" },
          data: {
            teacherId: replacement.newTeacherId,
            commission: nextCommission,
            teacherNet: nextNet,
          },
        });
        await tx.teacherReplacement.update({
          where: { id: replacement.id },
          data: {
            financialImpact,
            clientMessage,
            oldTeacherMessage,
            newTeacherMessage,
            status: "APPLIED",
            appliedAt: now,
          },
        });
        await tx.teacherTask.updateMany({
          where: {
            teacherId: replacement.oldTeacherId,
            bookingId: booking.id,
            status: { notIn: ["DONE", "CANCELLED"] },
            type: { not: "ADMIN_ACTION" },
          },
          data: { status: "CANCELLED", completedAt: now },
        });
        await tx.teacherMissionLink.updateMany({
          where: {
            teacherId: replacement.oldTeacherId,
            bookingId: booking.id,
            status: { in: ["PENDING_CONFIRMATION", "RELAUNCHED"] },
          },
          data: { status: "EXPIRED" },
        });
        await tx.teacherNotification.createMany({
          data: [
            {
              teacherId: replacement.oldTeacherId,
              bookingId: booking.id,
              title: `Retrait de réservation ${booking.reference}`,
              message: oldTeacherMessage,
              channel: "INTERNAL",
              sent: true,
              status: "SENT",
            },
            {
              teacherId: replacement.newTeacherId,
              bookingId: booking.id,
              title: `Cours attribué en remplacement ${booking.reference}`,
              message: newTeacherMessage,
              channel: "PRIVATE_LINK",
              sent: true,
              status: "SENT",
            },
          ],
        });
        await tx.teacherTask.create({
          data: {
            teacherId: replacement.newTeacherId,
            bookingId: booking.id,
            type: "CONFIRM_AVAILABILITY",
            title: "Confirmer le remplacement",
            description: `Confirmer la disponibilité pour la réservation ${booking.reference}.`,
            priority: "URGENT",
            status: "SENT_TO_TEACHER",
            dueAt: new Date(now.getTime() + 2 * 60 * 60 * 1000),
          },
        });
        await tx.teacherMissionLink.create({
          data: {
            token: missionToken,
            teacherId: replacement.newTeacherId,
            bookingId: booking.id,
            title: `Mission remplacement ${booking.reference} - ${booking.subjectName}`,
            instructions: "Vous recevez cette mission en remplacement. Merci de confirmer rapidement votre disponibilité ou de signaler un problème.",
            expiresAt: missionExpiresAt,
          },
        });
        await tx.notification.create({
          data: {
            userId: booking.clientId,
            title: "Nouveau professeur accepté",
            message: clientMessage,
            type: "AUTO_REPLACEMENT_ACCEPTED",
            recipientType: "CLIENT",
            recipientName: booking.client.name,
            channel: "INTERNAL",
            status: "CONFIRMED",
            priority: "IMPORTANT",
            bookingId: booking.id,
            teacherId: replacement.newTeacherId,
            clientId: booking.clientId,
            sentAt: now,
            confirmedAt: now,
            link: `/client/reservations/${booking.id}`,
            actionLabel: "Voir réservation",
          },
        });
        await tx.notification.create({
          data: {
            userId: null,
            title: "Remplacement accepté par le client",
            message: `${booking.client.name} a accepté ${newTeacherName}. Le nouveau professeur doit maintenant confirmer la mission ${booking.reference}.`,
            type: "AUTO_REPLACEMENT_ACCEPTED",
            recipientType: "ADMIN",
            channel: "INTERNAL",
            status: "CONFIRMED",
            priority: "URGENT",
            bookingId: booking.id,
            teacherId: replacement.newTeacherId,
            clientId: booking.clientId,
            sentAt: now,
            confirmedAt: now,
            link: `/admin/professeurs/${replacement.newTeacherId}?tab=cours&bookingId=${booking.id}`,
            actionLabel: "Ouvrir l'espace professeur",
          },
        });
        await tx.notification.create({
          data: {
            userId: null,
            title: "Lien mission remplacement envoyé",
            message: `Lien privé généré pour ${newTeacherName} sur ${booking.reference}.`,
            type: "TEACHER_MISSION_LINK",
            recipientType: "TEACHER",
            recipientName: newTeacherName,
            channel: "PRIVATE_LINK",
            status: "SENT",
            priority: "URGENT",
            bookingId: booking.id,
            teacherId: replacement.newTeacherId,
            clientId: booking.clientId,
            sentAt: now,
            expiresAt: missionExpiresAt,
            link: `/admin/professeurs/${replacement.newTeacherId}?tab=cours&bookingId=${booking.id}`,
            actionLabel: "Ouvrir l'espace professeur",
          },
        });
        await tx.clientCommunication.create({
          data: {
            clientId: booking.clientId,
            bookingId: booking.id,
            type: "TEACHER_CHANGE",
            channel: "INTERNAL",
            subject: `Professeur remplacé - ${booking.reference}`,
            content: clientMessage,
            priority: "IMPORTANT",
            status: "SENT",
          },
        });
        await tx.adminActionLog.create({
          data: {
            action: "Remplacement automatique accepté",
            entityType: "TeacherReplacement",
            entityId: replacement.id,
            detail: `${oldTeacherName} remplacé par ${newTeacherName} après acceptation client. Impact financier net: ${financialImpact} FCFA.`,
            oldStatus: replacement.oldTeacherId,
            newStatus: replacement.newTeacherId,
          },
        });
      });
      return NextResponse.json({ ok: true });
    }

    case "report":
    case "open_dispute": {
      if (!hasVerifiedClientFunds(booking.paymentStatus) || !hasVerifiedPayDunyaClientPayment(booking)) {
        return NextResponse.json({
          error: "Un litige financier ne peut être ouvert qu'après un paiement PayDunya vérifié.",
        }, { status: 409 });
      }
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
          recipientType: "ADMIN",
          channel: "INTERNAL",
          status: "SENT",
          priority: "CRITICAL",
          bookingId: booking.id,
          teacherId: booking.teacherId,
          clientId: booking.clientId,
          sentAt: now,
          link: `/admin/litiges/${dispute.id}`,
          actionLabel: "Traiter litige",
        },
      });
      return NextResponse.json({ booking: publicBookingDetailPayload(updated), dispute });
    }

    case "request_reschedule": {
      if (requiresVerifiedPayDunyaForOperationalAction(booking)) {
        return NextResponse.json({ error: PAYDUNYA_PROOF_REQUIRED_ERROR }, { status: 409 });
      }
      if (!["PAID", "PENDING_ADMIN_VALIDATION", "CONFIRMED", "ASSIGNED"].includes(booking.status)) {
        return NextResponse.json({ error: "Cette réservation ne peut pas être déplacée à ce stade." }, { status: 400 });
      }
      if (!booking.scheduledDate && !booking.startDate) {
        return NextResponse.json({ error: "Aucun créneau initial n'est fixé. Contactez le service client pour planifier cette réservation." }, { status: 400 });
      }
      const parsedReschedule = parseClientRescheduleInput(rescheduleDate, rescheduleTime);
      if (!parsedReschedule) {
        return NextResponse.json({ error: "Nouvelle date ou heure invalide." }, { status: 400 });
      }
      if (parsedReschedule.startsAt.getTime() < now.getTime() + 24 * 60 * 60 * 1000) {
        return NextResponse.json({ error: "Le nouveau créneau doit être choisi au moins 24h à l'avance." }, { status: 400 });
      }
      const currentDate = booking.scheduledDate ?? booking.startDate;
      const currentTime = booking.scheduledTime || booking.preferredTime;
      if (currentDate && isSameDate(currentDate, parsedReschedule.date) && currentTime === parsedReschedule.slotLabel) {
        return NextResponse.json({ error: "Le nouveau créneau est identique au créneau actuel." }, { status: 400 });
      }
      const existingAwaiting = await db.bookingRescheduleRequest.findFirst({
        where: {
          bookingId: booking.id,
          status: { in: ["PAYMENT_PENDING", "AWAITING_TEACHER"] },
        },
        orderBy: { createdAt: "desc" },
      });
      if (existingAwaiting) {
        return NextResponse.json({
          error: existingAwaiting.status === "PAYMENT_PENDING"
            ? "Une modification est déjà en attente de paiement."
            : "Une modification est déjà en attente de réponse du professeur.",
        }, { status: 409 });
      }

      const pricingSnapshot = parsePricingSnapshot(booking.pricingSnapshot);
      const policy = getReschedulePolicy({
        unitPrice: pricingSnapshot?.unitSessionAmount ?? booking.unitPrice,
        courseAmount: pricingSnapshot?.courseAmount ?? booking.courseAmount,
        totalClientPays: pricingSnapshot?.totalClientPays ?? booking.totalClientPays,
        totalPrice: booking.totalPrice,
        sessionsCount: pricingSnapshot?.numberOfSessions ?? booking.sessionsCount,
        paymentServiceFeeAmount: pricingSnapshot?.paymentServiceFeeAmount ?? booking.paymentServiceFeeAmount,
        scheduledDate: currentDate,
        scheduledTime: currentTime,
      }, now);
      if (policy.code === "NO_SHOW") {
        return NextResponse.json({
          error: "Le cours est déjà commencé ou dépassé. Le service client doit traiter cette modification manuellement.",
        }, { status: 409 });
      }

      const cleanReason = typeof rescheduleMessage === "string" ? rescheduleMessage.trim().slice(0, 700) : "";
      if (cleanReason.length < 5) {
        return NextResponse.json({ error: "Expliquez brièvement pourquoi vous souhaitez déplacer le créneau." }, { status: 400 });
      }

      const createdRequest = await db.bookingRescheduleRequest.create({
        data: {
          bookingId: booking.id,
          teacherId: booking.teacherId,
          clientId: booking.clientId,
          requestedBy: "CLIENT",
          oldScheduledDate: currentDate,
          oldScheduledTime: currentTime,
          proposedDate: parsedReschedule.date,
          proposedTime: parsedReschedule.slotLabel,
          reason: cleanReason,
          status: policy.feeAmount > 0 ? "PAYMENT_PENDING" : "AWAITING_TEACHER",
          feeWindow: policy.code,
          feeBaseAmount: policy.baseAmount,
          feeRate: policy.feeRate,
          feeAmount: policy.feeAmount,
          feeTeacherRate: policy.teacherRate,
          feeTeacherAmount: policy.teacherAmount,
          feePlatformRate: policy.platformRate,
          feePlatformAmount: policy.platformAmount,
          paymentServiceFeeRate: policy.paymentServiceFeeRate,
          paymentServiceFeeAmount: policy.paymentServiceFeeAmount,
          paymentServiceFeeLabel: policy.paymentServiceFeeLabel,
          totalToPay: policy.totalToPay,
        },
        include: {
          booking: {
            include: {
              client: { select: { name: true } },
              teacher: { select: { fullName: true, professionalName: true } },
            },
          },
          teacher: { select: { fullName: true, professionalName: true } },
          client: { select: { name: true } },
        },
      });

      if (policy.feeAmount <= 0) {
        await db.$transaction(async (tx) => {
          await createRescheduleAwaitingTeacherNotifications(tx, { request: createdRequest, now });
          await tx.adminActionLog.create({
            data: {
              adminId: null,
              action: "Modification créneau client gratuite",
              entityType: "BookingRescheduleRequest",
              entityId: createdRequest.id,
              detail: `${booking.client.name} demande ${parsedReschedule.slotLabel} le ${parsedReschedule.date.toLocaleDateString("fr-FR")} pour ${booking.reference}. ${reschedulePolicySummary(policy)}.`,
              oldStatus: "NONE",
              newStatus: "AWAITING_TEACHER",
            },
          });
        });
        return NextResponse.json({
          ok: true,
          rescheduleRequest: serializeRescheduleRequest(createdRequest),
          policy,
          message: "Demande de modification transmise au professeur.",
        });
      }

      let payment: Awaited<ReturnType<typeof createPayDunyaRescheduleFeeInvoice>>;
      try {
        payment = await createPayDunyaRescheduleFeeInvoice({
          origin: getPayDunyaPublicBaseUrl(req),
          booking: {
            id: booking.id,
            reference: booking.reference,
            subjectName: booking.subjectName,
            levelName: booking.levelName,
          },
          rescheduleRequest: {
            id: createdRequest.id,
            oldScheduledTime: currentTime,
            proposedTime: parsedReschedule.slotLabel,
            feeAmount: policy.feeAmount,
            paymentServiceFeeAmount: policy.paymentServiceFeeAmount,
            paymentServiceFeeLabel: policy.paymentServiceFeeLabel,
            totalToPay: policy.totalToPay,
          },
          client: {
            id: booking.client.id,
            name: booking.client.name,
            email: booking.client.email,
            phone: booking.client.phone,
          },
          teacher: {
            id: booking.teacher.id,
            name: booking.teacher.professionalName || booking.teacher.fullName,
          },
        });
      } catch (error: any) {
        const errorMessage = error?.message || "PayDunya a refusé la création du lien de paiement du supplément.";
        await db.bookingRescheduleRequest.update({
          where: { id: createdRequest.id },
          data: {
            status: "PAYMENT_FAILED",
            paydunyaStatus: "CREATE_FAILED",
            paydunyaFailureReason: errorMessage,
            paydunyaLastCheckedAt: new Date(),
            paydunyaLastPayload: errorMessage,
          },
        });
        return NextResponse.json({ error: errorMessage }, { status: 503 });
      }

      if (!payment.configured || !payment.checkoutUrl) {
        await db.bookingRescheduleRequest.update({
          where: { id: createdRequest.id },
          data: {
            status: "PAYMENT_FAILED",
            paydunyaStatus: payment.configured ? "CREATE_FAILED" : "NOT_CONFIGURED",
            paydunyaFailureReason: payment.configured
              ? "PayDunya n'a pas retourné de lien de paiement pour le supplément."
              : "PayDunya n'est pas encore configuré sur cette installation.",
            paydunyaLastCheckedAt: new Date(),
            paydunyaLastPayload: compactPayDunyaCreatePayload(payment.raw ?? payment.responseText),
          },
        });
        return NextResponse.json({
          error: payment.configured
            ? "PayDunya n'a pas retourné de lien de paiement pour le supplément."
            : "PayDunya n'est pas encore configuré sur cette installation.",
        }, { status: 503 });
      }

      const updatedRequest = await db.bookingRescheduleRequest.update({
        where: { id: createdRequest.id },
        data: {
          paydunyaToken: payment.token,
          paydunyaCheckoutUrl: payment.checkoutUrl,
          paydunyaStatus: "PENDING",
          paydunyaFailureReason: null,
          paydunyaLastCheckedAt: new Date(),
          paydunyaLastPayload: compactPayDunyaCreatePayload(payment.raw ?? payment.responseText),
        },
      });

      await db.adminActionLog.create({
        data: {
          adminId: null,
          action: "Supplément modification PayDunya créé",
          entityType: "BookingRescheduleRequest",
          entityId: createdRequest.id,
          detail: `${booking.client.name} doit payer ${policy.totalToPay.toLocaleString("fr-FR")} FCFA pour déplacer ${booking.reference}. Frais: ${policy.feeAmount.toLocaleString("fr-FR")} FCFA, service: ${policy.paymentServiceFeeAmount.toLocaleString("fr-FR")} FCFA.`,
          oldStatus: "NONE",
          newStatus: "PAYMENT_PENDING",
        },
      });

      return NextResponse.json({
        ok: true,
        rescheduleRequest: serializeRescheduleRequest(updatedRequest),
        policy,
        payment: {
          provider: "PAYDUNYA",
          configured: payment.configured,
          checkoutUrl: payment.checkoutUrl,
        },
        message: "Supplément requis avant transmission au professeur.",
      });
    }

    case "reschedule_fee_verify": {
      const requestId = typeof rescheduleRequestId === "string" ? rescheduleRequestId : null;
      const token = typeof body.token === "string" ? body.token : null;
      const result = await reconcilePayDunyaReschedulePayment({
        bookingId: booking.id,
        rescheduleRequestId: requestId,
        token,
        expectedClientId: booking.clientId,
        source: "client_manual",
        incomingPayload: body,
      });
      return NextResponse.json({
        ok: result.verified,
        payment: result,
      }, { status: result.action === "rejected" ? 409 : 200 });
    }

    case "reschedule": {
      if (requiresVerifiedPayDunyaForOperationalAction(booking)) {
        return NextResponse.json({ error: PAYDUNYA_PROOF_REQUIRED_ERROR }, { status: 409 });
      }
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
          recipientType: "ADMIN",
          channel: "INTERNAL",
          status: "SENT",
          priority: "IMPORTANT",
          bookingId: booking.id,
          teacherId: booking.teacherId,
          clientId: booking.clientId,
          sentAt: now,
          link: `/admin/reservations/${booking.id}`,
          actionLabel: "Replanifier",
        },
      });
      return NextResponse.json({ booking: publicBookingDetailPayload(updated) });
    }

    case "cancel": {
      const wasPaid = ["PAID", "PENDING_ADMIN_VALIDATION", "CONFIRMED", "ASSIGNED", "PENDING_CLIENT_VALIDATION"].includes(
        booking.status
      ) && hasVerifiedClientFunds(booking.paymentStatus) && hasVerifiedPayDunyaClientPayment(booking);
      const paidAggregate = wasPaid
        ? await db.transaction.aggregate({
            where: {
              bookingId: booking.id,
              type: "CLIENT_PAYMENT",
              status: { in: [...PAID_CLIENT_TRANSACTION_STATUSES] },
            },
            _sum: { amount: true },
          })
        : null;
      const paidAmount = paidAggregate?._sum.amount ?? 0;
      const policy = getCancellationPolicy({ ...booking, paidAmount: wasPaid ? paidAmount : null }, now, "CLIENT");
      const penaltySplit = getCancellationPenaltySplit(policy, "CLIENT");
      const paymentStatus = !wasPaid
        ? booking.paymentStatus
        : policy.refundAmount <= 0
          ? "RETAINED"
          : policy.refundAmount >= policy.baseAmount
            ? "REFUND_PENDING"
            : "PARTIAL_REFUND_PENDING";
      const updated = await db.booking.update({
        where: { id },
        data: {
          status: "CANCELLED",
          paymentStatus,
          cancelledAt: now,
          cancelledBy: "CLIENT",
          cancellationReason: reason || "Annulation demandée par le client",
          cancellationDetail: description || null,
          cancellationWindow: policy.code,
          cancellationFeeRate: policy.feeRate,
          cancellationFeeAmount: policy.feeAmount,
          cancellationPenaltyTeacherRate: penaltySplit.teacherRate,
          cancellationPenaltyTeacherAmount: penaltySplit.teacherAmount,
          cancellationPenaltyPlatformRate: penaltySplit.platformRate,
          cancellationPenaltyPlatformAmount: penaltySplit.platformAmount,
          cancellationRefundAmount: wasPaid ? policy.refundAmount : 0,
        },
      });
      if (wasPaid) {
        await db.transaction.updateMany({
          where: { bookingId: booking.id, type: "CLIENT_PAYMENT" },
          data: { status: paymentStatus },
        });
      }
      await db.notification.create({
        data: {
          userId: null,
          title: "Réservation annulée",
          message: `Le client a annulé la réservation ${booking.reference}. ${cancellationPolicySummary(policy)}. Frais: ${policy.feeAmount.toLocaleString("fr-FR")} FCFA. Part professeur: ${penaltySplit.teacherAmount.toLocaleString("fr-FR")} FCFA. Part plateforme: ${penaltySplit.platformAmount.toLocaleString("fr-FR")} FCFA. Frais service non remboursés: ${policy.serviceFeeAmount.toLocaleString("fr-FR")} FCFA. Remboursement: ${policy.refundAmount.toLocaleString("fr-FR")} FCFA.`,
          type: "BOOKING_CANCELLED",
          recipientType: "ADMIN",
          channel: "INTERNAL",
          status: "SENT",
          priority: policy.feeRate > 0 ? "URGENT" : wasPaid ? "IMPORTANT" : "NORMAL",
          bookingId: booking.id,
          teacherId: booking.teacherId,
          clientId: booking.clientId,
          sentAt: now,
          link: `/admin/reservations/${booking.id}`,
          actionLabel: wasPaid ? "Traiter remboursement" : "Voir annulation",
        },
      });
      await db.notification.create({
        data: {
          userId: booking.clientId,
          title: "Réservation annulée",
          message: wasPaid
            ? `Votre réservation ${booking.reference} est annulée. ${cancellationPolicySummary(policy)}. Frais retenus: ${policy.feeAmount.toLocaleString("fr-FR")} FCFA. Remboursement estimé: ${policy.refundAmount.toLocaleString("fr-FR")} FCFA.`
            : `Votre réservation ${booking.reference} est annulée. Aucun paiement n'était à rembourser.`,
          type: "BOOKING_CANCELLED",
          recipientType: "CLIENT",
          channel: "INTERNAL",
          status: "SENT",
          priority: policy.feeRate > 0 ? "IMPORTANT" : "NORMAL",
          bookingId: booking.id,
          teacherId: booking.teacherId,
          clientId: booking.clientId,
          sentAt: now,
          link: `/client/reservations/${booking.id}`,
          actionLabel: "Voir le détail",
        },
      });
      await db.clientCommunication.create({
        data: {
          clientId: booking.clientId,
          bookingId: booking.id,
          type: "INFORMATION",
          channel: "INTERNAL",
          subject: `Annulation réservation ${booking.reference}`,
          content: wasPaid
            ? `Votre réservation est annulée.\n\n${policy.label}\n${policy.description}\n\nFrais retenus : ${policy.feeAmount.toLocaleString("fr-FR")} FCFA\nFrais de service paiement non remboursés : ${policy.serviceFeeAmount.toLocaleString("fr-FR")} FCFA\nRemboursement estimé : ${policy.refundAmount.toLocaleString("fr-FR")} FCFA`
            : "Votre réservation est annulée. Aucun paiement n'était à rembourser.",
          priority: policy.feeRate > 0 ? "IMPORTANT" : "NORMAL",
          status: "SENT",
        },
      });
      await db.teacherNotification.create({
        data: {
          teacherId: booking.teacherId,
          bookingId: booking.id,
          title: "Réservation annulée par le client",
          message: [
            `La réservation ${booking.reference} a été annulée par le client.`,
            `Cours : ${booking.subjectName}`,
            `Niveau : ${booking.levelName}`,
            `Motif : ${reason || "Annulation demandée par le client"}`,
            `Frais retenus côté client : ${policy.feeAmount.toLocaleString("fr-FR")} FCFA`,
            `Part professeur prévue : ${penaltySplit.teacherAmount.toLocaleString("fr-FR")} FCFA`,
            `Part plateforme : ${penaltySplit.platformAmount.toLocaleString("fr-FR")} FCFA`,
            `Frais service paiement non remboursés : ${policy.serviceFeeAmount.toLocaleString("fr-FR")} FCFA`,
            "Ne vous présentez pas au cours sans nouvelle instruction du service client.",
          ].join("\n"),
          channel: "WHATSAPP",
          sent: false,
          status: "PENDING",
        },
      });
      await db.teacherTask.create({
        data: {
          teacherId: booking.teacherId,
          bookingId: booking.id,
          type: "ADMIN_ACTION",
          title: `Informer professeur - annulation ${booking.reference}`,
          description: `Le client a annulé la réservation. Motif: ${reason || "Non renseigné"}. ${cancellationPolicySummary(policy)}. Vérifier si le professeur doit être prévenu par WhatsApp/SMS/appel.`,
          priority: policy.feeRate > 0 ? "URGENT" : "IMPORTANT",
          status: "TODO",
          dueAt: new Date(now.getTime() + 2 * 60 * 60 * 1000),
        },
      });
      await db.teacher.update({
        where: { id: booking.teacherId },
        data: { lastActivityAt: now },
      });
      await db.adminActionLog.create({
        data: {
          adminId: null,
          action: "Annulation client réservation",
          entityType: "Booking",
          entityId: booking.id,
          detail: `Client a annulé ${booking.reference}. Motif: ${reason || "Non renseigné"}. Frais: ${policy.feeAmount} FCFA. Part professeur: ${penaltySplit.teacherAmount} FCFA. Part plateforme: ${penaltySplit.platformAmount} FCFA. Frais service non remboursés: ${policy.serviceFeeAmount} FCFA. Remboursement: ${wasPaid ? policy.refundAmount : 0} FCFA. Tâche professeur créée pour information.`,
          oldStatus: booking.status,
          newStatus: "CANCELLED",
        },
      });
      return NextResponse.json({ booking: publicBookingDetailPayload(updated) });
    }

    case "submit_refund_details": {
      if (!["CANCELLED", "REFUNDED"].includes(booking.status) || booking.cancellationRefundAmount <= 0) {
        return NextResponse.json({ error: "Aucun remboursement client n'est disponible pour cette réservation." }, { status: 400 });
      }
      const method = typeof body.method === "string" ? body.method.trim() : "";
      const paymentPhone = typeof body.paymentPhone === "string" ? body.paymentPhone.trim().replace(/\s+/g, " ") : "";
      const confirmPaymentPhone = typeof body.confirmPaymentPhone === "string" ? body.confirmPaymentPhone.trim().replace(/\s+/g, " ") : "";
      const accountName = typeof body.accountName === "string" ? body.accountName.trim() : "";
      const note = typeof body.note === "string" ? body.note.trim() : "";
      const normalizedPhoneDigits = paymentPhone.replace(/\D/g, "");
      const confirmedPhoneDigits = confirmPaymentPhone.replace(/\D/g, "");

      if (!isActivePaymentMethod(method)) {
        return NextResponse.json({ error: "Choisissez un moyen de remboursement valide." }, { status: 400 });
      }
      if (normalizedPhoneDigits.length < 8 || normalizedPhoneDigits.length > 15) {
        return NextResponse.json({ error: "Le numéro de remboursement doit contenir entre 8 et 15 chiffres." }, { status: 400 });
      }
      if (normalizedPhoneDigits !== confirmedPhoneDigits) {
        return NextResponse.json({ error: "Les deux numéros saisis ne correspondent pas." }, { status: 400 });
      }
      if (accountName.length < 2) {
        return NextResponse.json({ error: "Indiquez le nom du titulaire du compte mobile money." }, { status: 400 });
      }

      const existingPending = await db.clientRefundRequest.findFirst({
        where: {
          bookingId: booking.id,
          clientId: booking.clientId,
          status: { in: ["PENDING", "APPROVED"] },
        },
        orderBy: { createdAt: "desc" },
      });
      const payload = {
        amount: booking.cancellationRefundAmount,
        paymentServiceFeeNonRefunded: booking.paymentServiceFeeAmount,
        method,
        paymentPhone,
        accountName,
        note: note || null,
        status: "PENDING" as const,
      };
      const refundRequest = existingPending
        ? await db.clientRefundRequest.update({
            where: { id: existingPending.id },
            data: payload,
          })
        : await db.clientRefundRequest.create({
            data: {
              reference: generateReference("RF"),
              bookingId: booking.id,
              clientId: booking.clientId,
              ...payload,
            },
          });

      await db.notification.create({
        data: {
          userId: null,
          title: "Coordonnées de remboursement reçues",
          message: `Le client a renseigné le remboursement ${refundRequest.reference} pour ${booking.reference}: ${booking.cancellationRefundAmount.toLocaleString("fr-FR")} FCFA via ${paymentMethodLabel(method)} au ${paymentPhone}.`,
          type: "CLIENT_REFUND_DETAILS",
          recipientType: "ADMIN",
          channel: "INTERNAL",
          status: "SENT",
          priority: "IMPORTANT",
          bookingId: booking.id,
          teacherId: booking.teacherId,
          clientId: booking.clientId,
          sentAt: now,
          link: `/admin/reservations/${booking.id}`,
          actionLabel: "Traiter remboursement",
        },
      });
      await db.clientCommunication.create({
        data: {
          clientId: booking.clientId,
          bookingId: booking.id,
          type: "PAYMENT",
          channel: "INTERNAL",
          subject: `Coordonnées remboursement ${booking.reference}`,
          content: `Votre demande de remboursement ${refundRequest.reference} est enregistrée.\nMontant prévu : ${booking.cancellationRefundAmount.toLocaleString("fr-FR")} FCFA\nMoyen : ${paymentMethodLabel(method)}\nNuméro : ${paymentPhone}\nTitulaire : ${accountName}\nFrais de service paiement non remboursés : ${booking.paymentServiceFeeAmount.toLocaleString("fr-FR")} FCFA`,
          priority: "IMPORTANT",
          status: "SENT",
        },
      });
      await db.adminActionLog.create({
        data: {
          adminId: null,
          action: "Coordonnées remboursement client",
          entityType: "ClientRefundRequest",
          entityId: refundRequest.id,
          detail: `Remboursement ${refundRequest.reference} pour ${booking.reference}: ${booking.cancellationRefundAmount} FCFA via ${paymentMethodLabel(method)} au ${paymentPhone}.`,
          oldStatus: existingPending?.status ?? "NO_REFUND_REQUEST",
          newStatus: "PENDING",
        },
      });

      return NextResponse.json({ ok: true, refundRequest });
    }

    default:
      return NextResponse.json({ error: "Action inconnue" }, { status: 400 });
  }
}

function compactPayDunyaCreatePayload(value: unknown) {
  if (value == null) return null;
  try {
    return JSON.stringify(value).slice(0, 2000);
  } catch {
    return String(value).slice(0, 2000);
  }
}

function parseClientRescheduleInput(dateValue: unknown, timeValue: unknown) {
  if (typeof dateValue !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(dateValue)) return null;
  const date = new Date(`${dateValue}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return null;

  const time = typeof timeValue === "string" ? timeValue.trim() : "";
  const match = time.match(/^(\d{1,2})(?::?(\d{2}))?$/);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = match[2] ? Number(match[2]) : 0;
  if (!Number.isFinite(hour) || hour < 6 || hour > 20) return null;
  if (!Number.isFinite(minute) || minute < 0 || minute > 59) return null;
  const startsAt = new Date(date.getFullYear(), date.getMonth(), date.getDate(), hour, minute, 0, 0);
  const endHour = hour + 2;
  if (endHour > 22) return null;
  const startLabel = minute > 0 ? `${hour}h${String(minute).padStart(2, "0")}` : `${hour}h`;
  const endLabel = minute > 0 ? `${endHour}h${String(minute).padStart(2, "0")}` : `${endHour}h`;
  return {
    date,
    startsAt,
    slotLabel: `${startLabel}-${endLabel}`,
  };
}

function isSameDate(left: Date | string, right: Date) {
  const parsed = left instanceof Date ? left : new Date(left);
  if (Number.isNaN(parsed.getTime())) return false;
  return parsed.getFullYear() === right.getFullYear()
    && parsed.getMonth() === right.getMonth()
    && parsed.getDate() === right.getDate();
}

function serializeRescheduleRequest(request: any) {
  return {
    id: request.id,
    bookingId: request.bookingId,
    status: request.status,
    oldScheduledDate: request.oldScheduledDate,
    oldScheduledTime: request.oldScheduledTime,
    proposedDate: request.proposedDate,
    proposedTime: request.proposedTime,
    reason: request.reason,
    feeWindow: request.feeWindow,
    feeBaseAmount: request.feeBaseAmount,
    feeRate: request.feeRate,
    feeAmount: request.feeAmount,
    feeTeacherRate: request.feeTeacherRate,
    feeTeacherAmount: request.feeTeacherAmount,
    feePlatformRate: request.feePlatformRate,
    feePlatformAmount: request.feePlatformAmount,
    paymentServiceFeeAmount: request.paymentServiceFeeAmount,
    paymentServiceFeeLabel: request.paymentServiceFeeLabel,
    totalToPay: request.totalToPay,
    paydunyaStatus: request.paydunyaStatus,
    paydunyaVerifiedAt: request.paydunyaVerifiedAt,
    paidAt: request.paidAt,
    teacherResponse: request.teacherResponse,
    teacherRespondedAt: request.teacherRespondedAt,
    appliedAt: request.appliedAt,
    createdAt: request.createdAt,
  };
}
