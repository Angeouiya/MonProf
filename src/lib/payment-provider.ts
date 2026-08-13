import "server-only";

import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { createJekoPaymentRequest, JekoApiError } from "@/lib/jeko";
import { validateJekoRescheduleFinancialSnapshot } from "@/lib/jeko-client-payment";
import { recoverJekoPaymentAttemptIdentity } from "@/lib/jeko-payment-request-recovery";
import { isAllowedJekoRedirectUrl, xofToJekoAmountCents, type JekoPaymentMethod } from "@/lib/jeko-utils";
import { assertTeacherScheduleAvailable, lockTeacherSchedule } from "@/lib/teacher-schedule-conflicts";

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
  expectedAmountXof: number;
  expectedPricingSnapshot: string | null;
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

  const prepared = await db.$transaction(async (tx) => {
    const lockedBooking = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      SELECT "id"
      FROM "Booking"
      WHERE "id" = ${bookingId}
      FOR UPDATE
    `);
    if (lockedBooking.length === 0) throw new Error("Réservation introuvable.");

    // Relecture obligatoire sous le même verrou que le repricing : aucune
    // tentative n'est créée depuis un snapshot lu avant l'attente du verrou.
    const booking = await tx.booking.findUniqueOrThrow({
      where: { id: bookingId },
      select: {
        id: true,
        reference: true,
        teacherId: true,
        status: true,
        paymentStatus: true,
        isQuoteOnly: true,
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
        pricingSnapshot: true,
      },
    });
    if (SECURED_PAYMENT_STATUSES.has(booking.paymentStatus)) {
      throw new Error("Cette réservation possède déjà des fonds sécurisés.");
    }
    if (
      booking.status !== "PENDING_PAYMENT"
      || booking.paymentStatus !== "FAILED"
      || booking.isQuoteOnly
    ) {
      throw new Error("Cette réservation n'est plus payable par Jèko.");
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

    const amountXof = booking.totalClientPays > 0 ? booking.totalClientPays : booking.totalPrice;
    if (
      amountXof !== input.expectedAmountXof
      || booking.pricingSnapshot !== input.expectedPricingSnapshot
    ) {
      throw new Error(
        "Le tarif a été recalculé. Vérifiez le nouveau détail puis confirmez-le avant d'ouvrir Jèko.",
      );
    }

    await lockTeacherSchedule(tx, booking.teacherId);
    await assertTeacherScheduleAvailable(tx, {
      teacherId: booking.teacherId,
      bookingId: booking.id,
      excludeBookingId: booking.id,
    });

    // Verrou inter-fournisseurs posé en base avant tout appel externe. Les
    // anciens brouillons sans provider sont ainsi revendiqués par Jèko de façon
    // atomique ; un autre checkout doit observer JEKO et s'arrêter.
    const providerClaim = await tx.booking.updateMany({
      where: {
        id: booking.id,
        status: "PENDING_PAYMENT",
        paymentStatus: "FAILED",
        isQuoteOnly: false,
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

    let attempt = await tx.paymentAttempt.findUnique({ where: { idempotencyKey } });
    if (!attempt) {
      const concurrentAttempt = await tx.paymentAttempt.findFirst({
        where: {
          bookingId: booking.id,
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
      });
      if (concurrentAttempt) {
        throw new Error("Une tentative Jèko active existe déjà. Rechargez avant de poursuivre.");
      }
      try {
        attempt = await tx.paymentAttempt.create({
          data: {
            ...snapshot,
            status: "CREATED",
          },
        });
      } catch (error) {
        if (!isUniqueConstraintError(error)) throw error;
        attempt = await tx.paymentAttempt.findUnique({ where: { idempotencyKey } });
      }
    }
    if (!attempt) throw new Error("Impossible de créer la tentative de paiement.");
    assertAttemptMatchesSnapshot(attempt, snapshot);
    return { attempt, amountXof, providerAmountMinor, reference };
  });

  let attempt = prepared.attempt;
  const { amountXof, providerAmountMinor, reference } = prepared;

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

  // FAILED avec une identité distante reste rapprochable. Le sweeper et le
  // GET serveur doivent d'abord confirmer son issue ; renvoyer un nouveau POST
  // ici ouvrirait une seconde demande alors que la première peut encore payer.
  if (attempt.status === "FAILED" && attempt.providerOrderId) {
    if (attempt.failureCode === "JEKO_PAYMENT_FAILED") {
      throw new Error(
        "Cette clé d'idempotence correspond à un échec Jèko confirmé. Une nouvelle tentative est requise.",
      );
    }
    return checkoutResult(attempt, "processing");
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

  let paymentRequest: Awaited<ReturnType<typeof createJekoPaymentRequest>>;
  try {
    paymentRequest = await createJekoPaymentRequest({
      reference,
      amountXof,
      paymentMethod: input.paymentMethod,
      successUrl: appendAttemptId(input.successUrl, attempt.id),
      errorUrl: appendAttemptId(input.errorUrl, attempt.id),
    });
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
        where: { id: bookingId, paymentStatus: "FAILED", paymentProvider: "JEKO" },
        data: {
          providerPaymentStatus: recovery.action === "pending" ? "PENDING" : "ERROR",
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
      where: { id: bookingId, paymentStatus: "FAILED" },
      data: {
        paymentProvider: "JEKO",
        providerPaymentStatus: "ERROR",
        paymentVerifiedAt: null,
      },
    });
    throw error;
  }

  try {
    const updated = await db.$transaction(async (tx) => {
      const persisted = await tx.paymentAttempt.updateMany({
        where: { id: attempt.id, status: "REQUESTING" },
        data: {
          // La réponse de création ne constitue jamais une preuve de paiement.
          // Seul le rapprochement GET + webhook peut passer à SUCCEEDED.
          status: "PENDING",
          providerOrderId: paymentRequest.id,
          checkoutUrl: paymentRequest.redirectUrl,
          storeId: paymentRequest.storeId,
          responsePayload: toJson(paymentRequest.raw),
          lastCheckedAt: new Date(),
          failureCode: null,
          failureReason: null,
          verifiedAt: null,
          completedAt: null,
        },
      });
      const current = await tx.paymentAttempt.findUniqueOrThrow({ where: { id: attempt.id } });
      if (persisted.count === 0) {
        if (current.status === "SUCCEEDED") return current;
        if (
          current.status === "PENDING"
          && current.providerOrderId === paymentRequest.id
          && current.reference === reference
        ) return current;
        throw new Error("La tentative Jèko a changé pendant la persistance de la réponse fournisseur.");
      }

      const bookingClaim = await tx.booking.updateMany({
        where: {
          id: bookingId,
          status: "PENDING_PAYMENT",
          paymentStatus: "FAILED",
          isQuoteOnly: false,
          paymentProvider: "JEKO",
          paydunyaVerifiedAt: null,
        },
        data: {
          providerPaymentStatus: "PENDING",
          paymentVerifiedAt: null,
        },
      });
      if (bookingClaim.count !== 1) {
        throw new Error("La réservation a changé après la création de la demande Jèko.");
      }
      return current;
    });
    return checkoutResult(updated, updated.status === "SUCCEEDED" ? "succeeded" : "pending");
  } catch (error) {
    await preserveJekoProviderIdentityAfterLocalFailure(attempt.id, paymentRequest, error);
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

  const prepared = await db.$transaction(async (tx) => {
    const lockedBooking = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      SELECT "id"
      FROM "Booking"
      WHERE "id" = ${bookingId}
      FOR UPDATE
    `);
    if (lockedBooking.length !== 1) throw new Error("Réservation introuvable.");
    const currentBooking = await tx.booking.findUniqueOrThrow({
      where: { id: bookingId },
      select: { id: true, reference: true, status: true },
    });
    if (!["PAID", "PENDING_ADMIN_VALIDATION", "CONFIRMED", "ASSIGNED"].includes(currentBooking.status)) {
      throw new Error("La réservation n'accepte plus le paiement d'un supplément de créneau.");
    }

    const lockedRequest = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      SELECT "id"
      FROM "BookingRescheduleRequest"
      WHERE "id" = ${rescheduleRequestId} AND "bookingId" = ${bookingId}
      FOR UPDATE
    `);
    if (lockedRequest.length !== 1) throw new Error("Demande de modification introuvable.");
    const request = await tx.bookingRescheduleRequest.findFirst({
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
    const reference = buildJekoReference(`${currentBooking.reference}-RS`, idempotencyKey);
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

    let attempt = await tx.paymentAttempt.findUnique({ where: { idempotencyKey } });
    if (!attempt) {
      const concurrentAttempt = await tx.paymentAttempt.findFirst({
        where: {
          rescheduleRequestId: request.id,
          provider: "JEKO",
          purpose: "RESCHEDULE_FEE",
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
      });
      if (concurrentAttempt) {
        throw new Error("Une tentative Jèko rapprochable existe déjà pour ce supplément.");
      }
      try {
        attempt = await tx.paymentAttempt.create({ data: { ...snapshot, status: "CREATED" } });
      } catch (error) {
        if (!isUniqueConstraintError(error)) throw error;
        attempt = await tx.paymentAttempt.findUnique({ where: { idempotencyKey } });
      }
    }
    if (!attempt) throw new Error("Impossible de créer la tentative de supplément.");
    assertAttemptMatchesSnapshot(attempt, snapshot);
    return { request, attempt, amountXof, providerAmountMinor, reference };
  }, { isolationLevel: "Serializable" });

  const { request, amountXof, providerAmountMinor, reference } = prepared;
  let attempt = prepared.attempt;

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

  if (attempt.status === "FAILED" && attempt.providerOrderId) {
    if (attempt.failureCode === "JEKO_PAYMENT_FAILED") {
      throw new Error(
        "Cette clé d'idempotence correspond à un échec Jèko confirmé. Une nouvelle tentative est requise.",
      );
    }
    return { ...checkoutResult(attempt, "processing"), rescheduleRequestId: request.id };
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

  let paymentRequest: Awaited<ReturnType<typeof createJekoPaymentRequest>>;
  try {
    paymentRequest = await createJekoPaymentRequest({
      reference,
      amountXof,
      paymentMethod: input.paymentMethod,
      successUrl: appendAttemptId(input.successUrl, attempt.id),
      errorUrl: appendAttemptId(input.errorUrl, attempt.id),
    });
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
        data: { status: recovery.action === "pending" ? "PAYMENT_PENDING" : "PAYMENT_FAILED" },
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

  try {
    const updated = await db.$transaction(async (tx) => {
      const persisted = await tx.paymentAttempt.updateMany({
        where: { id: attempt.id, status: "REQUESTING" },
        data: {
          status: "PENDING",
          providerOrderId: paymentRequest.id,
          checkoutUrl: paymentRequest.redirectUrl,
          storeId: paymentRequest.storeId,
          responsePayload: toJson(paymentRequest.raw),
          lastCheckedAt: new Date(),
          failureCode: null,
          failureReason: null,
          verifiedAt: null,
          completedAt: null,
        },
      });
      const current = await tx.paymentAttempt.findUniqueOrThrow({ where: { id: attempt.id } });
      if (persisted.count === 0) {
        if (current.status === "SUCCEEDED") return current;
        if (
          current.status === "PENDING"
          && current.providerOrderId === paymentRequest.id
          && current.reference === reference
        ) return current;
        throw new Error("La tentative du supplément a changé pendant la persistance Jèko.");
      }

      const requestClaim = await tx.bookingRescheduleRequest.updateMany({
        where: {
          id: request.id,
          bookingId,
          paymentProvider: "JEKO",
          paidAt: null,
          status: { in: ["PAYMENT_PENDING", "PAYMENT_FAILED"] },
          booking: {
            status: { in: ["PAID", "PENDING_ADMIN_VALIDATION", "CONFIRMED", "ASSIGNED"] },
          },
        },
        data: { status: "PAYMENT_PENDING" },
      });
      if (requestClaim.count !== 1) {
        throw new Error("La demande de modification n'est plus payable après la création Jèko.");
      }
      return current;
    });
    return {
      ...checkoutResult(updated, updated.status === "SUCCEEDED" ? "succeeded" : "pending"),
      rescheduleRequestId: request.id,
    };
  } catch (error) {
    await preserveJekoProviderIdentityAfterLocalFailure(attempt.id, paymentRequest, error);
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

async function preserveJekoProviderIdentityAfterLocalFailure(
  attemptId: string,
  paymentRequest: Awaited<ReturnType<typeof createJekoPaymentRequest>>,
  persistenceError: unknown,
) {
  const message = persistenceError instanceof Error
    ? persistenceError.message
    : "Persistance locale Jèko indisponible.";
  try {
    await db.paymentAttempt.updateMany({
      where: { id: attemptId, status: "REQUESTING" },
      data: {
        // Le POST distant a répondu : cet état doit rester rapprochable et
        // ne doit jamais être compté comme une tentative terminale réessayable.
        status: "PENDING",
        providerOrderId: paymentRequest.id,
        checkoutUrl: paymentRequest.redirectUrl,
        storeId: paymentRequest.storeId,
        responsePayload: toJson(paymentRequest.raw),
        failureCode: "JEKO_LOCAL_PERSISTENCE_PENDING",
        failureReason: `Réponse Jèko reçue ; reprise locale requise : ${message}`.slice(0, 500),
        lastCheckedAt: new Date(),
      },
    });
  } catch (recoveryError) {
    // La tentative reste REQUESTING si la base est indisponible. Sa référence
    // stable permettra au sweeper de retrouver l'objet distant sans nouveau POST.
    console.error("[jeko:provider_identity_persistence_deferred]", {
      attemptId,
      message: recoveryError instanceof Error ? recoveryError.message : "Erreur SQL inconnue",
    });
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
