import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { afterEach, test } from "node:test";
import path from "node:path";
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url, { alias: { "@": path.resolve("src") } });
const {
  getPasswordEmailProviderForNewJob,
  getPasswordEmailProviderForPayload,
  readPasswordEmailDispatchSnapshot,
  readPasswordEmailProvider,
} = jiti("../src/lib/password-email-provider.ts");
const {
  classifyResendHttpFailure,
  hasResendEnvironmentConfiguration,
  isResendConfigured,
  sendResendEmail,
} = jiti("../src/lib/resend-email.ts");
const {
  createClientResetPasswordEmailSnapshot,
  sendEmail,
  sendPasswordEmailSnapshot,
} = jiti("../src/lib/notification-delivery.ts");

const originalFetch = globalThis.fetch;
const environmentKeys = [
  "VERCEL_ENV",
  "PASSWORD_EMAIL_PROVIDER",
  "RESEND_API_KEY",
  "RESEND_FROM_EMAIL",
  "GMAIL_CLIENT_ID",
  "GMAIL_CLIENT_SECRET",
  "GMAIL_REFRESH_TOKEN",
  "GMAIL_SENDER_EMAIL",
];
const originalEnvironment = Object.fromEntries(
  environmentKeys.map((key) => [key, process.env[key]]),
);

afterEach(() => {
  globalThis.fetch = originalFetch;
  for (const key of environmentKeys) {
    const value = originalEnvironment[key];
    if (typeof value === "string") process.env[key] = value;
    else delete process.env[key];
  }
});

test("the selected provider is explicit and legacy v1 payloads stay on Gmail", () => {
  assert.equal(readPasswordEmailProvider({ PASSWORD_EMAIL_PROVIDER: " gmail " }), "gmail");
  assert.equal(readPasswordEmailProvider({ PASSWORD_EMAIL_PROVIDER: "RESEND" }), "resend");
  assert.equal(readPasswordEmailProvider({ PASSWORD_EMAIL_PROVIDER: "smtp" }), null);
  assert.equal(getPasswordEmailProviderForNewJob({}), null);
  assert.equal(getPasswordEmailProviderForPayload({ version: 1 }), "gmail");
  assert.equal(getPasswordEmailProviderForPayload({ version: 1, provider: "resend" }), "gmail");
  assert.equal(getPasswordEmailProviderForPayload({ version: 2, provider: "resend" }), "resend");
  assert.equal(getPasswordEmailProviderForPayload({ version: 2, provider: "gmail" }), "gmail");
  assert.equal(getPasswordEmailProviderForPayload({ version: 2, provider: "smtp" }), null);
  const snapshot = {
    provider: "resend",
    senderIdentity: "Compétence <notifications@competence.ci>",
    subject: "Sujet",
    text: "Texte",
    html: "<p>Texte</p>",
  };
  assert.deepEqual(readPasswordEmailDispatchSnapshot(snapshot), snapshot);
  assert.equal(
    getPasswordEmailProviderForPayload({ version: 3, emailSnapshot: snapshot }),
    "resend",
  );
  assert.equal(
    getPasswordEmailProviderForPayload({
      version: 3,
      emailSnapshot: { ...snapshot, subject: "Sujet\r\nBcc: attacker@example.com" },
    }),
    null,
  );
  assert.equal(getPasswordEmailProviderForPayload({ version: 4, provider: "gmail" }), null);
});

test("Resend configuration is strict and cannot run in Vercel Preview", () => {
  const valid = {
    VERCEL_ENV: "production",
    RESEND_API_KEY: "re_test_123456789",
    RESEND_FROM_EMAIL: "Compétence <notifications@competence.ci>",
  };
  assert.equal(hasResendEnvironmentConfiguration(valid), true);
  assert.equal(isResendConfigured(valid), true);
  assert.equal(isResendConfigured({ ...valid, VERCEL_ENV: "preview" }), false);
  assert.equal(
    hasResendEnvironmentConfiguration({ ...valid, RESEND_API_KEY: "not-a-resend-key" }),
    false,
  );
  assert.equal(
    hasResendEnvironmentConfiguration({
      ...valid,
      RESEND_FROM_EMAIL: "Compétence <notifications@mail.competence.ci>",
    }),
    false,
  );
  assert.equal(
    hasResendEnvironmentConfiguration({
      ...valid,
      RESEND_FROM_EMAIL: "Compétence\r\nBcc: attacker@example.com <notifications@competence.ci>",
    }),
    false,
  );
});

test("a Gmail v3 snapshot freezes the exact authorized sender identity", () => {
  configureProductionGmailAndResend();
  const snapshot = createClientResetPasswordEmailSnapshot({
    provider: "gmail",
    name: "Awa",
    resetUrl: "https://www.competence.ci/reinitialiser-mot-de-passe?token=gmail",
  });
  assert.ok(snapshot);
  assert.equal(snapshot.provider, "gmail");
  assert.equal(snapshot.senderIdentity, "diplomateimmobilier99@gmail.com");
  assert.equal(Object.isFrozen(snapshot), true);
});

test("a v3 snapshot keeps the exact Gmail body across env and template changes", async () => {
  configureProductionGmailAndResend();
  const originalSnapshot = createClientResetPasswordEmailSnapshot({
    provider: "gmail",
    name: "Awa",
    resetUrl: "https://www.competence.ci/reinitialiser-mot-de-passe?token=gmail-original",
  });
  assert.ok(originalSnapshot);

  const requests = [];
  globalThis.fetch = async (url, init) => {
    const target = String(url);
    if (target.includes("oauth2.googleapis.com/token")) {
      return jsonResponse(200, { access_token: "gmail-access-token", expires_in: 3600 });
    }
    if (target.includes("gmail.googleapis.com")) {
      requests.push({
        rawBody: init.body,
        rawMime: JSON.parse(init.body).raw,
      });
      return jsonResponse(200, { id: `gmail-message-${requests.length}` });
    }
    throw new Error(`Unexpected URL: ${target}`);
  };

  const idempotencyKey = "stable-gmail-encrypted-outbox-key";
  const dispatch = {
    snapshot: originalSnapshot,
    to: "client@example.com",
    idempotencyKey,
  };
  const first = await sendPasswordEmailSnapshot(dispatch);

  // Simulate a later deployment with different OAuth environment values and
  // different rendered content. The existing encrypted v3 job must retain its
  // original MIME request, including its multipart boundary and Message-ID.
  process.env.GMAIL_CLIENT_ID = "changed-gmail-client";
  process.env.GMAIL_CLIENT_SECRET = "changed-gmail-secret";
  process.env.GMAIL_REFRESH_TOKEN = "changed-gmail-refresh";
  const newlyRenderedSnapshot = createClientResetPasswordEmailSnapshot({
    provider: "gmail",
    name: "Awa — nouveau modèle",
    resetUrl: "https://www.competence.ci/reinitialiser-mot-de-passe?token=gmail-nouveau",
  });
  assert.ok(newlyRenderedSnapshot);
  const simulatedNewTemplate = Object.freeze({
    ...newlyRenderedSnapshot,
    subject: "Nouveau modèle Gmail de réinitialisation",
  });
  assert.notDeepEqual(simulatedNewTemplate, originalSnapshot);

  const retry = await sendPasswordEmailSnapshot(dispatch);
  assert.equal(first.ok, true);
  assert.equal(retry.ok, true);
  assert.equal(requests.length, 2);
  assert.deepEqual(requests[1], requests[0]);

  const digest = createHash("sha256").update(idempotencyKey).digest("hex");
  const decodedMime = Buffer.from(requests[0].rawMime, "base64url").toString("utf8");
  assert.match(
    decodedMime,
    new RegExp(`boundary="competence-${digest.slice(0, 48)}"`),
  );
  assert.match(decodedMime, new RegExp(`Message-ID: <${digest}@competence\\.ci>`));
  assert.match(
    decodedMime,
    /^From: =\?UTF-8\?B\?Q29tcMOpdGVuY2UuQ0k=\?= <diplomateimmobilier99@gmail\.com>$/m,
  );
  assert.doesNotMatch(decodedMime, /MonProf/i);
  assert.match(originalSnapshot.subject, /Compétence\.CI/);
  assert.match(originalSnapshot.html, />Compétence\.CI</);
});

test("Resend failures preserve uncertainty without unsafe cross-provider failover", () => {
  assert.deepEqual(classifyResendHttpFailure(408), { retryable: true, ambiguous: true });
  assert.deepEqual(classifyResendHttpFailure(500), { retryable: true, ambiguous: true });
  assert.deepEqual(classifyResendHttpFailure(429), { retryable: true, ambiguous: false });
  assert.deepEqual(
    classifyResendHttpFailure(409, "concurrent_idempotent_requests"),
    { retryable: true, ambiguous: true },
  );
  assert.deepEqual(
    classifyResendHttpFailure(409, "invalid_idempotent_request"),
    { retryable: false, ambiguous: false },
  );
  assert.deepEqual(classifyResendHttpFailure(422, "invalid_from_address"), {
    retryable: false,
    ambiguous: false,
  });
});

test("Resend accepts delivery only with a 2xx response and a message id", async () => {
  configureProductionResend();
  let capturedUrl = "";
  let capturedInit;
  globalThis.fetch = async (url, init) => {
    capturedUrl = String(url);
    capturedInit = init;
    return jsonResponse(200, { id: "resend-message-id" });
  };

  const result = await sendResendEmail({
    to: "client@example.com",
    subject: "Réinitialisation Compétence",
    text: "Contenu sûr",
    html: "<p>Contenu sûr</p>",
    idempotencyKey: "password-reset-dedupe-key",
  });

  assert.deepEqual(result, {
    ok: true,
    provider: "resend",
    configured: true,
    message: "Email envoyé par Resend.",
    externalId: "resend-message-id",
    retryable: false,
    ambiguous: false,
    statusCode: 200,
  });
  assert.equal(capturedUrl, "https://api.resend.com/emails");
  assert.equal(capturedInit.headers.Authorization, "Bearer re_test_123456789");
  assert.equal(capturedInit.headers["User-Agent"], "competence-password-email/1.0");
  assert.equal(capturedInit.headers["Idempotency-Key"], "password-reset-dedupe-key");
  assert.deepEqual(JSON.parse(capturedInit.body), {
    from: "Compétence <notifications@competence.ci>",
    to: "client@example.com",
    subject: "Réinitialisation Compétence",
    text: "Contenu sûr",
    html: "<p>Contenu sûr</p>",
  });
});

test("a v3 snapshot keeps the exact Resend body across env and template changes", async () => {
  configureProductionResend();
  const originalSnapshot = createClientResetPasswordEmailSnapshot({
    provider: "resend",
    name: "Awa",
    resetUrl: "https://www.competence.ci/reinitialiser-mot-de-passe?token=original",
  });
  assert.ok(originalSnapshot);
  assert.equal(Object.isFrozen(originalSnapshot), true);

  // Simulate a later deployment with another sender and another rendered
  // template. A retry of the existing encrypted v3 job must ignore both.
  process.env.RESEND_FROM_EMAIL = "Compétence Sécurité <securite@competence.ci>";
  const newlyRenderedSnapshot = createClientResetPasswordEmailSnapshot({
    provider: "resend",
    name: "Awa — nouveau modèle",
    resetUrl: "https://www.competence.ci/reinitialiser-mot-de-passe?token=nouveau",
  });
  assert.ok(newlyRenderedSnapshot);
  const simulatedNewTemplate = Object.freeze({
    ...newlyRenderedSnapshot,
    subject: "Nouveau modèle de réinitialisation",
  });
  assert.notDeepEqual(simulatedNewTemplate, originalSnapshot);

  const requests = [];
  globalThis.fetch = async (_url, init) => {
    requests.push({
      rawBody: init.body,
      body: JSON.parse(init.body),
      idempotencyKey: init.headers["Idempotency-Key"],
    });
    return jsonResponse(200, { id: `resend-message-${requests.length}` });
  };

  const dispatch = {
    snapshot: originalSnapshot,
    to: "client@example.com",
    idempotencyKey: "stable-encrypted-outbox-key",
  };
  const first = await sendPasswordEmailSnapshot(dispatch);
  const retry = await sendPasswordEmailSnapshot(dispatch);
  assert.equal(first.ok, true);
  assert.equal(retry.ok, true);
  assert.equal(requests.length, 2);
  assert.deepEqual(requests[1], requests[0]);
  assert.equal(
    requests[0].body.from,
    "Compétence <notifications@competence.ci>",
  );
  assert.equal(requests[0].body.subject, originalSnapshot.subject);
  assert.equal(requests[0].body.text, originalSnapshot.text);
  assert.equal(requests[0].body.html, originalSnapshot.html);
  assert.notEqual(requests[0].body.subject, simulatedNewTemplate.subject);
  assert.notEqual(requests[0].body.text, simulatedNewTemplate.text);
});

test("Resend treats missing proof, concurrent idempotency and network loss as ambiguous", async () => {
  configureProductionResend();

  globalThis.fetch = async () => jsonResponse(200, {});
  const missingId = await sendResendEmail(validMessage());
  assert.equal(missingId.ok, false);
  assert.equal(missingId.retryable, true);
  assert.equal(missingId.ambiguous, true);
  assert.equal(missingId.statusCode, 200);

  globalThis.fetch = async () => jsonResponse(409, { name: "concurrent_idempotent_requests" });
  const concurrent = await sendResendEmail(validMessage());
  assert.equal(concurrent.ok, false);
  assert.equal(concurrent.retryable, true);
  assert.equal(concurrent.ambiguous, true);
  assert.equal(concurrent.statusCode, 409);

  globalThis.fetch = async () => {
    throw new Error("connection reset");
  };
  const networkLoss = await sendResendEmail(validMessage());
  assert.equal(networkLoss.ok, false);
  assert.equal(networkLoss.retryable, true);
  assert.equal(networkLoss.ambiguous, true);
  assert.equal(networkLoss.statusCode, null);
});

test("Resend rejects injectable or invalid message metadata before the network", async () => {
  configureProductionResend();
  globalThis.fetch = async () => {
    throw new Error("fetch must not be called");
  };

  const badSubject = await sendResendEmail({
    ...validMessage(),
    subject: "Sujet\r\nBcc: attacker@example.com",
  });
  assert.equal(badSubject.ok, false);
  assert.equal(badSubject.retryable, false);
  assert.equal(badSubject.ambiguous, false);

  const oversizedKey = await sendResendEmail({
    ...validMessage(),
    idempotencyKey: "x".repeat(257),
  });
  assert.equal(oversizedKey.ok, false);
  assert.equal(oversizedKey.retryable, false);
  assert.equal(oversizedKey.ambiguous, false);
});

test("a Gmail-ambiguous result never cross-sends the same email through Resend", async () => {
  configureProductionGmailAndResend();
  let resendCalls = 0;
  globalThis.fetch = async (url) => {
    const target = String(url);
    if (target.includes("oauth2.googleapis.com/token")) {
      return jsonResponse(200, { access_token: "gmail-access-token", expires_in: 3600 });
    }
    if (target.includes("gmail.googleapis.com")) {
      return jsonResponse(500, { error: { status: "INTERNAL" } });
    }
    if (target.includes("api.resend.com")) {
      resendCalls += 1;
      return jsonResponse(200, { id: "must-not-be-used" });
    }
    throw new Error(`Unexpected URL: ${target}`);
  };

  const result = await sendEmail(validMessage());
  assert.equal(result.provider, "gmail");
  assert.equal(result.ok, false);
  assert.equal(result.ambiguous, true);
  assert.equal(resendCalls, 0);
});

test("a definite Gmail rejection may use Resend for non-security notifications", async () => {
  configureProductionGmailAndResend();
  let resendCalls = 0;
  globalThis.fetch = async (url) => {
    const target = String(url);
    if (target.includes("oauth2.googleapis.com/token")) {
      return jsonResponse(200, { access_token: "gmail-access-token", expires_in: 3600 });
    }
    if (target.includes("gmail.googleapis.com")) {
      return jsonResponse(400, { error: { status: "INVALID_ARGUMENT" } });
    }
    if (target.includes("api.resend.com")) {
      resendCalls += 1;
      return jsonResponse(200, { id: "resend-fallback-message-id" });
    }
    throw new Error(`Unexpected URL: ${target}`);
  };

  const result = await sendEmail(validMessage());
  assert.equal(result.provider, "resend");
  assert.equal(result.ok, true);
  assert.equal(result.externalId, "resend-fallback-message-id");
  assert.equal(resendCalls, 1);
});

function configureProductionResend() {
  process.env.VERCEL_ENV = "production";
  process.env.RESEND_API_KEY = "re_test_123456789";
  process.env.RESEND_FROM_EMAIL = "Compétence <notifications@competence.ci>";
}

function configureProductionGmailAndResend() {
  configureProductionResend();
  process.env.GMAIL_CLIENT_ID = "gmail-test-client";
  process.env.GMAIL_CLIENT_SECRET = "gmail-test-secret";
  process.env.GMAIL_REFRESH_TOKEN = "gmail-test-refresh";
  process.env.GMAIL_SENDER_EMAIL = "diplomateimmobilier99@gmail.com";
}

function validMessage() {
  return {
    to: "client@example.com",
    subject: "Réinitialisation Compétence",
    text: "Contenu sûr",
    idempotencyKey: "password-reset-dedupe-key",
  };
}

function jsonResponse(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
