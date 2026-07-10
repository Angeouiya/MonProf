import fs from "node:fs";

const checks = [];

const session = read("src/lib/session.ts");
const teacherAuth = read("src/lib/teacher-auth.ts");
const clientLayout = read("src/app/client/layout.tsx");
const clientShell = read("src/components/layouts/client-layout.tsx");
const clientDashboard = read("src/app/client/page.tsx");
const clientSearch = read("src/app/client/rechercher/page.tsx");
const clientPayments = read("src/app/client/paiements/page.tsx");
const clientNotifications = read("src/app/client/notifications/page.tsx");
const adminDashboard = read("src/app/admin/page.tsx");
const publicHome = read("src/app/page.tsx");
const publicTeachers = read("src/app/professeurs/page.tsx");
const clientBooking = read("src/app/client/reserver/page.tsx");
const clientRegistration = read("src/app/inscription/page.tsx");
const clientCourses = read("src/app/client/cours/page.tsx");
const clientReviews = read("src/app/client/avis/page.tsx");
const clientSupport = read("src/app/client/service-client/page.tsx");
const clientSettings = read("src/app/client/parametres/page.tsx");
const professorDashboard = read("src/app/professeur/(espace)/page.tsx");
const adminTeachers = read("src/app/admin/professeurs/page.tsx");

check("Client session reads are cached per render", /export const getSessionUser = cache\(async/.test(session));
check("Professor session and profile reads are cached per render", /export const getTeacherSessionUser = cache\(async/.test(teacherAuth) && /export const requireTeacher = cache\(async/.test(teacherAuth));
check("Client shell does not block navigation on database reads", !/from "@\/lib\/db"/.test(clientLayout));
check("Client shell avoids dynamic route prefetch fan-out", /const CLIENT_NAV_PREFETCH\s*=\s*false/.test(clientShell) && !/CLIENT_PRIMARY_PREFETCH_ROUTES|requestIdleCallback/.test(clientShell));
check("Client shell updates notification badges asynchronously", !/fetch\("\/api\/client\/notifications"/.test(clientShell) && /competence:notification-count/.test(clientShell) && /WebPushRealtime/.test(clientShell));
check("Client dashboard batches bookings and recommendations on one pooled connection", hasDatabaseTransaction(clientDashboard));
check("Client search consolidates filter catalogs before render", /getCachedTeacherSearchCatalog/.test(clientSearch));
check("Client search catalogs remain available without published teachers", !/const \[subjects, levels, communes\] = total > 0/.test(clientSearch));
check("Client payments batch transactions and pending bookings on one pooled connection", hasDatabaseTransaction(clientPayments));
check("Client notifications load messages and reservations in one joined query", /FROM competence\."Notification" n/.test(clientNotifications) && /LEFT JOIN competence\."Booking" b/.test(clientNotifications));
check("Admin dashboard batches operational indicators on one pooled connection", hasDatabaseTransaction(adminDashboard));
check("Admin dashboard no longer serializes its first metric queries", !/const totalClients = await/.test(adminDashboard) && !/const totalTeachers = await/.test(adminDashboard));
check("Public home uses one consolidated catalog read", /getCachedTeacherSearchCatalog/.test(publicHome) && !/getCachedSubjects|getCachedLevels|getCachedCommunes/.test(publicHome));
check("Public teacher search batches results and uses the consolidated catalog", /getCachedTeacherSearchCatalog/.test(publicTeachers) && hasDatabaseTransaction(publicTeachers) && !/Promise\.all\(\[\s*getCachedSubjects/.test(publicTeachers));
check("Client onboarding and booking reuse the consolidated catalog", /getCachedTeacherSearchCatalog/.test(clientBooking) && /getCachedTeacherSearchCatalog/.test(clientRegistration));
check("Client courses batch tab, overview, and pending reads", hasDatabaseTransaction(clientCourses));
check("Client reviews batch pending and historical reads", hasDatabaseTransaction(clientReviews));
check("Client support batches eligible bookings and disputes", hasDatabaseTransaction(clientSupport));
check("Client settings batch profile and account indicators", hasDatabaseTransaction(clientSettings));
check("Professor dashboard batches operational and accounting reads", hasDatabaseTransaction(professorDashboard));
check("Admin teacher list batches profiles, catalogs, and photo stats", hasDatabaseTransaction(adminTeachers));

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
