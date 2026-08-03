import "server-only";

import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireJekoServerConfig, type JekoServerConfig } from "@/lib/jeko-config";
import {
  JekoApiError,
  recoverJekoPaymentRequestByReference,
} from "@/lib/jeko";
import {
  isStaleUnidentifiedJekoRequest,
  platformMethodToJeko,
} from "@/lib/jeko-client-payment";

const RECOVERY_PENDING_CODE = "JEKO_REFERENCE_RECOVERY_PENDING";
const RECOVERY_REJECTED_CODE = "JEKO_REFERENCE_RECOVERY_REJECTED";
const RECOVERY_EXPIRED_CODE = "JEKO_REQUEST_ID_UNRECOVERABLE";

export type JekoAttemptIdentityRecovery =
  | {
      recovered: true;
      providerOrderId: string;
      checkoutUrl: string;
      source: "provider_error" | "transaction_history";
    }
  | {
      recovered: false;
      action: "pending" | "rejected" | "expired";
      message: string;
    };

/**
 * Donne une identité fournisseur à une tentative REQUESTING dont la
 * réponse de création a été perdue. Cette fonction ne crée jamais de
 * demande distante : elle ne fait que des GET et persiste l'ID + l'URL après
 * validation stricte.
 */
export async function recoverJekoPaymentAttemptIdentity(
  attemptId: string,
  options: {
    config?: JekoServerConfig;
    providerError?: unknown;
  } = {},
): Promise<JekoAttemptIdentityRecovery> {
  const config = options.config ?? requireJekoServerConfig();
  const attempt = await db.paymentAttempt.findFirst({
    where: { id: attemptId, provider: "JEKO" },
    select: {
      id: true,
      bookingId: true,
      rescheduleRequestId: true,
      purpose: true,
      status: true,
      reference: true,
      amountXof: true,
      method: true,
      providerOrderId: true,
      checkoutUrl: true,
      requestedAt: true,
      createdAt: true,
      booking: {
        select: {
          id: true,
          reference: true,
          teacherId: true,
          clientId: true,
          paymentStatus: true,
        },
      },
    },
  });
  if (!attempt) {
    return { recovered: false, action: "rejected", message: "Tentative Jèko introuvable." };
  }
  if (attempt.providerOrderId && attempt.checkoutUrl) {
    return {
      recovered: true,
      providerOrderId: attempt.providerOrderId,
      checkoutUrl: attempt.checkoutUrl,
      source: "transaction_history",
    };
  }

  const paymentMethod = platformMethodToJeko(attempt.method);
  if (!paymentMethod) {
    const message = "La méthode locale ne permet pas de retrouver la demande Jèko.";
    await rejectRecovery(attempt, message);
    return { recovered: false, action: "rejected", message };
  }

  try {
    const recovered = await recoverJekoPaymentRequestByReference({
      reference: attempt.reference,
      amountXof: attempt.amountXof,
      paymentMethod,
      referenceCreatedAt: attempt.createdAt,
      providerErrorPayload: options.providerError instanceof JekoApiError
        ? options.providerError.details
        : null,
    }, { config });
    if (!recovered) {
      if (isStaleUnidentifiedJekoRequest(attempt)) {
        const message = "L'ancienne création Jèko n'a ni identifiant ni lien récupérable et aucune transaction correspondante n'a été trouvée après le délai de sécurité. Elle est clôturée sans valider de paiement.";
        const expired = await expireUnrecoverableRequest(attempt, message);
        if (expired) return { recovered: false, action: "expired", message };
      }
      const message = "La référence existe peut-être chez Jèko, mais aucun identifiant confirmable n'est encore disponible. Aucun nouveau POST ne sera envoyé.";
      await markRecoveryPending(attempt, message);
      return { recovered: false, action: "pending", message };
    }

    const now = new Date();
    const status = recovered.confirmation.status === "error" ? "FAILED" : "PENDING";
    await db.$transaction(async (tx) => {
      await tx.paymentAttempt.updateMany({
        where: {
          id: attempt.id,
          provider: "JEKO",
          providerOrderId: null,
          status: { in: ["CREATED", "REQUESTING", "PENDING", "FAILED"] },
        },
        data: {
          status,
          providerOrderId: recovered.confirmation.id,
          checkoutUrl: recovered.redirectUrl,
          storeId: recovered.confirmation.storeId,
          responsePayload: toJson(recovered.confirmation.raw),
          lastCheckedAt: now,
          failureCode: recovered.confirmation.status === "error" ? "JEKO_PAYMENT_FAILED" : null,
          failureReason: recovered.confirmation.status === "error"
            ? (recovered.confirmation.errorReason ?? "Paiement Jèko non finalisé.").slice(0, 500)
            : null,
          failedAt: recovered.confirmation.status === "error" ? now : null,
        },
      });
      if (attempt.purpose === "BOOKING" && attempt.bookingId) {
        await tx.booking.updateMany({
          where: { id: attempt.bookingId, paymentStatus: "FAILED" },
          data: {
            paymentProvider: "JEKO",
            providerPaymentStatus: recovered.confirmation.status === "error" ? "ERROR" : "PENDING",
            paymentVerifiedAt: null,
          },
        });
      }
      if (attempt.purpose === "RESCHEDULE_FEE" && attempt.rescheduleRequestId) {
        await tx.bookingRescheduleRequest.updateMany({
          where: { id: attempt.rescheduleRequestId, paidAt: null },
          data: {
            paymentProvider: "JEKO",
            status: recovered.confirmation.status === "error" ? "PAYMENT_FAILED" : "PAYMENT_PENDING",
          },
        });
      }
      await tx.adminActionLog.create({
        data: {
          adminId: null,
          action: "Demande Jèko ambiguë récupérée",
          entityType: attempt.purpose === "RESCHEDULE_FEE" ? "BookingRescheduleRequest" : "Booking",
          entityId: attempt.rescheduleRequestId ?? attempt.bookingId ?? attempt.id,
          detail: `Tentative ${attempt.id}. Référence ${attempt.reference}. ID Jèko et URL de paiement retrouvés par ${recovered.source === "provider_error" ? "la réponse fournisseur" : "l'historique des transactions"}, puis confirmés par GET serveur.`,
          oldStatus: attempt.status,
          newStatus: status,
        },
      });
    });

    return {
      recovered: true,
      providerOrderId: recovered.confirmation.id,
      checkoutUrl: recovered.redirectUrl,
      source: recovered.source,
    };
  } catch (error) {
    if (error instanceof JekoApiError && ["IDEMPOTENCY_MISMATCH", "RESPONSE_MISMATCH"].includes(error.code ?? "")) {
      const message = "La référence Jèko retrouvée est incohérente avec le montant ou le moyen local. Contrôle manuel obligatoire.";
      await rejectRecovery(attempt, message);
      return { recovered: false, action: "rejected", message };
    }
    const message = "La recherche serveur de la demande Jèko est temporairement indisponible. Aucun nouveau POST ne sera envoyé.";
    await markRecoveryPending(attempt, message);
    return { recovered: false, action: "pending", message };
  }
}

async function markRecoveryPending(
  attempt: RecoveryAttempt,
  message: string,
) {
  const now = new Date();
  await db.$transaction(async (tx) => {
    const firstAlert = await tx.paymentAttempt.updateMany({
      where: {
        id: attempt.id,
        status: { in: ["CREATED", "REQUESTING", "PENDING"] },
        OR: [
          { failureCode: null },
          { failureCode: { not: RECOVERY_PENDING_CODE } },
        ],
      },
      data: {
        status: "REQUESTING",
        failureCode: RECOVERY_PENDING_CODE,
        failureReason: message.slice(0, 500),
        lastCheckedAt: now,
      },
    });
    if (firstAlert.count === 0) {
      await tx.paymentAttempt.updateMany({
        where: { id: attempt.id, status: "REQUESTING" },
        data: { lastCheckedAt: now },
      });
      return;
    }
    await createRecoveryAlert(tx, attempt, {
      title: "Création Jèko ambiguë à contrôler",
      message: `${message} Référence: ${attempt.reference}. Tentative: ${attempt.id}.`,
      priority: "URGENT",
      newStatus: RECOVERY_PENDING_CODE,
    });
  });
}

async function expireUnrecoverableRequest(
  attempt: RecoveryAttempt,
  message: string,
) {
  const now = new Date();
  return db.$transaction(async (tx) => {
    const expired = await tx.paymentAttempt.updateMany({
      where: {
        id: attempt.id,
        provider: "JEKO",
        status: "REQUESTING",
        providerOrderId: null,
        checkoutUrl: null,
      },
      data: {
        status: "EXPIRED",
        failureCode: RECOVERY_EXPIRED_CODE,
        failureReason: message.slice(0, 500),
        failedAt: now,
        lastCheckedAt: now,
      },
    });
    if (expired.count === 0) return false;

    if (attempt.purpose === "BOOKING" && attempt.bookingId) {
      await tx.booking.updateMany({
        where: {
          id: attempt.bookingId,
          status: "PENDING_PAYMENT",
          paymentStatus: "FAILED",
          paymentProvider: "JEKO",
        },
        data: {
          providerPaymentStatus: "ERROR",
          paymentVerifiedAt: null,
        },
      });
    }
    if (attempt.purpose === "RESCHEDULE_FEE" && attempt.rescheduleRequestId) {
      await tx.bookingRescheduleRequest.updateMany({
        where: { id: attempt.rescheduleRequestId, paidAt: null },
        data: { status: "PAYMENT_FAILED" },
      });
    }
    await createRecoveryAlert(tx, attempt, {
      title: "Ancienne création Jèko clôturée sans paiement",
      message: `${message} Référence: ${attempt.reference}. Tentative: ${attempt.id}.`,
      priority: "URGENT",
      newStatus: RECOVERY_EXPIRED_CODE,
    });
    return true;
  });
}

async function rejectRecovery(
  attempt: RecoveryAttempt,
  message: string,
) {
  const now = new Date();
  await db.$transaction(async (tx) => {
    const rejected = await tx.paymentAttempt.updateMany({
      where: { id: attempt.id, status: { notIn: ["SUCCEEDED", "REJECTED"] } },
      data: {
        status: "REJECTED",
        failureCode: RECOVERY_REJECTED_CODE,
        failureReason: message.slice(0, 500),
        failedAt: now,
        lastCheckedAt: now,
      },
    });
    if (rejected.count === 0) return;
    await createRecoveryAlert(tx, attempt, {
      title: "Rapprochement Jèko incohérent",
      message: `${message} Référence: ${attempt.reference}. Tentative: ${attempt.id}.`,
      priority: "CRITICAL",
      newStatus: RECOVERY_REJECTED_CODE,
    });
  });
}

type RecoveryAttempt = {
  id: string;
  bookingId: string | null;
  rescheduleRequestId: string | null;
  purpose: string;
  status: string;
  reference: string;
  providerOrderId: string | null;
  checkoutUrl: string | null;
  requestedAt: Date | null;
  createdAt: Date;
  booking: {
    id: string;
    reference: string;
    teacherId: string;
    clientId: string;
    paymentStatus: string;
  } | null;
};

async function createRecoveryAlert(
  tx: Prisma.TransactionClient,
  attempt: RecoveryAttempt,
  alert: {
    title: string;
    message: string;
    priority: "URGENT" | "CRITICAL";
    newStatus: string;
  },
) {
  await tx.notification.create({
    data: {
      userId: null,
      title: alert.title,
      message: alert.message,
      type: "JEKO_RECONCILIATION_REQUIRED",
      recipientType: "ADMIN",
      channel: "INTERNAL",
      status: "SENT",
      priority: alert.priority,
      bookingId: attempt.bookingId,
      teacherId: attempt.booking?.teacherId ?? null,
      clientId: attempt.booking?.clientId ?? null,
      sentAt: new Date(),
      link: attempt.bookingId ? `/admin/reservations/${attempt.bookingId}` : "/admin/paiements",
      actionLabel: "Contrôler Jèko",
    },
  });
  await tx.adminActionLog.create({
    data: {
      adminId: null,
      action: alert.title,
      entityType: attempt.purpose === "RESCHEDULE_FEE" ? "BookingRescheduleRequest" : "Booking",
      entityId: attempt.rescheduleRequestId ?? attempt.bookingId ?? attempt.id,
      detail: alert.message,
      oldStatus: attempt.status,
      newStatus: alert.newStatus,
    },
  });
}

function toJson(value: unknown) {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}
