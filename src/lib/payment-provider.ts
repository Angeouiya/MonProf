import "server-only";

import { createHash } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { createJekoPaymentRequest, JekoApiError } from "@/lib/jeko";
import { validateJekoRescheduleFinancialSnapshot } from "@/lib/jeko-client-payment";
import { recoverJekoPaymentAttemptIdentity } from "@/lib/jeko-payment-request-recovery";
import { isAllowedJekoRedirectUrl, xofToJekoAmountCents, type JekoPaymentMethod } from "@/lib/jeko-utils";

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

export type CreateJekoBookingCheckoutInput = {
  bookingId: string;
  idempotencyKey: string;
  paymentMethod: JekoPaymentMethod;
  successUrl: string;
  errorUrl: string;
};

export type JekoBookingCheckoutResult = {
  attemptId: string;
  reference: string;
  status: "processing" | "pending" | "succeeded";
  checkoutUrl: string | null;
  amountXof: number;
};

export type CreateJekoRescheduleCheckoutInput = {
  bookingId: string;
  rescheduleRequestId: string;
  idempotencyKey: string;
  paymentMethod: JekoPaymentMethod;
  successUrl: string;
  errorUrl: string;
};

export type JekoRescheduleCheckoutResult = JekoBookingCheckoutResult & {
  rescheduleRequestId: string;
};

/**
 * Crée ou reprend une seule tentative Jèko pour une clé d'idempotence.
 * Le prix est toujours relu depuis Booking ; aucun montant client n'est accepté.
 */
export async function createJekoBookingCheckout(
  input: CreateJekoBookingCheckoutInput,
): Promise<JekoBookingCheckoutResult> {
  const idempotencyKey = normalizeIdempotencyKey(input.idempotencyKey);
  const bookingId = input.bookingId.trim();
  if (!bookingId) throw new Error("Réservation manquante.");

  const booking = await db.booking.findUnique({
    where: { id: bookingId },
    select: {
      id: true,
      reference: true,
      paymentStatus: true,
      paymentProvider: true,
      paydunyaToken: true,
      paydunyaCheckoutUrl: true,
      paydunyaStatus: true,
      paydunyaVerifiedAt: true,
      totalClientPays: true,
      totalPrice: true,
      courseAmount: true,
      transportFee: true,
      paymentServiceFeeAmount: true,
      commissionAmount: true,
      teacherNetAmount: true,
      totalTeacherReceives: true,
    },
  });
  if (!booking) throw new Error("Réservation introuvable.");
  if (SECURED_PAYMENT_STATUSES.has(booking.paymentStatus)) {
    throw new Error("Cette réservation possède déjà des fonds sécurisés.");
  }
  const paydunyaStatus = booking.paydunyaStatus?.trim().toUpperCase() ?? "";
  const paydunyaTerminalFailure = ["FAILED", "CANCELLED", "CANCELED", "EXPIRED"].includes(
    paydunyaStatus,
  );
  const activePayDunyaCheckout = Boolean(
    (booking.paydunyaToken || booking.paydunyaCheckoutUrl) && !paydunyaTerminalFailure,
  );
  if (
    booking.paymentProvider === "PAYDUNYA"
    || booking.paydunyaVerifiedAt
    || activePayDunyaCheckout
  ) {
    throw new Error(
      "Cette réservation est déjà affectée à PayDunya. Aucun lien Jèko concurrent ne peut être ouvert.",
    );
  }

  // Verrou inter-fournisseurs posé en base avant tout appel externe. Les
  // anciens brouillons sans provider sont ainsi revendiqués par Jèko de façon
  // atomique ; un autre checkout doit observer JEKO et s'arrêter.
  const providerClaim = await db.booking.updateMany({
    where: {
      id: booking.id,
      paymentStatus: "FAILED",
      paydunyaVerifiedAt: null,
      OR: [
        { paymentProvider: null },
        { paymentProvider: "JEKO" },
      ],
    },
    data: {
      paymentProvider: "JEKO",
      providerPaymentStatus: "PENDING",
      paymentVerifiedAt: null,
    },
  });
  if (providerClaim.count === 0) {
    throw new Error("Cette réservation a été revendiquée par un autre fournisseur de paiement.");
  }

  const amountXof = booking.totalClientPays > 0 ? booking.totalClientPays : booking.totalPrice;
  const providerAmountMinor = xofToJekoAmountCents(amountXof);
  const reference = buildJekoReference(booking.reference, idempotencyKey);
  const snapshot = {
    provider: "JEKO" as const,
    purpose: "BOOKING" as const,
    bookingId: booking.id,
    rescheduleRequestId: null,
    idempotencyKey,
    reference,
    currency: "XOF",
    amountXof,
    providerAmountMinor,
    courseAmountXof: booking.courseAmount,
    transportAmountXof: booking.transportFee,
    serviceFeeAmountXof: booking.paymentServiceFeeAmount,
    commissionAmountXof: booking.commissionAmount,
    teacherAmountXof: booking.totalTeacherReceives > 0
      ? booking.totalTeacherReceives
      : booking.teacherNetAmount,
    method: toPlatformPaymentMethod(input.paymentMethod),
  };

  let attempt = await db.paymentAttempt.findUnique({ where: { idempotencyKey } });
  if (!attempt) {
    try {
      attempt = await db.paymentAttempt.create({
        data: {
          ...snapshot,
          status: "CREATED",
        },
      });
    } catch (error) {
      if (!isUniqueConstraintError(error)) throw error;
      attempt = await db.paymentAttempt.findUnique({ where: { idempotencyKey } });
    }
  }
  if (!attempt) throw new Error("Impossible de créer la tentative de paiement.");
  assertAttemptMatchesSnapshot(attempt, snapshot);

  if (attempt.status === "SUCCEEDED") {
    return checkoutResult(attempt, "succeeded");
  }
  if (attempt.checkoutUrl && isAllowedJekoRedirectUrl(attempt.checkoutUrl)) {
    return checkoutResult(attempt, "pending");
  }

  if (attempt.status === "REQUESTING") {
    const recovery = await recoverJekoPaymentAttemptIdentity(attempt.id);
    if (recovery.recovered) {
      const recoveredAttempt = await db.paymentAttempt.findUniqueOrThrow({ where: { id: attempt.id } });
      return checkoutResult(recoveredAttempt, "pending");
    }
    const current = await db.paymentAttempt.findUniqueOrThrow({ where: { id: attempt.id } });
    return checkoutResult(current, "processing");
  }

  const claimed = await db.paymentAttempt.updateMany({
    where: {
      id: attempt.id,
      OR: [
        { status: "CREATED" },
        { status: "FAILED" },
      ],
    },
    data: {
      status: "REQUESTING",
      requestedAt: new Date(),
      failureCode: null,
      failureReason: null,
      requestPayload: toJson({
        reference,
        amountXof,
        providerAmountMinor,
        paymentMethod: input.paymentMethod,
      }),
    },
  });
  if (claimed.count === 0) {
    const current = await db.paymentAttempt.findUniqueOrThrow({ where: { id: attempt.id } });
    return checkoutResult(current, current.status === "SUCCEEDED" ? "succeeded" : "processing");
  }

  try {
    const paymentRequest = await createJekoPaymentRequest({
      reference,
      amountXof,
      paymentMethod: input.paymentMethod,
      successUrl: appendAttemptId(input.successUrl, attempt.id),
      errorUrl: appendAttemptId(input.errorUrl, attempt.id),
    });
    const updated = await db.paymentAttempt.update({
      where: { id: attempt.id },
      data: {
        // La réponse de création ne constitue jamais une preuve de paiement.
        // Seul le rapprochement GET + webhook peut passer à SUCCEEDED.
        status: "PENDING",
        providerOrderId: paymentRequest.id,
        checkoutUrl: paymentRequest.redirectUrl,
        storeId: paymentRequest.storeId,
        responsePayload: toJson(paymentRequest.raw),
        lastCheckedAt: new Date(),
        verifiedAt: null,
        completedAt: null,
      },
    });
    await db.booking.updateMany({
      where: { id: booking.id, paymentStatus: "FAILED" },
      data: {
        paymentProvider: "JEKO",
        providerPaymentStatus: "PENDING",
        paymentVerifiedAt: null,
      },
    });
    return checkoutResult(updated, "pending");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Création Jèko impossible.";
    const ambiguousProviderOutcome = isAmbiguousJekoCreateOutcome(error);
    if (ambiguousProviderOutcome) {
      const recovery = await recoverJekoPaymentAttemptIdentity(attempt.id, { providerError: error });
      if (recovery.recovered) {
        const recoveredAttempt = await db.paymentAttempt.findUniqueOrThrow({ where: { id: attempt.id } });
        return checkoutResult(recoveredAttempt, "pending");
      }
      await db.booking.updateMany({
        where: { id: booking.id, paymentStatus: "FAILED", paymentProvider: "JEKO" },
        data: {
          providerPaymentStatus: recovery.action === "rejected" ? "ERROR" : "PENDING",
          paymentVerifiedAt: null,
        },
      });
      throw error;
    }
    await db.paymentAttempt.updateMany({
      where: { id: attempt.id, status: { not: "SUCCEEDED" } },
      data: {
        // Une coupure après l'envoi peut cacher une demande effectivement
        // créée chez Jèko. Garder la même tentative active force le retry
        // à réutiliser la même référence au lieu d'en ouvrir une seconde.
        status: "FAILED",
        failedAt: new Date(),
        failureCode: getErrorCode(error),
        failureReason: message.slice(0, 500),
      },
    });
    await db.booking.updateMany({
      where: { id: booking.id, paymentStatus: "FAILED" },
      data: {
        paymentProvider: "JEKO",
        providerPaymentStatus: "ERROR",
        paymentVerifiedAt: null,
      },
    });
    throw error;
  }
}

/**
 * Prépare un supplément Jèko à partir du snapshot financier immuable de la
 * demande. Seul le marqueur explicite JEKO rend la demande éligible : un
 * ancien dossier nullable ne peut donc jamais basculer de fournisseur.
 */
export async function createJekoRescheduleCheckout(
  input: CreateJekoRescheduleCheckoutInput,
): Promise<JekoRescheduleCheckoutResult> {
  const idempotencyKey = normalizeIdempotencyKey(input.idempotencyKey);
  const bookingId = input.bookingId.trim();
  const rescheduleRequestId = input.rescheduleRequestId.trim();
  if (!bookingId || !rescheduleRequestId) throw new Error("Demande de modification manquante.");

  const request = await db.bookingRescheduleRequest.findFirst({
    where: { id: rescheduleRequestId, bookingId },
    select: {
      id: true,
      bookingId: true,
      status: true,
      totalToPay: true,
      feeAmount: true,
      feePlatformAmount: true,
      feeTeacherAmount: true,
      paymentServiceFeeAmount: true,
      paidAt: true,
      paymentProvider: true,
      booking: { select: { reference: true } },
    },
  });
  if (!request) throw new Error("Demande de modification introuvable.");
  if (request.paymentProvider !== "JEKO") {
    throw new Error("Cette demande n'est pas explicitement affectée à Jèko.");
  }
  if (
    request.paidAt
    || !["PAYMENT_PENDING", "PAYMENT_FAILED"].includes(request.status)
    || !Number.isSafeInteger(request.totalToPay)
    || request.totalToPay <= 0
  ) {
    throw new Error("Ce supplément n'est plus payable.");
  }
  const invalidFinancialSnapshot = validateJekoRescheduleFinancialSnapshot(request);
  if (invalidFinancialSnapshot) throw new Error(invalidFinancialSnapshot);

  const amountXof = request.totalToPay;
  const providerAmountMinor = xofToJekoAmountCents(amountXof);
  const reference = buildJekoReference(`${request.booking.reference}-RS`, idempotencyKey);
  const snapshot = {
    provider: "JEKO" as const,
    purpose: "RESCHEDULE_FEE" as const,
    bookingId: request.bookingId,
    rescheduleRequestId: request.id,
    idempotencyKey,
    reference,
    currency: "XOF",
    amountXof,
    providerAmountMinor,
    courseAmountXof: request.feeAmount,
    transportAmountXof: 0,
    serviceFeeAmountXof: request.paymentServiceFeeAmount,
    commissionAmountXof: request.feePlatformAmount,
    teacherAmountXof: request.feeTeacherAmount,
    method: toPlatformPaymentMethod(input.paymentMethod),
  };

  let attempt = await db.paymentAttempt.findUnique({ where: { idempotencyKey } });
  if (!attempt) {
    try {
      attempt = await db.paymentAttempt.create({ data: { ...snapshot, status: "CREATED" } });
    } catch (error) {
      if (!isUniqueConstraintError(error)) throw error;
      attempt = await db.paymentAttempt.findUnique({ where: { idempotencyKey } });
    }
  }
  if (!attempt) throw new Error("Impossible de créer la tentative de supplément.");
  assertAttemptMatchesSnapshot(attempt, snapshot);

  if (attempt.status === "SUCCEEDED") {
    return { ...checkoutResult(attempt, "succeeded"), rescheduleRequestId: request.id };
  }
  if (attempt.checkoutUrl && isAllowedJekoRedirectUrl(attempt.checkoutUrl)) {
    return { ...checkoutResult(attempt, "pending"), rescheduleRequestId: request.id };
  }

  if (attempt.status === "REQUESTING") {
    const recovery = await recoverJekoPaymentAttemptIdentity(attempt.id);
    if (recovery.recovered) {
      const recoveredAttempt = await db.paymentAttempt.findUniqueOrThrow({ where: { id: attempt.id } });
      return {
        ...checkoutResult(recoveredAttempt, "pending"),
        rescheduleRequestId: request.id,
      };
    }
    const current = await db.paymentAttempt.findUniqueOrThrow({ where: { id: attempt.id } });
    return { ...checkoutResult(current, "processing"), rescheduleRequestId: request.id };
  }

  const claimed = await db.paymentAttempt.updateMany({
    where: {
      id: attempt.id,
      OR: [
        { status: "CREATED" },
        { status: "FAILED" },
      ],
    },
    data: {
      status: "REQUESTING",
      requestedAt: new Date(),
      failureCode: null,
      failureReason: null,
      requestPayload: toJson({
        reference,
        amountXof,
        providerAmountMinor,
        paymentMethod: input.paymentMethod,
        purpose: "RESCHEDULE_FEE",
        rescheduleRequestId: request.id,
      }),
    },
  });
  if (claimed.count === 0) {
    const current = await db.paymentAttempt.findUniqueOrThrow({ where: { id: attempt.id } });
    return {
      ...checkoutResult(current, current.status === "SUCCEEDED" ? "succeeded" : "processing"),
      rescheduleRequestId: request.id,
    };
  }

  try {
    const paymentRequest = await createJekoPaymentRequest({
      reference,
      amountXof,
      paymentMethod: input.paymentMethod,
      successUrl: appendAttemptId(input.successUrl, attempt.id),
      errorUrl: appendAttemptId(input.errorUrl, attempt.id),
    });
    const updated = await db.paymentAttempt.update({
      where: { id: attempt.id },
      data: {
        status: "PENDING",
        providerOrderId: paymentRequest.id,
        checkoutUrl: paymentRequest.redirectUrl,
        storeId: paymentRequest.storeId,
        responsePayload: toJson(paymentRequest.raw),
        lastCheckedAt: new Date(),
        verifiedAt: null,
        completedAt: null,
      },
    });
    await db.bookingRescheduleRequest.updateMany({
      where: { id: request.id, paidAt: null },
      data: { status: "PAYMENT_PENDING" },
    });
    return { ...checkoutResult(updated, "pending"), rescheduleRequestId: request.id };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Création Jèko impossible.";
    const ambiguousProviderOutcome = isAmbiguousJekoCreateOutcome(error);
    if (ambiguousProviderOutcome) {
      const recovery = await recoverJekoPaymentAttemptIdentity(attempt.id, { providerError: error });
      if (recovery.recovered) {
        const recoveredAttempt = await db.paymentAttempt.findUniqueOrThrow({ where: { id: attempt.id } });
        return {
          ...checkoutResult(recoveredAttempt, "pending"),
          rescheduleRequestId: request.id,
        };
      }
      await db.bookingRescheduleRequest.updateMany({
        where: { id: request.id, paidAt: null, paymentProvider: "JEKO" },
        data: { status: recovery.action === "rejected" ? "PAYMENT_FAILED" : "PAYMENT_PENDING" },
      });
      throw error;
    }
    await db.$transaction([
      db.paymentAttempt.updateMany({
        where: { id: attempt.id, status: { not: "SUCCEEDED" } },
        data: {
          status: "FAILED",
          failedAt: new Date(),
          failureCode: getErrorCode(error),
          failureReason: message.slice(0, 500),
        },
      }),
      db.bookingRescheduleRequest.updateMany({
        where: { id: request.id, paidAt: null },
        data: { status: "PAYMENT_FAILED" },
      }),
    ]);
    throw error;
  }
}

function assertAttemptMatchesSnapshot(
  attempt: {
    provider: string;
    purpose: string;
    bookingId: string | null;
    rescheduleRequestId: string | null;
    reference: string;
    currency: string;
    amountXof: number;
    providerAmountMinor: number;
    courseAmountXof: number;
    transportAmountXof: number;
    serviceFeeAmountXof: number;
    commissionAmountXof: number;
    teacherAmountXof: number;
    method: string | null;
  },
  snapshot: {
    provider: string;
    purpose: string;
    bookingId: string;
    rescheduleRequestId: string | null;
    reference: string;
    currency: string;
    amountXof: number;
    providerAmountMinor: number;
    courseAmountXof: number;
    transportAmountXof: number;
    serviceFeeAmountXof: number;
    commissionAmountXof: number;
    teacherAmountXof: number;
    method: string;
  },
) {
  if (
    attempt.provider !== snapshot.provider
    || attempt.purpose !== snapshot.purpose
    || attempt.bookingId !== snapshot.bookingId
    || attempt.rescheduleRequestId !== snapshot.rescheduleRequestId
    || attempt.reference !== snapshot.reference
    || attempt.currency !== snapshot.currency
    || attempt.amountXof !== snapshot.amountXof
    || attempt.providerAmountMinor !== snapshot.providerAmountMinor
    || attempt.courseAmountXof !== snapshot.courseAmountXof
    || attempt.transportAmountXof !== snapshot.transportAmountXof
    || attempt.serviceFeeAmountXof !== snapshot.serviceFeeAmountXof
    || attempt.commissionAmountXof !== snapshot.commissionAmountXof
    || attempt.teacherAmountXof !== snapshot.teacherAmountXof
    || attempt.method !== snapshot.method
  ) {
    throw new Error("La clé d'idempotence correspond à une autre tentative de paiement.");
  }
}

function checkoutResult(
  attempt: {
    id: string;
    reference: string;
    checkoutUrl: string | null;
    amountXof: number;
  },
  status: JekoBookingCheckoutResult["status"],
): JekoBookingCheckoutResult {
  return {
    attemptId: attempt.id,
    reference: attempt.reference,
    status,
    checkoutUrl: attempt.checkoutUrl,
    amountXof: attempt.amountXof,
  };
}

function buildJekoReference(bookingReference: string, idempotencyKey: string) {
  const bookingPart = bookingReference.replace(/[^A-Za-z0-9_-]/g, "-").slice(0, 55);
  const digest = createHash("sha256").update(idempotencyKey).digest("hex").slice(0, 16).toUpperCase();
  return `JEKO-${bookingPart}-${digest}`;
}

function appendAttemptId(callbackUrl: string, attemptId: string) {
  const url = new URL(callbackUrl);
  url.searchParams.set("attempt", attemptId);
  return url.toString();
}

function normalizeIdempotencyKey(value: string) {
  const normalized = value.trim();
  if (normalized.length < 16 || normalized.length > 160 || !/^[A-Za-z0-9._:-]+$/.test(normalized)) {
    throw new Error("Clé d'idempotence invalide.");
  }
  return normalized;
}

function toPlatformPaymentMethod(method: JekoPaymentMethod) {
  const values = {
    wave: "WAVE",
    orange: "ORANGE_MONEY",
    mtn: "MTN_MONEY",
    moov: "MOOV_MONEY",
    djamo: "DJAMO",
  } as const;
  return values[method];
}

function isUniqueConstraintError(error: unknown) {
  return error !== null && typeof error === "object" && "code" in error && error.code === "P2002";
}

function getErrorCode(error: unknown) {
  if (error && typeof error === "object" && "code" in error && typeof error.code === "string") {
    return error.code.slice(0, 100);
  }
  return "JEKO_CREATE_FAILED";
}

function isAmbiguousJekoCreateOutcome(error: unknown) {
  if (!(error instanceof JekoApiError)) return false;
  return error.httpStatus === 408
    || error.httpStatus === 409
    || error.httpStatus === 429
    || error.httpStatus >= 500
    || error.code === "NETWORK_ERROR"
    || error.code === "TIMEOUT";
}

function toJson(value: unknown) {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}
