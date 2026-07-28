import "server-only";

import { createHash } from "node:crypto";
import type { PaymentMethod, Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { syncBookingSessionAggregates } from "@/lib/booking-sessions";
import { generateReference } from "@/lib/format";
import { requireJekoServerConfig, type JekoServerConfig } from "@/lib/jeko-config";
import {
  buildJekoTeacherPayoutReference,
  createJekoTeacherPayout,
  getJekoTeacherPayoutTransfer,
  jekoPayoutWebhookMethodMatches,
  JekoPayoutApiError,
  mapTeacherPayoutMethodToJeko,
  normalizeJekoPayoutPhoneNumber,
  type JekoTeacherPayoutResult,
  type JekoTransferDetails,
} from "@/lib/jeko-payout";
import {
  jekoFeeCentsToCoveredXof,
  jekoPayloadSha256,
  normalizeJekoPaymentStatus,
  xofToJekoAmountCents,
  type ParsedJekoWebhook,
} from "@/lib/jeko-utils";
import { paymentMethodLabel } from "@/lib/payment-methods";
import { getTeacherPayableAmount, isCancellationPenaltyPayout } from "@/lib/teacher-payments";
import { decideTeacherPayoutTransition } from "@/lib/jeko-payout-state";

export type JekoPayoutAction =
  | "paid"
  | "already_paid"
  | "pending"
  | "failed"
  | "duplicate"
  | "rejected"
  | "not_found"
  | "ignored";

export type JekoPayoutReconciliationResult = {
  payoutRecordId?: string;
  reference?: string;
  action: JekoPayoutAction;
  status: "success" | "pending" | "error" | "rejected" | "ignored";
  verified: boolean;
  message: string;
  feeCoveredByPlatformXof?: number | null;
};

type RecordForProof = {
  id: string;
  reference: string;
  providerReference: string | null;
  provider: string | null;
  teacherId: string;
  amount: number;
  method: PaymentMethod | null;
  paymentPhone: string | null;
  status: string;
};

export function buildJekoPayoutRecordId(idempotencyKey: string) {
  const normalized = idempotencyKey.trim();
  if (normalized.length < 16 || normalized.length > 180 || !/^[A-Za-z0-9._:-]+$/.test(normalized)) {
    throw new Error("Clé d'idempotence du versement invalide.");
  }
  const digest = createHash("sha256").update(normalized).digest("hex");
  return `jp_${digest.slice(0, 40)}`;
}

export function getStableJekoPayoutReference(payoutRecordId: string) {
  return buildJekoTeacherPayoutReference(payoutRecordId);
}

/**
 * Appelle Jèko avec la référence du DRAFT. Un statut pending ne touche jamais
 * au ledger ; success est la seule branche qui appelle la finalisation.
 */
export async function processJekoTeacherPayoutRecord(
  payoutRecordId: string,
  options: { config?: JekoServerConfig } = {},
): Promise<JekoPayoutReconciliationResult> {
  const record = await db.teacherPayoutRecord.findUnique({
    where: { id: payoutRecordId },
    include: {
      teacher: { select: { fullName: true, professionalName: true } },
      allocations: { select: { id: true } },
    },
  });
  if (!record) return notFoundResult("Versement professeur introuvable.");
  if (record.status === "PAID") return alreadyPaidResult(record);
  if (record.status === "CANCELLED") {
    return {
      payoutRecordId: record.id,
      reference: record.reference,
      action: "failed",
      status: "error",
      verified: false,
      message: "Cette tentative de versement Jèko est annulée.",
    };
  }
  assertDraftRecordReady(record);

  let result: JekoTeacherPayoutResult;
  try {
    result = await createJekoTeacherPayout({
      reference: record.reference,
      teacherName: record.teacher.professionalName || record.teacher.fullName,
      phoneNumber: record.paymentPhone!,
      paymentMethod: record.method!,
      teacherNetAmountXof: record.amount,
      description: `Versement professeur Compétence ${record.reference}`,
      referenceCreatedAt: record.createdAt,
    }, { config: options.config });

  } catch (error) {
    const message = error instanceof Error ? error.message : "Transfert Jèko indisponible.";
    const uncertain = error instanceof JekoPayoutApiError && error.retryable;
    if (uncertain) {
      await appendDraftTrace(record.id, `Confirmation Jèko à reprendre : ${message}`);
      return {
        payoutRecordId: record.id,
        reference: record.reference,
        action: "pending",
        status: "pending",
        verified: false,
        message: "Jèko n'a pas encore fourni de confirmation terminale. Aucun débit comptable n'a été appliqué.",
      };
    }
    return cancelJekoTeacherPayout({
      payoutRecordId: record.id,
      reason: message,
      feeAmountCents: 0,
    });
  }

  try {
    await persistApiPayoutResult(record, result, options.config);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Persistance de la réponse Jèko impossible.";
    // À ce stade Jèko a répondu : une erreur SQL ne doit jamais transformer
    // une issue externe potentiellement réussie en CANCELLED.
    await appendDraftTrace(record.id, `Réponse Jèko reçue, rapprochement local à reprendre : ${message}`);
    return pendingResult(record, result.feeCoveredByPlatformXof);
  }

  const transition = decideTeacherPayoutTransition(record.status, result.status);
  if (transition === "finalize") {
    try {
      return await finalizeJekoTeacherPayout({
        payoutRecordId: record.id,
        providerTransferId: result.providerTransferId,
        providerTransactionId: result.providerTransactionId,
        feeAmountCents: result.feeCoveredByPlatformCents ?? 0,
        proof: result.raw,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Finalisation locale impossible.";
      await appendDraftTrace(record.id, `Transfert Jèko confirmé, finalisation SQL à reprendre : ${message}`);
      return pendingResult(record, result.feeCoveredByPlatformXof);
    }
  }
  if (transition === "cancel") {
    return cancelJekoTeacherPayout({
      payoutRecordId: record.id,
      reason: "Jèko a confirmé l'échec du transfert.",
      feeAmountCents: result.feeCoveredByPlatformCents ?? 0,
    });
  }
  return pendingResult(record, result.feeCoveredByPlatformXof);
}

/** Vérification serveur manuelle d'un DRAFT dont l'identifiant transfert est connu. */
export async function verifyJekoTeacherPayoutRecord(
  payoutRecordId: string,
  options: { config?: JekoServerConfig } = {},
): Promise<JekoPayoutReconciliationResult> {
  const config = options.config ?? requireJekoServerConfig();
  const record = await db.teacherPayoutRecord.findUnique({ where: { id: payoutRecordId } });
  if (!record) return notFoundResult("Versement professeur introuvable.");
  if (record.status === "PAID") return alreadyPaidResult(record);
  if (record.status === "CANCELLED") {
    return {
      payoutRecordId: record.id,
      reference: record.reference,
      action: "failed",
      status: "error",
      verified: false,
      message: "Cette tentative est déjà annulée.",
    };
  }
  assertDraftRecordReady(record);

  const event = await db.paymentEvent.findFirst({
    where: {
      provider: "JEKO",
      reference: record.reference,
      providerOrderId: { not: null },
    },
    orderBy: { receivedAt: "desc" },
    select: { providerOrderId: true },
  });
  if (!event?.providerOrderId) {
    // Une réponse a pu être perdue après création côté Jèko. La référence
    // stable transforme ce nouvel appel en 409/réconciliation sans double débit.
    return processJekoTeacherPayoutRecord(record.id, { config });
  }

  const details = await getJekoTeacherPayoutTransfer(event.providerOrderId, { config });
  const mismatches = validateTransferAgainstRecord(record, details, config);
  if (mismatches.length > 0) {
    await recordProviderEvent({
      record,
      storeId: config.storeId,
      dedupeKey: `JEKO:PAYOUT:VERIFY:${details.providerTransferId}:REJECTED`,
      providerEventId: details.providerTransactionId ?? details.providerTransferId,
      eventType: "teacher_payout.server_verification",
      status: "REJECTED",
      signatureValid: false,
      verificationSource: "SERVER_CONFIRMATION",
      providerOrderId: details.providerTransferId,
      feeAmountCents: details.feeCoveredByPlatformCents,
      payload: details.raw,
      payloadSha256: jekoPayloadSha256(JSON.stringify(details.raw)),
      processingError: mismatches.join(", "),
    });
    return rejectedResult(record, mismatches);
  }

  await recordProviderEvent({
    record,
    storeId: config.storeId,
    dedupeKey: `JEKO:PAYOUT:VERIFY:${details.providerTransferId}:${details.status}`,
    providerEventId: details.providerTransactionId ?? details.providerTransferId,
    eventType: "teacher_payout.server_verification",
    status: details.status === "pending" ? "RECEIVED" : "PROCESSED",
    signatureValid: false,
    verificationSource: "SERVER_CONFIRMATION",
    providerOrderId: details.providerTransferId,
    feeAmountCents: details.feeCoveredByPlatformCents,
    payload: details.raw,
    payloadSha256: jekoPayloadSha256(JSON.stringify(details.raw)),
  });
  const transition = decideTeacherPayoutTransition(record.status, details.status);
  if (transition === "wait") {
    await persistPendingProviderData(record.id, details.feeCoveredByPlatformCents);
    return pendingResult(record, details.feeCoveredByPlatformXof);
  }
  if (transition === "cancel") {
    return cancelJekoTeacherPayout({
      payoutRecordId: record.id,
      reason: "La vérification serveur Jèko confirme l'échec du transfert.",
      feeAmountCents: details.feeCoveredByPlatformCents,
    });
  }
  if (transition === "already") return alreadyPaidResult(record);
  if (transition === "conflict") {
    return rejectedResult(record, ["statut local incompatible avec la confirmation Jèko"]);
  }
  return finalizeJekoTeacherPayout({
    payoutRecordId: record.id,
    providerTransferId: details.providerTransferId,
    providerTransactionId: details.providerTransactionId,
    feeAmountCents: details.feeCoveredByPlatformCents,
    proof: details.raw,
  });
}

export async function reconcileJekoPayoutWebhook(input: {
  webhook: ParsedJekoWebhook;
  payloadSha256: string;
  config?: JekoServerConfig;
}): Promise<JekoPayoutReconciliationResult> {
  const config = input.config ?? requireJekoServerConfig();
  const incoming = input.webhook.transaction;
  if (
    input.webhook.eventType !== "transaction.completed"
    || normalizeTransactionType(incoming.transactionType) !== "transfer"
  ) {
    return {
      action: "ignored",
      status: "ignored",
      verified: false,
      message: "Événement sans transfert professeur ignoré.",
    };
  }

  const reference = incoming.transactionDetails?.reference?.trim() ?? "";
  const incomingTransferId = incoming.transactionDetails?.id?.trim() ?? "";
  if (!reference) {
    return {
      action: "rejected",
      status: "rejected",
      verified: false,
      message: "Webhook transfert rejeté : référence partenaire absente.",
    };
  }

  const records = await db.teacherPayoutRecord.findMany({
    where: {
      provider: "JEKO",
      OR: [{ reference }, { providerReference: reference }],
    },
    take: 2,
  });
  if (records.length === 0) return notFoundResult("DRAFT du versement Jèko pas encore disponible.");
  if (records.length !== 1) {
    return {
      action: "rejected",
      status: "rejected",
      verified: false,
      message: "Référence de versement Jèko ambiguë.",
    };
  }
  const record = records[0];
  const existingEvent = await db.paymentEvent.findUnique({ where: { dedupeKey: input.webhook.dedupeKey } });
  if (existingEvent?.status === "PROCESSED" || existingEvent?.status === "REJECTED") {
    return {
      payoutRecordId: record.id,
      reference: record.reference,
      action: "duplicate",
      status: record.status === "PAID" ? "success" : existingEvent.status === "REJECTED" ? "rejected" : "error",
      verified: record.status === "PAID",
      message: "Webhook transfert déjà traité ; aucun double débit.",
    };
  }

  const priorProviderId = await db.paymentEvent.findFirst({
    where: { provider: "JEKO", reference: record.reference, providerOrderId: { not: null } },
    orderBy: { receivedAt: "desc" },
    select: { providerOrderId: true },
  });
  const transferId = incomingTransferId || priorProviderId?.providerOrderId || "";
  if (!transferId) {
    await recordProviderEvent({
      record,
      storeId: config.storeId,
      dedupeKey: input.webhook.dedupeKey,
      providerEventId: incoming.id,
      eventType: "teacher_payout.webhook",
      status: "RECEIVED",
      signatureValid: true,
      verificationSource: "WEBHOOK",
      providerOrderId: null,
      feeAmountCents: incoming.fees.amount,
      payload: input.webhook.payload,
      payloadSha256: input.payloadSha256,
      processingError: "Identifiant de transfert absent du webhook ; rapprochement à reprendre.",
    });
    await persistPendingProviderData(record.id, incoming.fees.amount);
    return {
      payoutRecordId: record.id,
      reference: record.reference,
      action: "pending",
      status: "pending",
      verified: false,
      message: "Identifiant du transfert absent ; Jèko peut réessayer le webhook.",
    };
  }

  const details = await getJekoTeacherPayoutTransfer(transferId, { config });
  const mismatches = [
    ...validateTransferAgainstRecord(record, details, config),
    reference !== record.reference ? "référence webhook différente" : "",
    incomingTransferId && incomingTransferId !== details.providerTransferId ? "identifiant transfert différent" : "",
    incoming.amount.currency.toUpperCase() !== "XOF" ? "devise webhook différente" : "",
    incoming.fees.currency.toUpperCase() !== "XOF" ? "devise de frais webhook différente" : "",
    incoming.amount.amount !== xofToJekoAmountCents(record.amount) ? "montant webhook différent" : "",
    incoming.fees.amount !== details.feeCoveredByPlatformCents ? "frais webhook différents" : "",
    details.providerTransactionId && details.providerTransactionId !== incoming.id
      ? "identifiant transaction différent"
      : "",
    jekoPayoutWebhookMethodMatches(record.method, incoming.paymentMethod) ? "" : "méthode webhook différente",
    webhookPhoneMatches(record.paymentPhone, incoming.counterpartIdentifier) ? "" : "bénéficiaire webhook différent",
  ].filter(Boolean);

  if (mismatches.length > 0) {
    await recordProviderEvent({
      record,
      storeId: config.storeId,
      dedupeKey: input.webhook.dedupeKey,
      providerEventId: incoming.id,
      eventType: "teacher_payout.webhook",
      status: "REJECTED",
      signatureValid: true,
      verificationSource: "WEBHOOK",
      providerOrderId: transferId,
      feeAmountCents: incoming.fees.amount,
      payload: input.webhook.payload,
      payloadSha256: input.payloadSha256,
      processingError: mismatches.join(", "),
    });
    return rejectedResult(record, mismatches);
  }

  const incomingStatus = normalizeJekoPaymentStatus(incoming.status);
  const confirmedStatus = toWebhookComparableStatus(details.status);
  const statusConsensus = incomingStatus === confirmedStatus && incomingStatus !== "pending"
    ? incomingStatus
    : "pending";
  if (statusConsensus === "pending") {
    await recordProviderEvent({
      record,
      storeId: config.storeId,
      dedupeKey: input.webhook.dedupeKey,
      providerEventId: incoming.id,
      eventType: "teacher_payout.webhook",
      status: "RECEIVED",
      signatureValid: true,
      verificationSource: "WEBHOOK",
      providerOrderId: transferId,
      feeAmountCents: incoming.fees.amount,
      payload: input.webhook.payload,
      payloadSha256: input.payloadSha256,
      processingError: "Statuts webhook et confirmation serveur encore non concordants.",
    });
    await persistPendingProviderData(record.id, incoming.fees.amount);
    return pendingResult(record, jekoFeeCentsToCoveredXof(incoming.fees.amount));
  }

  const transition = decideTeacherPayoutTransition(record.status, details.status);
  if (transition === "conflict") {
    const conflict = "statut local incompatible avec la confirmation Jèko";
    await recordProviderEvent({
      record,
      storeId: config.storeId,
      dedupeKey: input.webhook.dedupeKey,
      providerEventId: incoming.id,
      eventType: "teacher_payout.webhook",
      status: "REJECTED",
      signatureValid: true,
      verificationSource: "WEBHOOK",
      providerOrderId: transferId,
      feeAmountCents: incoming.fees.amount,
      payload: input.webhook.payload,
      payloadSha256: input.payloadSha256,
      processingError: conflict,
    });
    return rejectedResult(record, [conflict]);
  }

  if (transition === "wait") {
    await recordProviderEvent({
      record,
      storeId: config.storeId,
      dedupeKey: input.webhook.dedupeKey,
      providerEventId: incoming.id,
      eventType: "teacher_payout.webhook",
      status: "RECEIVED",
      signatureValid: true,
      verificationSource: "WEBHOOK",
      providerOrderId: transferId,
      feeAmountCents: incoming.fees.amount,
      payload: input.webhook.payload,
      payloadSha256: input.payloadSha256,
    });
    await persistPendingProviderData(record.id, incoming.fees.amount);
    return pendingResult(record, jekoFeeCentsToCoveredXof(incoming.fees.amount));
  }

  let result: JekoPayoutReconciliationResult;
  if (transition === "cancel") {
    result = await cancelJekoTeacherPayout({
      payoutRecordId: record.id,
      reason: "Le webhook signé et la vérification serveur confirment l'échec du transfert.",
      feeAmountCents: incoming.fees.amount,
    });
  } else if (transition === "finalize") {
    result = await finalizeJekoTeacherPayout({
      payoutRecordId: record.id,
      providerTransferId: details.providerTransferId,
      providerTransactionId: incoming.id,
      feeAmountCents: incoming.fees.amount,
      proof: input.webhook.payload,
    });
  } else {
    result = record.status === "PAID"
      ? alreadyPaidResult(record)
      : {
          payoutRecordId: record.id,
          reference: record.reference,
          action: "failed",
          status: "error",
          verified: true,
          message: "L'échec Jèko avait déjà annulé cette tentative ; aucun débit professeur n'a été appliqué.",
        };
  }
  await recordProviderEvent({
    record,
    storeId: config.storeId,
    dedupeKey: input.webhook.dedupeKey,
    providerEventId: incoming.id,
    eventType: "teacher_payout.webhook",
    status: "PROCESSED",
    signatureValid: true,
    verificationSource: "WEBHOOK",
    providerOrderId: transferId,
    feeAmountCents: incoming.fees.amount,
    payload: input.webhook.payload,
    payloadSha256: input.payloadSha256,
  });
  return result;
}

export async function finalizeJekoTeacherPayout(input: {
  payoutRecordId: string;
  providerTransferId: string | null;
  providerTransactionId: string | null;
  feeAmountCents: number;
  proof: unknown;
}): Promise<JekoPayoutReconciliationResult> {
  const now = new Date();
  const feeAmountMinor = Math.max(0, Math.round(input.feeAmountCents));
  const feeAmountXof = jekoFeeCentsToCoveredXof(feeAmountMinor);
  const proofSha256 = jekoPayloadSha256(JSON.stringify(input.proof ?? {}));

  const result = await db.$transaction(async (tx) => {
    const record = await tx.teacherPayoutRecord.findUnique({
      where: { id: input.payoutRecordId },
      include: {
        teacher: { select: { fullName: true, professionalName: true } },
        createdBy: { select: { id: true, name: true } },
        payoutRequest: { select: { id: true, reference: true, status: true } },
        allocations: {
          orderBy: { createdAt: "asc" },
          include: {
            booking: {
              select: {
                id: true,
                reference: true,
                teacherId: true,
                status: true,
                paymentStatus: true,
                paymentMethod: true,
                teacherNetAmount: true,
                teacherPaidAmount: true,
                teacherPaidAt: true,
                cancellationPenaltyTeacherAmount: true,
              },
            },
            bookingSession: {
              select: {
                id: true,
                bookingId: true,
                teacherId: true,
                sequence: true,
                status: true,
                releasedAmount: true,
                paidAmount: true,
                retainedAmount: true,
                paidAt: true,
              },
            },
          },
        },
      },
    });
    if (!record) return { kind: "not_found" as const };
    if (record.status === "PAID") return { kind: "already_paid" as const, record };
    if (record.status !== "DRAFT") throw new Error("PAYOUT_NOT_FINALIZABLE");
    assertDraftRecordReady(record);
    if (record.reference !== getStableJekoPayoutReference(record.id)) {
      throw new Error("PAYOUT_REFERENCE_MISMATCH");
    }
    const allocatedTotal = record.allocations.reduce((sum, allocation) => sum + allocation.amount, 0);
    if (allocatedTotal !== record.amount || record.allocations.length === 0) {
      throw new Error("PAYOUT_ALLOCATION_MISMATCH");
    }

    const claimed = await tx.teacherPayoutRecord.updateMany({
      where: { id: record.id, status: "DRAFT" },
      data: {
        status: "PAID",
        paidAt: now,
        provider: "JEKO",
        providerReference: record.reference,
        transferFeeAmount: feeAmountXof,
        transferFeeAmountMinor: feeAmountMinor,
        transferFeeCoveredByPlatform: feeAmountXof,
        transferFeeCoveredByPlatformMinor: feeAmountMinor,
        note: appendTrace(
          record.note,
          `Jèko confirmé${input.providerTransferId ? ` (${input.providerTransferId})` : ""}${input.providerTransactionId ? `, transaction ${input.providerTransactionId}` : ""}; preuve ${proofSha256.slice(0, 12)}; frais ${feeAmountXof} FCFA pris en charge par Compétence.`,
        ),
      },
    });
    if (claimed.count !== 1) return { kind: "already_paid" as const, record };

    const sessionBookingIds = new Set<string>();
    for (const allocation of record.allocations) {
      const booking = allocation.booking;
      const session = allocation.bookingSession;
      if (session) {
        if (
          session.bookingId !== booking.id
          || session.teacherId !== record.teacherId
          || session.paidAmount !== allocation.paidAmountBefore
          || session.releasedAmount !== allocation.releasedAmountSnapshot
          || session.retainedAmount !== allocation.retainedAmountSnapshot
        ) {
          throw new Error("PAYOUT_BALANCE_CHANGED");
        }
        const newPaid = allocation.paidAmountBefore + allocation.amount;
        if (newPaid + allocation.retainedAmountSnapshot > allocation.releasedAmountSnapshot) {
          throw new Error("PAYOUT_ALLOCATION_EXCEEDS_BALANCE");
        }
        const fullyPaid = newPaid + allocation.retainedAmountSnapshot >= allocation.releasedAmountSnapshot;
        const updated = await tx.bookingSession.updateMany({
          where: {
            id: session.id,
            teacherId: record.teacherId,
            paidAmount: allocation.paidAmountBefore,
            releasedAmount: allocation.releasedAmountSnapshot,
            retainedAmount: allocation.retainedAmountSnapshot,
          },
          data: {
            paidAmount: newPaid,
            retainedAmount: allocation.retainedAmountSnapshot,
            status: fullyPaid ? "PAID" : "PARTIALLY_PAID",
            paidAt: fullyPaid ? now : session.paidAt,
          },
        });
        if (updated.count !== 1) throw new Error("PAYOUT_BALANCE_CHANGED");
        sessionBookingIds.add(booking.id);
        await tx.bookingSessionHistory.create({
          data: {
            bookingSessionId: session.id,
            action: "PAYOUT_RECORDED",
            detail: `${allocation.amount} FCFA versés via Jèko sous la référence ${record.reference}.`,
            actorType: "ADMIN",
            actorId: record.createdById,
            fromStatus: session.status,
            toStatus: fullyPaid ? "PAID" : "PARTIALLY_PAID",
          },
        });
        await createTeacherPayoutTransaction(tx, {
          bookingId: booking.id,
          teacherId: record.teacherId,
          amount: allocation.amount,
          method: record.method,
          fullyPaid,
          paidAt: now,
        });
        continue;
      }

      const payableNow = getTeacherPayableAmount(booking);
      if (
        booking.teacherId !== record.teacherId
        || booking.teacherPaidAmount !== allocation.paidAmountBefore
        || payableNow !== allocation.releasedAmountSnapshot
      ) {
        throw new Error("PAYOUT_BALANCE_CHANGED");
      }
      const newPaid = allocation.paidAmountBefore + allocation.amount;
      if (newPaid + allocation.retainedAmountSnapshot > allocation.releasedAmountSnapshot) {
        throw new Error("PAYOUT_ALLOCATION_EXCEEDS_BALANCE");
      }
      const fullyPaid = newPaid + allocation.retainedAmountSnapshot >= allocation.releasedAmountSnapshot;
      const cancellationPenalty = isCancellationPenaltyPayout(booking);
      const updated = await tx.booking.updateMany({
        where: { id: booking.id, teacherPaidAmount: allocation.paidAmountBefore },
        data: {
          teacherPaidAmount: newPaid,
          paymentStatus: cancellationPenalty
            ? booking.paymentStatus
            : fullyPaid ? "TEACHER_PAID" : "TO_PAY_TEACHER",
          status: cancellationPenalty
            ? booking.status
            : fullyPaid ? "TEACHER_PAID" : booking.status,
          teacherPaidAt: fullyPaid ? now : booking.teacherPaidAt,
        },
      });
      if (updated.count !== 1) throw new Error("PAYOUT_BALANCE_CHANGED");
      await createTeacherPayoutTransaction(tx, {
        bookingId: booking.id,
        teacherId: record.teacherId,
        amount: allocation.amount,
        method: record.method,
        fullyPaid,
        paidAt: now,
      });
      if (fullyPaid && !cancellationPenalty) {
        await tx.transaction.updateMany({
          where: { bookingId: booking.id, type: "CLIENT_PAYMENT" },
          data: { status: "TEACHER_PAID", paidAt: now },
        });
      }
    }

    for (const bookingId of sessionBookingIds) {
      const aggregate = await syncBookingSessionAggregates(
        tx as unknown as Parameters<typeof syncBookingSessionAggregates>[0],
        bookingId,
      );
      if (aggregate?.paymentStatus === "TEACHER_PAID") {
        await tx.transaction.updateMany({
          where: { bookingId, type: "CLIENT_PAYMENT" },
          data: { status: "TEACHER_PAID", paidAt: now },
        });
      }
    }

    if (record.payoutRequest) {
      const request = await tx.teacherPayoutRequest.updateMany({
        where: {
          id: record.payoutRequest.id,
          status: "PENDING",
          payoutRecordId: record.id,
        },
        data: {
          status: "PAID",
          adminNote: `Versement Jèko confirmé. Reçu ${record.reference}. Le professeur reçoit exactement ${record.amount} FCFA.`,
          reviewedAt: now,
          reviewedById: record.createdById,
        },
      });
      if (request.count !== 1) throw new Error("PAYOUT_REQUEST_ALREADY_HANDLED");
    }

    const teacherName = record.teacher.professionalName || record.teacher.fullName;
    const allocationSummary = record.allocations
      .map((allocation) => `- ${allocation.booking.reference}${allocation.bookingSession ? ` · séance ${allocation.bookingSession.sequence}` : ""} : ${allocation.amount.toLocaleString("fr-FR")} FCFA`)
      .join("\n");
    await tx.adminActionLog.create({
      data: {
        adminId: record.createdById,
        action: "Versement professeur Jèko confirmé",
        entityType: "TeacherPayoutRecord",
        entityId: record.id,
        detail: `${record.amount} FCFA versés exactement à ${teacherName}. Frais Jèko de ${feeAmountXof} FCFA pris en charge par Compétence. Référence ${record.reference}. Preuve ${proofSha256}.`,
        oldStatus: "DRAFT",
        newStatus: "PAID",
      },
    });
    await tx.teacherNotification.create({
      data: {
        teacherId: record.teacherId,
        bookingId: record.allocations[0]?.booking.id,
        title: `Paiement reçu - ${record.reference}`,
        message: [
          `Bonjour ${teacherName},`,
          "",
          `Votre versement de ${record.amount.toLocaleString("fr-FR")} FCFA est confirmé.`,
          "Les frais de transfert Jèko sont intégralement pris en charge par Compétence : aucun frais n'est déduit de votre montant.",
          `Méthode : ${paymentMethodLabel(record.method)}`,
          record.paymentPhone ? `Numéro payé : ${record.paymentPhone}` : "",
          `Référence : ${record.reference}`,
          "",
          "Réservations concernées :",
          allocationSummary,
        ].filter(Boolean).join("\n"),
        channel: "WHATSAPP",
        sent: false,
        status: "PENDING",
        sentById: record.createdById,
      },
    });
    await tx.notification.create({
      data: {
        userId: null,
        title: "Versement professeur Jèko confirmé",
        message: `${record.amount} FCFA versés à ${teacherName}; frais plateforme ${feeAmountXof} FCFA.`,
        type: "TEACHER_PAYOUT",
        recipientType: "TEACHER",
        recipientName: teacherName,
        channel: "WHATSAPP",
        status: "CREATED",
        priority: "NORMAL",
        teacherId: record.teacherId,
        bookingId: record.allocations[0]?.booking.id,
        adminId: record.createdById,
        link: `/admin/professeurs/${record.teacherId}?tab=paiements`,
        actionLabel: "Ouvrir comptabilité",
      },
    });
    return { kind: "paid" as const, record };
  }, { isolationLevel: "Serializable" });

  if (result.kind === "not_found") return notFoundResult("Versement professeur introuvable.");
  if (result.kind === "already_paid") return alreadyPaidResult(result.record);
  return {
    payoutRecordId: result.record.id,
    reference: result.record.reference,
    action: "paid",
    status: "success",
    verified: true,
    message: `Versement de ${result.record.amount} FCFA confirmé et comptabilisé une seule fois.`,
    feeCoveredByPlatformXof: feeAmountXof,
  };
}

export async function cancelJekoTeacherPayout(input: {
  payoutRecordId: string;
  reason: string;
  feeAmountCents: number;
}): Promise<JekoPayoutReconciliationResult> {
  const reason = input.reason.trim().slice(0, 500) || "Échec du transfert Jèko.";
  const feeAmountMinor = Math.max(0, Math.round(input.feeAmountCents));
  const feeAmountXof = jekoFeeCentsToCoveredXof(feeAmountMinor);
  const record = await db.$transaction(async (tx) => {
    const current = await tx.teacherPayoutRecord.findUnique({ where: { id: input.payoutRecordId } });
    if (!current) return null;
    if (current.status === "PAID" || current.status === "CANCELLED") return current;
    const cancelled = await tx.teacherPayoutRecord.update({
      where: { id: current.id },
      data: {
        status: "CANCELLED",
        provider: "JEKO",
        transferFeeAmount: feeAmountXof,
        transferFeeAmountMinor: feeAmountMinor,
        transferFeeCoveredByPlatform: feeAmountXof,
        transferFeeCoveredByPlatformMinor: feeAmountMinor,
        note: appendTrace(current.note, `Échec Jèko : ${reason}`),
      },
    });
    await tx.teacherPayoutRequest.updateMany({
      where: { payoutRecordId: current.id, status: "PENDING" },
      data: {
        payoutRecordId: null,
        adminNote: `Tentative Jèko annulée sans débit du solde professeur : ${reason}`,
      },
    });
    await tx.adminActionLog.create({
      data: {
        adminId: current.createdById,
        action: "Versement professeur Jèko annulé",
        entityType: "TeacherPayoutRecord",
        entityId: current.id,
        detail: `${reason} Aucun montant n'a été débité du ledger professeur.`,
        oldStatus: "DRAFT",
        newStatus: "CANCELLED",
      },
    });
    return cancelled;
  }, { isolationLevel: "Serializable" });
  if (!record) return notFoundResult("Versement professeur introuvable.");
  if (record.status === "PAID") return alreadyPaidResult(record);
  return {
    payoutRecordId: record.id,
    reference: record.reference,
    action: "failed",
    status: "error",
    verified: true,
    message: `${reason} Aucun débit professeur n'a été appliqué.`,
    feeCoveredByPlatformXof: feeAmountXof,
  };
}

function validateTransferAgainstRecord(
  record: RecordForProof,
  details: JekoTransferDetails,
  config: JekoServerConfig,
) {
  const expectedReference = getStableJekoPayoutReference(record.id);
  const expectedMethod = record.method ? mapTeacherPayoutMethodToJeko(record.method) : null;
  let expectedPhone: string | null = null;
  let beneficiaryPhone: string | null = null;
  try {
    expectedPhone = record.paymentPhone ? normalizeJekoPayoutPhoneNumber(record.paymentPhone) : null;
    beneficiaryPhone = details.beneficiary ? normalizeJekoPayoutPhoneNumber(details.beneficiary) : null;
  } catch {
    // Les erreurs de format deviennent des motifs explicites de rejet ci-dessous.
  }
  return [
    record.provider !== "JEKO" ? "fournisseur local différent" : "",
    record.reference !== expectedReference ? "référence locale non déterministe" : "",
    record.providerReference !== expectedReference ? "référence fournisseur locale différente" : "",
    details.reference !== expectedReference ? "référence Jèko différente" : "",
    details.storeId !== config.storeId ? "magasin Jèko différent" : "",
    details.teacherNetAmountCents !== xofToJekoAmountCents(record.amount) ? "montant Jèko différent" : "",
    details.teacherNetAmountXof !== record.amount ? "net professeur différent" : "",
    expectedMethod !== details.paymentMethod ? "méthode Jèko différente" : "",
    !expectedPhone || !beneficiaryPhone || expectedPhone !== beneficiaryPhone ? "bénéficiaire Jèko différent" : "",
  ].filter(Boolean);
}

async function persistApiPayoutResult(
  record: RecordForProof,
  result: JekoTeacherPayoutResult,
  configOverride?: JekoServerConfig,
) {
  const config = configOverride ?? requireJekoServerConfig();
  const mismatches = [
    result.reference !== record.reference ? "référence API différente" : "",
    result.storeId !== config.storeId ? "magasin API différent" : "",
    result.teacherNetAmountCents !== xofToJekoAmountCents(record.amount) ? "montant API différent" : "",
    record.method && result.paymentMethod !== mapTeacherPayoutMethodToJeko(record.method) ? "méthode API différente" : "",
  ].filter(Boolean);
  if (mismatches.length > 0) {
    throw new JekoPayoutApiError(mismatches.join(", "), 502, "PAYOUT_RESPONSE_MISMATCH");
  }
  await persistPendingProviderData(record.id, result.feeCoveredByPlatformCents ?? 0);
  const providerEventId = result.providerTransactionId ?? result.providerTransferId ?? `${record.id}:${result.status}`;
  await recordProviderEvent({
    record,
    storeId: config.storeId,
    dedupeKey: `JEKO:PAYOUT:API:${providerEventId}:${result.status}`,
    providerEventId,
    eventType: "teacher_payout.api_response",
    status: result.status === "pending" ? "RECEIVED" : "PROCESSED",
    signatureValid: false,
    verificationSource: "SERVER_CONFIRMATION",
    providerOrderId: result.providerTransferId,
    feeAmountCents: result.feeCoveredByPlatformCents ?? 0,
    payload: result.raw,
    payloadSha256: jekoPayloadSha256(JSON.stringify(result.raw)),
  });
}

async function persistPendingProviderData(recordId: string, feeAmountCents: number) {
  const feeAmountMinor = Math.max(0, Math.round(feeAmountCents));
  const feeAmountXof = jekoFeeCentsToCoveredXof(feeAmountMinor);
  await db.teacherPayoutRecord.updateMany({
    where: { id: recordId, status: "DRAFT" },
    data: {
      provider: "JEKO",
      transferFeeAmount: feeAmountXof,
      transferFeeAmountMinor: feeAmountMinor,
      transferFeeCoveredByPlatform: feeAmountXof,
      transferFeeCoveredByPlatformMinor: feeAmountMinor,
    },
  });
}

async function appendDraftTrace(recordId: string, detail: string) {
  const record = await db.teacherPayoutRecord.findUnique({
    where: { id: recordId },
    select: { note: true, status: true },
  });
  if (!record || record.status !== "DRAFT") return;
  await db.teacherPayoutRecord.updateMany({
    where: { id: recordId, status: "DRAFT" },
    data: { note: appendTrace(record.note, detail) },
  });
}

async function recordProviderEvent(input: {
  record: RecordForProof;
  storeId: string;
  dedupeKey: string;
  providerEventId: string;
  eventType: string;
  status: "RECEIVED" | "PROCESSED" | "REJECTED" | "FAILED";
  signatureValid: boolean;
  verificationSource: "WEBHOOK" | "SERVER_CONFIRMATION";
  providerOrderId: string | null;
  feeAmountCents: number;
  payload: unknown;
  payloadSha256: string;
  processingError?: string;
}) {
  const feeAmountXof = jekoFeeCentsToCoveredXof(Math.max(0, input.feeAmountCents));
  const processedAt = input.status === "RECEIVED" ? null : new Date();
  await db.paymentEvent.upsert({
    where: { dedupeKey: input.dedupeKey },
    create: {
      provider: "JEKO",
      paymentAttemptId: null,
      dedupeKey: input.dedupeKey,
      providerEventId: input.providerEventId,
      eventType: input.eventType,
      status: input.status,
      verificationSource: input.verificationSource,
      signatureValid: input.signatureValid,
      providerOrderId: input.providerOrderId,
      reference: input.record.reference,
      storeId: input.storeId,
      currency: "XOF",
      amountXof: input.record.amount,
      providerAmountMinor: xofToJekoAmountCents(input.record.amount),
      providerFeeAmountXof: feeAmountXof,
      providerFeeAmountMinor: input.feeAmountCents,
      payloadSha256: input.payloadSha256,
      payload: toJson(input.payload),
      processingError: input.processingError ?? null,
      processedAt,
    },
    update: {
      status: input.status,
      signatureValid: input.signatureValid,
      providerOrderId: input.providerOrderId,
      storeId: input.storeId,
      providerFeeAmountXof: feeAmountXof,
      providerFeeAmountMinor: input.feeAmountCents,
      payloadSha256: input.payloadSha256,
      payload: toJson(input.payload),
      processingError: input.processingError ?? null,
      processedAt,
    },
  });
}

async function createTeacherPayoutTransaction(
  tx: Prisma.TransactionClient,
  input: {
    bookingId: string;
    teacherId: string;
    amount: number;
    method: PaymentMethod | null;
    fullyPaid: boolean;
    paidAt: Date;
  },
) {
  await tx.transaction.create({
    data: {
      reference: generateReference("TX-PROF"),
      bookingId: input.bookingId,
      teacherId: input.teacherId,
      amount: input.amount,
      commission: 0,
      teacherNet: input.amount,
      type: "TEACHER_PAYOUT",
      status: input.fullyPaid ? "TEACHER_PAID" : "TO_PAY_TEACHER",
      method: input.method,
      paidAt: input.paidAt,
    },
  });
}

function assertDraftRecordReady(record: {
  id: string;
  reference: string;
  providerReference: string | null;
  provider: string | null;
  method: PaymentMethod | null;
  paymentPhone: string | null;
  allocations?: unknown[];
}) {
  const expectedReference = getStableJekoPayoutReference(record.id);
  if (
    record.provider !== "JEKO"
    || record.reference !== expectedReference
    || record.providerReference !== expectedReference
    || !record.method
    || !record.paymentPhone
    || (record.allocations && record.allocations.length === 0)
  ) {
    throw new Error("DRAFT_JEKO_INCOMPLETE");
  }
}


function webhookPhoneMatches(expected: string | null, received: string | undefined) {
  if (!expected || !received) return false;
  try {
    return normalizeJekoPayoutPhoneNumber(expected) === normalizeJekoPayoutPhoneNumber(received);
  } catch {
    return false;
  }
}

function normalizeTransactionType(value: string) {
  return value.trim().toLowerCase().replace(/[\s_-]/g, "");
}

function toWebhookComparableStatus(status: JekoTransferDetails["status"]) {
  return status === "failed" ? "error" : status;
}

function appendTrace(note: string | null, detail: string) {
  const marker = `[${new Date().toISOString()}] ${detail}`;
  return note?.trim() ? `${note.trim()}\n${marker}` : marker;
}

function pendingResult(record: { id: string; reference: string }, fee: number | null | undefined): JekoPayoutReconciliationResult {
  return {
    payoutRecordId: record.id,
    reference: record.reference,
    action: "pending",
    status: "pending",
    verified: false,
    message: "Transfert Jèko en attente. Le solde professeur reste inchangé jusqu'à la confirmation finale.",
    feeCoveredByPlatformXof: fee ?? null,
  };
}

function alreadyPaidResult(record: { id: string; reference: string }): JekoPayoutReconciliationResult {
  return {
    payoutRecordId: record.id,
    reference: record.reference,
    action: "already_paid",
    status: "success",
    verified: true,
    message: "Versement déjà confirmé ; aucun double débit.",
  };
}

function notFoundResult(message: string): JekoPayoutReconciliationResult {
  return { action: "not_found", status: "pending", verified: false, message };
}

function rejectedResult(record: { id: string; reference: string }, mismatches: string[]): JekoPayoutReconciliationResult {
  return {
    payoutRecordId: record.id,
    reference: record.reference,
    action: "rejected",
    status: "rejected",
    verified: false,
    message: `Rapprochement du versement rejeté : ${mismatches.join(", ")}.`,
  };
}

function toJson(value: unknown) {
  return JSON.parse(JSON.stringify(value ?? {})) as Prisma.InputJsonValue;
}
