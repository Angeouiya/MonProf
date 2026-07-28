import assert from "node:assert/strict";
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

console.log("Password reset throttling verification passed.");
