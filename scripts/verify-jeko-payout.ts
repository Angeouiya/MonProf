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
const payout = jiti("../src/lib/jeko-payout.ts") as typeof import("../src/lib/jeko-payout");

const TEST_CONFIG = {
  apiBaseUrl: "https://api.jeko.africa",
  apiKey: "server-api-key-test",
  apiKeyId: "server-api-key-id-test",
  storeId: "59ae202a-f583-4a15-970f-9e99bd1e0baa",
  webhookSecret: "server-webhook-secret-test",
  timeoutMs: 2_000,
} as const;

type MockReply = {
  status?: number;
  body?: unknown;
  rawBody?: string;
};

type MockCall = {
  url: string;
  init: RequestInit;
};

function createFetchQueue(replies: MockReply[]) {
  const queue = [...replies];
  const calls: MockCall[] = [];
  const fetchImpl: typeof fetch = async (input, init = {}) => {
    const reply = queue.shift();
    assert.ok(reply, `Aucune réponse mock restante pour ${String(input)}`);
    calls.push({ url: String(input), init });
    const body = reply.rawBody ?? JSON.stringify(reply.body ?? {});
    return new Response(body, {
      status: reply.status ?? 200,
      headers: { "Content-Type": "application/json" },
    });
  };
  return {
    calls,
    fetchImpl,
    assertConsumed() {
      assert.equal(queue.length, 0, `${queue.length} réponse(s) mock non consommée(s)`);
    },
  };
}

function mobileContact(
  paymentMethod = "wave",
  number = "+2250701234567",
  id = "29f81706-03a6-492f-92ee-5f0b2e9b18e7",
) {
  return {
    id,
    name: "Professeur Test",
    paymentMethod,
    identifier: { number },
  };
}

function transferResponse(overrides: Record<string, unknown> = {}) {
  return {
    id: "wth_abc123def456",
    storeId: TEST_CONFIG.storeId,
    contactId: "29f81706-03a6-492f-92ee-5f0b2e9b18e7",
    amount: { amount: 2_000_000, currency: "XOF" },
    fees: { amount: 30_050, currency: "XOF" },
    status: "pending",
    paymentMethod: "orange",
    beneficiary: "+2250501234567",
    description: "Versement professeur juillet",
    reference: "COMP-PROF-payout-001",
    createdAt: "2026-07-27T10:00:00.000Z",
    transaction: { id: "txn_payout_001", status: "pending" },
    ...overrides,
  };
}

function transferTransaction(overrides: Record<string, unknown> = {}) {
  return {
    id: "txn_payout_001",
    type: "transfer",
    status: "success",
    amount: { amount: 2_000_000, currency: "XOF" },
    fees: { amount: 30_000, currency: "XOF" },
    currency: "XOF",
    paymentMethod: "wave",
    counterpartLabel: "Professeur Test",
    counterpartIdentifier: "+2250701234567",
    description: "Versement professeur",
    reference: "COMP-PROF-payout-409",
    createdAt: "2026-07-27T10:00:00.000Z",
    ...overrides,
  };
}

function assertServerAuthentication(calls: MockCall[]) {
  for (const call of calls) {
    const headers = new Headers(call.init.headers);
    assert.equal(headers.get("X-API-KEY"), TEST_CONFIG.apiKey);
    assert.equal(headers.get("X-API-KEY-ID"), TEST_CONFIG.apiKeyId);
    assert.equal(headers.get("Accept"), "application/json");
  }
}

async function verifyMappingAndNormalization() {
  assert.equal(payout.mapTeacherPayoutMethodToJeko("WAVE"), "wave");
  assert.equal(payout.mapTeacherPayoutMethodToJeko("ORANGE_MONEY"), "orange");
  assert.equal(payout.mapTeacherPayoutMethodToJeko("MTN_MONEY"), "mtn");
  assert.equal(payout.mapTeacherPayoutMethodToJeko("MOOV_MONEY"), "moov");
  assert.equal(payout.mapTeacherPayoutMethodToJeko("DJAMO"), "djamo");
  assert.throws(() => payout.mapTeacherPayoutMethodToJeko("CARD"), /pas prise en charge/);

  assert.equal(payout.jekoPayoutWebhookMethodMatches("ORANGE_MONEY", "orange"), true);
  assert.equal(payout.jekoPayoutWebhookMethodMatches("ORANGE_MONEY", "orange_money"), true);
  assert.equal(payout.jekoPayoutWebhookMethodMatches("ORANGE_MONEY", " orange "), true);
  assert.equal(payout.jekoPayoutWebhookMethodMatches("WAVE", "orange"), false);
  assert.equal(payout.jekoPayoutWebhookMethodMatches(null, "orange"), false);

  assert.equal(payout.normalizeJekoPayoutPhoneNumber("07 01 23 45 67"), "+2250701234567");
  assert.equal(payout.normalizeJekoPayoutPhoneNumber("00225 05 01 23 45 67"), "+2250501234567");
  assert.throws(() => payout.normalizeJekoPayoutPhoneNumber("123"));

  const reference = payout.buildJekoTeacherPayoutReference("cmdu6payout001");
  assert.equal(reference, "COMP-PROF-cmdu6payout001");
  assert.equal(payout.buildJekoTeacherPayoutReference("cmdu6payout001"), reference);
  assert.ok(payout.buildJekoTeacherPayoutReference("x".repeat(300)).length <= 100);
}

async function verifyContactReuse() {
  const mock = createFetchQueue([{ body: [mobileContact()] }]);
  const contact = await payout.ensureJekoMobileMoneyContact({
    teacherName: "Professeur Test",
    paymentMethod: "WAVE",
    phoneNumber: "07 01 23 45 67",
  }, { config: TEST_CONFIG, fetchImpl: mock.fetchImpl });
  assert.equal(contact.id, "29f81706-03a6-492f-92ee-5f0b2e9b18e7");
  assert.equal(contact.phoneNumber, "+2250701234567");
  assert.equal(mock.calls.length, 1, "un contact existant ne doit pas être recréé");
  assertServerAuthentication(mock.calls);
  mock.assertConsumed();
}

async function verifyExactPayoutAndPlatformFee() {
  const mock = createFetchQueue([
    { body: [] },
    { body: mobileContact("orange", "+2250501234567") },
    { body: { amount: 5_000_000, currency: "XOF" } },
    { body: transferResponse() },
  ]);
  const result = await payout.createJekoTeacherPayout({
    reference: "COMP-PROF-payout-001",
    teacherName: "Professeur Test",
    phoneNumber: "+225 05 01 23 45 67",
    paymentMethod: "ORANGE_MONEY",
    teacherNetAmountXof: 20_000,
    description: "Versement professeur juillet",
  }, { config: TEST_CONFIG, fetchImpl: mock.fetchImpl });

  assert.equal(result.teacherNetAmountCents, 2_000_000);
  assert.equal(result.teacherNetAmountXof, 20_000);
  assert.equal(result.feeCoveredByPlatformCents, 30_050);
  assert.equal(result.feeCoveredByPlatformXof, 301);
  assert.equal(result.totalPlatformDebitCents, 2_030_050);
  assert.equal(result.totalPlatformDebitXof, 20_301);
  assert.equal(result.status, "pending");
  assert.equal(result.duplicate, false);

  assert.equal(mock.calls[0]?.url, "https://api.jeko.africa/partner_api/contacts");
  assert.equal(mock.calls[1]?.url, "https://api.jeko.africa/partner_api/contacts");
  assert.equal(mock.calls[2]?.url, `https://api.jeko.africa/partner_api/stores/${TEST_CONFIG.storeId}/balance`);
  assert.equal(mock.calls[3]?.url, "https://api.jeko.africa/partner_api/transfers");

  const contactPayload = JSON.parse(String(mock.calls[1]?.init.body));
  assert.deepEqual(contactPayload, {
    name: "Professeur Test",
    paymentMethod: "orange",
    identifier: { number: "+2250501234567" },
  });
  const transferPayload = JSON.parse(String(mock.calls[3]?.init.body));
  assert.equal(transferPayload.amountCents, 2_000_000, "le net professeur ne doit pas être diminué");
  assert.equal(transferPayload.reference, "COMP-PROF-payout-001");
  assert.equal(transferPayload.storeId, TEST_CONFIG.storeId);
  assert.equal(transferPayload.contactId, "29f81706-03a6-492f-92ee-5f0b2e9b18e7");
  assert.equal("fees" in transferPayload, false, "les frais Jèko ne sont pas prélevés sur le net");
  assertServerAuthentication(mock.calls);
  mock.assertConsumed();
}

async function verifyStatusesAndStrictResponses() {
  for (const [providerStatus, expectedStatus] of [
    ["success", "success"],
    ["error", "failed"],
  ] as const) {
    const mock = createFetchQueue([{
      body: transferResponse({
        status: providerStatus,
        transaction: { id: `txn_${providerStatus}`, status: providerStatus },
      }),
    }]);
    const result = await payout.getJekoTeacherPayoutTransfer(
      "wth_abc123def456",
      { config: TEST_CONFIG, fetchImpl: mock.fetchImpl },
    );
    assert.equal(result.status, expectedStatus);
    mock.assertConsumed();
  }

  const mismatch = createFetchQueue([
    { body: [mobileContact("orange", "+2250501234567")] },
    { body: { amount: 5_000_000, currency: "XOF" } },
    { body: transferResponse({ amount: { amount: 1_999_900, currency: "XOF" } }) },
  ]);
  await assert.rejects(
    payout.createJekoTeacherPayout({
      reference: "COMP-PROF-payout-001",
      teacherName: "Professeur Test",
      phoneNumber: "+2250501234567",
      paymentMethod: "ORANGE_MONEY",
      teacherNetAmountXof: 20_000,
    }, { config: TEST_CONFIG, fetchImpl: mismatch.fetchImpl }),
    (error: unknown) => (
      error instanceof payout.JekoPayoutApiError && error.code === "RESPONSE_MISMATCH"
    ),
  );
  mismatch.assertConsumed();

  const invalidJson = createFetchQueue([{ rawBody: "not-json" }]);
  await assert.rejects(
    payout.getJekoStoreBalance({ config: TEST_CONFIG, fetchImpl: invalidJson.fetchImpl }),
    (error: unknown) => error instanceof payout.JekoPayoutApiError && error.code === "INVALID_JSON",
  );
  invalidJson.assertConsumed();
}

async function verifyInsufficientBalanceStopsNewTransfer() {
  const mock = createFetchQueue([
    { body: [mobileContact()] },
    { body: { amount: 1_000_000, currency: "XOF" } },
    { body: { total: 0, perPage: 100, currentPage: 1, data: [] } },
  ]);
  await assert.rejects(
    payout.createJekoTeacherPayout({
      reference: "COMP-PROF-payout-low",
      teacherName: "Professeur Test",
      phoneNumber: "+2250701234567",
      paymentMethod: "WAVE",
      teacherNetAmountXof: 20_000,
    }, { config: TEST_CONFIG, fetchImpl: mock.fetchImpl }),
    (error: unknown) => (
      error instanceof payout.JekoPayoutApiError && error.code === "INSUFFICIENT_BALANCE"
    ),
  );
  assert.equal(mock.calls.some((call) => (
    call.url.endsWith("/partner_api/transfers") && call.init.method === "POST"
  )), false);
  mock.assertConsumed();
}

async function verifyConflictReconciliation() {
  const mock = createFetchQueue([
    { body: [mobileContact()] },
    { body: { amount: 5_000_000, currency: "XOF" } },
    {
      status: 409,
      body: {
        id: "transfer_exists_with_reference",
        message: "Un virement avec cette référence existe déjà",
      },
    },
    {
      body: {
        total: 101,
        perPage: 100,
        currentPage: 1,
        data: [],
      },
    },
    {
      body: {
        total: 101,
        perPage: 100,
        currentPage: 2,
        data: [transferTransaction()],
      },
    },
  ]);
  const result = await payout.createJekoTeacherPayout({
    reference: "COMP-PROF-payout-409",
    teacherName: "Professeur Test",
    phoneNumber: "+2250701234567",
    paymentMethod: "WAVE",
    teacherNetAmountXof: 20_000,
  }, { config: TEST_CONFIG, fetchImpl: mock.fetchImpl });
  assert.equal(result.duplicate, true);
  assert.equal(result.reconciliationRequired, false);
  assert.equal(result.status, "success");
  assert.equal(result.providerTransactionId, "txn_payout_001");
  assert.equal(result.teacherNetAmountXof, 20_000);
  assert.equal(result.feeCoveredByPlatformXof, 300);
  const historyCalls = mock.calls.filter((call) => call.url.includes("/partner_api/transactions?"));
  assert.equal(historyCalls.length, 2);
  assert.match(historyCalls[0]!.url, /page=1/);
  assert.match(historyCalls[1]!.url, /page=2/);
  for (const call of historyCalls) {
    assert.match(call.url, /startDate=\d{4}-\d{2}-\d{2}/);
    assert.match(call.url, /endDate=\d{4}-\d{2}-\d{2}/);
  }
  assert.equal(mock.calls.filter((call) => call.url.endsWith("/partner_api/transfers")).length, 1);
  mock.assertConsumed();

  const notVisible = createFetchQueue([
    { body: [mobileContact()] },
    { body: { amount: 5_000_000, currency: "XOF" } },
    { status: 409, body: { id: "transfer_exists_with_reference", message: "Conflict" } },
    { body: { total: 0, perPage: 100, currentPage: 1, data: [] } },
  ]);
  const pending = await payout.createJekoTeacherPayout({
    reference: "COMP-PROF-payout-hidden",
    teacherName: "Professeur Test",
    phoneNumber: "+2250701234567",
    paymentMethod: "WAVE",
    teacherNetAmountXof: 20_000,
  }, { config: TEST_CONFIG, fetchImpl: notVisible.fetchImpl });
  assert.equal(pending.duplicate, true);
  assert.equal(pending.reconciliationRequired, true);
  assert.equal(pending.status, "pending");
  assert.equal(pending.feeCoveredByPlatformCents, null);
  notVisible.assertConsumed();
}

async function verifyProviderErrors() {
  const mock = createFetchQueue([{
    status: 401,
    body: { id: "unauthorized", message: "Unauthorized" },
  }]);
  await assert.rejects(
    payout.listJekoMobileMoneyContacts({ config: TEST_CONFIG, fetchImpl: mock.fetchImpl }),
    (error: unknown) => (
      error instanceof payout.JekoPayoutApiError
      && error.httpStatus === 401
      && error.code === "unauthorized"
      && error.retryable === false
    ),
  );
  mock.assertConsumed();
}

async function main() {
  await verifyMappingAndNormalization();
  await verifyContactReuse();
  await verifyExactPayoutAndPlatformFee();
  await verifyStatusesAndStrictResponses();
  await verifyInsufficientBalanceStopsNewTransfer();
  await verifyConflictReconciliation();
  await verifyProviderErrors();
  console.log(
    "OK Jèko payout: contacts, auth serveur, solde, net exact, frais plateforme, statuts et 409 vérifiés.",
  );
}

await main();
