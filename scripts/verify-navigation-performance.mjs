import fs from "node:fs";

const checks = [];

const session = read("src/lib/session.ts");
const teacherAuth = read("src/lib/teacher-auth.ts");
const clientLayout = read("src/app/client/layout.tsx");
const clientDashboard = read("src/app/client/page.tsx");
const clientSearch = read("src/app/client/rechercher/page.tsx");
const clientPayments = read("src/app/client/paiements/page.tsx");
const clientNotifications = read("src/app/client/notifications/page.tsx");
const adminDashboard = read("src/app/admin/page.tsx");

check("Client session reads are cached per render", /export const getSessionUser = cache\(async/.test(session));
check("Professor session and profile reads are cached per render", /export const getTeacherSessionUser = cache\(async/.test(teacherAuth) && /export const requireTeacher = cache\(async/.test(teacherAuth));
check("Client shell does not block navigation on database reads", !/from "@\/lib\/db"/.test(clientLayout));
check("Client dashboard batches bookings and recommendations on one pooled connection", hasDatabaseTransaction(clientDashboard));
check("Client search consolidates filter catalogs before render", /getCachedTeacherSearchCatalog/.test(clientSearch));
check("Client search catalogs remain available without published teachers", !/const \[subjects, levels, communes\] = total > 0/.test(clientSearch));
check("Client payments batch transactions and pending bookings on one pooled connection", hasDatabaseTransaction(clientPayments));
check("Client notifications load messages and reservations in one joined query", /FROM competence\."Notification" n/.test(clientNotifications) && /LEFT JOIN competence\."Booking" b/.test(clientNotifications));
check("Admin dashboard batches operational indicators on one pooled connection", hasDatabaseTransaction(adminDashboard));
check("Admin dashboard no longer serializes its first metric queries", !/const totalClients = await/.test(adminDashboard) && !/const totalTeachers = await/.test(adminDashboard));

for (const result of checks) {
  console.log(`${result.ok ? "OK" : "FAIL"} ${result.label}`);
}

const failed = checks.filter((result) => !result.ok);
if (failed.length > 0) {
  console.error(`FAIL Navigation performance verification: ${failed.length} blocking issue(s).`);
  process.exitCode = 1;
} else {
  console.log("OK Navigation performance verification passed.");
}

function read(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

function hasDatabaseTransaction(source) {
  return /await db\.\$transaction\(\[/.test(source);
}

function check(label, ok) {
  checks.push({ label, ok });
}
