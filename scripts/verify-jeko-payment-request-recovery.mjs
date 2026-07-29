import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url, {
  alias: {
    "server-only": fileURLToPath(
      new URL("../node_modules/next/dist/compiled/server-only/empty.js", import.meta.url),
    ),
  },
});
const {
  JekoApiError,
  createJekoPaymentRequest,
  recoverJekoPaymentRequestByReference,
} = jiti("../src/lib/jeko.ts");

const storeId = "59ae202a-f583-4a15-970f-9e99bd1e0baa";
const config = {
  apiBaseUrl: "https://api.jeko.africa",
  apiKey: "test-api-key",
  apiKeyId: "test-api-key-id",
  storeId,
  webhookSecret: "test-webhook-secret-long-enough",
  timeoutMs: 2_000,
};
const reference = "JEKO-MP-TEST-RECOVERY";
const requestId = "d22c81f3-ee04-4ec5-8bd2-cd8af5dabcfc";

const callsFrom409 = [];
const recoveredFrom409 = await recoverJekoPaymentRequestByReference({
  reference,
  amountXof: 20_000,
  paymentMethod: "wave",
  providerErrorPayload: {
    id: "payment_request_exists_with_reference",
    extras: {
      paymentRequestId: requestId,
      redirectUrl: `https://pay.jeko.africa/payment/${requestId}`,
    },
  },
}, {
  config,
  fetchImpl: async (url, init) => {
    callsFrom409.push({ url: String(url), method: init?.method ?? "GET" });
    return jsonResponse({
      id: requestId,
      storeId,
      reference,
      type: "redirect",
      paymentMethod: "wave",
      status: "pending",
      redirectUrl: `https://pay.jeko.africa/payment/${requestId}`,
      transaction: null,
    });
  },
});
assert.equal(recoveredFrom409?.source, "provider_error");
assert.equal(recoveredFrom409?.confirmation.id, requestId);
assert.equal(recoveredFrom409?.redirectUrl, `https://pay.jeko.africa/payment/${requestId}`);
assert.deepEqual(callsFrom409, [{
  url: `https://api.jeko.africa/partner_api/payment_requests/${requestId}`,
  method: "GET",
}]);

const historyRequestId = "pr_history_request_123";
const historyCalls = [];
const recoveredFromHistory = await recoverJekoPaymentRequestByReference({
  reference,
  amountXof: 20_000,
  paymentMethod: "wave",
  referenceCreatedAt: new Date(),
}, {
  config,
  fetchImpl: async (url, init) => {
    const href = String(url);
    historyCalls.push({ url: href, method: init?.method ?? "GET" });
    if (href.includes("/partner_api/transactions?")) {
      const parsed = new URL(href);
      const start = new Date(`${parsed.searchParams.get("startDate")}T00:00:00.000Z`);
      const end = new Date(`${parsed.searchParams.get("endDate")}T00:00:00.000Z`);
      assert.ok((end.getTime() - start.getTime()) / 86_400_000 <= 89, "la fenêtre Jèko reste <= 90 jours inclus");
      return jsonResponse({
        total: 1,
        perPage: 100,
        currentPage: 1,
        data: [{
          id: "txn_payment_123",
          type: "payment",
          status: "success",
          amount: { amount: 2_000_000, currency: "XOF" },
          fees: { amount: 30_000, currency: "XOF" },
          currency: "XOF",
          paymentMethod: "wave",
          reference,
          createdAt: new Date().toISOString(),
          transactionDetails: { id: historyRequestId, reference },
        }],
      });
    }
    assert.equal(href, `https://api.jeko.africa/partner_api/payment_requests/${historyRequestId}`);
    return jsonResponse({
      id: historyRequestId,
      storeId,
      reference,
      type: "redirect",
      paymentMethod: "wave",
      status: "success",
      transaction: {
        id: "txn_payment_123",
        amount: { amount: 2_000_000, currency: "XOF" },
        fees: { amount: 30_000, currency: "XOF" },
        status: "success",
      },
    });
  },
});
assert.equal(recoveredFromHistory?.source, "transaction_history");
assert.equal(recoveredFromHistory?.confirmation.id, historyRequestId);
assert.equal(recoveredFromHistory?.redirectUrl, `https://pay.jeko.africa/payment/${historyRequestId}`);
assert.ok(historyCalls.every((call) => call.method === "GET"), "la récupération ne doit jamais réémettre de POST");

const callbackOrigin = getVerificationAppOrigin();
process.env.NEXT_PUBLIC_APP_URL = callbackOrigin;
await assert.rejects(
  createJekoPaymentRequest({
    reference,
    amountXof: 20_000,
    paymentMethod: "wave",
    successUrl: `${callbackOrigin}/client/reservations/test?jeko=return`,
    errorUrl: `${callbackOrigin}/client/reservations/test?jeko=cancelled`,
  }, {
    config,
    fetchImpl: async () => jsonResponse({
      id: "payment_request_exists_with_reference",
      message: "Une demande de paiement avec cette référence existe déjà",
      extras: { paymentRequestId: requestId },
    }, 409),
  }),
  (error) => {
    assert.ok(error instanceof JekoApiError);
    assert.equal(error.httpStatus, 409);
    assert.equal(error.details?.extras?.paymentRequestId, requestId);
    return true;
  },
);

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function getVerificationAppOrigin() {
  const vercelUrl = process.env.VERCEL_URL?.trim();
  if (process.env.VERCEL_ENV === "preview" && vercelUrl) {
    return new URL(vercelUrl.includes("://") ? vercelUrl : `https://${vercelUrl}`).origin;
  }
  return "https://www.competence.ci";
}

console.log("Jèko ambiguous-create recovery verification passed: 409 payload, <=90-day history, strict GET and no duplicate POST.");
