import assert from "node:assert/strict";
import fs from "node:fs";
import jitiFactory from "jiti";

const jiti = jitiFactory(import.meta.url, { interopDefault: true });
const {
  isPasswordResetRequestAllowed,
  isPasswordResetIpAllowed,
  MAX_PASSWORD_RESET_REQUESTS_PER_WINDOW,
  MAX_PASSWORD_RESET_REQUESTS_PER_IP_WINDOW,
  PASSWORD_RESET_REQUEST_WINDOW_MS,
} = jiti("../src/lib/password-reset-rate-limit.ts");

assert.equal(isPasswordResetRequestAllowed(0), true);
assert.equal(isPasswordResetRequestAllowed(MAX_PASSWORD_RESET_REQUESTS_PER_WINDOW - 1), true);
assert.equal(isPasswordResetRequestAllowed(MAX_PASSWORD_RESET_REQUESTS_PER_WINDOW), false);
assert.equal(PASSWORD_RESET_REQUEST_WINDOW_MS, 900_000);
assert.equal(isPasswordResetIpAllowed(MAX_PASSWORD_RESET_REQUESTS_PER_IP_WINDOW - 1), true);
assert.equal(isPasswordResetIpAllowed(MAX_PASSWORD_RESET_REQUESTS_PER_IP_WINDOW), false);

const outboxSource = fs.readFileSync(new URL("../src/lib/password-email-outbox.ts", import.meta.url), "utf8");
const forgotRouteSource = fs.readFileSync(new URL("../src/app/api/auth/forgot-password/route.ts", import.meta.url), "utf8");
const rateCountIndex = outboxSource.indexOf("const [recentIpRequests, recentAccountRequests]");
const auditCreateIndex = outboxSource.indexOf("const audit = await tx.passwordResetRequestAudit.create");
const activeReuseIndex = outboxSource.indexOf("const existing = await tx.passwordEmailOutbox.findFirst");
assert.ok(rateCountIndex >= 0 && auditCreateIndex > rateCountIndex);
assert.ok(
  activeReuseIndex > auditCreateIndex,
  "Une demande qui réutilise un reset actif doit d'abord être comptée et auditée.",
);
assert.match(
  forgotRouteSource,
  /if \(request\.jobId && !request\.reused\)/,
  "Un reset actif réutilisé doit attendre le cron au lieu de relancer un flush par requête.",
);

console.log("Password reset throttling verification passed.");
