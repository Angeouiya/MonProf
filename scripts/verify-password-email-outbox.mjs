import assert from "node:assert/strict";
import fs from "node:fs";
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url);
const {
  decryptPasswordEmailPayload,
  encryptPasswordEmailPayload,
  passwordEmailIdentifier,
} = jiti("../src/lib/password-email-outbox-crypto.ts");
const {
  classifyGmailHttpFailure,
  classifyGoogleOAuthTokenFailure,
} = jiti("../src/lib/gmail-email.ts");

const secret = "test-secret-that-is-long-enough-for-outbox-verification";
const aad = "job-dedupe-key";
const payload = {
  kind: "PASSWORD_RESET",
  email: "private@example.com",
  token: "raw-secret-token",
};
const encrypted = encryptPasswordEmailPayload(payload, secret, aad);
assert.deepEqual(decryptPasswordEmailPayload(encrypted, secret, aad), payload);
assert.doesNotMatch(encrypted.payloadCiphertext, /private@example|raw-secret-token/);
const corruptedCiphertext = `${encrypted.payloadCiphertext.slice(0, -1)}${
  encrypted.payloadCiphertext.endsWith("A") ? "B" : "A"
}`;
assert.throws(() => decryptPasswordEmailPayload({
  ...encrypted,
  payloadCiphertext: corruptedCiphertext,
}, secret, aad));
assert.equal(
  passwordEmailIdentifier("account:user@example.com", secret),
  passwordEmailIdentifier("account:user@example.com", secret),
);

assert.deepEqual(classifyGmailHttpFailure(500), { retryable: true, ambiguous: true });
assert.deepEqual(classifyGmailHttpFailure(408), { retryable: true, ambiguous: true });
assert.deepEqual(classifyGmailHttpFailure(429), { retryable: true, ambiguous: false });
assert.deepEqual(classifyGmailHttpFailure(400), { retryable: false, ambiguous: false });
assert.deepEqual(
  classifyGoogleOAuthTokenFailure(400, "invalid_grant"),
  { retryable: false, ambiguous: false, statusCode: 400 },
);
assert.deepEqual(
  classifyGoogleOAuthTokenFailure(401, "invalid_client"),
  { retryable: false, ambiguous: false, statusCode: 401 },
);
assert.deepEqual(
  classifyGoogleOAuthTokenFailure(400, "unauthorized_client"),
  { retryable: false, ambiguous: false, statusCode: 400 },
);
assert.deepEqual(
  classifyGoogleOAuthTokenFailure(400, "invalid_request"),
  { retryable: false, ambiguous: false, statusCode: 400 },
);
assert.deepEqual(
  classifyGoogleOAuthTokenFailure(408, "temporarily_unavailable"),
  { retryable: true, ambiguous: false, statusCode: 408 },
);
assert.deepEqual(
  classifyGoogleOAuthTokenFailure(429, "rate_limit_exceeded"),
  { retryable: true, ambiguous: false, statusCode: 429 },
);
assert.deepEqual(
  classifyGoogleOAuthTokenFailure(503, "server_error"),
  { retryable: true, ambiguous: false, statusCode: 503 },
);
assert.deepEqual(
  classifyGoogleOAuthTokenFailure(null),
  { retryable: true, ambiguous: false, statusCode: null },
);

const schema = read("../prisma/schema.prisma");
const migration = read("../prisma/migrations/20260728050000_password_reset_request_audit/migration.sql");
const outbox = read("../src/lib/password-email-outbox.ts");
const gmail = read("../src/lib/gmail-email.ts");
const cron = read("../src/app/api/cron/password-email-outbox/route.ts");
const vercel = JSON.parse(read("../vercel.json"));
const nextConfig = read("../next.config.ts");

assert.match(schema, /model PasswordEmailOutbox \{/);
assert.match(schema, /payloadCiphertext\s+String\?/);
assert.match(migration, /PasswordEmailOutbox_active_reset_routing_key/);
assert.match(migration, /PasswordEmailOutbox_processing_account_key/);
assert.match(migration, /UPDATE "PasswordResetToken"[\s\S]*"deliveredAt" = "createdAt"/);
assert.match(outbox, /`account:\$\{normalizedEmail\}`/);
assert.doesNotMatch(outbox, /`account:\$\{input\.requestedAccountType/);
assert.match(outbox, /kind: "PASSWORD_RESET"[\s\S]*status: \{ in: ACTIVE_STATUSES \}/);
assert.match(outbox, /prepareResetTokenForDelivery[\s\S]*sendClientResetPasswordEmail/);
assert.match(outbox, /rememberAmbiguousDelivery[\s\S]*retryPasswordEmailJob/);
assert.match(outbox, /async function expireActivePasswordEmailJobs/);
assert.match(outbox, /UPDATE "PasswordEmailOutbox"[\s\S]*RETURNING "kind"/);
assert.match(outbox, /type: "PASSWORD_EMAIL_OUTBOX_EXPIRED"/);
assert.match(outbox, /priority: "URGENT"/);
assert.match(outbox, /db\.passwordResetToken\.deleteMany/);
assert.match(outbox, /PASSWORD_RESET_TOKEN_RETENTION_MS/);
assert.match(gmail, /const classification = oauthTokenFailureFromError\(error\)/);
assert.match(gmail, /message: classification\.retryable/);
assert.match(cron, /authorization !== `Bearer \$\{configuredSecret\}`/);
assert.match(cron, /status: 401/);
assert.ok(vercel.crons.some((item) => item.path === "/api/cron/password-email-outbox" && item.schedule === "*/5 * * * *"));
assert.doesNotMatch(nextConfig, /env:\s*\{[\s\S]*APP_URL/);

console.log("Password email outbox verification passed.");

function read(relativePath) {
  return fs.readFileSync(new URL(relativePath, import.meta.url), "utf8");
}
