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
const {
  selectPasswordEmailCandidateBatch,
} = jiti("../src/lib/password-email-candidate-selection.ts");

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
const corruptionIndex = Math.floor(encrypted.payloadCiphertext.length / 2);
const corruptedCiphertext = `${encrypted.payloadCiphertext.slice(0, corruptionIndex)}${
  encrypted.payloadCiphertext[corruptionIndex] === "A" ? "B" : "A"
}${encrypted.payloadCiphertext.slice(corruptionIndex + 1)}`;
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

const claimStart = outbox.indexOf("async function claimPasswordEmailJob");
const claimEnd = outbox.indexOf("async function prepareResetTokenForDelivery", claimStart);
assert.ok(claimStart >= 0 && claimEnd > claimStart, "La fonction de claim outbox doit exister.");
const claim = outbox.slice(claimStart, claimEnd);
assert.match(claim, /processingForAccount[\s\S]*status: "PROCESSING"/);
assert.match(claim, /executableWhere[\s\S]*availableAt: \{ lte: now \}/);
assert.match(claim, /firstAvailableReset[\s\S]*kind: "PASSWORD_RESET"/);
assert.ok(
  claim.indexOf("const firstAvailableReset") < claim.indexOf("const firstAvailableForAccount"),
  "Un reset exécutable doit être choisi avant le fallback des confirmations.",
);
assert.doesNotMatch(
  claim,
  /status: \{ in: ACTIVE_STATUSES \}/,
  "Un job actif mais encore en backoff ne doit pas bloquer un reset disponible.",
);
assert.match(
  outbox,
  /const \[resetCandidates, otherCandidates\][\s\S]*kind: "PASSWORD_RESET"[\s\S]*kind: \{ not: "PASSWORD_RESET" \}[\s\S]*selectPasswordEmailCandidateBatch/,
  "Le flush réel doit fournir deux fenêtres au sélecteur testé avant d'appliquer sa limite globale.",
);

// Régression comportementale : un `take` rempli de confirmations anciennes
// ne doit jamais cacher les resets plus récents, et chaque passage doit faire
// progresser la file jusqu'aux confirmations.
const batchLimit = 5;
const oldConfirmations = Array.from({ length: batchLimit }, (_, index) => ({
  id: `confirmation-${String(index).padStart(2, "0")}`,
  kind: "PASSWORD_CHANGED",
  createdAt: new Date(`2026-07-28T10:00:${String(index).padStart(2, "0")}Z`),
}));
const newerResets = Array.from({ length: batchLimit + 2 }, (_, index) => ({
  id: `reset-${String(index).padStart(2, "0")}`,
  kind: "PASSWORD_RESET",
  createdAt: new Date(`2026-07-28T11:00:${String(index).padStart(2, "0")}Z`),
}));
let pendingCandidates = [...oldConfirmations, ...newerResets];
const processedBatches = [];
while (pendingCandidates.length > 0) {
  const batch = selectPasswordEmailCandidateBatch(pendingCandidates, batchLimit);
  assert.ok(batch.length > 0, "Chaque passage doit faire progresser la file.");
  processedBatches.push(batch);
  const selectedIds = new Set(batch.map((candidate) => candidate.id));
  pendingCandidates = pendingCandidates.filter((candidate) => !selectedIds.has(candidate.id));
}
assert.deepEqual(
  processedBatches[0].filter((candidate) => candidate.kind === "PASSWORD_RESET").map((candidate) => candidate.id),
  newerResets.slice(0, batchLimit - 1).map((candidate) => candidate.id),
  "Le premier batch doit rester majoritairement composé de resets, même s'ils sont plus récents.",
);
assert.ok(
  processedBatches[0].some((candidate) => candidate.kind !== "PASSWORD_RESET"),
  "Un lot mixte doit aussi faire progresser les confirmations.",
);
assert.deepEqual(
  processedBatches.flat().map((candidate) => candidate.id).sort(),
  [...oldConfirmations, ...newerResets].map((candidate) => candidate.id).sort(),
  "Tous les jobs doivent finir par progresser sans starvation.",
);

// Un flux continu qui remplit chaque nouveau lot de resets doit laisser au
// moins une place aux confirmations à chaque passage.
let continuouslyPendingConfirmations = Array.from({ length: 6 }, (_, index) => ({
  id: `continuous-confirmation-${index}`,
  kind: "PASSWORD_CHANGED",
  createdAt: new Date(`2026-07-28T09:00:${String(index).padStart(2, "0")}Z`),
}));
for (let cycle = 0; cycle < 3; cycle += 1) {
  const incomingResets = Array.from({ length: batchLimit }, (_, index) => ({
    id: `continuous-reset-${cycle}-${index}`,
    kind: "PASSWORD_RESET",
    createdAt: new Date(`2026-07-28T12:0${cycle}:${String(index).padStart(2, "0")}Z`),
  }));
  const batch = selectPasswordEmailCandidateBatch(
    [...continuouslyPendingConfirmations, ...incomingResets],
    batchLimit,
  );
  const progressedConfirmationIds = new Set(
    batch
      .filter((candidate) => candidate.kind !== "PASSWORD_RESET")
      .map((candidate) => candidate.id),
  );
  assert.ok(progressedConfirmationIds.size >= 1, "Chaque lot mixte doit faire progresser une confirmation.");
  continuouslyPendingConfirmations = continuouslyPendingConfirmations.filter(
    (candidate) => !progressedConfirmationIds.has(candidate.id),
  );
}
assert.equal(
  continuouslyPendingConfirmations.length,
  3,
  "Les confirmations doivent progresser même si chaque passage reçoit un nouveau lot complet de resets.",
);

console.log("Password email outbox verification passed.");

function read(relativePath) {
  return fs.readFileSync(new URL(relativePath, import.meta.url), "utf8");
}
