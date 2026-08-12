import fs from "node:fs";

const read = (path) => fs.readFileSync(path, "utf8");
const schema = read("prisma/schema.prisma");
const migration = read("prisma/migrations/20260804000000_teacher_journey_offers/migration.sql");
const journeyModel = read("src/lib/teacher-journeys.ts");
const publicTeachers = read("src/app/professeurs/page.tsx");
const publicTeacherDetail = read("src/app/professeurs/[id]/page.tsx");
const publicTeacherApi = read("src/app/api/teachers/route.ts");
const publicTeacherDetailApi = read("src/app/api/teachers/[id]/route.ts");
const clientSearch = read("src/app/client/rechercher/page.tsx");
const clientDashboard = read("src/app/client/page.tsx");
const journeySwitcher = read("src/components/shared/journey-switcher.tsx");
const bookingPage = read("src/app/client/reserver/page.tsx");
const bookingForm = read("src/app/client/reserver/reserver-form.tsx");
const bookingApi = read("src/app/api/bookings/route.ts");
const replacement = read("src/lib/teacher-replacement-matching.ts");
const adminReplacementSuggestions = read("src/app/api/admin/replacement-suggestions/route.ts");
const adminBookingApi = read("src/app/api/admin/bookings/[id]/route.ts");
const teacherForm = read("src/components/admin/teacher-form.tsx");
const adminTeacherList = read("src/app/admin/professeurs/page.tsx");
const createTeacher = read("src/app/api/admin/teachers/route.ts");
const updateTeacher = read("src/app/api/admin/teachers/[id]/route.ts");
const journeyValidation = read("src/lib/teacher-journey-validation.ts");

const checks = [];
const check = (label, ok) => checks.push({ label, ok: Boolean(ok) });

check(
  "One teacher owns three cumulative mini-app authorizations with safe defaults",
  /offersIvorianSystem\s+Boolean\s+@default\(true\)/.test(schema)
    && /offersFrenchSystem\s+Boolean\s+@default\(false\)/.test(schema)
    && /offersProfessionalTraining\s+Boolean\s+@default\(false\)/.test(schema)
    && /Teacher_at_least_one_journey_check/.test(migration),
);
check(
  "Shared journey model maps every mini-app to one eligibility field",
  /teacherField: "offersIvorianSystem"/.test(journeyModel)
    && /teacherField: "offersFrenchSystem"/.test(journeyModel)
    && /teacherField: "offersProfessionalTraining"/.test(journeyModel)
    && /teacherEligibleJourneys/.test(journeyModel),
);
check(
  "Admin can activate any combination but cannot disable all mini-apps",
  /name="offersIvorianSystem"/.test(teacherForm)
    && /name="offersFrenchSystem"/.test(teacherForm)
    && /name="offersProfessionalTraining"/.test(teacherForm)
    && /data-admin-teacher-journey-locks/.test(teacherForm)
    && /data-admin-teacher-journey-lock=\{name\}/.test(teacherForm)
    && /offersFrenchSystem: "matieres"/.test(teacherForm)
    && /Hors système = action impossible/.test(teacherForm)
    && /Verrouillé/.test(teacherForm)
    && /Activez au moins une mini-application/.test(teacherForm)
    && /hasTeacherJourney\(journeyEligibility\)/.test(createTeacher)
    && /hasTeacherJourney\(journeyEligibility\)/.test(updateTeacher),
);
check(
  "Admin journey locks require a real compatible catalog and protect active missions",
  /teacherJourneyCatalogIssues/.test(journeyValidation)
    && /filterSubjectsForJourney\(subjects, journey\)/.test(journeyValidation)
    && /filterLevelsForJourney/.test(journeyValidation)
    && /data-admin-teacher-journey-catalog-state/.test(teacherForm)
    && /data-admin-teacher-journey-catalog=\{state\.journey\}/.test(teacherForm)
    && /teacherJourneyCatalogIssueMessage\(teacherJourneyCatalogIssues/.test(createTeacher)
    && /teacherJourneyCatalogIssueMessage\(teacherJourneyCatalogIssues/.test(updateTeacher)
    && /const disabledJourneys = TEACHER_JOURNEYS\.filter/.test(updateTeacher)
    && /resolveTeacherJourney\(\{[\s\S]*?courseCategory: booking\.courseCategory/.test(updateTeacher)
    && /Impossible de verrouiller/.test(updateTeacher),
);
check(
  "Public mini-app tabs require authorization plus compatible subject and level",
  /teacherJourneyWhere\(journey\)/.test(publicTeachers)
    && /teacherJourneyCatalogClauses\(subjects, levels\)/.test(publicTeachers)
    && /TEACHER_JOURNEYS\.map/.test(publicTeachers)
    && /aria-label="Choisir une mini-application"/.test(publicTeachers)
    && /teacherJourneyWhere\(journey\)/.test(publicTeacherApi)
    && /teacherJourneyCatalogClauses\(subjects, levels\)/.test(publicTeacherApi)
    && /teacherJourneyWhere\(journey\)/.test(publicTeacherDetail)
    && /parseTeacherJourney\(requestedJourney\)/.test(publicTeacherDetailApi)
    && /teacherJourneyWhere\(journey\)/.test(publicTeacherDetailApi)
    && /teacherEligibleJourneys\(teacher\)/.test(publicTeacherDetailApi)
    && /filterSubjectsForJourney/.test(publicTeacherDetailApi)
    && /filterLevelsForJourney/.test(publicTeacherDetailApi)
    && /n'enseigne pas dans ce système/.test(publicTeacherDetailApi),
);
check(
  "Public and client cards never leak a fallback subject from another mini-app",
  !/t\.subjects\[0\]\?\.subject\.name/.test(publicTeachers)
    && !/t\.subjects\[0\]\?\.subject\.name/.test(clientSearch)
    && /journeyConfig\.primarySubjectFallback/.test(publicTeachers)
    && /journeyConfig\.primarySubjectFallback/.test(clientSearch),
);
check(
  "Authenticated client search keeps the mini-app through booking",
  /teacherJourneyWhere\(journey\)/.test(clientSearch)
    && /teacherJourneyCatalogClauses\(subjects, levels\)/.test(clientSearch)
    && /data-client-journey-tabs/.test(clientSearch)
    && /teacherId=\$\{t\.id\}&journey=\$\{journey\}/.test(clientSearch)
    && /data-client-dashboard-journeys/.test(clientDashboard)
    && /CLIENT_JOURNEY_HREFS/.test(clientDashboard)
    && /<JourneySwitcher/.test(clientDashboard)
    && /data-journey-tab=\{journey\}/.test(journeySwitcher)
    && /data-mini-app-tabs/.test(journeySwitcher)
    && /data-mini-app-system-switcher/.test(journeySwitcher)
    && /data-mini-app-active-pill/.test(journeySwitcher)
    && /role="tablist"/.test(journeySwitcher)
    && /role="tab"/.test(journeySwitcher)
    && !/Professeurs recommandés/.test(clientDashboard),
);
check(
  "Booking UI exposes only mini-apps enabled for the professor",
  /teacherEligibleJourneys\(teacher\)/.test(bookingPage)
    && /filterSubjectsForJourney\(teacher\.subjects/.test(bookingPage)
    && /filterLevelsForJourney\(teacher\.levels/.test(bookingPage)
    && /eligibleJourneys\.length === 0\) notFound/.test(bookingPage)
    && /!eligibleJourneys\.includes\(initialJourney\)/.test(bookingPage)
    && /eligibleJourneys: BookingJourney\[\]/.test(bookingForm)
    && /filter\(\(\{ value \}\) => eligibleJourneys\.includes\(value\)\)/.test(bookingForm)
    && /!eligibleJourneys\.includes\(journey\)/.test(bookingForm)
    && /n'enseigne pas dans ce système/.test(bookingForm)
    && /data-booking-journey-switcher/.test(bookingForm)
    && /data-mini-app-tablist/.test(bookingForm)
    && /role="tablist"/.test(bookingForm)
    && /role="tab"/.test(bookingForm),
);
check(
  "Server booking and automatic replacement enforce the selected mini-app",
  /resolveTeacherJourney/.test(bookingApi)
    && /teacherSupportsJourney\(teacher, bookingJourney\)/.test(bookingApi)
    && /Ce professeur ne propose pas ce parcours/.test(bookingApi)
    && /teacherJourneyWhere\(bookingJourney\)/.test(replacement),
);
check(
  "Admin replacement suggestions and forced replacement stay locked to the booking mini-app",
  /resolveTeacherJourney/.test(adminReplacementSuggestions)
    && /teacherJourneyWhere\(bookingJourney\)/.test(adminReplacementSuggestions)
    && /Même système d'enseignement/.test(adminReplacementSuggestions)
    && /resolveTeacherJourney/.test(adminBookingApi)
    && /teacherSupportsJourney\(newTeacher, bookingJourney\)/.test(adminBookingApi)
    && /Le professeur remplaçant n'enseigne pas dans le système/.test(adminBookingApi)
    && /Systèmes enseignés et autorisés/.test(teacherForm)
    && /liste client, profil, réservation, paiement et remplacement/.test(teacherForm),
);
check(
  "Admin teacher list shows the exact authorized and locked mini-apps",
  /TeacherJourneyPills/.test(adminTeacherList)
    && /data-admin-teacher-row-journeys/.test(adminTeacherList)
    && /data-admin-teacher-row-journey=\{journey\}/.test(adminTeacherList)
    && /teacherSupportsJourney\(teacher, journey\)/.test(adminTeacherList)
    && /\$\{config\.shortLabel\} verrouillé/.test(adminTeacherList),
);
check(
  "Booking choices and server validation stay inside the selected mini-app",
  /filterSubjectsForJourney\(subjects, bookingJourney\)/.test(bookingForm)
    && /filterLevelsForJourney\(levels, bookingJourney\)/.test(bookingForm)
    && /subjectNameMatchesJourney\(canonicalSubjectName, bookingJourney\)/.test(bookingApi)
    && /filterLevelsForJourney\(\[\{/.test(bookingApi)
    && /ne correspond pas au système choisi/.test(bookingApi),
);

for (const item of checks) console.log(`${item.ok ? "OK" : "FAIL"} ${item.label}`);
const failed = checks.filter((item) => !item.ok);
if (failed.length) {
  console.error(`FAIL Teacher mini-app verification: ${failed.length} issue(s).`);
  process.exitCode = 1;
} else {
  console.log("OK Teacher mini-app eligibility and booking isolation verified.");
}
