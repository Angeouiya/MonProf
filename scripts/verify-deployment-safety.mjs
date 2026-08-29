import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createJiti } from "jiti";

if (process.env.VERCEL_BUILD_DISPATCH_TEST === "fake-npm") {
  console.log(`FAKE_NPM_TARGET=${process.argv.slice(2).join(":")}`);
  process.exit(0);
}

const jiti = createJiti(import.meta.url, { alias: { "@": path.resolve("src") } });
const {
  getProductionIntegrationPolicy,
  productionIntegrationsAreEnabled,
} = jiti("../src/lib/production-integration-policy.ts");

assert.deepEqual(getProductionIntegrationPolicy({}), {
  enabled: true,
  mode: "local-explicit",
  deploymentPlatform: "local",
  cloudflareEnvironment: null,
  vercelEnvironment: null,
});
assert.equal(productionIntegrationsAreEnabled({ VERCEL_ENV: "production" }), true);
assert.equal(productionIntegrationsAreEnabled({ VERCEL_ENV: "preview" }), false);
assert.equal(productionIntegrationsAreEnabled({ VERCEL_ENV: "development" }), false);
assert.equal(productionIntegrationsAreEnabled({ VERCEL_ENV: "custom-preview" }), false);
assert.equal(productionIntegrationsAreEnabled({
  APP_DEPLOYMENT_PLATFORM: "cloudflare",
  APP_DEPLOYMENT_ENV: "staging",
}), false);
assert.equal(productionIntegrationsAreEnabled({
  APP_DEPLOYMENT_PLATFORM: "cloudflare",
  APP_DEPLOYMENT_ENV: "production",
}), true);

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

  delete process.env.VERCEL_ENV;
  delete process.env.GMAIL_SENDER_EMAIL;
  assert.equal(
    hasGmailEnvironmentConfiguration(),
    false,
    "Gmail runtime configuration must require its exact sender explicitly",
  );

  process.env.GMAIL_SENDER_EMAIL = "diplomateimmobilier99@gmail.com";
  assert.equal(hasGmailEnvironmentConfiguration(), true);
  assert.equal(isGmailConfigured(), true, "local explicit verification remains available");

  process.env.GMAIL_SENDER_EMAIL = "another.sender@gmail.com";
  assert.equal(
    hasGmailEnvironmentConfiguration(),
    false,
    "Gmail runtime configuration must reject any sender other than diplomateimmobilier99@gmail.com",
  );
  assert.equal(isGmailConfigured(), false);
  process.env.GMAIL_SENDER_EMAIL = "diplomateimmobilier99@gmail.com";

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
const resend = read("../src/lib/resend-email.ts");
const paydunya = read("../src/lib/paydunya.ts");
const paydunyaBookingReconciliation = read("../src/lib/paydunya-reconciliation.ts");
const paydunyaRescheduleReconciliation = read("../src/lib/paydunya-reschedule-reconciliation.ts");
assert.match(jekoConfig, /if \(!productionIntegrationsAreEnabled\(\)\) return null/);
assert.match(gmail, /if \(!productionIntegrationsAreEnabled\(\)\) return null/);
assert.match(gmail, /productionIntegrationsAreEnabled\(\) && hasGmailEnvironmentConfiguration\(\)/);
assert.match(resend, /if \(!productionIntegrationsAreEnabled\(\)\) return null/);
assert.match(resend, /productionIntegrationsAreEnabled\(environment\)/);
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
const publicHome = read("../src/app/page.tsx");
assert.match(health, /scope: "configuration-readiness"/);
assert.match(health, /const gmailConfigured = hasGmailEnvironmentConfiguration\(\)/);
assert.match(health, /const gmailRuntimeEnabled = isGmailConfigured\(\)/);
assert.match(health, /readPasswordEmailProvider\(\)/);
assert.match(health, /hasResendEnvironmentConfiguration\(\)/);
assert.match(health, /isResendConfigured\(\)/);
assert.match(health, /integrations\.passwordEmail\.runtimeEnabled/);
assert.match(health, /liveVerification: "not_checked_by_health"/);
assert.match(health, /getProductionIntegrationPolicy\(\)/);
assert.doesNotMatch(health, /sendGmailEmail|oauth2\.googleapis\.com|gmail\.googleapis\.com/);

const productionCheck = read("./check-production-config.mjs");
const vercelBuildDispatcher = read("./run-vercel-build.mjs");
const packageJson = JSON.parse(read("../package.json"));
const vercelConfig = JSON.parse(read("../vercel.json"));
const envExample = read("../.env.example");
assert.ok(
  (productionCheck.match(/if \(isVercelNonProductionDeployment\(\)\)/g) ?? []).length >= 2,
  "Preview configuration checks must not require live Jèko or Gmail credentials.",
);
assert.match(productionCheck, /Production build verifies Vercel integration isolation/);
assert.equal(packageJson.scripts?.["build:vercel"], "node scripts/run-vercel-build.mjs");
assert.match(packageJson.scripts?.["build:preview"] ?? "", /npm run build:quality/);
assert.match(packageJson.scripts?.["build:preview"] ?? "", /npm run build/);
assert.doesNotMatch(
  `${packageJson.scripts?.["build:preview"] ?? ""} ${packageJson.scripts?.["build:quality"] ?? ""}`,
  /production:check|verify:admin-governance|verify:web-push|verify:platform-settings|db:verify|verify:session-accounting|payment:audit/,
);
assert.match(packageJson.scripts?.["build:production"] ?? "", /npm run production:check/);
assert.match(packageJson.scripts?.["build:production"] ?? "", /npm run verify:admin-governance/);
assert.match(packageJson.scripts?.["build:production"] ?? "", /npm run verify:web-push/);
assert.match(packageJson.scripts?.["build:production"] ?? "", /npm run verify:platform-settings/);
assert.match(packageJson.scripts?.["build:production"] ?? "", /npm run db:verify/);
assert.match(packageJson.scripts?.["build:production"] ?? "", /npm run verify:session-accounting/);
assert.match(packageJson.scripts?.["build:production"] ?? "", /npm run payment:audit/);
assert.equal(vercelConfig.buildCommand, "npm run build:vercel");
assert.match(vercelBuildDispatcher, /vercelEnvironment\s*===\s*"production"/);
assert.match(vercelBuildDispatcher, /vercelEnvironment\s*===\s*"preview"/);
assert.match(vercelBuildDispatcher, /Unsupported VERCEL_ENV/);
assert.match(vercelBuildDispatcher, /process\.env\.npm_execpath/);
assert.doesNotMatch(vercelBuildDispatcher, /shell:\s*true/);
assertVercelBuildTarget("preview", "build:preview");
assertVercelBuildTarget("production", "build:production");
assertVercelBuildRejected(null);
assertVercelBuildRejected("development");
assertVercelBuildRejected("custom-preview");
assert.match(productionCheck, /expectedRole:\s*"competence_runtime"/);
assert.match(productionCheck, /expectedRole:\s*"competence_migrator"/);
assert.match(productionCheck, /Password email provider is explicitly gmail or resend/);
assert.match(productionCheck, /provider === "gmail" \|\| provider === "resend"/);
assert.match(productionCheck, /Resend sender uses the verified competence\.ci domain/);
assert.match(envExample, /DATABASE_URL="postgresql:\/\/competence_runtime\.PROJECT_REF:/);
assert.match(envExample, /DIRECT_URL="postgresql:\/\/competence_migrator\.PROJECT_REF:/);
assert.match(envExample, /PASSWORD_EMAIL_PROVIDER="gmail"/);
assert.match(envExample, /RESEND_FROM_EMAIL="Compétence <notifications@competence\.ci>"/);
assert.doesNotMatch(envExample, /DATABASE_URL="postgresql:\/\/competence_app\./);
assert.doesNotMatch(
  publicHome,
  /from "@\/lib\/db"|getCachedTeacherSearchCatalog|db\.teacher\.findMany|TeacherCard|featuredCards/,
  "The public home page must remain available in isolated Preview deployments without production database credentials.",
);
assert.match(publicHome, /data-home-centered-entry/);
assert.match(publicHome, /data-home-journey-tabs/);

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

function runVercelBuildDispatcher(vercelEnvironment) {
  const environment = {
    ...process.env,
    VERCEL_BUILD_DISPATCH_TEST: "fake-npm",
    npm_execpath: fileURLToPath(import.meta.url),
  };
  if (vercelEnvironment) environment.VERCEL_ENV = vercelEnvironment;
  else delete environment.VERCEL_ENV;

  return spawnSync(process.execPath, [fileURLToPath(new URL("./run-vercel-build.mjs", import.meta.url))], {
    encoding: "utf8",
    env: environment,
  });
}

function assertVercelBuildTarget(vercelEnvironment, expectedTarget) {
  const result = runVercelBuildDispatcher(vercelEnvironment);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, new RegExp(`FAKE_NPM_TARGET=run:${expectedTarget}`));
}

function assertVercelBuildRejected(vercelEnvironment) {
  const result = runVercelBuildDispatcher(vercelEnvironment);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Unsupported VERCEL_ENV/);
  assert.doesNotMatch(result.stdout, /FAKE_NPM_TARGET=/);
}
