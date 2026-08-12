import { randomBytes } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isBookingFinanciallyTerminal, isBookingRefundInProgressOrFinal } from "@/lib/booking-financial-state";
import {
  assertBookingRefundPayoutSafetyInTransaction,
  prepareBookingSessionsForRefundInTransaction,
  BookingRefundWorkflowError,
} from "@/lib/booking-refund-finalization";
import { lockTeacherPayoutBalances } from "@/lib/teacher-payout-reservations";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { DisputeStatus, Prisma } from "@prisma/client";
import { generateReference } from "@/lib/format";
import { PAID_CLIENT_TRANSACTION_STATUSES, cancellationPolicySummary, getCancellationPenaltySplit, getCancellationPolicy } from "@/lib/cancellation-policy";
import { parsePricingSnapshot, pricingSnapshotToJson } from "@/lib/pricing";
import { reconcilePayDunyaBookingPayment } from "@/lib/paydunya-reconciliation";
import { CLIENT_DELETED_DRAFT_REASON } from "@/lib/booking-draft-deletion";
import { createRescheduleAwaitingTeacherNotifications, reconcilePayDunyaReschedulePayment } from "@/lib/paydunya-reschedule-reconciliation";
import { planJekoRescheduleAttempt, platformMethodToJeko } from "@/lib/jeko-client-payment";
import { reconcileJekoReschedulePaymentAttempt } from "@/lib/jeko-reschedule-reconciliation";
import { isAllowedJekoRedirectUrl } from "@/lib/jeko-utils";
import { createJekoRescheduleCheckout } from "@/lib/payment-provider";
import { isActivePaymentMethod, paymentMethodLabel } from "@/lib/payment-methods";
import { findReplacementCandidatesForBooking } from "@/lib/teacher-replacement-matching";
import { absoluteAppUrl } from "@/lib/public-url";
import { getReschedulePolicy, reschedulePolicySummary } from "@/lib/reschedule-policy";
import {
  hasVerifiedClientFunds,
  hasVerifiedPayDunyaClientPayment,
  isPaymentReadyForCourseProgressWithProof,
  PAYMENT_PROOF_REQUIRED_ERROR,
  requiresVerifiedPayDunyaForOperationalAction,
} from "@/lib/payment-security";
import { distributeAmount, syncBookingSessionAggregates } from "@/lib/booking-sessions";
import { isReschedulableBookingSessionStatus } from "@/lib/reschedule-session-target";

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
  const teacher = booking.teacher
    ? {
        ...booking.teacher,
        phone: verifiedClientPayment ? booking.teacher.phone ?? null : null,
        email: verifiedClientPayment ? booking.teacher.email ?? null : null,
      }
    : null;
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
    teacher,
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
    sessions: Array.isArray(booking.sessions) ? booking.sessions : [],
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
      sessions: {
        orderBy: { sequence: "asc" },
        include: {
          teacher: { select: { id: true, fullName: true, professionalName: true, photoUrl: true } },
          proposedTeacher: { select: { id: true, fullName: true, professionalName: true, photoUrl: true } },
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
      sessions: { orderBy: { sequence: "asc" } },
      paymentAttempts: {
        where: {
          provider: "JEKO",
          purpose: "BOOKING",
          OR: [
            { status: { in: ["CREATED", "REQUESTING", "PENDING"] } },
            {
              status: "FAILED",
              providerOrderId: { not: null },
              OR: [
                { failureCode: null },
                { failureCode: { not: "JEKO_PAYMENT_FAILED" } },
              ],
            },
          ],
        },
        select: { id: true },
        take: 1,
      },
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
    bookingSessionId,
    rescheduleRequestId,
    proposalId,
    replacementId,
    clientResponse,
  } = body;

  const now = new Date();

  switch (action) {
    case "delete_draft": {
      if (booking.status !== "PENDING_PAYMENT") {
        return NextResponse.json({ error: "Seul un brouillon non réservé peut être supprimé." }, { status: 400 });
      }
      if (hasVerifiedPayDunyaClientPayment(booking)) {
        return NextResponse.json({ error: "Ce dossier contient un paiement vérifié et ne peut pas être supprimé." }, { status: 409 });
      }

      let deletionResult:
        | { ok: true }
        | { ok: false; status: number; error: string };
      try {
        deletionResult = await db.$transaction(async (tx) => {
          // Le checkout Jèko prend le même verrou avant de créer sa
          // tentative. Si le paiement gagne la course, sa ligne est visible
          // ci-dessous et bloque la suppression ; si la suppression gagne,
          // Jèko constate ensuite que le brouillon n'existe plus avant tout POST.
          const locked = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
            SELECT "id"
            FROM "Booking"
            WHERE "id" = ${booking.id}
            FOR UPDATE
          `);
          if (locked.length !== 1) {
            return { ok: false as const, status: 404, error: "Brouillon introuvable." };
          }

          const protectedRelations = await tx.booking.findUnique({
            where: { id: booking.id },
            select: {
              clientId: true,
              status: true,
              paymentStatus: true,
              paymentVerifiedAt: true,
              paydunyaVerifiedAt: true,
            },
          });
          if (!protectedRelations || protectedRelations.clientId !== userId) {
            return { ok: false as const, status: 404, error: "Brouillon introuvable." };
          }
          if (
            protectedRelations.status !== "PENDING_PAYMENT"
            || protectedRelations.paymentStatus !== "FAILED"
            || protectedRelations.paymentVerifiedAt
            || protectedRelations.paydunyaVerifiedAt
          ) {
            return {
              ok: false as const,
              status: 409,
              error: "Ce dossier a changé ou contient maintenant un paiement et ne peut plus être supprimé.",
            };
          }

          await tx.notification.deleteMany({ where: { bookingId: booking.id } });
          await tx.teacherNotification.deleteMany({ where: { bookingId: booking.id } });
          await tx.clientCommunication.deleteMany({ where: { bookingId: booking.id } });
          await tx.teacherTask.updateMany({
            where: { bookingId: booking.id, status: { notIn: ["DONE", "CANCELLED"] } },
            data: { status: "CANCELLED", completedAt: now },
          });
          await tx.bookingScheduleProposal.updateMany({
            where: { bookingId: booking.id, status: "PENDING" },
            data: { status: "CANCELLED", respondedAt: now },
          });
          await tx.teacherReplacement.updateMany({
            where: { bookingId: booking.id, status: { in: ["DRAFT", "CLIENT_NOTIFIED"] } },
            data: { status: "CANCELLED", details: "Brouillon supprimé par le client." },
          });
          await tx.teacherMissionLink.updateMany({
            where: { bookingId: booking.id, status: { in: ["PENDING_CONFIRMATION", "RELAUNCHED"] } },
            data: { status: "EXPIRED", expiresAt: now, response: "Brouillon supprimé par le client." },
          });
          await tx.booking.update({
            where: { id: booking.id },
            data: {
              status: "CANCELLED",
              cancelledAt: now,
              cancelledBy: "CLIENT",
              cancellationReason: CLIENT_DELETED_DRAFT_REASON,
              cancellationDetail: "Brouillon retiré immédiatement de l'espace client.",
            },
          });
          await tx.adminActionLog.create({
            data: {
              action: "Brouillon client supprimé",
              entityType: "Booking",
              entityId: booking.id,
              detail: `Le client ${booking.client.name} a retiré le brouillon ${booking.reference}. Le dossier technique reste neutralisé pour rapprocher sans risque un éventuel paiement reçu simultanément.`,
              oldStatus: "PENDING_PAYMENT",
              newStatus: "DRAFT_DELETED",
            },
          });
          return { ok: true as const };
        }, { isolationLevel: "Serializable" });
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") {
          return NextResponse.json({
            error: "Le brouillon a changé pendant la suppression. Rechargez la page avant de réessayer.",
          }, { status: 409 });
        }
        throw error;
      }
      if (!deletionResult.ok) {
        return NextResponse.json({ error: deletionResult.error }, { status: deletionResult.status });
      }

      return NextResponse.json({ ok: true, deleted: true, redirect: "/client/reservations?tab=brouillons" });
    }

    case "paydunya_checkout": {
      if (booking.paymentProvider === "JEKO" || booking.paymentAttempts.length > 0) {
        return NextResponse.json({
          error: "Cette réservation est déjà affectée à Jèko. Aucun second lien PayDunya ne peut être ouvert.",
          code: "PAYMENT_PROVIDER_LOCKED",
        }, { status: 409 });
      }
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

      // PayDunya reste lisible et rapprochable pour l'historique, mais aucun
      // nouvel objet distant ne doit plus être créé. Cette coupure explicite
      // ferme la course avec Jèko sur les anciens brouillons sans provider.
      return NextResponse.json({
        error: "La création de nouveaux paiements PayDunya est désactivée. Reprenez ce brouillon avec le paiement Jèko sécurisé.",
        code: "PAYDUNYA_NEW_CHECKOUT_DISABLED",
        payment: {
          provider: "PAYDUNYA",
          configured: false,
          checkoutUrl: null,
          migrationProvider: "JEKO",
        },
      }, { status: 409 });

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
      const pendingSessions = booking.sessions.filter((session) => session.status === "AWAITING_CLIENT_CONFIRMATION");
      if (booking.sessions.length > 0) {
        if (pendingSessions.length !== 1) {
          return NextResponse.json({ error: "Confirmez la séance concernée depuis le suivi du pack." }, { status: 409 });
        }
        const pendingSession = pendingSessions[0];
        await db.$transaction(async (tx) => {
          await tx.bookingSession.update({
            where: { id: pendingSession.id },
            data: {
              status: "RELEASED",
              clientValidatedAt: now,
              releasedAt: now,
              releasedAmount: pendingSession.teacherNetAmount,
            },
          });
          await tx.bookingSessionHistory.create({
            data: {
              bookingSessionId: pendingSession.id,
              actorType: "CLIENT",
              actorId: userId,
              action: "CLIENT_CONFIRMED",
              fromStatus: pendingSession.status,
              toStatus: "RELEASED",
              detail: pendingSession.teacherNetAmount + " FCFA libérés.",
            },
          });
          await syncBookingSessionAggregates(tx as any, booking.id);
          await tx.notification.create({
            data: {
              userId: null,
              title: "Paiement séance à libérer",
              message: "Le client a confirmé la séance " + pendingSession.sequence + "/" + booking.sessionsCount + " de " + booking.reference + ".",
              type: "SESSION_FUNDS_RELEASED",
              recipientType: "ADMIN",
              channel: "INTERNAL",
              status: "SENT",
              priority: "IMPORTANT",
              bookingId: booking.id,
              teacherId: pendingSession.teacherId,
              clientId: booking.clientId,
              sentAt: now,
              link: "/admin/reservations/" + booking.id + "#seances",
            },
          });
        });
        const refreshed = await db.booking.findUniqueOrThrow({ where: { id: booking.id } });
        return NextResponse.json({ booking: publicBookingDetailPayload(refreshed) });
      }
      if (booking.status !== "PENDING_CLIENT_VALIDATION") {
        return NextResponse.json({ error: "Action non autorisée pour ce statut" }, { status: 400 });
      }
      if (!isPaymentReadyForCourseProgressWithProof(booking)) {
        return NextResponse.json({
          error: "Impossible de confirmer ce cours : le paiement n'est pas confirmé côté serveur et bloqué.",
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
        return NextResponse.json({ error: PAYMENT_PROOF_REQUIRED_ERROR }, { status: 409 });
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
    case "reject_replacement_proposal":
    case "cancel_after_teacher_unavailable": {
      if (requiresVerifiedPayDunyaForOperationalAction(booking)) {
        return NextResponse.json({ error: PAYMENT_PROOF_REQUIRED_ERROR }, { status: 409 });
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

      if (action === "cancel_after_teacher_unavailable") {
        if (replacement.reason !== "UNAVAILABLE") {
          return NextResponse.json({
            error: "L'annulation sans pénalité est réservée aux indisponibilités confirmées du professeur.",
          }, { status: 409 });
        }

        const paidAggregate = await db.transaction.aggregate({
          where: {
            bookingId: booking.id,
            type: "CLIENT_PAYMENT",
            status: { in: [...PAID_CLIENT_TRANSACTION_STATUSES] },
          },
          _sum: { amount: true },
        });
        const paidAmount = Math.max(0, paidAggregate._sum.amount ?? 0);
        const policy = getCancellationPolicy({
          ...booking,
          paidAmount,
        }, now, "TEACHER");
        const refundStatus = policy.refundAmount > 0 ? "REFUND_PENDING" : "REFUNDED";

        try {
          await db.$transaction(async (tx) => {
          await assertBookingRefundPayoutSafetyInTransaction(tx, booking.id);
          await tx.$queryRaw(Prisma.sql`
            SELECT "id"
            FROM "Booking"
            WHERE "id" = ${booking.id}
            FOR UPDATE
          `);
          const currentBooking = await tx.booking.findUnique({
            where: { id: booking.id },
            select: { id: true, clientId: true, teacherId: true, status: true, paymentStatus: true, updatedAt: true },
          });
          if (!currentBooking || currentBooking.clientId !== userId) {
            throw new BookingRefundWorkflowError("Réservation introuvable", 404, "BOOKING_NOT_FOUND");
          }
          if (
            currentBooking.teacherId !== replacement.oldTeacherId
            || currentBooking.status !== booking.status
            || currentBooking.paymentStatus !== booking.paymentStatus
            || currentBooking.updatedAt.getTime() !== booking.updatedAt.getTime()
            || currentBooking.status === "DISPUTED"
            || currentBooking.paymentStatus === "DISPUTED"
            || isBookingFinanciallyTerminal(currentBooking)
            || isBookingRefundInProgressOrFinal(currentBooking)
          ) {
            throw new BookingRefundWorkflowError(
              "La réservation ou son professeur vient de changer.",
              409,
              "TEACHER_UNAVAILABLE_CANCELLATION_CONFLICT",
            );
          }
          const activeDispute = await tx.dispute.findFirst({
            where: { bookingId: booking.id, status: { in: ["OPEN", "INVESTIGATING"] } },
            select: { id: true },
          });
          if (activeDispute) {
            throw new BookingRefundWorkflowError(
              "Clôturez d'abord le litige ouvert avant d'annuler cette réservation.",
              409,
              "BOOKING_ACTIVE_DISPUTE",
            );
          }
          await prepareBookingSessionsForRefundInTransaction(tx, {
            bookingId: booking.id,
            actorId: userId,
            actorType: "CLIENT",
            now,
          });
          const replacementCancelled = await tx.teacherReplacement.updateMany({
            where: {
              id: replacement.id,
              bookingId: booking.id,
              oldTeacherId: replacement.oldTeacherId,
              status: replacement.status,
            },
            data: {
              status: "CANCELLED",
              details: `${replacement.details || ""}\nLe client a choisi l'annulation sans pénalité après l'indisponibilité du professeur.${cleanClientResponse ? ` Message: ${cleanClientResponse}` : ""}`.trim(),
            },
          });
          if (replacementCancelled.count !== 1) {
            throw new BookingRefundWorkflowError(
              "Cette proposition vient d'être traitée depuis une autre fenêtre.",
              409,
              "TEACHER_REPLACEMENT_CONCURRENT_UPDATE",
            );
          }
          const bookingCancelled = await tx.booking.updateMany({
            where: {
              id: booking.id,
              clientId: userId,
              teacherId: currentBooking.teacherId,
              status: currentBooking.status,
              paymentStatus: currentBooking.paymentStatus,
              updatedAt: currentBooking.updatedAt,
            },
            data: {
              status: "CANCELLED",
              paymentStatus: refundStatus,
              cancelledAt: now,
              cancelledBy: "TEACHER",
              cancellationReason: "Indisponibilité du professeur",
              cancellationDetail: cleanClientResponse || "Le client a refusé le remplacement automatique et choisi l'annulation.",
              cancellationWindow: policy.code,
              cancellationFeeRate: 0,
              cancellationFeeAmount: 0,
              cancellationPenaltyTeacherRate: 0,
              cancellationPenaltyTeacherAmount: 0,
              cancellationPenaltyPlatformRate: 0,
              cancellationPenaltyPlatformAmount: 0,
              cancellationRefundAmount: policy.refundAmount,
            },
          });
          if (bookingCancelled.count !== 1) {
            throw new BookingRefundWorkflowError(
              "La réservation vient de changer pendant l'annulation.",
              409,
              "BOOKING_CANCELLATION_CONCURRENT_UPDATE",
            );
          }
          await tx.transaction.updateMany({
            where: {
              bookingId: booking.id,
              type: "CLIENT_PAYMENT",
              status: { in: [...PAID_CLIENT_TRANSACTION_STATUSES] },
            },
            data: { status: refundStatus },
          });
          await tx.teacherTask.updateMany({
            where: {
              bookingId: booking.id,
              status: { notIn: ["DONE", "CANCELLED"] },
            },
            data: { status: "CANCELLED", completedAt: now },
          });
          await tx.notification.create({
            data: {
              userId: booking.clientId,
              title: "Réservation annulée sans pénalité",
              message: `Votre réservation ${booking.reference} est annulée à la suite de l'indisponibilité du professeur. Aucune pénalité d'annulation n'est appliquée. Remboursement prévu : ${policy.refundAmount.toLocaleString("fr-FR")} FCFA.`,
              type: "TEACHER_UNAVAILABLE_CANCELLATION",
              recipientType: "CLIENT",
              recipientName: booking.client.name,
              channel: "INTERNAL",
              status: "CONFIRMED",
              priority: "IMPORTANT",
              bookingId: booking.id,
              teacherId: replacement.oldTeacherId,
              clientId: booking.clientId,
              sentAt: now,
              confirmedAt: now,
              link: `/client/reservations/${booking.id}`,
              actionLabel: policy.refundAmount > 0 ? "Renseigner le remboursement" : "Voir l'annulation",
            },
          });
          await tx.notification.create({
            data: {
              userId: null,
              title: "Annulation sans pénalité - professeur indisponible",
              message: `${booking.client.name} a annulé ${booking.reference} après l'indisponibilité de ${oldTeacherName}. Pénalité client : 0 FCFA. Remboursement à traiter : ${policy.refundAmount.toLocaleString("fr-FR")} FCFA.`,
              type: "TEACHER_UNAVAILABLE_CANCELLATION",
              recipientType: "ADMIN",
              channel: "INTERNAL",
              status: "SENT",
              priority: "URGENT",
              bookingId: booking.id,
              teacherId: replacement.oldTeacherId,
              clientId: booking.clientId,
              sentAt: now,
              link: `/admin/reservations/${booking.id}`,
              actionLabel: policy.refundAmount > 0 ? "Traiter le remboursement" : "Voir l'annulation",
            },
          });
          await tx.clientCommunication.create({
            data: {
              clientId: booking.clientId,
              bookingId: booking.id,
              type: "TEACHER_CHANGE",
              channel: "INTERNAL",
              subject: `Annulation sans pénalité - ${booking.reference}`,
              content: `Le professeur initial est indisponible et vous avez choisi de ne pas accepter le remplaçant proposé. Aucune pénalité d'annulation n'est appliquée. Remboursement prévu : ${policy.refundAmount.toLocaleString("fr-FR")} FCFA. Frais de service paiement non remboursés : ${policy.serviceFeeAmount.toLocaleString("fr-FR")} FCFA.`,
              priority: "IMPORTANT",
              status: "SENT",
            },
          });
          await tx.adminActionLog.create({
            data: {
              action: "Annulation sans pénalité après indisponibilité professeur",
              entityType: "TeacherReplacement",
              entityId: replacement.id,
              detail: `${booking.client.name} a annulé ${booking.reference}. Cause professeur: ${oldTeacherName} indisponible. Pénalité client: 0 FCFA. Remboursement: ${policy.refundAmount} FCFA. Frais service non remboursés: ${policy.serviceFeeAmount} FCFA.`,
              oldStatus: "CLIENT_NOTIFIED",
              newStatus: "CANCELLED_WITHOUT_PENALTY",
            },
          });
          }, { isolationLevel: "Serializable" });
        } catch (error) {
          if (error instanceof BookingRefundWorkflowError) {
            return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
          }
          if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") {
            return NextResponse.json({
              error: "La réservation vient de changer. Rechargez-la avant de recommencer.",
              code: "CANCELLATION_SERIALIZATION_CONFLICT",
            }, { status: 409 });
          }
          console.error("teacher unavailable cancellation error", error);
          return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
        }

        return NextResponse.json({
          ok: true,
          cancellation: {
            reason: "TEACHER_UNAVAILABLE",
            penaltyAmount: 0,
            refundAmount: policy.refundAmount,
            paymentServiceFeeAmount: policy.serviceFeeAmount,
          },
        });
      }

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
      const nextCommission = booking.commissionAmount;
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

      try {
        await db.$transaction(async (tx) => {
        const lockedTeacherIds = await lockTeacherPayoutBalances(tx, [
          booking.teacherId,
          replacement.newTeacherId,
          ...booking.sessions.map((session) => session.teacherId),
        ]);
        const currentBooking = await tx.booking.findUnique({
          where: { id: booking.id },
          select: {
            id: true,
            clientId: true,
            teacherId: true,
            status: true,
            paymentStatus: true,
            updatedAt: true,
          },
        });
        if (
          !currentBooking
          || currentBooking.clientId !== userId
          || currentBooking.teacherId !== replacement.oldTeacherId
          || currentBooking.status !== booking.status
          || currentBooking.paymentStatus !== booking.paymentStatus
          || currentBooking.updatedAt.getTime() !== booking.updatedAt.getTime()
          || currentBooking.status === "DISPUTED"
          || currentBooking.paymentStatus === "DISPUTED"
          || isBookingFinanciallyTerminal(currentBooking)
          || isBookingRefundInProgressOrFinal(currentBooking)
        ) {
          throw new BookingRefundWorkflowError(
            "La réservation ou son professeur vient de changer.",
            409,
            "BOOKING_REPLACEMENT_CONFLICT",
          );
        }
        const activeDispute = await tx.dispute.findFirst({
          where: { bookingId: booking.id, status: { in: ["OPEN", "INVESTIGATING"] } },
          select: { id: true },
        });
        if (activeDispute) {
          throw new BookingRefundWorkflowError(
            "Clôturez d'abord le litige ouvert avant de remplacer le professeur.",
            409,
            "BOOKING_ACTIVE_DISPUTE",
          );
        }
        const currentReplacement = await tx.teacherReplacement.findUnique({ where: { id: replacement.id } });
        if (
          !currentReplacement
          || currentReplacement.bookingId !== booking.id
          || currentReplacement.oldTeacherId !== replacement.oldTeacherId
          || currentReplacement.newTeacherId !== replacement.newTeacherId
          || currentReplacement.status !== replacement.status
        ) {
          throw new BookingRefundWorkflowError(
            "Cette proposition vient d'être traitée depuis une autre fenêtre.",
            409,
            "TEACHER_REPLACEMENT_CONCURRENT_UPDATE",
          );
        }
        const bookingReassigned = await tx.booking.updateMany({
          where: {
            id: booking.id,
            clientId: userId,
            teacherId: currentBooking.teacherId,
            status: currentBooking.status,
            paymentStatus: currentBooking.paymentStatus,
            updatedAt: currentBooking.updatedAt,
          },
          data: {
            teacherId: replacement.newTeacherId,
            status: ["PAID", "PENDING_ADMIN_VALIDATION", "CONFIRMED", "ASSIGNED"].includes(booking.status) ? "ASSIGNED" : booking.status,
            assignedAt: booking.assignedAt ?? now,
            commissionRate: booking.commissionRate,
            commissionAmount: nextCommission,
            teacherRate: booking.teacherRate,
            teacherPayoutAmount: nextTeacherCoursePayout,
            transportFee: nextTransportFee,
            totalTeacherReceives: nextNet,
            teacherNetAmount: nextNet,
            pricingSnapshot: nextPricingSnapshot,
          },
        });
        if (bookingReassigned.count !== 1) {
          throw new BookingRefundWorkflowError(
            "La réservation vient de changer pendant le remplacement.",
            409,
            "BOOKING_REPLACEMENT_CONCURRENT_UPDATE",
          );
        }
        const futureSessions = await tx.bookingSession.findMany({
          where: {
            bookingId: booking.id,
            status: { in: ["PLANNED", "TEACHER_CONFIRMED", "IN_PROGRESS", "RESCHEDULE_PROPOSED", "REPLACEMENT_PROPOSED", "NEEDS_REPLACEMENT"] },
          },
          orderBy: { sequence: "asc" },
          include: {
            payoutAllocations: {
              select: { payout: { select: { status: true } } },
            },
          },
        });
        if (futureSessions.some((session) => !lockedTeacherIds.includes(session.teacherId))) {
          throw new BookingRefundWorkflowError(
            "L'affectation d'une séance vient de changer.",
            409,
            "BOOKING_REPLACEMENT_SESSION_TEACHER_CONFLICT",
          );
        }
        if (futureSessions.some((session) => (
          session.paidAmount > 0
          || session.payoutAllocations.some((allocation) => ["DRAFT", "PAID"].includes(allocation.payout.status))
        ))) {
          throw new BookingRefundWorkflowError(
            "Une séance possède déjà un versement professeur soumis ou exécuté.",
            409,
            "BOOKING_REPLACEMENT_PAYOUT_CONFLICT",
          );
        }
        if (futureSessions.length > 0) {
          const courseParts = distributeAmount(booking.courseAmount, booking.sessionsCount);
          const commissionParts = distributeAmount(nextCommission, booking.sessionsCount);
          const teacherParts = distributeAmount(nextTeacherCoursePayout, booking.sessionsCount);
          const transportParts = distributeAmount(nextTransportFee, booking.sessionsCount);
          for (const courseSession of futureSessions) {
            const index = Math.max(0, courseSession.sequence - 1);
            const sessionReassigned = await tx.bookingSession.updateMany({
              where: {
                id: courseSession.id,
                bookingId: booking.id,
                teacherId: courseSession.teacherId,
                status: courseSession.status,
                paidAmount: courseSession.paidAmount,
                releasedAmount: courseSession.releasedAmount,
                retainedAmount: courseSession.retainedAmount,
              },
              data: {
                teacherId: replacement.newTeacherId,
                proposedTeacherId: null,
                status: "PLANNED",
                courseAmount: courseParts[index] ?? courseSession.courseAmount,
                commissionAmount: commissionParts[index] ?? courseSession.commissionAmount,
                teacherCourseAmount: teacherParts[index] ?? courseSession.teacherCourseAmount,
                transportFee: transportParts[index] ?? courseSession.transportFee,
                teacherNetAmount: (teacherParts[index] ?? courseSession.teacherCourseAmount) + (transportParts[index] ?? courseSession.transportFee),
              },
            });
            if (sessionReassigned.count !== 1) {
              throw new BookingRefundWorkflowError(
                "La comptabilité d'une séance vient de changer.",
                409,
                "BOOKING_REPLACEMENT_SESSION_CONFLICT",
              );
            }
          }
        }
        await tx.transaction.updateMany({
          where: { bookingId: booking.id, type: "CLIENT_PAYMENT" },
          data: {
            teacherId: replacement.newTeacherId,
            commission: nextCommission,
            teacherNet: nextNet,
          },
        });
        const replacementApplied = await tx.teacherReplacement.updateMany({
          where: {
            id: replacement.id,
            bookingId: booking.id,
            oldTeacherId: replacement.oldTeacherId,
            newTeacherId: replacement.newTeacherId,
            status: replacement.status,
          },
          data: {
            financialImpact,
            clientMessage,
            oldTeacherMessage,
            newTeacherMessage,
            status: "APPLIED",
            appliedAt: now,
          },
        });
        if (replacementApplied.count !== 1) {
          throw new BookingRefundWorkflowError(
            "Cette proposition vient d'être traitée depuis une autre fenêtre.",
            409,
            "TEACHER_REPLACEMENT_CONCURRENT_UPDATE",
          );
        }
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
        }, { isolationLevel: "Serializable" });
      } catch (error) {
        if (error instanceof BookingRefundWorkflowError) {
          return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
        }
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") {
          return NextResponse.json({
            error: "La réservation vient de changer. Rechargez-la avant d'accepter le remplacement.",
            code: "BOOKING_REPLACEMENT_SERIALIZATION_CONFLICT",
          }, { status: 409 });
        }
        console.error("booking replacement acceptance error", error);
        return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
      }
      return NextResponse.json({ ok: true });
    }

    case "report":
    case "open_dispute": {
      if (isBookingFinanciallyTerminal(booking) || isBookingRefundInProgressOrFinal(booking)) {
        return NextResponse.json({ error: "Cette réservation est financièrement clôturée et ne peut plus être remise en litige." }, { status: 409 });
      }
      if (!hasVerifiedClientFunds(booking.paymentStatus) || !hasVerifiedPayDunyaClientPayment(booking)) {
        return NextResponse.json({
          error: "Un litige financier ne peut être ouvert qu'après confirmation serveur du paiement.",
        }, { status: 409 });
      }
      const r = reason || "Problème signalé par le client";
      const d = description || (action === "report" ? "Le client signale un problème sur ce cours." : "Litige ouvert par le client.");
      let disputeResult;
      try {
        disputeResult = await db.$transaction(async (tx) => {
          await assertBookingRefundPayoutSafetyInTransaction(tx, booking.id);
          const currentBooking = await tx.booking.findUnique({
            where: { id },
            include: { transactions: { where: { type: "CLIENT_PAYMENT" } } },
          });
          if (!currentBooking || currentBooking.clientId !== userId) {
            throw new BookingRefundWorkflowError("Réservation introuvable", 404, "BOOKING_NOT_FOUND");
          }
          if (isBookingFinanciallyTerminal(currentBooking) || isBookingRefundInProgressOrFinal(currentBooking)) {
            throw new BookingRefundWorkflowError(
              "Cette réservation est financièrement clôturée et ne peut plus être remise en litige.",
              409,
              "BOOKING_FINANCIALLY_TERMINAL",
            );
          }
          if (!hasVerifiedClientFunds(currentBooking.paymentStatus) || !hasVerifiedPayDunyaClientPayment(currentBooking)) {
            throw new BookingRefundWorkflowError(
              "Un litige financier ne peut être ouvert qu'après confirmation serveur du paiement.",
              409,
              "CLIENT_PAYMENT_NOT_VERIFIED",
            );
          }
          const openDispute = await tx.dispute.findFirst({
            where: { bookingId: id, status: { in: ["OPEN", "INVESTIGATING"] } },
            select: { id: true },
          });
          if (currentBooking.status === "DISPUTED" || openDispute) {
            throw new BookingRefundWorkflowError(
              "Un litige est déjà ouvert sur cette réservation.",
              409,
              "DISPUTE_ALREADY_OPEN",
            );
          }
          const transitioned = await tx.booking.updateMany({
            where: {
              id,
              clientId: userId,
              status: currentBooking.status,
              paymentStatus: currentBooking.paymentStatus,
            },
            data: { status: "DISPUTED", paymentStatus: "DISPUTED" },
          });
          if (transitioned.count !== 1) {
            throw new BookingRefundWorkflowError("La réservation a changé et ne peut pas être remise en litige.", 409, "BOOKING_TERMINAL_STATE_CONFLICT");
          }
          await tx.transaction.updateMany({
            where: {
              bookingId: id,
              type: "CLIENT_PAYMENT",
              status: { in: [...PAID_CLIENT_TRANSACTION_STATUSES] },
            },
            data: { status: "DISPUTED" },
          });
          const dispute = await tx.dispute.create({
            data: { bookingId: id, openedById: userId, reason: r, description: d, status: "OPEN" as DisputeStatus },
          });
          const updated = await tx.booking.findUniqueOrThrow({ where: { id } });
          await tx.notification.create({
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
          return { dispute, updated };
        }, { isolationLevel: "Serializable" });
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
        console.error("booking dispute error", error);
        return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
      }
      const { dispute, updated } = disputeResult;
      return NextResponse.json({ booking: publicBookingDetailPayload(updated), dispute });
    }

    case "request_reschedule": {
      if (requiresVerifiedPayDunyaForOperationalAction(booking)) {
        return NextResponse.json({ error: PAYMENT_PROOF_REQUIRED_ERROR }, { status: 409 });
      }
      if (!["PAID", "PENDING_ADMIN_VALIDATION", "CONFIRMED", "ASSIGNED"].includes(booking.status)) {
        return NextResponse.json({ error: "Cette réservation ne peut pas être déplacée à ce stade." }, { status: 400 });
      }

      const requestedSessionId = typeof bookingSessionId === "string" ? bookingSessionId.trim() : "";
      if (booking.sessions.length > 0 && !requestedSessionId) {
        return NextResponse.json({ error: "Choisissez la séance exacte à déplacer." }, { status: 400 });
      }
      const parsedReschedule = parseClientRescheduleInput(rescheduleDate, rescheduleTime);
      if (!parsedReschedule) {
        return NextResponse.json({ error: "Nouvelle date ou heure invalide." }, { status: 400 });
      }
      if (parsedReschedule.startsAt.getTime() < now.getTime() + 2 * 60 * 60 * 1000) {
        return NextResponse.json({ error: "Le nouveau créneau doit commencer au moins 2h après la demande. Pour une urgence, contactez le service client." }, { status: 400 });
      }

      const cleanReason = typeof rescheduleMessage === "string" ? rescheduleMessage.trim().slice(0, 700) : "";
      if (cleanReason.length < 5) {
        return NextResponse.json({ error: "Expliquez brièvement pourquoi vous souhaitez déplacer le créneau." }, { status: 400 });
      }

      let creationResult;
      try {
        creationResult = await db.$transaction(async (tx) => {
          const lockedBookingRows = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
            SELECT "id"
            FROM "Booking"
            WHERE "id" = ${booking.id}
            FOR UPDATE
          `);
          if (lockedBookingRows.length !== 1) {
            return { ok: false as const, status: 404, error: "Réservation introuvable." };
          }
          const lockedBooking = await tx.booking.findUnique({
            where: { id: booking.id },
            include: {
              transactions: { where: { type: "CLIENT_PAYMENT" }, orderBy: { createdAt: "desc" } },
            },
          });
          if (!lockedBooking || lockedBooking.clientId !== userId) {
            return { ok: false as const, status: 403, error: "Accès refusé." };
          }
          if (requiresVerifiedPayDunyaForOperationalAction(lockedBooking)) {
            return { ok: false as const, status: 409, error: PAYMENT_PROOF_REQUIRED_ERROR };
          }
          if (!["PAID", "PENDING_ADMIN_VALIDATION", "CONFIRMED", "ASSIGNED"].includes(lockedBooking.status)) {
            return { ok: false as const, status: 409, error: "Cette réservation vient de changer d'état et ne peut plus être déplacée." };
          }

          let lockedSession: (typeof booking.sessions)[number] | null = null;
          if (requestedSessionId) {
            // Le verrou fige l'affectation, le statut, le prix et le créneau
            // jusqu'à ce que la demande qui les photographie soit créée.
            const lockedRows = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
              SELECT "id"
              FROM "BookingSession"
              WHERE "id" = ${requestedSessionId} AND "bookingId" = ${booking.id}
              FOR UPDATE
            `);
            if (lockedRows.length !== 1) {
              return { ok: false as const, status: 400, error: "Cette séance n'appartient pas à la réservation." };
            }
            lockedSession = await tx.bookingSession.findUnique({ where: { id: requestedSessionId } });
            if (!lockedSession) {
              return { ok: false as const, status: 409, error: "Cette séance vient d'être supprimée. Actualisez la réservation." };
            }
            if (!isReschedulableBookingSessionStatus(lockedSession.status)) {
              return { ok: false as const, status: 409, error: "Seule une séance planifiée ou confirmée peut être déplacée." };
            }
            if (!lockedSession.scheduledDate || !lockedSession.scheduledTime) {
              return { ok: false as const, status: 409, error: "Cette séance n'a pas encore de créneau complet. Contactez le service client." };
            }
          } else {
            const sessionCount = await tx.bookingSession.count({ where: { bookingId: booking.id } });
            if (sessionCount > 0) {
              return { ok: false as const, status: 400, error: "Choisissez la séance exacte à déplacer." };
            }
          }

          const currentDate = lockedSession?.scheduledDate ?? lockedBooking.scheduledDate ?? lockedBooking.startDate;
          const currentTime = lockedSession?.scheduledTime ?? (lockedBooking.scheduledTime || lockedBooking.preferredTime);
          const rescheduleTeacherId = lockedSession?.teacherId ?? lockedBooking.teacherId;
          if (!currentDate) {
            return { ok: false as const, status: 400, error: "Aucun créneau initial n'est fixé. Contactez le service client pour planifier cette réservation." };
          }
          if (isSameDate(currentDate, parsedReschedule.date) && currentTime === parsedReschedule.slotLabel) {
            return { ok: false as const, status: 400, error: "Le nouveau créneau est identique au créneau actuel." };
          }

          const existingAwaiting = await tx.bookingRescheduleRequest.findFirst({
            where: {
              bookingId: booking.id,
              status: { in: ["PAYMENT_PENDING", "PAYMENT_FAILED", "AWAITING_TEACHER", "REFUND_REQUIRED"] },
            },
            orderBy: { createdAt: "desc" },
          });
          if (existingAwaiting) {
            return {
              ok: false as const,
              status: 409,
              error: existingAwaiting.status === "AWAITING_TEACHER"
                ? "Une modification est déjà en attente de réponse du professeur."
                : existingAwaiting.status === "REFUND_REQUIRED"
                  ? "Le supplément du précédent changement de créneau doit être remboursé avant une nouvelle demande."
                  : existingAwaiting.status === "PAYMENT_FAILED"
                    ? "Une modification existe déjà : relancez son paiement au lieu de créer une seconde demande."
                    : "Une modification est déjà en attente de paiement.",
            };
          }

          const pricingSnapshot = parsePricingSnapshot(lockedBooking.pricingSnapshot);
          const policy = getReschedulePolicy(lockedSession
            ? {
                unitPrice: lockedSession.courseAmount,
                courseAmount: lockedSession.courseAmount,
                totalClientPays: lockedSession.courseAmount,
                totalPrice: lockedSession.courseAmount,
                sessionsCount: 1,
                paymentServiceFeeAmount: 0,
                scheduledDate: lockedSession.scheduledDate,
                scheduledTime: lockedSession.scheduledTime,
              }
            : {
                unitPrice: pricingSnapshot?.unitSessionAmount ?? lockedBooking.unitPrice,
                courseAmount: pricingSnapshot?.courseAmount ?? lockedBooking.courseAmount,
                totalClientPays: pricingSnapshot?.totalClientPays ?? lockedBooking.totalClientPays,
                totalPrice: lockedBooking.totalPrice,
                sessionsCount: pricingSnapshot?.numberOfSessions ?? lockedBooking.sessionsCount,
                paymentServiceFeeAmount: pricingSnapshot?.paymentServiceFeeAmount ?? lockedBooking.paymentServiceFeeAmount,
                scheduledDate: currentDate,
                scheduledTime: currentTime,
              }, now);
          if (policy.code === "NO_SHOW") {
            return {
              ok: false as const,
              status: 409,
              error: "Le cours est déjà commencé ou dépassé. Le service client doit traiter cette modification manuellement.",
            };
          }

          const createdRequest = await tx.bookingRescheduleRequest.create({
            data: {
              bookingId: booking.id,
              bookingSessionId: lockedSession?.id ?? null,
              teacherId: rescheduleTeacherId,
              clientId: lockedBooking.clientId,
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
              paymentProvider: policy.feeAmount > 0 ? "JEKO" : null,
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
          return { ok: true as const, createdRequest, policy };
        }, { isolationLevel: "Serializable" });
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
          return NextResponse.json({
            error: "Une autre modification de créneau vient d'être créée pour cette réservation. Ouvrez-la au lieu d'en payer une seconde.",
          }, { status: 409 });
        }
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") {
          return NextResponse.json({
            error: "La séance vient d'être modifiée ou réaffectée. Actualisez avant de recommencer.",
          }, { status: 409 });
        }
        throw error;
      }
      if (!creationResult.ok) {
        return NextResponse.json({
          error: creationResult.error,
        }, { status: creationResult.status });
      }
      const { createdRequest, policy } = creationResult;

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

      const paymentMethod = platformMethodToJeko(booking.paymentMethod);
      if (!paymentMethod) {
        return NextResponse.json({
          error: "Choisissez un moyen Jèko pris en charge pour payer ce supplément.",
          code: "JEKO_PAYMENT_METHOD_REQUIRED",
          rescheduleRequest: serializeRescheduleRequest(createdRequest),
          paymentEndpoint: `/api/bookings/${booking.id}/reschedule-requests/${createdRequest.id}/jeko-payment`,
        }, { status: 409 });
      }

      let payment: Awaited<ReturnType<typeof createJekoRescheduleCheckout>>;
      try {
        const safeBookingId = encodeURIComponent(booking.id);
        const safeRequestId = encodeURIComponent(createdRequest.id);
        payment = await createJekoRescheduleCheckout({
          bookingId: booking.id,
          rescheduleRequestId: createdRequest.id,
          idempotencyKey: `RESCHEDULE:${createdRequest.id}:JEKO:ATTEMPT:1`,
          paymentMethod,
          successUrl: absoluteAppUrl(
            `/client/reservations/${safeBookingId}?jekoReschedule=return&rescheduleRequestId=${safeRequestId}`,
            req,
          ),
          errorUrl: absoluteAppUrl(
            `/client/reservations/${safeBookingId}?jekoReschedule=cancelled&rescheduleRequestId=${safeRequestId}`,
            req,
          ),
        });
      } catch (error) {
        console.error("[jeko:reschedule_initial_checkout_failed]", {
          bookingId: booking.id,
          rescheduleRequestId: createdRequest.id,
          message: error instanceof Error ? error.message : "Erreur inconnue",
        });
        return NextResponse.json({
          error: "Le supplément Jèko n'a pas pu être préparé. Vous pouvez le relancer sans double débit.",
          rescheduleRequest: serializeRescheduleRequest(createdRequest),
        }, { status: 503 });
      }

      await db.adminActionLog.create({
        data: {
          adminId: null,
          action: "Supplément modification Jèko créé",
          entityType: "BookingRescheduleRequest",
          entityId: createdRequest.id,
          detail: `${booking.client.name} doit payer ${policy.totalToPay.toLocaleString("fr-FR")} FCFA pour déplacer ${booking.reference}. Frais: ${policy.feeAmount.toLocaleString("fr-FR")} FCFA, service: ${policy.paymentServiceFeeAmount.toLocaleString("fr-FR")} FCFA.`,
          oldStatus: "NONE",
          newStatus: "PAYMENT_PENDING",
        },
      });

      return NextResponse.json({
        ok: true,
        rescheduleRequest: serializeRescheduleRequest(createdRequest),
        policy,
        payment: {
          provider: "JEKO",
          purpose: "RESCHEDULE_FEE",
          configured: true,
          attemptId: payment.attemptId,
          reference: payment.reference,
          amount: payment.amountXof,
          status: payment.status,
          checkoutUrl: isAllowedJekoRedirectUrl(payment.checkoutUrl) ? payment.checkoutUrl : null,
        },
        message: "Supplément requis avant transmission au professeur.",
      });
    }

    case "reschedule_fee_verify": {
      const requestId = typeof rescheduleRequestId === "string" ? rescheduleRequestId : null;
      const token = typeof body.token === "string" ? body.token : null;
      if (!requestId && !token) {
        return NextResponse.json({ error: "Demande de modification introuvable." }, { status: 400 });
      }
      const request = await db.bookingRescheduleRequest.findFirst({
        where: {
          bookingId: booking.id,
          clientId: booking.clientId,
          OR: [
            ...(requestId ? [{ id: requestId }] : []),
            ...(token ? [{ paydunyaToken: token }] : []),
          ],
        },
      });
      if (!request) return NextResponse.json({ error: "Demande de modification introuvable." }, { status: 404 });

      if (request.paymentProvider !== "JEKO") {
        const result = await reconcilePayDunyaReschedulePayment({
          bookingId: booking.id,
          rescheduleRequestId: request.id,
          token,
          expectedClientId: booking.clientId,
          source: "client_manual",
          incomingPayload: body,
        });
        return NextResponse.json({
          ok: result.verified,
          payment: { provider: "PAYDUNYA", ...result },
        }, { status: result.action === "rejected" ? 409 : 200 });
      }

      const attempt = await db.paymentAttempt.findFirst({
        where: {
          bookingId: booking.id,
          rescheduleRequestId: request.id,
          provider: "JEKO",
          purpose: "RESCHEDULE_FEE",
        },
        orderBy: { createdAt: "desc" },
      });
      if (!attempt) {
        return NextResponse.json({ error: "Aucune tentative Jèko pour ce supplément." }, { status: 404 });
      }
      try {
        const result = await reconcileJekoReschedulePaymentAttempt(attempt.id, {
          expectedBookingId: booking.id,
          expectedClientId: booking.clientId,
          expectedRescheduleRequestId: request.id,
        });
        return NextResponse.json({
          ok: result.verified,
          payment: { provider: "JEKO", purpose: "RESCHEDULE_FEE", ...result },
        }, { status: result.action === "rejected" ? 409 : 200 });
      } catch (error) {
        console.error("[jeko:reschedule_manual_verification_failed]", {
          bookingId: booking.id,
          rescheduleRequestId: request.id,
          attemptId: attempt.id,
          message: error instanceof Error ? error.message : "Erreur inconnue",
        });
        return NextResponse.json({
          error: "La confirmation Jèko est temporairement indisponible. Aucun supplément n'a été validé.",
        }, { status: 503 });
      }
    }

    case "reschedule_fee_checkout": {
      if (requiresVerifiedPayDunyaForOperationalAction(booking)) {
        return NextResponse.json({ error: PAYMENT_PROOF_REQUIRED_ERROR }, { status: 409 });
      }
      const requestId = typeof rescheduleRequestId === "string" ? rescheduleRequestId : null;
      if (!requestId) {
        return NextResponse.json({ error: "Demande de modification introuvable." }, { status: 400 });
      }
      const request = await db.bookingRescheduleRequest.findFirst({
        where: {
          id: requestId,
          bookingId: booking.id,
          clientId: booking.clientId,
          status: { in: ["PAYMENT_PENDING", "PAYMENT_FAILED"] },
        },
      });
      if (!request) {
        return NextResponse.json({ error: "Aucun supplément à payer pour cette demande." }, { status: 404 });
      }
      if (request.feeAmount <= 0 || request.totalToPay <= 0) {
        return NextResponse.json({ error: "Cette modification ne nécessite pas de supplément." }, { status: 400 });
      }

      if (request.paymentProvider === "JEKO") {
        const paymentMethod = platformMethodToJeko(booking.paymentMethod);
        if (!paymentMethod) {
          return NextResponse.json({
            error: "Choisissez un moyen Jèko pris en charge pour payer ce supplément.",
            code: "JEKO_PAYMENT_METHOD_REQUIRED",
            paymentEndpoint: `/api/bookings/${booking.id}/reschedule-requests/${request.id}/jeko-payment`,
          }, { status: 409 });
        }
        const attempts = await db.paymentAttempt.findMany({
          where: {
            bookingId: booking.id,
            rescheduleRequestId: request.id,
            provider: "JEKO",
            purpose: "RESCHEDULE_FEE",
          },
          select: {
            id: true,
            idempotencyKey: true,
            status: true,
            method: true,
            providerOrderId: true,
            failureCode: true,
          },
          orderBy: { createdAt: "desc" },
        });
        const plan = planJekoRescheduleAttempt({
          rescheduleRequestId: request.id,
          requestedMethod: paymentMethod,
          attempts,
        });
        if (plan.kind === "already_paid") {
          const result = await reconcileJekoReschedulePaymentAttempt(plan.attemptId, {
            expectedBookingId: booking.id,
            expectedClientId: booking.clientId,
            expectedRescheduleRequestId: request.id,
          });
          return NextResponse.json({
            ok: result.verified,
            payment: { provider: "JEKO", purpose: "RESCHEDULE_FEE", ...result, checkoutUrl: null },
          }, { status: result.verified ? 200 : 409 });
        }
        if (plan.kind === "blocked") {
          return NextResponse.json({ error: plan.reason, attemptId: plan.attemptId }, { status: 409 });
        }

        try {
          const safeBookingId = encodeURIComponent(booking.id);
          const safeRequestId = encodeURIComponent(request.id);
          const payment = await createJekoRescheduleCheckout({
            bookingId: booking.id,
            rescheduleRequestId: request.id,
            idempotencyKey: plan.idempotencyKey,
            paymentMethod: plan.paymentMethod,
            successUrl: absoluteAppUrl(
              `/client/reservations/${safeBookingId}?jekoReschedule=return&rescheduleRequestId=${safeRequestId}`,
              req,
            ),
            errorUrl: absoluteAppUrl(
              `/client/reservations/${safeBookingId}?jekoReschedule=cancelled&rescheduleRequestId=${safeRequestId}`,
              req,
            ),
          });
          return NextResponse.json({
            ok: true,
            payment: {
              provider: "JEKO",
              purpose: "RESCHEDULE_FEE",
              configured: true,
              attemptId: payment.attemptId,
              reference: payment.reference,
              amount: payment.amountXof,
              status: payment.status,
              checkoutUrl: isAllowedJekoRedirectUrl(payment.checkoutUrl) ? payment.checkoutUrl : null,
              message: plan.kind === "reuse"
                ? "Lien Jèko du supplément réutilisé."
                : "Lien Jèko du supplément créé.",
            },
          });
        } catch (error) {
          console.error("[jeko:reschedule_checkout_retry_failed]", {
            bookingId: booking.id,
            rescheduleRequestId: request.id,
            message: error instanceof Error ? error.message : "Erreur inconnue",
          });
          return NextResponse.json({
            error: "Jèko n'a pas pu préparer le supplément. Vous pouvez réessayer sans risque de double débit.",
          }, { status: 503 });
        }
      }

      const reusableStatus = (request.paydunyaStatus ?? "").toUpperCase();
      const canReusePayDunyaCheckout = Boolean(
        request.paydunyaCheckoutUrl
        && !["COMPLETED", "FAILED", "CANCELLED", "CANCELED", "REJECTED", "CREATE_FAILED", "NOT_CONFIGURED"].includes(reusableStatus),
      );
      if (canReusePayDunyaCheckout) {
        return NextResponse.json({
          ok: true,
          payment: {
            provider: "PAYDUNYA",
            configured: true,
            checkoutUrl: request.paydunyaCheckoutUrl,
            status: request.paydunyaStatus ?? "PENDING",
            message: "Lien PayDunya du supplément réutilisé.",
          },
        });
      }

      // Les anciens liens PayDunya existants restent réutilisables et leurs
      // callbacks restent rapprochés. En revanche, toute nouvelle création est
      // coupée afin qu'une demande nullable ne puisse pas courir contre Jèko.
      return NextResponse.json({
        error: "La création de nouveaux suppléments PayDunya est désactivée. Le service client doit migrer explicitement la demande vers Jèko.",
        code: "PAYDUNYA_NEW_CHECKOUT_DISABLED",
        payment: {
          provider: "PAYDUNYA",
          configured: false,
          checkoutUrl: null,
          migrationProvider: "JEKO",
        },
      }, { status: 409 });

    }

    case "reschedule": {
      if (requiresVerifiedPayDunyaForOperationalAction(booking)) {
        return NextResponse.json({ error: PAYMENT_PROOF_REQUIRED_ERROR }, { status: 409 });
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
      const cancellableStatuses = ["PAID", "PENDING_ADMIN_VALIDATION", "CONFIRMED", "ASSIGNED", "PENDING_CLIENT_VALIDATION"];
      const wasPaid = cancellableStatuses.includes(
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
      let cancellationResult;
      try {
        cancellationResult = await db.$transaction(async (tx) => {
          // Même mutex professeur que la création d'un DRAFT Jèko. Un
          // transfert soumis ou une séance déjà payée bloque l'annulation.
          await assertBookingRefundPayoutSafetyInTransaction(tx, booking.id);
          // Partage le verrou de request_reschedule : soit l'annulation gagne
          // et la création revalide CANCELLED, soit la demande gagne et bloque
          // l'annulation tant que son paiement/réponse n'est pas terminal.
          await tx.$queryRaw(Prisma.sql`
            SELECT "id"
            FROM "Booking"
            WHERE "id" = ${booking.id}
            FOR UPDATE
          `);
          const currentBooking = await tx.booking.findUnique({
            where: { id: booking.id },
            select: { id: true, clientId: true, status: true, paymentStatus: true, updatedAt: true },
          });
          if (!currentBooking || currentBooking.clientId !== userId) {
            return { ok: false as const, status: 404, error: "Réservation introuvable." };
          }
          if (!cancellableStatuses.includes(currentBooking.status)) {
            return { ok: false as const, status: 409, error: "Cette réservation ne peut plus être annulée depuis cet écran." };
          }
          if (
            currentBooking.paymentStatus !== booking.paymentStatus
            || currentBooking.updatedAt.getTime() !== booking.updatedAt.getTime()
            || currentBooking.status === "DISPUTED"
            || currentBooking.paymentStatus === "DISPUTED"
            || isBookingFinanciallyTerminal(currentBooking)
            || isBookingRefundInProgressOrFinal(currentBooking)
          ) {
            return { ok: false as const, status: 409, error: "La situation financière de cette réservation vient de changer." };
          }
          const activeReschedule = await tx.bookingRescheduleRequest.findFirst({
            where: {
              bookingId: booking.id,
              OR: [
                { status: { in: ["PAYMENT_PENDING", "PAYMENT_FAILED", "AWAITING_TEACHER", "REFUND_REQUIRED"] } },
                {
                  paymentAttempts: {
                    some: {
                      provider: "JEKO",
                      purpose: "RESCHEDULE_FEE",
                      OR: [
                        { status: { in: ["CREATED", "REQUESTING", "PENDING"] } },
                        { status: "FAILED", providerOrderId: { not: null } },
                      ],
                    },
                  },
                },
              ],
            },
            select: { id: true },
          });
          if (activeReschedule) {
            return {
              ok: false as const,
              status: 409,
              error: "Terminez ou annulez d'abord la demande de changement de créneau en cours.",
            };
          }
          const activeDispute = await tx.dispute.findFirst({
            where: { bookingId: booking.id, status: { in: ["OPEN", "INVESTIGATING"] } },
            select: { id: true },
          });
          if (activeDispute) {
            return {
              ok: false as const,
              status: 409,
              error: "Clôturez d'abord le litige ouvert avant d'annuler cette réservation.",
            };
          }

          // Les contrôles sont terminés : la neutralisation peut maintenant
          // être appliquée sans risquer d'être validée par un retour {ok:false}.
          await prepareBookingSessionsForRefundInTransaction(tx, {
            bookingId: booking.id,
            actorId: userId,
            actorType: "CLIENT",
            now,
          });
          const cancelled = await tx.booking.updateMany({
            where: {
              id,
              clientId: userId,
              status: currentBooking.status,
              paymentStatus: currentBooking.paymentStatus,
              updatedAt: currentBooking.updatedAt,
            },
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
          if (cancelled.count !== 1) {
            throw new BookingRefundWorkflowError(
              "La réservation vient de changer pendant l'annulation.",
              409,
              "BOOKING_CANCELLATION_CONCURRENT_UPDATE",
            );
          }
          if (wasPaid) {
            await tx.transaction.updateMany({
              where: {
                bookingId: booking.id,
                type: "CLIENT_PAYMENT",
                status: { in: [...PAID_CLIENT_TRANSACTION_STATUSES] },
              },
              data: { status: paymentStatus },
            });
          }
          const updated = await tx.booking.findUniqueOrThrow({ where: { id } });
          return { ok: true as const, updated };
        }, { isolationLevel: "Serializable" });
      } catch (error) {
        if (error instanceof BookingRefundWorkflowError) {
          return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
        }
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") {
          return NextResponse.json({
            error: "La réservation vient d'être modifiée. Actualisez avant de recommencer.",
          }, { status: 409 });
        }
        throw error;
      }
      if (!cancellationResult.ok) {
        return NextResponse.json({ error: cancellationResult.error }, { status: cancellationResult.status });
      }
      const { updated } = cancellationResult;
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
      const refundDetailsAllowed = ["CANCELLED", "DISPUTED", "REFUNDED"].includes(booking.status)
        && ["REFUND_PENDING", "PARTIAL_REFUND_PENDING", "PARTIALLY_REFUNDED"].includes(booking.paymentStatus);
      if (!refundDetailsAllowed || booking.cancellationRefundAmount <= 0) {
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
    bookingSessionId: request.bookingSessionId,
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
    paymentProvider: request.paymentProvider,
    paydunyaStatus: request.paydunyaStatus,
    paydunyaVerifiedAt: request.paydunyaVerifiedAt,
    paidAt: request.paidAt,
    teacherResponse: request.teacherResponse,
    teacherRespondedAt: request.teacherRespondedAt,
    appliedAt: request.appliedAt,
    createdAt: request.createdAt,
  };
}
