import fs from "node:fs";
import path from "node:path";

const migrationRoot = path.resolve("prisma", "migrations");
const checks = [];

const migrationLockPath = path.join(migrationRoot, "migration_lock.toml");
record(
  "Prisma migration provider is locked to PostgreSQL",
  fs.existsSync(migrationLockPath)
    && /provider\s*=\s*["']postgresql["']/.test(fs.readFileSync(migrationLockPath, "utf8")),
);

checkDirectoryContainsSql("20260727000000_baseline", [
  'CREATE TABLE "User"',
  'CREATE TABLE "Teacher"',
  'CREATE TABLE "Booking"',
  'CREATE TABLE "Transaction"',
  'CREATE TABLE "BookingRescheduleRequest"',
  'CREATE TABLE "TeacherPayoutRecord"',
  'CREATE TABLE "TeacherPayoutAllocation"',
  'CREATE TABLE "Setting"',
]);
checkDirectoryContainsSql("20260728000000_jeko_teacher_payout_snapshots", [
  'CREATE TYPE "PaymentProvider"',
  'ADD VALUE \'DJAMO\'',
  'ADD COLUMN "provider" "PaymentProvider"',
  'ADD COLUMN "releasedAmountSnapshot" INTEGER NOT NULL DEFAULT 0',
]);
checkDirectoryContainsSql("20260728010000_jeko_reschedule_payment_attempts", [
  'CREATE TABLE "PaymentAttempt"',
  'CREATE TABLE "PaymentEvent"',
  'ADD COLUMN "paymentProvider" "PaymentProvider"',
]);
checkDirectoryContainsSql("20260728020000_reschedule_payment_provider_discriminator", [
  'ALTER TABLE "BookingRescheduleRequest"',
  'ADD COLUMN "paymentProvider"',
  '"paymentProvider" "PaymentProvider"',
]);
checkDirectoryContainsSql("20260728030000_password_session_version", [
  'ADD COLUMN "sessionVersion" INTEGER NOT NULL DEFAULT 0',
  'CREATE TABLE "TeacherPasswordResetToken"',
]);
checkDirectoryContainsSql("20260728040000_one_active_reschedule_per_booking", [
  'CREATE UNIQUE INDEX',
  'BookingRescheduleRequest',
]);
checkDirectoryContainsSql("20260728050000_password_reset_request_audit", [
  'ALTER TABLE "PasswordResetToken"',
  'ALTER TABLE "TeacherPasswordResetToken"',
  'ADD COLUMN "deliveredAt" TIMESTAMP(3)',
  'CREATE TABLE "PasswordResetRequestAudit"',
  'CREATE TABLE "PasswordEmailOutbox"',
  'PasswordResetRequestAudit_ipHash_createdAt_idx',
  'PasswordResetRequestAudit_accountHash_createdAt_idx',
  'PasswordEmailOutbox_active_reset_routing_key',
  'PasswordEmailOutbox_processing_account_key',
]);
checkDirectoryContainsSql("20260728060000_jeko_payout_fee_minor", [
  'ALTER TABLE "TeacherPayoutRecord"',
  'ADD COLUMN "transferFeeAmountMinor" INTEGER NOT NULL DEFAULT 0',
  'ADD COLUMN "transferFeeCoveredByPlatformMinor" INTEGER NOT NULL DEFAULT 0',
]);
checkDirectoryContainsSql("20260728080000_reschedule_refund_tracking", [
  'ALTER TYPE "RescheduleRequestStatus" ADD VALUE \'REFUNDED\'',
  'ADD COLUMN "refundedAmount" INTEGER NOT NULL DEFAULT 0',
  'ADD COLUMN "refundTransactionId" TEXT',
  'BookingRescheduleRequest_refundTransactionId_key',
  'BookingRescheduleRequest_refundExternalReference_key',
  'BookingRescheduleRequest_refundTransactionId_fkey',
]);
checkDirectoryContainsSql("20260728070000_teacher_temporary_password", [
  'ALTER TABLE "Teacher"',
  'ADD COLUMN "portalPasswordMustChange" BOOLEAN NOT NULL DEFAULT false',
]);
checkDirectoryContainsSql("20260728090000_jeko_payout_sweep_fairness", [
  'ALTER TABLE "TeacherPayoutRecord"',
  'ADD COLUMN "lastCheckedAt" TIMESTAMP(3)',
  'CREATE INDEX "TeacherPayoutRecord_jeko_sweep_idx"',
  'CREATE INDEX "PaymentAttempt_jeko_sweep_idx"',
  'CREATE INDEX "TeacherPayoutRecord_jeko_sweep_due_expr_idx"',
  'CREATE INDEX "PaymentAttempt_jeko_sweep_due_expr_idx"',
  'COALESCE("lastCheckedAt", "createdAt")',
  'COALESCE("lastCheckedAt", "updatedAt")',
  '"failureCode" IS DISTINCT FROM \'JEKO_PAYMENT_FAILED\'',
]);
checkDirectoryContainsSql("20260728100000_booking_reschedule_session_target", [
  'ALTER TABLE "BookingRescheduleRequest"',
  'ADD COLUMN "bookingSessionId" TEXT',
  'CREATE INDEX "BookingRescheduleRequest_bookingSessionId_idx"',
  'ADD CONSTRAINT "BookingRescheduleRequest_bookingSessionId_fkey"',
  'REFERENCES "BookingSession"("id")',
]);
checkDirectoryContainsSql("20260728110000_reschedule_refund_active_guard", [
  'DROP INDEX "BookingRescheduleRequest_one_active_per_booking"',
  'CREATE UNIQUE INDEX "BookingRescheduleRequest_one_active_per_booking"',
  "'REFUND_REQUIRED'::\"RescheduleRequestStatus\"",
  'HAVING COUNT(*) > 1',
  'RAISE EXCEPTION',
]);

const packageJson = JSON.parse(fs.readFileSync("package.json", "utf8"));
const deployScript = packageJson.scripts?.["db:deploy"] ?? "";
record(
  "Database deploy prepares the legacy baseline before migrate deploy",
  deployScript.startsWith("node scripts/ensure-prisma-migration-baseline.mjs")
    && deployScript.includes("npm run db:migration-preflight")
    && deployScript.includes("prisma migrate deploy"),
);

const migrationPreflight = fs.existsSync("scripts/preflight-prisma-migrations.mjs")
  ? fs.readFileSync("scripts/preflight-prisma-migrations.mjs", "utf8")
  : "";
record(
  "Migration preflight blocks duplicate active reschedule requests before the unique index",
  migrationPreflight.includes("PAYMENT_PENDING")
    && migrationPreflight.includes("PAYMENT_FAILED")
    && migrationPreflight.includes("AWAITING_TEACHER")
    && migrationPreflight.includes("REFUND_REQUIRED")
    && migrationPreflight.includes("HAVING COUNT(*) > 1"),
);

const baselineScript = fs.existsSync("scripts/ensure-prisma-migration-baseline.mjs")
  ? fs.readFileSync("scripts/ensure-prisma-migration-baseline.mjs", "utf8")
  : "";
record(
  "Baseline adoption fingerprints all tables, columns, enums, indexes, and constraints",
  baselineScript.includes("parseBaselineFingerprint")
    && baselineScript.includes("information_schema.columns")
    && baselineScript.includes("pg_indexes")
    && baselineScript.includes("information_schema.table_constraints")
    && baselineScript.includes("pg_enum")
    && baselineScript.includes("Refusing to mark the Prisma baseline"),
);

for (const check of checks) {
  console.log(`${check.ok ? "OK" : "FAIL"} ${check.label}`);
}

const failures = checks.filter((check) => !check.ok);
if (failures.length > 0) {
  console.error(`FAIL Prisma migration verification failed: ${failures.length} issue(s).`);
  process.exit(1);
}

console.log(`OK Prisma migration verification passed (${checks.length} checks).`);

function checkDirectoryContainsSql(name, requiredFragments) {
  const sqlPath = path.join(migrationRoot, name, "migration.sql");
  if (!fs.existsSync(sqlPath)) {
    record(`Migration ${name} contains migration.sql`, false);
    return;
  }

  const sql = fs.readFileSync(sqlPath, "utf8").trim();
  record(`Migration ${name} is not empty`, sql.length > 0);
  for (const fragment of requiredFragments) {
    record(`Migration ${name} includes ${fragment}`, sql.includes(fragment));
  }
}

function record(label, ok) {
  checks.push({ label, ok });
}
