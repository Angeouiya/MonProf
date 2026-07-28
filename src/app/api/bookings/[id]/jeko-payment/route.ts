import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getJekoServerConfig } from "@/lib/jeko-config";
import { JekoApiError } from "@/lib/jeko";
import {
  isJekoBookingPayable,
  parseJekoCheckoutBody,
  planJekoBookingAttempt,
  platformMethodToJeko,
} from "@/lib/jeko-client-payment";
import { reconcileJekoPaymentAttempt } from "@/lib/jeko-reconciliation";
import { isAllowedJekoRedirectUrl } from "@/lib/jeko-utils";
import { createJekoBookingCheckout } from "@/lib/payment-provider";
import { absoluteAppUrl } from "@/lib/public-url";
import { getSessionUser, type SessionUser } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_POST_BODY_BYTES = 4 * 1024;

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: RouteContext) {
  const authentication = await getApiClient();
  if (authentication.response) return authentication.response;

  const { id: bookingId } = await params;
  const booking = await findOwnedBooking(bookingId, authentication.client.id);
  if (!booking) return apiJson({ error: "Réservation introuvable." }, 404);
  if (!isJekoBookingPayable(booking)) {
    return apiJson({
      error: "Cette réservation n'est pas payable ou son paiement est déjà sécurisé.",
      code: "BOOKING_NOT_PAYABLE",
      booking: {
        id: booking.id,
        status: booking.status,
        paymentStatus: booking.paymentStatus,
      },
    }, 409);
  }

  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(contentLength) && contentLength > MAX_POST_BODY_BYTES) {
    return apiJson({ error: "Corps de requête trop volumineux." }, 413);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiJson({ error: "Corps JSON invalide." }, 400);
  }
  const parsedBody = parseJekoCheckoutBody(body);
  if (!parsedBody.ok) return apiJson({ error: parsedBody.error }, 400);

  const config = getJekoServerConfig();
  if (!config) {
    return apiJson({
      error: "Le paiement Jèko est temporairement indisponible.",
      code: "JEKO_NOT_CONFIGURED",
    }, 503);
  }

  const attempts = await db.paymentAttempt.findMany({
    where: {
      bookingId: booking.id,
      provider: "JEKO",
      purpose: "BOOKING",
    },
    select: {
      id: true,
      idempotencyKey: true,
      status: true,
      method: true,
    },
    orderBy: { createdAt: "desc" },
  });
  const plan = planJekoBookingAttempt({
    bookingId: booking.id,
    requestedMethod: parsedBody.paymentMethod,
    attempts,
  });

  if (plan.kind === "already_paid") {
    const reconciliation = await reconcileJekoPaymentAttempt(plan.attemptId, {
      expectedBookingId: booking.id,
      expectedClientId: authentication.client.id,
      config,
    });
    return apiJson({
      error: reconciliation.verified
        ? null
        : "Une tentative antérieure doit être contrôlée avant un nouveau paiement.",
      payment: {
        provider: "JEKO",
        attemptId: plan.attemptId,
        verified: reconciliation.verified,
        action: reconciliation.action,
        status: reconciliation.status,
        checkoutUrl: null,
        message: reconciliation.message,
      },
    }, reconciliation.verified ? 200 : 409);
  }
  if (plan.kind === "blocked") {
    return apiJson({
      error: plan.reason,
      code: "ACTIVE_ATTEMPT_BLOCKED",
      attemptId: plan.attemptId,
    }, 409);
  }

  const safeBookingId = encodeURIComponent(booking.id);
  try {
    const checkout = await createJekoBookingCheckout({
      bookingId: booking.id,
      idempotencyKey: plan.idempotencyKey,
      paymentMethod: plan.paymentMethod,
      successUrl: absoluteAppUrl(`/client/reservations/${safeBookingId}?jeko=return`, request),
      errorUrl: absoluteAppUrl(`/client/reservations/${safeBookingId}?jeko=cancelled`, request),
    });
    const checkoutUrl = isAllowedJekoRedirectUrl(checkout.checkoutUrl)
      ? checkout.checkoutUrl
      : null;

    return apiJson({
      payment: {
        provider: "JEKO",
        configured: true,
        attemptId: checkout.attemptId,
        reference: checkout.reference,
        status: checkout.status,
        amount: checkout.amountXof,
        paymentMethod: plan.paymentMethod,
        checkoutUrl,
        reused: plan.kind === "reuse",
      },
    }, plan.kind === "create" ? 201 : 200);
  } catch (error) {
    console.error("[jeko:client_checkout_failed]", {
      bookingId: booking.id,
      plan: plan.kind,
      message: error instanceof Error ? error.message : "Erreur inconnue",
    });
    const response = publicJekoError(error);
    return apiJson(response.body, response.status);
  }
}

export async function GET(_request: NextRequest, { params }: RouteContext) {
  const authentication = await getApiClient();
  if (authentication.response) return authentication.response;

  const { id: bookingId } = await params;
  const booking = await findOwnedBooking(bookingId, authentication.client.id);
  if (!booking) return apiJson({ error: "Réservation introuvable." }, 404);

  const attempt = await db.paymentAttempt.findFirst({
    where: {
      bookingId: booking.id,
      provider: "JEKO",
      purpose: "BOOKING",
    },
    orderBy: { createdAt: "desc" },
  });
  if (!attempt) {
    return apiJson({
      payment: null,
      booking: {
        id: booking.id,
        status: booking.status,
        paymentStatus: booking.paymentStatus,
      },
      message: "Aucune tentative de paiement Jèko.",
    });
  }

  const config = getJekoServerConfig();
  if (!config) {
    return apiJson({
      error: "La vérification Jèko est temporairement indisponible.",
      code: "JEKO_NOT_CONFIGURED",
      payment: publicAttempt(attempt),
    }, 503);
  }

  try {
    const reconciliation = await reconcileJekoPaymentAttempt(attempt.id, {
      expectedBookingId: booking.id,
      expectedClientId: authentication.client.id,
      config,
    });
    const [freshAttempt, freshBooking] = await Promise.all([
      db.paymentAttempt.findUnique({ where: { id: attempt.id } }),
      db.booking.findUnique({
        where: { id: booking.id },
        select: {
          id: true,
          status: true,
          paymentStatus: true,
          paymentProvider: true,
          providerPaymentStatus: true,
          paymentVerifiedAt: true,
          isQuoteOnly: true,
          totalClientPays: true,
          totalPrice: true,
        },
      }),
    ]);
    if (!freshAttempt || !freshBooking) {
      return apiJson({ error: "Tentative Jèko introuvable après vérification." }, 404);
    }

    return apiJson({
      payment: {
        ...publicAttempt(freshAttempt),
        verified: reconciliation.verified,
        action: reconciliation.action,
        reconciliationStatus: reconciliation.status,
        message: reconciliation.message,
        canRetry: isJekoBookingPayable(freshBooking)
          && ["FAILED", "REJECTED", "CANCELLED", "EXPIRED"].includes(freshAttempt.status),
      },
      booking: {
        id: freshBooking.id,
        status: freshBooking.status,
        paymentStatus: freshBooking.paymentStatus,
        paymentProvider: freshBooking.paymentProvider,
        providerPaymentStatus: freshBooking.providerPaymentStatus,
        paymentVerifiedAt: freshBooking.paymentVerifiedAt,
      },
    });
  } catch (error) {
    console.error("[jeko:client_confirmation_failed]", {
      bookingId: booking.id,
      attemptId: attempt.id,
      message: error instanceof Error ? error.message : "Erreur inconnue",
    });
    return apiJson({
      error: "La confirmation Jèko est temporairement indisponible. Aucun paiement n'a été validé.",
      payment: publicAttempt(attempt),
    }, 503);
  }
}

async function getApiClient(): Promise<
  | { client: SessionUser; response: null }
  | { client: null; response: NextResponse }
> {
  const user = await getSessionUser();
  if (!user) {
    return { client: null, response: apiJson({ error: "Non authentifié." }, 401) };
  }
  if (user.role !== "CLIENT") {
    return {
      client: null,
      response: apiJson({ error: "Accès réservé au client propriétaire de la réservation." }, 403),
    };
  }
  return { client: user, response: null };
}

async function findOwnedBooking(bookingId: string, clientId: string) {
  const safeId = bookingId.trim();
  if (!safeId) return null;
  return db.booking.findFirst({
    where: { id: safeId, clientId },
    select: {
      id: true,
      clientId: true,
      status: true,
      paymentStatus: true,
      isQuoteOnly: true,
      totalClientPays: true,
      totalPrice: true,
    },
  });
}

function publicAttempt(attempt: {
  id: string;
  reference: string;
  status: string;
  amountXof: number;
  method: string | null;
  checkoutUrl: string | null;
  failureReason: string | null;
  verifiedAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    provider: "JEKO",
    attemptId: attempt.id,
    reference: attempt.reference,
    status: attempt.status,
    amount: attempt.amountXof,
    paymentMethod: platformMethodToJeko(attempt.method),
    checkoutUrl: isAllowedJekoRedirectUrl(attempt.checkoutUrl) ? attempt.checkoutUrl : null,
    failureReason: attempt.failureReason
      ? "La tentative n'a pas pu être finalisée. Vous pouvez la reprendre sans modifier le montant."
      : null,
    verifiedAt: attempt.verifiedAt,
    completedAt: attempt.completedAt,
    createdAt: attempt.createdAt,
    updatedAt: attempt.updatedAt,
  };
}

function publicJekoError(error: unknown) {
  if (error instanceof JekoApiError) {
    return {
      status: error.httpStatus >= 500 ? 503 : 502,
      body: {
        error: "Jèko n'a pas pu préparer le paiement. Vous pouvez réessayer sans risque de double débit.",
        code: error.code ?? "JEKO_API_ERROR",
      },
    };
  }
  const message = error instanceof Error ? error.message : "Paiement Jèko indisponible.";
  const conflict = message.includes("idempotence")
    || message.includes("fonds sécurisés")
    || message.includes("PayDunya");
  return {
    status: conflict ? 409 : 503,
    body: {
      error: conflict ? message : "Le paiement Jèko est temporairement indisponible.",
      code: conflict ? "PAYMENT_CONFLICT" : "JEKO_UNAVAILABLE",
    },
  };
}

function apiJson(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store, max-age=0" },
  });
}
