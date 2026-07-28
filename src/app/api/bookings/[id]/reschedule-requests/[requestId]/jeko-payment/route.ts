import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getJekoServerConfig } from "@/lib/jeko-config";
import { JekoApiError } from "@/lib/jeko";
import {
  isJekoReschedulePayable,
  parseJekoCheckoutBody,
  planJekoRescheduleAttempt,
  platformMethodToJeko,
} from "@/lib/jeko-client-payment";
import { reconcileJekoReschedulePaymentAttempt } from "@/lib/jeko-reschedule-reconciliation";
import { isAllowedJekoRedirectUrl } from "@/lib/jeko-utils";
import { createJekoRescheduleCheckout } from "@/lib/payment-provider";
import { absoluteAppUrl } from "@/lib/public-url";
import { getSessionUser, type SessionUser } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_POST_BODY_BYTES = 4 * 1024;

type RouteContext = { params: Promise<{ id: string; requestId: string }> };

export async function POST(request: NextRequest, { params }: RouteContext) {
  const authentication = await getApiClient();
  if (authentication.response) return authentication.response;

  const { id: bookingId, requestId } = await params;
  const rescheduleRequest = await findOwnedRequest(bookingId, requestId, authentication.client.id);
  if (!rescheduleRequest) return apiJson({ error: "Demande de modification introuvable." }, 404);
  if (!isExplicitJekoRequest(rescheduleRequest)) {
    return apiJson({
      error: "Cette demande historique reste gérée par PayDunya.",
      code: "LEGACY_PAYDUNYA_RESCHEDULE",
      payment: {
        provider: "PAYDUNYA",
        checkoutUrl: rescheduleRequest.paydunyaCheckoutUrl,
        status: rescheduleRequest.paydunyaStatus,
      },
    }, 409);
  }
  if (!isJekoReschedulePayable(rescheduleRequest)) {
    return apiJson({
      error: "Ce supplément n'est pas payable ou a déjà été sécurisé.",
      code: "RESCHEDULE_FEE_NOT_PAYABLE",
      rescheduleRequest: {
        id: rescheduleRequest.id,
        status: rescheduleRequest.status,
        paidAt: rescheduleRequest.paidAt,
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
    return apiJson({ error: "Le paiement Jèko est temporairement indisponible.", code: "JEKO_NOT_CONFIGURED" }, 503);
  }

  const attempts = await db.paymentAttempt.findMany({
    where: {
      bookingId: rescheduleRequest.bookingId,
      rescheduleRequestId: rescheduleRequest.id,
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
    rescheduleRequestId: rescheduleRequest.id,
    requestedMethod: parsedBody.paymentMethod,
    attempts,
  });

  if (plan.kind === "already_paid") {
    const reconciliation = await reconcileJekoReschedulePaymentAttempt(plan.attemptId, {
      expectedBookingId: rescheduleRequest.bookingId,
      expectedClientId: authentication.client.id,
      expectedRescheduleRequestId: rescheduleRequest.id,
      config,
    });
    return apiJson({
      error: reconciliation.verified ? null : "Une tentative antérieure doit être contrôlée.",
      payment: {
        provider: "JEKO",
        purpose: "RESCHEDULE_FEE",
        attemptId: plan.attemptId,
        ...reconciliation,
        checkoutUrl: null,
      },
    }, reconciliation.verified ? 200 : 409);
  }
  if (plan.kind === "blocked") {
    return apiJson({ error: plan.reason, code: "ACTIVE_ATTEMPT_BLOCKED", attemptId: plan.attemptId }, 409);
  }

  try {
    const safeBookingId = encodeURIComponent(rescheduleRequest.bookingId);
    const safeRequestId = encodeURIComponent(rescheduleRequest.id);
    const checkout = await createJekoRescheduleCheckout({
      bookingId: rescheduleRequest.bookingId,
      rescheduleRequestId: rescheduleRequest.id,
      idempotencyKey: plan.idempotencyKey,
      paymentMethod: plan.paymentMethod,
      successUrl: absoluteAppUrl(
        `/client/reservations/${safeBookingId}?jekoReschedule=return&rescheduleRequestId=${safeRequestId}`,
        request,
      ),
      errorUrl: absoluteAppUrl(
        `/client/reservations/${safeBookingId}?jekoReschedule=cancelled&rescheduleRequestId=${safeRequestId}`,
        request,
      ),
    });
    return apiJson({
      payment: {
        provider: "JEKO",
        purpose: "RESCHEDULE_FEE",
        configured: true,
        attemptId: checkout.attemptId,
        rescheduleRequestId: checkout.rescheduleRequestId,
        reference: checkout.reference,
        status: checkout.status,
        amount: checkout.amountXof,
        paymentMethod: plan.paymentMethod,
        checkoutUrl: isAllowedJekoRedirectUrl(checkout.checkoutUrl) ? checkout.checkoutUrl : null,
        reused: plan.kind === "reuse",
      },
    }, plan.kind === "create" ? 201 : 200);
  } catch (error) {
    console.error("[jeko:reschedule_client_checkout_failed]", {
      bookingId: rescheduleRequest.bookingId,
      rescheduleRequestId: rescheduleRequest.id,
      message: error instanceof Error ? error.message : "Erreur inconnue",
    });
    const response = publicJekoError(error);
    return apiJson(response.body, response.status);
  }
}

export async function GET(_request: NextRequest, { params }: RouteContext) {
  const authentication = await getApiClient();
  if (authentication.response) return authentication.response;

  const { id: bookingId, requestId } = await params;
  const rescheduleRequest = await findOwnedRequest(bookingId, requestId, authentication.client.id);
  if (!rescheduleRequest) return apiJson({ error: "Demande de modification introuvable." }, 404);
  if (!isExplicitJekoRequest(rescheduleRequest)) {
    return apiJson({
      error: "Cette demande historique reste vérifiable par le flux PayDunya existant.",
      code: "LEGACY_PAYDUNYA_RESCHEDULE",
      payment: { provider: "PAYDUNYA", status: rescheduleRequest.paydunyaStatus },
    }, 409);
  }

  const attempt = await db.paymentAttempt.findFirst({
    where: {
      bookingId: rescheduleRequest.bookingId,
      rescheduleRequestId: rescheduleRequest.id,
      provider: "JEKO",
      purpose: "RESCHEDULE_FEE",
    },
    orderBy: { createdAt: "desc" },
  });
  if (!attempt) {
    return apiJson({
      payment: null,
      rescheduleRequest: publicRequest(rescheduleRequest),
      message: "Aucune tentative Jèko pour ce supplément.",
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
    const reconciliation = await reconcileJekoReschedulePaymentAttempt(attempt.id, {
      expectedBookingId: rescheduleRequest.bookingId,
      expectedClientId: authentication.client.id,
      expectedRescheduleRequestId: rescheduleRequest.id,
      config,
    });
    const [freshAttempt, freshRequest] = await Promise.all([
      db.paymentAttempt.findUnique({ where: { id: attempt.id } }),
      db.bookingRescheduleRequest.findUnique({
        where: { id: rescheduleRequest.id },
        select: {
          id: true,
          bookingId: true,
          clientId: true,
          status: true,
          totalToPay: true,
          paidAt: true,
          paymentProvider: true,
        },
      }),
    ]);
    if (!freshAttempt || !freshRequest) return apiJson({ error: "Tentative Jèko introuvable après vérification." }, 404);

    return apiJson({
      payment: {
        ...publicAttempt(freshAttempt),
        verified: reconciliation.verified,
        action: reconciliation.action,
        reconciliationStatus: reconciliation.status,
        message: reconciliation.message,
        canRetry: isJekoReschedulePayable(freshRequest)
          && ["FAILED", "REJECTED", "CANCELLED", "EXPIRED"].includes(freshAttempt.status),
      },
      rescheduleRequest: publicRequest(freshRequest),
    });
  } catch (error) {
    console.error("[jeko:reschedule_client_confirmation_failed]", {
      bookingId: rescheduleRequest.bookingId,
      rescheduleRequestId: rescheduleRequest.id,
      attemptId: attempt.id,
      message: error instanceof Error ? error.message : "Erreur inconnue",
    });
    return apiJson({
      error: "La confirmation Jèko est temporairement indisponible. Aucun supplément n'a été validé.",
      payment: publicAttempt(attempt),
    }, 503);
  }
}

async function getApiClient(): Promise<
  | { client: SessionUser; response: null }
  | { client: null; response: NextResponse }
> {
  const user = await getSessionUser();
  if (!user) return { client: null, response: apiJson({ error: "Non authentifié." }, 401) };
  if (user.role !== "CLIENT") {
    return { client: null, response: apiJson({ error: "Accès réservé au client propriétaire." }, 403) };
  }
  return { client: user, response: null };
}

async function findOwnedRequest(bookingId: string, requestId: string, clientId: string) {
  const safeBookingId = bookingId.trim();
  const safeRequestId = requestId.trim();
  if (!safeBookingId || !safeRequestId) return null;
  return db.bookingRescheduleRequest.findFirst({
    where: { id: safeRequestId, bookingId: safeBookingId, clientId },
    select: {
      id: true,
      bookingId: true,
      clientId: true,
      status: true,
      totalToPay: true,
      paidAt: true,
      paymentProvider: true,
      paydunyaCheckoutUrl: true,
      paydunyaStatus: true,
    },
  });
}

function isExplicitJekoRequest(request: {
  paymentProvider: string | null;
}) {
  return request.paymentProvider === "JEKO";
}

function publicRequest(request: { id: string; bookingId: string; status: string; totalToPay: number; paidAt: Date | null }) {
  return {
    id: request.id,
    bookingId: request.bookingId,
    status: request.status,
    totalToPay: request.totalToPay,
    paidAt: request.paidAt,
  };
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
    purpose: "RESCHEDULE_FEE",
    attemptId: attempt.id,
    reference: attempt.reference,
    status: attempt.status,
    amount: attempt.amountXof,
    paymentMethod: platformMethodToJeko(attempt.method),
    checkoutUrl: isAllowedJekoRedirectUrl(attempt.checkoutUrl) ? attempt.checkoutUrl : null,
    failureReason: attempt.failureReason ? "La tentative n'a pas pu être finalisée." : null,
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
        error: "Jèko n'a pas pu préparer le supplément. Vous pouvez réessayer sans risque de double débit.",
        code: error.code ?? "JEKO_API_ERROR",
      },
    };
  }
  const message = error instanceof Error ? error.message : "Paiement Jèko indisponible.";
  const conflict = message.includes("idempotence") || message.includes("historique") || message.includes("plus payable");
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
