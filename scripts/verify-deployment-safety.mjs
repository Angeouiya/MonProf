import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url, { alias: { "@": path.resolve("src") } });
const {
  getProductionIntegrationPolicy,
  productionIntegrationsAreEnabled,
} = jiti("../src/lib/production-integration-policy.ts");

assert.deepEqual(getProductionIntegrationPolicy({}), {
  enabled: true,
  mode: "local-explicit",
  vercelEnvironment: null,
});
assert.equal(productionIntegrationsAreEnabled({ VERCEL_ENV: "production" }), true);
assert.equal(productionIntegrationsAreEnabled({ VERCEL_ENV: "preview" }), false);
assert.equal(productionIntegrationsAreEnabled({ VERCEL_ENV: "development" }), false);
assert.equal(productionIntegrationsAreEnabled({ VERCEL_ENV: "custom-preview" }), false);

const {
  hasGmailEnvironmentConfiguration,
  isGmailConfigured,
} = jiti("../src/lib/gmail-email.ts");
const gmailEnvironmentKeys = [
  "VERCEL_ENV",
  "GMAIL_CLIENT_ID",
  "GMAIL_CLIENT_SECRET",
  "GMAIL_REFRESH_TOKEN",
  "GMAIL_SENDER_EMAIL",
];
const originalGmailEnvironment = Object.fromEntries(
  gmailEnvironmentKeys.map((key) => [key, process.env[key]]),
);
try {
  process.env.GMAIL_CLIENT_ID = "deployment-safety-client";
  process.env.GMAIL_CLIENT_SECRET = "deployment-safety-secret";
  process.env.GMAIL_REFRESH_TOKEN = "deployment-safety-refresh";
  process.env.GMAIL_SENDER_EMAIL = "diplomateimmobilier99@gmail.com";

  delete process.env.VERCEL_ENV;
  assert.equal(hasGmailEnvironmentConfiguration(), true);
  assert.equal(isGmailConfigured(), true, "local explicit verification remains available");

  process.env.VERCEL_ENV = "production";
  assert.equal(isGmailConfigured(), true);

  process.env.VERCEL_ENV = "preview";
  assert.equal(hasGmailEnvironmentConfiguration(), true, "health may report configuration presence");
  assert.equal(isGmailConfigured(), false, "Preview must never enable Gmail runtime delivery");
} finally {
  for (const key of gmailEnvironmentKeys) {
    const value = originalGmailEnvironment[key];
    if (typeof value === "string") process.env[key] = value;
    else delete process.env[key];
  }
}

const jekoConfig = read("../src/lib/jeko-config.ts");
const gmail = read("../src/lib/gmail-email.ts");
const paydunya = read("../src/lib/paydunya.ts");
const paydunyaBookingReconciliation = read("../src/lib/paydunya-reconciliation.ts");
const paydunyaRescheduleReconciliation = read("../src/lib/paydunya-reschedule-reconciliation.ts");
assert.match(jekoConfig, /if \(!productionIntegrationsAreEnabled\(\)\) return null/);
assert.match(gmail, /if \(!productionIntegrationsAreEnabled\(\)\) return null/);
assert.match(gmail, /productionIntegrationsAreEnabled\(\) && hasGmailEnvironmentConfiguration\(\)/);
assert.match(paydunya, /import \{ productionIntegrationsAreEnabled \} from "@\/lib\/production-integration-policy"/);
assert.match(paydunya, /if \(!productionIntegrationsAreEnabled\(\)\) return null/);

assertPreviewReconciliationGuard(
  paydunyaBookingReconciliation,
  "reconcilePayDunyaBookingPayment",
  "db.booking.findFirst",
);
assertPreviewReconciliationGuard(
  paydunyaRescheduleReconciliation,
  "reconcilePayDunyaReschedulePayment",
  "db.bookingRescheduleRequest.findFirst",
);

const { db } = jiti("../src/lib/db.ts");
const { reconcilePayDunyaBookingPayment } = jiti("../src/lib/paydunya-reconciliation.ts");
const { reconcilePayDunyaReschedulePayment } = jiti("../src/lib/paydunya-reschedule-reconciliation.ts");
const originalVercelEnvironment = process.env.VERCEL_ENV;
const originalBookingFindFirst = db.booking.findFirst;
const originalRescheduleFindFirst = db.bookingRescheduleRequest.findFirst;
try {
  process.env.VERCEL_ENV = "preview";
  db.booking.findFirst = async () => {
    throw new Error("Preview booking reconciliation reached the database");
  };
  db.bookingRescheduleRequest.findFirst = async () => {
    throw new Error("Preview reschedule reconciliation reached the database");
  };

  const bookingPreviewResult = await reconcilePayDunyaBookingPayment({
    bookingId: "preview-booking-probe",
    source: "webhook",
  });
  assert.equal(bookingPreviewResult.bookingId, "preview-booking-probe");
  assert.equal(bookingPreviewResult.action, "not_configured");
  assert.equal(bookingPreviewResult.verified, false);

  const reschedulePreviewResult = await reconcilePayDunyaReschedulePayment({
    bookingId: "preview-booking-probe",
    rescheduleRequestId: "preview-reschedule-probe",
    source: "webhook",
  });
  assert.equal(reschedulePreviewResult.bookingId, "preview-booking-probe");
  assert.equal(reschedulePreviewResult.rescheduleRequestId, "preview-reschedule-probe");
  assert.equal(reschedulePreviewResult.action, "not_configured");
  assert.equal(reschedulePreviewResult.verified, false);
} finally {
  db.booking.findFirst = originalBookingFindFirst;
  db.bookingRescheduleRequest.findFirst = originalRescheduleFindFirst;
  if (typeof originalVercelEnvironment === "string") process.env.VERCEL_ENV = originalVercelEnvironment;
  else delete process.env.VERCEL_ENV;
}

for (const relativePath of [
  "../src/app/api/cron/notification-reminders/route.ts",
  "../src/app/api/cron/web-push/route.ts",
]) {
  const cronRoute = read(relativePath);
  assert.match(cronRoute, /authorization !== `Bearer \$\{configuredSecret\}`/);
  assert.doesNotMatch(cronRoute, /nextUrl\.searchParams/);
  assert.doesNotMatch(cronRoute, /x-cron-secret/i);
  assert.match(cronRoute, /"Cache-Control": "no-store"/);
}

const health = read("../src/app/api/health/route.ts");
assert.match(health, /scope: "configuration-readiness"/);
assert.match(health, /configured: hasGmailEnvironmentConfiguration\(\)/);
assert.match(health, /runtimeEnabled: isGmailConfigured\(\)/);
assert.match(health, /liveVerification: "not_checked_by_health"/);
assert.match(health, /getProductionIntegrationPolicy\(\)/);
assert.doesNotMatch(health, /sendGmailEmail|oauth2\.googleapis\.com|gmail\.googleapis\.com/);

const productionCheck = read("./check-production-config.mjs");
const envExample = read("../.env.example");
assert.ok(
  (productionCheck.match(/if \(isVercelNonProductionDeployment\(\)\)/g) ?? []).length >= 2,
  "Preview configuration checks must not require live Jèko or Gmail credentials.",
);
assert.match(productionCheck, /Production build verifies Vercel integration isolation/);
assert.match(productionCheck, /expectedRole:\s*"competence_runtime"/);
assert.match(productionCheck, /expectedRole:\s*"competence_migrator"/);
assert.match(envExample, /DATABASE_URL="postgresql:\/\/competence_runtime\.PROJECT_REF:/);
assert.match(envExample, /DIRECT_URL="postgresql:\/\/competence_migrator\.PROJECT_REF:/);
assert.doesNotMatch(envExample, /DATABASE_URL="postgresql:\/\/competence_app\./);

console.log("Deployment safety verification passed: Vercel isolation, Bearer-only crons and explicit health semantics.");

function read(relativePath) {
  return fs.readFileSync(new URL(relativePath, import.meta.url), "utf8");
}

function assertPreviewReconciliationGuard(source, functionName, firstDatabaseRead) {
  assert.match(
    source,
    /import \{ productionIntegrationsAreEnabled \} from "@\/lib\/production-integration-policy"/,
  );

  const functionStart = source.indexOf(`export async function ${functionName}`);
  const guard = source.indexOf("if (!productionIntegrationsAreEnabled())", functionStart);
  const databaseRead = source.indexOf(firstDatabaseRead, functionStart);
  const providerConfirmation = source.indexOf("confirmPayDunyaInvoice(", functionStart);

  assert.ok(functionStart >= 0, `${functionName} must remain exported`);
  assert.ok(guard > functionStart, `${functionName} must enforce Preview isolation`);
  assert.ok(databaseRead > guard, `${functionName} must block Preview before its first database read`);
  assert.ok(providerConfirmation > guard, `${functionName} must block Preview before PayDunya confirmation`);

  const functionPreamble = source.slice(functionStart, guard);
  assert.doesNotMatch(functionPreamble, /\b(?:await|db\.|confirmPayDunyaInvoice\()/);
}
