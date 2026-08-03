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
import {
  resolveJekoPaymentStatusConsensus,
  validateJekoRescheduleFinancialSnapshot,
} from "@/lib/jeko-client-payment";
import { createRescheduleAwaitingTeacherNotifications } from "@/lib/paydunya-reschedule-reconciliation";
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

type ReconcileJekoRescheduleInput = {
  attemptId: string;
  webhook: ParsedJekoWebhook;
  payloadSha256: string;
  config?: JekoServerConfig;
  confirmation?: JekoPaymentConfirmation;
  verificationSource?: "WEBHOOK" | "SERVER_CONFIRMATION";
};

export type ReconcileJekoRescheduleResult = {
  attemptId?: string;
  bookingId?: string | null;
  rescheduleRequestId?: string | null;
  verified: boolean;
  action: "paid" | "already_paid" | "pending" | "failed" | "rejected" | "duplicate" | "ignored" | "not_found";
  status: "success" | "pending" | "error" | "rejected" | "ignored";
  message: string;
};

export async function reconcileJekoRescheduleWebhook(
  input: ReconcileJekoRescheduleInput,
): Promise<ReconcileJekoRescheduleResult> {
  const config = input.config ?? requireJekoServerConfig();
  const verificationSource = input.verificationSource ?? "WEBHOOK";
  const { webhook } = input;
  const incoming = webhook.transaction;

  if (webhook.eventType !== "transaction.completed" || !isJekoIncomingPaymentType(incoming.transactionType)) {
    return {
      verified: false,
      action: "ignored",
      status: "ignored",
      message: "Événement Jèko sans supplément de reprogrammation ignoré.",
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

  const attempt = await db.paymentAttempt.findUnique({
    where: { id: input.attemptId },
    include: {
      rescheduleRequest: {
        include: {
          booking: {
            include: {
              client: { select: { id: true, name: true } },
              teacher: { select: { id: true, fullName: true, professionalName: true } },
            },
          },
          teacher: { select: { id: true, fullName: true, professionalName: true } },
          client: { select: { id: true, name: true } },
          transaction: true,
        },
      },
    },
  });
  if (
    !attempt
    || attempt.provider !== "JEKO"
    || attempt.purpose !== "RESCHEDULE_FEE"
    || !attempt.rescheduleRequest
    || attempt.rescheduleRequest.paymentProvider !== "JEKO"
  ) {
    return {
      verified: false,
      action: "not_found",
      status: "pending",
      message: "Tentative Jèko du supplément introuvable.",
    };
  }
  const request = attempt.rescheduleRequest;

  const previousEvent = await db.paymentEvent.findUnique({ where: { dedupeKey: webhook.dedupeKey } });
  if (previousEvent?.status === "PROCESSED" || previousEvent?.status === "REJECTED") {
    const successful = previousEvent.status === "PROCESSED" && attempt.status === "SUCCEEDED";
    return {
      attemptId: attempt.id,
      bookingId: attempt.bookingId,
      rescheduleRequestId: request.id,
      verified: successful,
      action: "duplicate",
      status: previousEvent.status === "REJECTED" ? "rejected" : successful ? "success" : "error",
      message: successful
        ? "Supplément Jèko déjà rapproché ; aucun double crédit."
        : "Événement Jèko déjà traité sans validation du supplément.",
    };
  }
  if (attempt.status === "REJECTED") {
    return resultFor(
      attempt,
      request.id,
      "rejected",
      false,
      "rejected",
      attempt.failureReason ?? "Tentative du supplément rejetée ; un contrôle manuel est requis.",
    );
  }

  let confirmation: JekoPaymentConfirmation;
  try {
    confirmation = input.confirmation ?? await confirmJekoPaymentRequest(providerOrderId, { config });
  } catch (error) {
    await recordTransientEvent({
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
  const invalidFinancialSnapshot = validateJekoRescheduleFinancialSnapshot(request);
  const mismatches = [
    attempt.bookingId !== request.bookingId ? "réservation locale différente" : "",
    attempt.rescheduleRequestId !== request.id ? "demande locale différente" : "",
    attempt.reference !== reference ? "référence locale différente" : "",
    attempt.providerOrderId && attempt.providerOrderId !== providerOrderId ? "identifiant Jèko local différent" : "",
    confirmation.id !== providerOrderId ? "identifiant Jèko confirmé différent" : "",
    confirmation.reference !== reference ? "référence Jèko confirmée différente" : "",
    confirmation.storeId !== config.storeId ? "magasin Jèko confirmé différent" : "",
    attempt.storeId && attempt.storeId !== config.storeId ? "magasin local différent" : "",
    attempt.currency !== "XOF" ? "devise locale différente" : "",
    incoming.amount.currency !== "XOF" ? "devise webhook différente" : "",
    incoming.fees.currency !== "XOF" ? "devise de frais webhook différente" : "",
    attempt.amountXof !== request.totalToPay ? "montant de la demande modifié" : "",
    attempt.providerAmountMinor !== xofToJekoAmountCents(request.totalToPay) ? "instantané local incohérent" : "",
    invalidFinancialSnapshot ?? "",
    attempt.courseAmountXof !== request.feeAmount ? "supplément local différent" : "",
    attempt.transportAmountXof !== 0 ? "transport inattendu dans le supplément" : "",
    attempt.serviceFeeAmountXof !== request.paymentServiceFeeAmount ? "frais de service locaux différents" : "",
    attempt.commissionAmountXof !== request.feePlatformAmount ? "commission locale différente" : "",
    attempt.teacherAmountXof !== request.feeTeacherAmount ? "part professeur locale différente" : "",
    incoming.amount.amount !== attempt.providerAmountMinor ? "montant webhook différent" : "",
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
    return rejectEvent({
      attempt,
      webhook,
      payloadSha256: input.payloadSha256,
      config,
      confirmation,
      verificationSource,
      reason: `Rapprochement du supplément Jèko rejeté : ${mismatches.join(", ")}.`,
    });
  }

  const incomingStatus = normalizeJekoPaymentStatus(incoming.status);
  if (
    attempt.status === "SUCCEEDED"
    && (confirmation.status !== "success" || confirmedTransaction?.status !== "success" || incomingStatus !== "success")
  ) {
    return rejectEvent({
      attempt,
      webhook,
      payloadSha256: input.payloadSha256,
      config,
      confirmation,
      verificationSource,
      reason: "Statut Jèko contradictoire après un supplément déjà sécurisé ; aucun déclassement appliqué.",
    });
  }

  if (!confirmedTransaction) {
    await recordPendingEvent({ attempt, webhook, payloadSha256: input.payloadSha256, config, confirmation, verificationSource });
    return resultFor(
      attempt,
      request.id,
      "pending",
      false,
      "pending",
      "Supplément Jèko encore en attente d'une confirmation finale cohérente.",
    );
  }
  const statusConsensus = resolveJekoPaymentStatusConsensus([
    confirmation.status,
    confirmedTransaction.status,
    incomingStatus,
  ]);
  if (statusConsensus === "pending") {
    await recordPendingEvent({ attempt, webhook, payloadSha256: input.payloadSha256, config, confirmation, verificationSource });
    return resultFor(
      attempt,
      request.id,
      "pending",
      false,
      "pending",
      "Supplément Jèko encore en attente d'une confirmation finale cohérente.",
    );
  }

  if (statusConsensus === "error") {
    return recordFailedEvent({ attempt, webhook, payloadSha256: input.payloadSha256, config, confirmation, verificationSource });
  }

  const paidAmountXof = jekoAmountCentsToXof(confirmedTransaction.amountCents);
  const providerFeeXof = jekoFeeCentsToCoveredXof(confirmedTransaction.feeCents);
  const paymentMethod = incomingMethod!;
  const now = new Date();
  let action: ReconcileJekoRescheduleResult["action"] = "paid";

  await db.$transaction(async (tx) => {
    const current = await tx.paymentAttempt.findUnique({
      where: { id: attempt.id },
      include: {
        rescheduleRequest: {
          include: {
            booking: {
              include: {
                client: { select: { id: true, name: true } },
                teacher: { select: { id: true, fullName: true, professionalName: true } },
              },
            },
            teacher: { select: { id: true, fullName: true, professionalName: true } },
            client: { select: { id: true, name: true } },
            transaction: true,
          },
        },
      },
    });
    if (!current?.rescheduleRequest) throw new Error("Tentative Jèko supprimée pendant le rapprochement.");

    const knownEvent = await tx.paymentEvent.findUnique({ where: { dedupeKey: webhook.dedupeKey } });
    if (knownEvent?.status === "PROCESSED") {
      action = current.status === "SUCCEEDED" ? "duplicate" : "failed";
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
          verificationSource,
          processingError: "Tentative locale déjà rejetée.",
          processedAt: now,
        }),
        update: { status: "REJECTED", processingError: "Tentative locale déjà rejetée.", processedAt: now },
      });
      return;
    }

    const attemptClaim = await tx.paymentAttempt.updateMany({
      where: {
        id: current.id,
        // Une confirmation serveur positive fait foi même si un état local
        // terminal a été posé trop tôt. REJECTED reste volontairement
        // exclu : il signale une incohérence de rapprochement.
        status: { in: ["CREATED", "REQUESTING", "PENDING", "FAILED", "CANCELLED", "EXPIRED"] },
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
    let transactionId = current.transactionId;
    if (attemptClaim.count === 0) {
      // Une autre livraison du même événement peut avoir gagné la course
      // pendant l'UPDATE conditionnel. Relire l'état empêche de déclarer
      // « déjà payé » une tentative qui n'aurait pas été créditée.
      const latestAttempt = await tx.paymentAttempt.findUnique({
        where: { id: current.id },
        select: { status: true, transactionId: true },
      });
      action = latestAttempt?.status === "SUCCEEDED" ? "already_paid" : "rejected";
      transactionId = latestAttempt?.transactionId ?? transactionId;
    }

    if (attemptClaim.count > 0) {
      const requestClaim = await tx.bookingRescheduleRequest.updateMany({
        where: { id: current.rescheduleRequest.id, paidAt: null },
        data: { status: "AWAITING_TEACHER", paidAt: now },
      });

      if (requestClaim.count > 0) {
        const financialTransaction = await tx.transaction.create({
          data: {
            reference: generateReference("TX-RESCHEDULE-JEKO"),
            bookingId: current.rescheduleRequest.bookingId,
            teacherId: current.rescheduleRequest.teacherId,
            rescheduleRequestId: current.rescheduleRequest.id,
            amount: paidAmountXof,
            commission: current.commissionAmountXof,
            teacherNet: current.teacherAmountXof,
            type: "RESCHEDULE_FEE",
            status: "BLOCKED",
            method: toPlatformPaymentMethod(paymentMethod),
            paidAt: now,
          },
        });
        transactionId = financialTransaction.id;
        await createRescheduleAwaitingTeacherNotifications(tx, {
          request: current.rescheduleRequest,
          now,
        });
        await tx.adminActionLog.create({
          data: {
            adminId: null,
            action: "Supplément modification Jèko vérifié serveur",
            entityType: "BookingRescheduleRequest",
            entityId: current.rescheduleRequest.id,
            detail: `Référence ${reference}. Montant confirmé : ${paidAmountXof} FCFA. Frais Jèko couverts : ${providerFeeXof} FCFA.`,
            oldStatus: current.rescheduleRequest.status,
            newStatus: "AWAITING_TEACHER",
          },
        });
      } else {
        action = "already_paid";
        await tx.notification.create({
          data: {
            userId: null,
            title: "Double encaissement potentiel sur reprogrammation",
            message: `La tentative Jèko ${maskReference(reference)} a été confirmée alors que la demande ${current.rescheduleRequest.id} était déjà payée. Aucun double crédit n'a été créé.`,
            type: "RESCHEDULE_DUPLICATE_PAYMENT",
            recipientType: "ADMIN",
            channel: "INTERNAL",
            status: "SENT",
            priority: "CRITICAL",
            bookingId: current.rescheduleRequest.bookingId,
            teacherId: current.rescheduleRequest.teacherId,
            clientId: current.rescheduleRequest.clientId,
            sentAt: now,
            link: `/admin/reservations/${current.rescheduleRequest.bookingId}`,
            actionLabel: "Contrôler le paiement",
          },
        });
      }
    }

    if (transactionId) {
      await tx.paymentAttempt.update({ where: { id: current.id }, data: { transactionId } });
    }
    const eventStatus = action === "rejected" ? "REJECTED" : "PROCESSED";
    await tx.paymentEvent.upsert({
      where: { dedupeKey: webhook.dedupeKey },
      create: eventCreateData({
        attemptId: current.id,
        webhook,
        payloadSha256: input.payloadSha256,
        status: eventStatus,
        config,
        confirmation,
        verificationSource,
        amountXof: paidAmountXof,
        providerFeeXof,
        processingError: action === "rejected"
          ? "La tentative n'a pas pu être revendiquée après confirmation serveur."
          : undefined,
        processedAt: now,
      }),
      update: {
        paymentAttemptId: current.id,
        status: eventStatus,
        storeId: config.storeId,
        amountXof: paidAmountXof,
        providerFeeAmountXof: providerFeeXof,
        providerFeeAmountMinor: confirmedTransaction.feeCents,
        processingError: action === "rejected"
          ? "La tentative n'a pas pu être revendiquée après confirmation serveur."
          : null,
        processedAt: now,
      },
    });
  });

  const finalAction = action as ReconcileJekoRescheduleResult["action"];
  const verified = ["paid", "already_paid", "duplicate"].includes(finalAction);
  return resultFor(
    attempt,
    request.id,
    finalAction,
    verified,
    finalAction === "rejected" ? "rejected" : finalAction === "failed" ? "error" : "success",
    finalAction === "paid"
      ? "Supplément Jèko confirmé. La demande attend maintenant la réponse du professeur."
      : finalAction === "rejected"
        ? "Tentative du supplément déjà rejetée ; contrôle manuel requis."
        : finalAction === "failed"
          ? "Événement Jèko traité sans validation du supplément."
          : "Supplément Jèko déjà rapproché ; aucun double crédit.",
  );
}

export async function reconcileJekoReschedulePaymentAttempt(
  attemptId: string,
  options: {
    expectedBookingId?: string | null;
    expectedClientId?: string | null;
    expectedRescheduleRequestId?: string | null;
    config?: JekoServerConfig;
  } = {},
): Promise<ReconcileJekoRescheduleResult> {
  const config = options.config ?? requireJekoServerConfig();
  const attempt = await db.paymentAttempt.findUnique({
    where: { id: attemptId },
    include: {
      rescheduleRequest: { select: { id: true, bookingId: true, clientId: true, status: true, paidAt: true, totalToPay: true, paymentProvider: true } },
    },
  });
  if (
    !attempt
    || attempt.provider !== "JEKO"
    || attempt.purpose !== "RESCHEDULE_FEE"
    || !attempt.rescheduleRequest
    || attempt.rescheduleRequest.paymentProvider !== "JEKO"
  ) {
    return { verified: false, action: "not_found", status: "pending", message: "Tentative Jèko du supplément introuvable." };
  }
  const request = attempt.rescheduleRequest;
  if (
    (options.expectedBookingId && request.bookingId !== options.expectedBookingId)
    || (options.expectedClientId && request.clientId !== options.expectedClientId)
    || (options.expectedRescheduleRequestId && request.id !== options.expectedRescheduleRequestId)
  ) {
    return resultFor(attempt, request.id, "rejected", false, "rejected", "Accès refusé pour cette tentative Jèko.");
  }

  if (attempt.status === "REJECTED") {
    return resultFor(
      attempt,
      request.id,
      "rejected",
      false,
      "rejected",
      attempt.failureReason ?? "Tentative du supplément rejetée ; un contrôle manuel est requis.",
    );
  }
  if (attempt.status === "SUCCEEDED" && request.paidAt) {
    return resultFor(attempt, request.id, "already_paid", true, "success", "Supplément Jèko déjà rapproché.");
  }
  if (!attempt.providerOrderId && attempt.status === "REQUESTING") {
    const recovery = await recoverJekoPaymentAttemptIdentity(attempt.id, { config });
    if (recovery.recovered) {
      return reconcileJekoReschedulePaymentAttempt(attempt.id, options);
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
    return resultFor(
      attempt,
      request.id,
      recoveryAction,
      false,
      recoveryStatus,
      recovery.message,
    );
  }
  if (!attempt.providerOrderId) {
    const failed = ["FAILED", "REJECTED", "CANCELLED", "EXPIRED"].includes(attempt.status);
    return resultFor(
      attempt,
      request.id,
      failed ? "failed" : "pending",
      false,
      failed ? "error" : "pending",
      failed ? "La tentative Jèko n'a pas abouti." : "La demande Jèko est encore en cours de création.",
    );
  }

  const confirmation = await confirmJekoPaymentRequest(attempt.providerOrderId, { config });
  const confirmationMismatch = [
    confirmation.id !== attempt.providerOrderId ? "identifiant Jèko confirmé différent" : "",
    confirmation.reference !== attempt.reference ? "référence Jèko confirmée différente" : "",
    confirmation.storeId !== config.storeId ? "magasin Jèko confirmé différent" : "",
    attempt.storeId && confirmation.storeId !== attempt.storeId ? "magasin local différent" : "",
    confirmation.paymentMethod
      && attempt.method
      && toPlatformPaymentMethod(confirmation.paymentMethod) !== attempt.method
      ? "méthode Jèko confirmée différente"
      : "",
  ].filter(Boolean);
  if (confirmationMismatch.length > 0) {
    const reason = `Confirmation du supplément Jèko rejetée : ${confirmationMismatch.join(", ")}.`;
    await rejectAttemptWithoutEvent(attempt.id, request.id, confirmation, reason);
    return resultFor(attempt, request.id, "rejected", false, "rejected", reason);
  }
  if (!confirmation.transaction) {
    const failed = confirmation.status === "error";
    await db.$transaction([
      db.paymentAttempt.updateMany({
        where: { id: attempt.id, status: { notIn: ["SUCCEEDED", "REJECTED"] } },
        data: {
          status: failed ? "FAILED" : "PENDING",
          checkoutUrl: getJekoPaymentRedirectUrl(confirmation),
          failureCode: failed ? "JEKO_PAYMENT_FAILED" : null,
          failureReason: failed ? (confirmation.errorReason ?? "Paiement Jèko non finalisé.").slice(0, 500) : null,
          failedAt: failed ? new Date() : null,
          lastCheckedAt: new Date(),
          responsePayload: toJson(confirmation.raw),
        },
      }),
      db.bookingRescheduleRequest.updateMany({
        where: { id: request.id, paidAt: null },
        data: { status: failed ? "PAYMENT_FAILED" : "PAYMENT_PENDING" },
      }),
    ]);
    return resultFor(
      attempt,
      request.id,
      failed ? "failed" : "pending",
      false,
      failed ? "error" : "pending",
      failed ? (confirmation.errorReason ?? "Paiement Jèko non finalisé.") : "Supplément Jèko encore en attente.",
    );
  }

  const method = confirmation.paymentMethod ?? fromPlatformPaymentMethod(attempt.method);
  if (!method) {
    await rejectAttemptWithoutEvent(attempt.id, request.id, confirmation, "Confirmation Jèko rejetée : méthode de paiement inconnue.");
    return resultFor(attempt, request.id, "rejected", false, "rejected", "Confirmation Jèko rejetée : méthode inconnue.");
  }

  const syntheticPayload = { source: "server_confirmation", paymentRequest: confirmation.raw };
  const webhook: ParsedJekoWebhook = {
    eventType: "transaction.completed",
    transaction: {
      id: confirmation.transaction.id,
      amount: { amount: confirmation.transaction.amountCents, currency: confirmation.transaction.currency },
      fees: { amount: confirmation.transaction.feeCents, currency: confirmation.transaction.feeCurrency },
      status: confirmation.transaction.status,
      counterpartLabel: confirmation.transaction.counterpartLabel ?? undefined,
      counterpartIdentifier: confirmation.transaction.counterpartIdentifier ?? undefined,
      paymentMethod: method,
      transactionType: "PaymentRequest",
      description: confirmation.transaction.description ?? undefined,
      executedAt: confirmation.transaction.executedAt ?? undefined,
      transactionDetails: { id: confirmation.id, reference: confirmation.reference },
    },
    payload: syntheticPayload,
    dedupeKey: `JEKO:${confirmation.transaction.id}:${confirmation.transaction.status}`,
  };
  return reconcileJekoRescheduleWebhook({
    attemptId: attempt.id,
    webhook,
    payloadSha256: jekoPayloadSha256(JSON.stringify(syntheticPayload)),
    config,
    confirmation,
    verificationSource: "SERVER_CONFIRMATION",
  });
}

async function recordPendingEvent(input: {
  attempt: { id: string; rescheduleRequestId: string | null };
  webhook: ParsedJekoWebhook;
  payloadSha256: string;
  config: JekoServerConfig;
  confirmation: JekoPaymentConfirmation;
  verificationSource: "WEBHOOK" | "SERVER_CONFIRMATION";
}) {
  const now = new Date();
  const operations: Prisma.PrismaPromise<unknown>[] = [
    db.paymentAttempt.updateMany({
      where: { id: input.attempt.id, status: { notIn: ["SUCCEEDED", "REJECTED"] } },
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
      create: eventCreateData({ ...input, attemptId: input.attempt.id, status: "RECEIVED", processingError: "Confirmation serveur encore en attente." }),
      update: { status: "RECEIVED", processingError: "Confirmation serveur encore en attente." },
    }),
  ];
  if (input.attempt.rescheduleRequestId) {
    operations.push(db.bookingRescheduleRequest.updateMany({
      where: { id: input.attempt.rescheduleRequestId, paidAt: null },
      data: { status: "PAYMENT_PENDING" },
    }));
  }
  await db.$transaction(operations);
}

async function recordFailedEvent(input: {
  attempt: { id: string; bookingId: string | null; rescheduleRequestId: string | null };
  webhook: ParsedJekoWebhook;
  payloadSha256: string;
  config: JekoServerConfig;
  confirmation: JekoPaymentConfirmation;
  verificationSource: "WEBHOOK" | "SERVER_CONFIRMATION";
}): Promise<ReconcileJekoRescheduleResult> {
  const now = new Date();
  const failureReason = input.confirmation.errorReason ?? "Supplément Jèko non finalisé.";
  const operations: Prisma.PrismaPromise<unknown>[] = [
    db.paymentAttempt.updateMany({
      where: { id: input.attempt.id, status: { notIn: ["SUCCEEDED", "REJECTED"] } },
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
      create: eventCreateData({ ...input, attemptId: input.attempt.id, status: "PROCESSED", processingError: failureReason, processedAt: now }),
      update: { status: "PROCESSED", processingError: failureReason, processedAt: now },
    }),
  ];
  if (input.attempt.rescheduleRequestId) {
    operations.push(db.bookingRescheduleRequest.updateMany({
      where: { id: input.attempt.rescheduleRequestId, paidAt: null },
      data: { status: "PAYMENT_FAILED" },
    }));
  }
  await db.$transaction(operations);
  return resultFor(input.attempt, input.attempt.rescheduleRequestId, "failed", false, "error", failureReason);
}

async function rejectEvent(input: {
  attempt: { id: string; bookingId: string | null; rescheduleRequestId: string | null; status: string };
  webhook: ParsedJekoWebhook;
  payloadSha256: string;
  config: JekoServerConfig;
  confirmation: JekoPaymentConfirmation;
  verificationSource: "WEBHOOK" | "SERVER_CONFIRMATION";
  reason: string;
}): Promise<ReconcileJekoRescheduleResult> {
  const now = new Date();
  await db.$transaction(async (tx) => {
    await tx.paymentEvent.upsert({
      where: { dedupeKey: input.webhook.dedupeKey },
      create: eventCreateData({ ...input, attemptId: input.attempt.id, status: "REJECTED", processingError: input.reason, processedAt: now }),
      update: { status: "REJECTED", processingError: input.reason, processedAt: now },
    });
    if (input.attempt.status !== "SUCCEEDED") {
      await tx.paymentAttempt.updateMany({
        where: { id: input.attempt.id, status: { not: "SUCCEEDED" } },
        data: {
          status: "REJECTED",
          failureCode: "RECONCILIATION_MISMATCH",
          failureReason: input.reason.slice(0, 500),
          lastCheckedAt: now,
          responsePayload: toJson(input.confirmation.raw),
        },
      });
    }
    if (input.attempt.rescheduleRequestId) {
      await tx.bookingRescheduleRequest.updateMany({
        where: { id: input.attempt.rescheduleRequestId, paidAt: null },
        data: { status: "PAYMENT_FAILED" },
      });
      await tx.adminActionLog.create({
        data: {
          adminId: null,
          action: "Supplément modification Jèko suspect rejeté",
          entityType: "BookingRescheduleRequest",
          entityId: input.attempt.rescheduleRequestId,
          detail: input.reason,
          newStatus: "PAYMENT_FAILED",
        },
      });
    }
  });
  return resultFor(input.attempt, input.attempt.rescheduleRequestId, "rejected", false, "rejected", input.reason);
}

async function rejectAttemptWithoutEvent(
  attemptId: string,
  requestId: string,
  confirmation: JekoPaymentConfirmation,
  reason: string,
) {
  await db.$transaction([
    db.paymentAttempt.updateMany({
      where: { id: attemptId, status: { not: "SUCCEEDED" } },
      data: {
        status: "REJECTED",
        failureCode: "RECONCILIATION_MISMATCH",
        failureReason: reason,
        responsePayload: toJson(confirmation.raw),
        lastCheckedAt: new Date(),
      },
    }),
    db.bookingRescheduleRequest.updateMany({
      where: { id: requestId, paidAt: null },
      data: { status: "PAYMENT_FAILED" },
    }),
  ]);
}

async function recordTransientEvent(input: {
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
    update: { status: "FAILED", processingError: input.message.slice(0, 500) },
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

function resultFor(
  attempt: { id: string; bookingId: string | null },
  requestId: string | null,
  action: ReconcileJekoRescheduleResult["action"],
  verified: boolean,
  status: ReconcileJekoRescheduleResult["status"],
  message: string,
): ReconcileJekoRescheduleResult {
  return {
    attemptId: attempt.id,
    bookingId: attempt.bookingId,
    rescheduleRequestId: requestId,
    verified,
    action,
    status,
    message,
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

function maskReference(value: string) {
  return value.length <= 10 ? "********" : `${value.slice(0, 5)}...${value.slice(-5)}`;
}

function toJson(value: unknown) {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}
