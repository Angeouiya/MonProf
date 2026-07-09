import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();
const checks = [];
const warnings = [];
const counts = {};

const criticalTables = [
  ["users", () => db.user.count()],
  ["teachers", () => db.teacher.count()],
  ["subjects", () => db.subject.count()],
  ["levels", () => db.level.count()],
  ["communes", () => db.commune.count()],
  ["bookings", () => db.booking.count()],
  ["transactions", () => db.transaction.count()],
  ["notifications", () => db.notification.count()],
  ["reviews", () => db.review.count()],
  ["disputes", () => db.dispute.count()],
  ["teacherNotifications", () => db.teacherNotification.count()],
  ["teacherMissionLinks", () => db.teacherMissionLink.count()],
  ["teacherPayoutRequests", () => db.teacherPayoutRequest.count()],
  ["clientRefundRequests", () => db.clientRefundRequest.count()],
  ["adminActionLogs", () => db.adminActionLog.count()],
  ["settings", () => db.setting.count()],
  ["passwordResetTokens", () => db.passwordResetToken.count()],
];

try {
  await checkDatabaseUrl();
  for (const [label, getCount] of criticalTables) {
    await checkTable(label, getCount);
  }

  await checkAdminAccount();
  checkRequiredCatalogs();
  checkOperationalSettings();
  await checkNoDemoAccounts();
} finally {
  await db.$disconnect();
}

for (const warning of warnings) {
  console.warn(`WARN ${warning}`);
}

for (const check of checks) {
  console.log(`${check.ok ? "OK" : "FAIL"} ${check.label}`);
}

const failed = checks.filter((check) => !check.ok);
if (failed.length > 0) {
  console.log(`FAIL Database readiness check failed: ${failed.length} blocking issue(s).`);
  process.exitCode = 1;
}

async function checkDatabaseUrl() {
  const rawUrl = process.env.DATABASE_URL?.trim();
  if (!rawUrl) {
    record("DATABASE_URL is configured for database readiness", false);
    return;
  }

  try {
    const url = new URL(rawUrl);
    record("DATABASE_URL uses PostgreSQL for database readiness", url.protocol === "postgresql:");
    record("DATABASE_URL targets Supabase for database readiness", isSupabaseDatabaseHost(url.hostname));
    record("DATABASE_URL does not target a local database for database readiness", !isLocalDatabaseHost(url.hostname));
    record("DATABASE_URL has no placeholder password for database readiness", isSafeDatabasePassword(url.password));
    record("DATABASE_URL targets schema=competence for database readiness", url.searchParams.get("schema") === "competence");
  } catch {
    record("DATABASE_URL is valid for database readiness", false);
  }
}

function isSupabaseDatabaseHost(hostname) {
  const normalized = hostname.toLowerCase();
  return normalized.endsWith(".supabase.co") || normalized.endsWith(".pooler.supabase.com");
}

function isLocalDatabaseHost(hostname) {
  const normalized = hostname.toLowerCase();
  return normalized === "localhost" || normalized === "127.0.0.1" || normalized === "::1";
}

function isSafeDatabasePassword(password) {
  const decoded = decodeURIComponent(password ?? "").trim();
  if (!decoded) return false;
  const lowered = decoded.toLowerCase();
  return !lowered.includes("your-password")
    && !lowered.includes("password")
    && !lowered.includes("change-me")
    && !lowered.includes("placeholder");
}

async function checkTable(label, getCount) {
  try {
    const count = await getCount();
    counts[label] = count;
    record(`Database table ${label} is reachable`, Number.isInteger(count) && count >= 0);
  } catch (error) {
    counts[label] = null;
    warnings.push(`Table ${label} could not be queried: ${error instanceof Error ? error.message : "unknown error"}.`);
    record(`Database table ${label} is reachable`, false);
  }
}

async function checkAdminAccount() {
  try {
    const adminCount = await db.user.count({ where: { role: "ADMIN" } });
    record("At least one administrator account exists", adminCount > 0);
  } catch (error) {
    warnings.push(`Admin account check failed: ${error instanceof Error ? error.message : "unknown error"}.`);
    record("At least one administrator account exists", false);
  }
}

function checkRequiredCatalogs() {
  record("Subject catalog is ready", (counts.subjects ?? 0) > 0);
  record("Level catalog is ready", (counts.levels ?? 0) > 0);
  record("Commune catalog is ready", (counts.communes ?? 0) > 0);
}

function checkOperationalSettings() {
  record("Operational settings table is initialized", (counts.settings ?? 0) > 0);
}

async function checkNoDemoAccounts() {
  try {
    const demoUsers = await db.user.count({
      where: {
        OR: [
          { email: { endsWith: "@demo.ci", mode: "insensitive" } },
          { email: { endsWith: "@monprof.ci", mode: "insensitive" } },
        ],
      },
    });
    record("Production database has no obvious demo user accounts", demoUsers === 0);
  } catch (error) {
    warnings.push(`Demo account check failed: ${error instanceof Error ? error.message : "unknown error"}.`);
    record("Production database has no obvious demo user accounts", false);
  }
}

function record(label, ok) {
  checks.push({ label, ok });
}
