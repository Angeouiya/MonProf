import "server-only";

import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { generateReference } from "@/lib/format";
import { requireJekoServerConfig, type JekoServerConfig } from "@/lib/jeko-config";
import {
  confirmJekoPaymentRequest,
  getJekoPaymentRedirectUrl,
  type JekoPaymentConfirmation,
} from "@/lib/jeko";
import { recoverJekoPaymentAttemptIdentity } from "@/lib/jeko-payment-request-recovery";
import { reconcileJekoRescheduleWebhook } from "@/lib/jeko-reschedule-reconciliation";
import { isClientDeletedDraft } from "@/lib/booking-draft-deletion";
import { resolveJekoPaymentStatusConsensus } from "@/lib/jeko-client-payment";
import {
  isJekoIncomingPaymentType,
  jekoAmountCentsToXof,
  jekoFeeCentsToCoveredXof,
  jekoPayloadSha256,
  normalizeJekoPaymentMethod,
  normalizeJekoPaymentStatus,
  xofToJekoAmountCents,
  type ParsedJekoWebhook,
} from "@/lib/jeko-utils";

const SECURED_PAYMENT_STATUSES = new Set([
  "RECEIVED",
  "BLOCKED",
  "VALIDATED",
  "TO_PAY_TEACHER",
  "TEACHER_PAID",
  "DISPUTED",
  "REFUND_PENDING",
  "PARTIAL_REFUND_PENDING",
  "PARTIALLY_REFUNDED",
  "RETAINED",
]);

type ReconcileJekoInput = {
  webhook: ParsedJekoWebhook;
  payloadSha256: string;
  config?: JekoServerConfig;
  confirmation?: JekoPaymentConfirmation;
  verificationSource?: "WEBHOOK" | "SERVER_CONFIRMATION";
};

export type ReconcileJekoResult = {
  attemptId?: string;
  bookingId?: string | null;
  rescheduleRequestId?: string | null;
  verified: boolean;
  action: "paid" | "already_paid" | "pending" | "failed" | "rejected" | "duplicate" | "ignored" | "not_found";
  status: "success" | "pending" | "error" | "rejected" | "ignored";
  message: string;
};

export async function reconcileJekoWebhook(input: ReconcileJekoInput): Promise<ReconcileJekoResult> {
  const config = input.config ?? requireJekoServerConfig();
  const verificationSource = input.verificationSource ?? "WEBHOOK";
  const { webhook } = input;
  const incoming = webhook.transaction;

  if (webhook.eventType !== "transaction.completed" || !isJekoIncomingPaymentType(incoming.transactionType)) {
    return {
      verified: false,
      action: "ignored",
      status: "ignored",
      message: "Événement Jèko sans encaissement Compétence ignoré.",
    };
  }

  const providerOrderId = incoming.transactionDetails?.id?.trim() ?? "";
  const reference = incoming.transactionDetails?.reference?.trim() ?? "";
  if (!providerOrderId || !reference) {
    return {
      verified: false,
      action: "rejected",
      status: "rejected",
      message: "Webhook Jèko rejeté : identifiant de demande ou référence absent.",
    };
  }

  const previousEvent = await db.paymentEvent.findUnique({
    where: { dedupeKey: webhook.dedupeKey },
    include: {
      paymentAttempt: { select: { status: true, bookingId: true, rescheduleRequestId: true } },
    },
  });
  if (previousEvent?.status === "PROCESSED" || previousEvent?.status === "REJECTED") {
    const wasSuccessful = previousEvent.status === "PROCESSED"
      && previousEvent.paymentAttempt?.status === "SUCCEEDED";
    return {
      attemptId: previousEvent.paymentAttemptId ?? undefined,
      bookingId: previousEvent.paymentAttempt?.bookingId,
      rescheduleRequestId: previousEvent.paymentAttempt?.rescheduleRequestId,
      verified: wasSuccessful,
      action: "duplicate",
      status: previousEvent.status === "REJECTED"
        ? "rejected"
        : wasSuccessful
          ? "success"
          : "error",
      message: wasSuccessful
        ? "Événement Jèko déjà rapproché ; aucun double crédit."
        : "Événement Jèko déjà traité sans validation de fonds.",
    };
  }

  const candidates = await db.paymentAttempt.findMany({
    where: {
      provider: "JEKO",
      OR: [
        { providerOrderId },
        { reference },
      ],
    },
    include: {
      booking: {
        select: {
          id: true,
          reference: true,
          teacherId: true,
          status: true,
          paymentStatus: true,
          totalClientPays: true,
          totalPrice: true,
          commissionAmount: true,
          teacherNetAmount: true,
        },
      },
      transaction: { select: { id: true } },
    },
    take: 3,
  });

  if (candidates.length === 0) {
    return {
      verified: false,
      action: "not_found",
      status: "pending",
      message: "Tentative Jèko pas encore disponible ; Jèko peut réessayer le webhook.",
    };
  }
  if (candidates.length !== 1) {
    return {
      verified: false,
      action: "rejected",
      status: "rejected",
      message: "Webhook Jèko ambigu : référence et identifiant pointent vers des tentatives différentes.",
    };
  }

  const attempt = candidates[0];
  if (attempt.purpose === "RESCHEDULE_FEE") {
    return reconcileJekoRescheduleWebhook({
      attemptId: attempt.id,
      webhook,
      payloadSha256: input.payloadSha256,
      config,
      confirmation: input.confirmation,
      verificationSource,
    });
  }
  let confirmation: JekoPaymentConfirmation;
  try {
    confirmation = input.confirmation ?? await confirmJekoPaymentRequest(providerOrderId, { config });
  } catch (error) {
    await recordTransientJekoEvent({
      attemptId: attempt.id,
      webhook,
      payloadSha256: input.payloadSha256,
      verificationSource,
      message: error instanceof Error ? error.message : "Confirmation Jèko indisponible.",
    });
    throw error;
  }

  const incomingMethod = normalizeJekoPaymentMethod(incoming.paymentMethod);
  const confirmedTransaction = confirmation.transaction;
  const expectedBookingAmount = attempt.booking
    ? (attempt.booking.totalClientPays > 0 ? attempt.booking.totalClientPays : attempt.booking.totalPrice)
    : attempt.amountXof;
  const mismatches = [
    attempt.reference !== reference ? "référence locale différente" : "",
    attempt.providerOrderId && attempt.providerOrderId !== providerOrderId ? "identifiant Jèko local différent" : "",
    confirmation.id !== providerOrderId ? "identifiant Jèko confirmé différent" : "",
    confirmation.reference !== reference ? "référence Jèko confirmée différente" : "",
    confirmation.storeId !== config.storeId ? "magasin Jèko confirmé différent" : "",
    attempt.storeId && attempt.storeId !== config.storeId ? "magasin local différent" : "",
    attempt.currency !== "XOF" ? "devise locale différente" : "",
    incoming.amount.currency !== "XOF" ? "devise webhook différente" : "",
    incoming.fees.currency !== "XOF" ? "devise de frais webhook différente" : "",
    attempt.providerAmountMinor !== xofToJekoAmountCents(attempt.amountXof) ? "instantané local incohérent" : "",
    incoming.amount.amount !== attempt.providerAmountMinor ? "montant webhook différent" : "",
    expectedBookingAmount !== attempt.amountXof ? "montant de réservation modifié" : "",
    !incomingMethod ? "méthode webhook inconnue" : "",
    attempt.method && incomingMethod && attempt.method !== toPlatformPaymentMethod(incomingMethod)
      ? "méthode locale différente"
      : "",
    confirmation.paymentMethod && incomingMethod && confirmation.paymentMethod !== incomingMethod
      ? "méthode confirmée différente"
      : "",
    confirmedTransaction && confirmedTransaction.id !== incoming.id ? "identifiant de transaction différent" : "",
    confirmedTransaction && confirmedTransaction.amountCents !== attempt.providerAmountMinor ? "montant confirmé différent" : "",
    confirmedTransaction && confirmedTransaction.currency !== "XOF" ? "devise confirmée différente" : "",
    confirmedTransaction && confirmedTransaction.feeCurrency !== "XOF" ? "devise des frais confirmés différente" : "",
    confirmedTransaction && incoming.fees.amount !== confirmedTransaction.feeCents ? "frais webhook différents des frais confirmés" : "",
  ].filter(Boolean);

  if (mismatches.length > 0) {
    return recordRejectedJekoEvent({
      attempt,
      webhook,
      payloadSha256: input.payloadSha256,
      config,
      confirmation,
      verificationSource,
      reason: `Rapprochement Jèko rejeté : ${mismatches.join(", ")}.`,
    });
  }

  const incomingStatus = normalizeJekoPaymentStatus(incoming.status);
  if (
    attempt.status === "SUCCEEDED"
    && (
      confirmation.status !== "success"
      || confirmedTransaction?.status !== "success"
      || incomingStatus !== "success"
    )
  ) {
    return recordRejectedJekoEvent({
      attempt,
      webhook,
      payloadSha256: input.payloadSha256,
      config,
      confirmation,
      verificationSource,
      reason: "Statut Jèko contradictoire après un paiement déjà sécurisé ; aucun déclassement automatique appliqué.",
    });
  }
  if (!confirmedTransaction) {
    await recordPendingJekoEvent({
      attemptId: attempt.id,
      webhook,
      payloadSha256: input.payloadSha256,
      config,
      confirmation,
      verificationSource,
    });
    return {
      attemptId: attempt.id,
      bookingId: attempt.bookingId,
      verified: false,
      action: "pending",
      status: "pending",
      message: "Paiement Jèko encore en attente de confirmation finale.",
    };
  }

  const statusConsensus = resolveJekoPaymentStatusConsensus([
    confirmation.status,
    confirmedTransaction.status,
    incomingStatus,
  ]);
  if (statusConsensus === "pending") {
    await recordPendingJekoEvent({
      attemptId: attempt.id,
      webhook,
      payloadSha256: input.payloadSha256,
      config,
      confirmation,
      verificationSource,
    });
    return {
      attemptId: attempt.id,
      bookingId: attempt.bookingId,
      verified: false,
      action: "pending",
      status: "pending",
      message: "Paiement Jèko encore en attente d'une confirmation finale cohérente.",
    };
  }

  if (statusConsensus === "error") {
    return recordFailedJekoEvent({
      attempt,
      webhook,
      payloadSha256: input.payloadSha256,
      config,
      confirmation,
      verificationSource,
    });
  }

  // Cette conversion stricte constitue le dernier garde-fou avant de toucher
  // aux soldes applicatifs. Elle échoue si Jèko renvoie une fraction de FCFA.
  const paidAmountXof = jekoAmountCentsToXof(confirmedTransaction.amountCents);
  const providerFeeXof = jekoFeeCentsToCoveredXof(confirmedTransaction.feeCents);
  const paymentMethod = incomingMethod!;
  const now = new Date();
  let action: ReconcileJekoResult["action"] = "paid";

  await db.$transaction(async (tx) => {
    const current = await tx.paymentAttempt.findUnique({
      where: { id: attempt.id },
      include: {
        booking: {
          select: {
            id: true,
            reference: true,
            teacherId: true,
            clientId: true,
            status: true,
            cancellationReason: true,
            paymentStatus: true,
            paymentProvider: true,
            providerPaymentStatus: true,
            paymentVerifiedAt: true,
            commissionAmount: true,
            teacherNetAmount: true,
          },
        },
      },
    });
    if (!current) throw new Error("Tentative Jèko supprimée pendant le rapprochement.");

    const knownEvent = await tx.paymentEvent.findUnique({ where: { dedupeKey: webhook.dedupeKey } });
    if (knownEvent?.status === "PROCESSED" || current.status === "SUCCEEDED") {
      action = knownEvent?.status === "PROCESSED"
        ? (current.status === "SUCCEEDED" ? "duplicate" : "failed")
        : "already_paid";
      await tx.paymentEvent.upsert({
        where: { dedupeKey: webhook.dedupeKey },
        create: eventCreateData({
          attemptId: current.id,
          webhook,
          payloadSha256: input.payloadSha256,
          status: "PROCESSED",
          config,
          confirmation,
          amountXof: paidAmountXof,
          providerFeeXof,
          processedAt: now,
          verificationSource,
        }),
        update: {
          status: "PROCESSED",
          processingError: current.status === "SUCCEEDED" ? null : knownEvent?.processingError,
          processedAt: now,
        },
      });
      return;
    }
    if (current.status === "REJECTED") {
      action = "rejected";
      await tx.paymentEvent.upsert({
        where: { dedupeKey: webhook.dedupeKey },
        create: eventCreateData({
          attemptId: current.id,
          webhook,
          payloadSha256: input.payloadSha256,
          status: "REJECTED",
          config,
          confirmation,
          amountXof: paidAmountXof,
          providerFeeXof,
          processingError: "Tentative locale déjà rejetée.",
          processedAt: now,
          verificationSource,
        }),
        update: { status: "REJECTED", processingError: "Tentative locale déjà rejetée.", processedAt: now },
      });
      return;
    }

    const claimed = await tx.paymentAttempt.updateMany({
      where: {
        id: current.id,
        status: { in: ["CREATED", "REQUESTING", "PENDING", "FAILED"] },
      },
      data: {
        status: "SUCCEEDED",
        providerOrderId,
        checkoutUrl: getJekoPaymentRedirectUrl(confirmation),
        storeId: config.storeId,
        providerFeeAmountMinor: confirmedTransaction.feeCents,
        providerFeeAmountXof: providerFeeXof,
        responsePayload: toJson(confirmation.raw),
        failureCode: null,
        failureReason: null,
        lastCheckedAt: now,
        verifiedAt: now,
        completedAt: now,
        failedAt: null,
      },
    });
    if (claimed.count === 0) {
      action = "already_paid";
      return;
    }

    let transactionId = current.transactionId;
    if (!transactionId && current.booking) {
      const financialTransaction = await tx.transaction.create({
        data: {
          reference: generateReference("TX-JEKO"),
          bookingId: current.booking.id,
          teacherId: current.booking.teacherId,
          amount: paidAmountXof,
          commission: current.commissionAmountXof,
          teacherNet: current.teacherAmountXof,
          type: "CLIENT_PAYMENT",
          status: "BLOCKED",
          method: toPlatformPaymentMethod(paymentMethod),
          paidAt: now,
        },
      });
      transactionId = financialTransaction.id;
    } else if (transactionId) {
      await tx.transaction.update({
        where: { id: transactionId },
        data: {
          amount: paidAmountXof,
          commission: current.commissionAmountXof,
          teacherNet: current.teacherAmountXof,
          status: "BLOCKED",
          method: toPlatformPaymentMethod(paymentMethod),
          paidAt: now,
        },
      });
    }

    if (current.booking) {
      const bookingWasAlreadySecured = SECURED_PAYMENT_STATUSES.has(current.booking.paymentStatus);
      const clientDeletedDraft = isClientDeletedDraft(current.booking);
      const nextPaymentStatus = bookingWasAlreadySecured
        ? current.booking.paymentStatus
        : clientDeletedDraft
          ? "REFUND_PENDING"
          : "BLOCKED";
      const preserveAnotherProvider = bookingWasAlreadySecured && current.booking.paymentProvider !== "JEKO";
      await tx.booking.update({
        where: { id: current.booking.id },
        data: {
          status: current.booking.status === "PENDING_PAYMENT" ? "PAID" : current.booking.status,
          paymentStatus: nextPaymentStatus,
          paymentMethod: toPlatformPaymentMethod(paymentMethod),
          paymentProvider: preserveAnotherProvider ? current.booking.paymentProvider : "JEKO",
          providerPaymentStatus: preserveAnotherProvider ? current.booking.providerPaymentStatus : "SUCCESS",
          paymentVerifiedAt: preserveAnotherProvider ? current.booking.paymentVerifiedAt : now,
        },
      });
      await tx.adminActionLog.create({
        data: {
          adminId: null,
          action: clientDeletedDraft
            ? "Paiement Jèko reçu après suppression d'un brouillon"
            : "Paiement Jèko vérifié serveur",
          entityType: "Booking",
          entityId: current.booking.id,
          detail: `Référence ${reference}. Montant confirmé : ${paidAmountXof} FCFA. Frais Jèko couverts : ${providerFeeXof} FCFA (${confirmedTransaction.feeCents} unités mineures).${clientDeletedDraft ? " Le brouillon avait déjà été retiré par le client : aucun cours n'est activé et les fonds passent en remboursement." : ""}${preserveAnotherProvider ? " Alerte : la réservation possédait déjà des fonds sécurisés par un autre flux ; contrôle de double encaissement requis." : ""}`,
          oldStatus: current.booking.paymentStatus,
          newStatus: nextPaymentStatus,
        },
      });
      if (clientDeletedDraft) {
        await tx.notification.createMany({
          data: [
            {
              userId: current.booking.clientId,
              title: "Paiement reçu après suppression",
              message: `Le paiement ${current.booking.reference} a été reçu alors que vous aviez supprimé le brouillon. Aucun cours n'a été activé ; le remboursement est maintenant en traitement.`,
              type: "REFUND_REQUESTED",
              recipientType: "CLIENT",
              channel: "INTERNAL",
              status: "SENT",
              priority: "IMPORTANT",
              bookingId: current.booking.id,
              teacherId: current.booking.teacherId,
              clientId: current.booking.clientId,
              sentAt: now,
              link: `/client/reservations/${current.booking.id}`,
              actionLabel: "Suivre le remboursement",
            },
            {
              userId: null,
              title: "Remboursement requis après suppression",
              message: `Jèko a confirmé ${current.booking.reference} après la suppression du brouillon par le client. Le cours reste annulé et ${paidAmountXof} FCFA doivent être remboursés.`,
              type: "REFUND_REQUESTED",
              recipientType: "ADMIN",
              channel: "INTERNAL",
              status: "SENT",
              priority: "URGENT",
              bookingId: current.booking.id,
              teacherId: current.booking.teacherId,
              clientId: current.booking.clientId,
              sentAt: now,
              link: `/admin/reservations/${current.booking.id}`,
              actionLabel: "Traiter le remboursement",
            },
          ],
        });
      }
      if (preserveAnotherProvider) {
        await tx.notification.create({
          data: {
            userId: null,
            title: "Double encaissement potentiel",
            message: `Jèko vient de confirmer ${current.booking.reference}, alors que le dossier possédait déjà des fonds sécurisés par ${current.booking.paymentProvider}. Contrôlez les deux fournisseurs avant toute restitution ou libération.`,
            type: "PAYMENT_PROVIDER_CONFLICT",
            recipientType: "ADMIN",
            channel: "INTERNAL",
            status: "SENT",
            priority: "URGENT",
            bookingId: current.booking.id,
            teacherId: current.booking.teacherId,
            clientId: current.booking.clientId,
            sentAt: now,
            link: `/admin/reservations/${current.booking.id}`,
            actionLabel: "Contrôler les encaissements",
          },
        });
      }
    }

    await tx.paymentAttempt.update({
      where: { id: current.id },
      data: { transactionId },
    });
    await tx.paymentEvent.upsert({
      where: { dedupeKey: webhook.dedupeKey },
      create: eventCreateData({
        attemptId: current.id,
        webhook,
        payloadSha256: input.payloadSha256,
        status: "PROCESSED",
        config,
        confirmation,
        amountXof: paidAmountXof,
        providerFeeXof,
        processedAt: now,
        verificationSource,
      }),
      update: {
        paymentAttemptId: current.id,
        status: "PROCESSED",
        storeId: config.storeId,
        amountXof: paidAmountXof,
        providerFeeAmountXof: providerFeeXof,
        providerFeeAmountMinor: confirmedTransaction.feeCents,
        processingError: null,
        processedAt: now,
      },
    });
  });

  const finalAction = action as ReconcileJekoResult["action"];
  return {
    attemptId: attempt.id,
    bookingId: attempt.bookingId,
    verified: finalAction === "paid" || finalAction === "already_paid" || finalAction === "duplicate",
    action: finalAction,
    status: finalAction === "rejected" ? "rejected" : finalAction === "failed" ? "error" : "success",
    message: finalAction === "paid"
      ? "Paiement Jèko confirmé, rapproché et sécurisé."
      : finalAction === "rejected"
        ? "Tentative Jèko précédemment rejetée ; contrôle manuel requis."
        : finalAction === "failed"
          ? "Événement Jèko déjà traité sans validation de fonds."
        : "Paiement Jèko déjà rapproché ; aucun double crédit.",
  };
}

/**
 * Fallback sûr pour le retour navigateur : relit la tentative, interroge Jèko
 * en serveur-à-serveur puis emprunte exactement la même transaction de
 * rapprochement que le webhook. Le successUrl n'est donc jamais une preuve.
 */
export async function reconcileJekoPaymentAttempt(
  attemptId: string,
  options: {
    expectedClientId?: string | null;
    expectedBookingId?: string | null;
    config?: JekoServerConfig;
  } = {},
): Promise<ReconcileJekoResult> {
  const config = options.config ?? requireJekoServerConfig();
  const safeAttemptId = attemptId.trim();
  if (!safeAttemptId) {
    return {
      verified: false,
      action: "not_found",
      status: "pending",
      message: "Tentative Jèko introuvable.",
    };
  }

  const attempt = await db.paymentAttempt.findFirst({
    where: { id: safeAttemptId, provider: "JEKO" },
    include: {
      booking: { select: { id: true, clientId: true, paymentStatus: true } },
    },
  });
  if (
    !attempt
    || (options.expectedClientId && attempt.booking?.clientId !== options.expectedClientId)
    || (options.expectedBookingId && attempt.bookingId !== options.expectedBookingId)
  ) {
    return {
      verified: false,
      action: "not_found",
      status: "pending",
      message: "Tentative Jèko introuvable.",
    };
  }
  if (attempt.status === "SUCCEEDED") {
    return {
      attemptId: attempt.id,
      bookingId: attempt.bookingId,
      verified: true,
      action: "already_paid",
      status: "success",
      message: "Paiement Jèko déjà rapproché.",
    };
  }
  if (attempt.status === "REJECTED") {
    return {
      attemptId: attempt.id,
      bookingId: attempt.bookingId,
      verified: false,
      action: "rejected",
      status: "rejected",
      message: attempt.failureReason ?? "Tentative Jèko rejetée ; contrôle manuel requis.",
    };
  }
  if (!attempt.providerOrderId && attempt.status === "REQUESTING") {
    const recovery = await recoverJekoPaymentAttemptIdentity(attempt.id, { config });
    if (recovery.recovered) {
      return reconcileJekoPaymentAttempt(attempt.id, options);
    }
    const recoveryAction = recovery.action === "rejected"
      ? "rejected"
      : recovery.action === "expired"
        ? "failed"
        : "pending";
    const recoveryStatus = recovery.action === "rejected"
      ? "rejected"
      : recovery.action === "expired"
        ? "error"
        : "pending";
    return {
      attemptId: attempt.id,
      bookingId: attempt.bookingId,
      verified: false,
      action: recoveryAction,
      status: recoveryStatus,
      message: recovery.message,
    };
  }
  if (!attempt.providerOrderId) {
    const terminalFailure = ["FAILED", "CANCELLED", "EXPIRED"].includes(attempt.status);
    return {
      attemptId: attempt.id,
      bookingId: attempt.bookingId,
      verified: false,
      action: terminalFailure ? "failed" : "pending",
      status: terminalFailure ? "error" : "pending",
      message: terminalFailure
        ? (attempt.failureReason ?? "La tentative Jèko n'a pas pu être créée.")
        : "La demande de paiement Jèko est encore en cours de création.",
    };
  }

  const confirmation = await confirmJekoPaymentRequest(attempt.providerOrderId, { config });
  const coreMismatch = confirmation.id !== attempt.providerOrderId
    || confirmation.reference !== attempt.reference
    || confirmation.storeId !== config.storeId
    || Boolean(attempt.storeId && attempt.storeId !== config.storeId);
  if (coreMismatch) {
    const reason = "Confirmation Jèko rejetée : identifiant, référence ou magasin incohérent.";
    await rejectJekoAttemptWithoutEvent(attempt.id, attempt.bookingId, confirmation, reason);
    return {
      attemptId: attempt.id,
      bookingId: attempt.bookingId,
      verified: false,
      action: "rejected",
      status: "rejected",
      message: reason,
    };
  }

  if (!confirmation.transaction) {
    const failed = confirmation.status === "error";
    const now = new Date();
    await db.$transaction(async (tx) => {
      await tx.paymentAttempt.update({
        where: { id: attempt.id },
        data: {
          status: failed ? "FAILED" : "PENDING",
          providerOrderId: confirmation.id,
          checkoutUrl: getJekoPaymentRedirectUrl(confirmation),
          storeId: config.storeId,
          responsePayload: toJson(confirmation.raw),
          failureCode: failed ? "JEKO_PAYMENT_FAILED" : null,
          failureReason: failed ? (confirmation.errorReason ?? "Paiement Jèko non finalisé.") : null,
          failedAt: failed ? now : null,
          lastCheckedAt: now,
        },
      });
      if (attempt.bookingId) {
        await tx.booking.updateMany({
          where: { id: attempt.bookingId, paymentStatus: "FAILED" },
          data: {
            paymentProvider: "JEKO",
            providerPaymentStatus: failed ? "ERROR" : "PENDING",
            paymentVerifiedAt: null,
          },
        });
      }
    });
    return {
      attemptId: attempt.id,
      bookingId: attempt.bookingId,
      verified: false,
      action: failed ? "failed" : "pending",
      status: failed ? "error" : "pending",
      message: failed
        ? (confirmation.errorReason ?? "Paiement Jèko non finalisé.")
        : "Paiement Jèko encore en attente de confirmation finale.",
    };
  }

  const method = confirmation.paymentMethod ?? fromPlatformPaymentMethod(attempt.method);
  if (!method) {
    const reason = "Confirmation Jèko rejetée : méthode de paiement inconnue.";
    await rejectJekoAttemptWithoutEvent(attempt.id, attempt.bookingId, confirmation, reason);
    return {
      attemptId: attempt.id,
      bookingId: attempt.bookingId,
      verified: false,
      action: "rejected",
      status: "rejected",
      message: reason,
    };
  }

  const syntheticPayload = {
    source: "server_confirmation",
    paymentRequest: confirmation.raw,
  };
  const webhook: ParsedJekoWebhook = {
    eventType: "transaction.completed",
    transaction: {
      id: confirmation.transaction.id,
      amount: {
        amount: confirmation.transaction.amountCents,
        currency: confirmation.transaction.currency,
      },
      fees: {
        amount: confirmation.transaction.feeCents,
        currency: confirmation.transaction.feeCurrency,
      },
      status: confirmation.transaction.status,
      counterpartLabel: confirmation.transaction.counterpartLabel ?? undefined,
      counterpartIdentifier: confirmation.transaction.counterpartIdentifier ?? undefined,
      paymentMethod: method,
      transactionType: "PaymentRequest",
      description: confirmation.transaction.description ?? undefined,
      executedAt: confirmation.transaction.executedAt ?? undefined,
      transactionDetails: {
        id: confirmation.id,
        reference: confirmation.reference,
      },
    },
    payload: syntheticPayload,
    dedupeKey: `JEKO:${confirmation.transaction.id}:${confirmation.transaction.status}`,
  };
  const serializedPayload = JSON.stringify(syntheticPayload);
  return reconcileJekoWebhook({
    webhook,
    payloadSha256: jekoPayloadSha256(serializedPayload),
    config,
    confirmation,
    verificationSource: "SERVER_CONFIRMATION",
  });
}

async function rejectJekoAttemptWithoutEvent(
  attemptId: string,
  bookingId: string | null,
  confirmation: JekoPaymentConfirmation,
  reason: string,
) {
  const now = new Date();
  await db.$transaction(async (tx) => {
    await tx.paymentAttempt.update({
      where: { id: attemptId },
      data: {
        status: "REJECTED",
        failureCode: "RECONCILIATION_MISMATCH",
        failureReason: reason,
        responsePayload: toJson(confirmation.raw),
        lastCheckedAt: now,
      },
    });
    if (bookingId) {
      await tx.booking.updateMany({
        where: { id: bookingId, paymentStatus: "FAILED" },
        data: {
          paymentProvider: "JEKO",
          providerPaymentStatus: "REJECTED",
          paymentVerifiedAt: null,
        },
      });
      await tx.adminActionLog.create({
        data: {
          adminId: null,
          action: "Confirmation serveur Jèko rejetée",
          entityType: "Booking",
          entityId: bookingId,
          detail: reason,
          newStatus: "REJECTED",
        },
      });
    }
  });
}

async function recordRejectedJekoEvent(input: {
  attempt: {
    id: string;
    bookingId: string | null;
    status: string;
  };
  webhook: ParsedJekoWebhook;
  payloadSha256: string;
  config: JekoServerConfig;
  confirmation: JekoPaymentConfirmation;
  verificationSource: "WEBHOOK" | "SERVER_CONFIRMATION";
  reason: string;
}): Promise<ReconcileJekoResult> {
  const now = new Date();
  await db.$transaction(async (tx) => {
    await tx.paymentEvent.upsert({
      where: { dedupeKey: input.webhook.dedupeKey },
      create: eventCreateData({
        attemptId: input.attempt.id,
        webhook: input.webhook,
        payloadSha256: input.payloadSha256,
        status: "REJECTED",
        config: input.config,
        confirmation: input.confirmation,
        verificationSource: input.verificationSource,
        processingError: input.reason,
        processedAt: now,
      }),
      update: { status: "REJECTED", processingError: input.reason, processedAt: now },
    });
    if (input.attempt.status !== "SUCCEEDED") {
      await tx.paymentAttempt.update({
        where: { id: input.attempt.id },
        data: {
          status: "REJECTED",
          failureCode: "RECONCILIATION_MISMATCH",
          failureReason: input.reason.slice(0, 500),
          lastCheckedAt: now,
          responsePayload: toJson(input.confirmation.raw),
        },
      });
    }
    if (input.attempt.bookingId) {
      await tx.booking.updateMany({
        where: { id: input.attempt.bookingId, paymentStatus: "FAILED" },
        data: {
          paymentProvider: "JEKO",
          providerPaymentStatus: "REJECTED",
          paymentVerifiedAt: null,
        },
      });
      await tx.adminActionLog.create({
        data: {
          adminId: null,
          action: "Paiement Jèko suspect rejeté",
          entityType: "Booking",
          entityId: input.attempt.bookingId,
          detail: input.reason,
          newStatus: "REJECTED",
        },
      });
    }
  });
  return {
    attemptId: input.attempt.id,
    bookingId: input.attempt.bookingId,
    verified: false,
    action: "rejected",
    status: "rejected",
    message: input.reason,
  };
}

async function recordPendingJekoEvent(input: {
  attemptId: string;
  webhook: ParsedJekoWebhook;
  payloadSha256: string;
  config: JekoServerConfig;
  confirmation: JekoPaymentConfirmation;
  verificationSource: "WEBHOOK" | "SERVER_CONFIRMATION";
}) {
  const now = new Date();
  const attempt = await db.paymentAttempt.findUnique({
    where: { id: input.attemptId },
    select: { bookingId: true },
  });
  const operations: Prisma.PrismaPromise<unknown>[] = [
    db.paymentAttempt.updateMany({
      where: { id: input.attemptId, status: { not: "SUCCEEDED" } },
      data: {
        status: "PENDING",
        providerOrderId: input.confirmation.id,
        checkoutUrl: getJekoPaymentRedirectUrl(input.confirmation),
        storeId: input.config.storeId,
        lastCheckedAt: now,
        responsePayload: toJson(input.confirmation.raw),
      },
    }),
    db.paymentEvent.upsert({
      where: { dedupeKey: input.webhook.dedupeKey },
      create: eventCreateData({
        attemptId: input.attemptId,
        webhook: input.webhook,
        payloadSha256: input.payloadSha256,
        status: "RECEIVED",
        config: input.config,
        confirmation: input.confirmation,
        verificationSource: input.verificationSource,
        processingError: "Confirmation serveur encore en attente.",
      }),
      update: { status: "RECEIVED", processingError: "Confirmation serveur encore en attente." },
    }),
  ];
  if (attempt?.bookingId) {
    operations.push(db.booking.updateMany({
      where: { id: attempt.bookingId, paymentStatus: "FAILED" },
      data: {
        paymentProvider: "JEKO",
        providerPaymentStatus: "PENDING",
        paymentVerifiedAt: null,
      },
    }));
  }
  await db.$transaction(operations);
}

async function recordFailedJekoEvent(input: {
  attempt: { id: string; bookingId: string | null };
  webhook: ParsedJekoWebhook;
  payloadSha256: string;
  config: JekoServerConfig;
  confirmation: JekoPaymentConfirmation;
  verificationSource: "WEBHOOK" | "SERVER_CONFIRMATION";
}): Promise<ReconcileJekoResult> {
  const now = new Date();
  const failureReason = input.confirmation.errorReason ?? "Paiement Jèko non finalisé.";
  const operations: Prisma.PrismaPromise<unknown>[] = [
    db.paymentAttempt.updateMany({
      where: { id: input.attempt.id, status: { not: "SUCCEEDED" } },
      data: {
        status: "FAILED",
        failureCode: "JEKO_PAYMENT_FAILED",
        failureReason: failureReason.slice(0, 500),
        failedAt: now,
        lastCheckedAt: now,
        responsePayload: toJson(input.confirmation.raw),
      },
    }),
    db.paymentEvent.upsert({
      where: { dedupeKey: input.webhook.dedupeKey },
      create: eventCreateData({
        attemptId: input.attempt.id,
        webhook: input.webhook,
        payloadSha256: input.payloadSha256,
        status: "PROCESSED",
        config: input.config,
        confirmation: input.confirmation,
        verificationSource: input.verificationSource,
        processingError: failureReason,
        processedAt: now,
      }),
      update: { status: "PROCESSED", processingError: failureReason, processedAt: now },
    }),
  ];
  if (input.attempt.bookingId) {
    operations.push(db.booking.updateMany({
      where: { id: input.attempt.bookingId, paymentStatus: "FAILED" },
      data: {
        paymentProvider: "JEKO",
        providerPaymentStatus: "ERROR",
        paymentVerifiedAt: null,
      },
    }));
  }
  await db.$transaction(operations);
  return {
    attemptId: input.attempt.id,
    bookingId: input.attempt.bookingId,
    verified: false,
    action: "failed",
    status: "error",
    message: failureReason,
  };
}

async function recordTransientJekoEvent(input: {
  attemptId: string;
  webhook: ParsedJekoWebhook;
  payloadSha256: string;
  verificationSource: "WEBHOOK" | "SERVER_CONFIRMATION";
  message: string;
}) {
  await db.paymentEvent.upsert({
    where: { dedupeKey: input.webhook.dedupeKey },
    create: {
      provider: "JEKO",
      paymentAttemptId: input.attemptId,
      dedupeKey: input.webhook.dedupeKey,
      providerEventId: input.webhook.transaction.id,
      eventType: input.webhook.eventType,
      status: "FAILED",
      verificationSource: input.verificationSource,
      signatureValid: input.verificationSource === "WEBHOOK",
      providerOrderId: input.webhook.transaction.transactionDetails?.id,
      reference: input.webhook.transaction.transactionDetails?.reference,
      currency: input.webhook.transaction.amount.currency,
      providerAmountMinor: input.webhook.transaction.amount.amount,
      providerFeeAmountMinor: input.webhook.transaction.fees.amount,
      payloadSha256: input.payloadSha256,
      payload: toJson(input.webhook.payload),
      processingError: input.message.slice(0, 500),
    },
    update: {
      status: "FAILED",
      processingError: input.message.slice(0, 500),
    },
  });
}

function eventCreateData(input: {
  attemptId: string;
  webhook: ParsedJekoWebhook;
  payloadSha256: string;
  status: "RECEIVED" | "PROCESSED" | "REJECTED" | "FAILED";
  config: JekoServerConfig;
  confirmation: JekoPaymentConfirmation;
  verificationSource: "WEBHOOK" | "SERVER_CONFIRMATION";
  amountXof?: number;
  providerFeeXof?: number;
  processingError?: string;
  processedAt?: Date;
}): Prisma.PaymentEventUncheckedCreateInput {
  return {
    provider: "JEKO",
    paymentAttemptId: input.attemptId,
    dedupeKey: input.webhook.dedupeKey,
    providerEventId: input.webhook.transaction.id,
    eventType: input.webhook.eventType,
    status: input.status,
    verificationSource: input.verificationSource,
    signatureValid: input.verificationSource === "WEBHOOK",
    providerOrderId: input.confirmation.id,
    reference: input.confirmation.reference,
    storeId: input.config.storeId,
    currency: input.webhook.transaction.amount.currency,
    amountXof: input.amountXof,
    providerAmountMinor: input.webhook.transaction.amount.amount,
    providerFeeAmountXof: input.providerFeeXof,
    providerFeeAmountMinor: input.webhook.transaction.fees.amount,
    payloadSha256: input.payloadSha256,
    payload: toJson(input.webhook.payload),
    processingError: input.processingError?.slice(0, 500),
    processedAt: input.processedAt,
  };
}

function toPlatformPaymentMethod(method: NonNullable<ReturnType<typeof normalizeJekoPaymentMethod>>) {
  const values = {
    wave: "WAVE",
    orange: "ORANGE_MONEY",
    mtn: "MTN_MONEY",
    moov: "MOOV_MONEY",
    djamo: "DJAMO",
  } as const;
  return values[method];
}

function fromPlatformPaymentMethod(method: string | null) {
  const values: Record<string, NonNullable<ReturnType<typeof normalizeJekoPaymentMethod>>> = {
    WAVE: "wave",
    ORANGE_MONEY: "orange",
    MTN_MONEY: "mtn",
    MOOV_MONEY: "moov",
    DJAMO: "djamo",
  };
  return method ? values[method] ?? null : null;
}

function toJson(value: unknown) {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}
