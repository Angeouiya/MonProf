import fs from "node:fs";

const checks = [];
const read = (filePath) => fs.readFileSync(filePath, "utf8");
const record = (label, passed) => checks.push({ label, passed });

const ui = read("src/components/professor/professor-ui.tsx");
const layout = read("src/components/layouts/professor-layout.tsx");
const dashboard = read("src/app/professeur/(espace)/page.tsx");
const missions = read("src/app/professeur/(espace)/missions/page.tsx");
const payments = read("src/app/professeur/(espace)/paiements/page.tsx");
const messages = read("src/app/professeur/(espace)/messages/page.tsx");
const notifications = read("src/app/professeur/(espace)/notifications/page.tsx");
const markNotificationsRead = read("src/components/professor/mark-teacher-notifications-read.tsx");
const payoutRequestForm = read("src/components/professor/teacher-payout-request-form.tsx");
const serviceClientMessageCompose = read("src/components/professor/teacher-admin-message-compose.tsx");
const settings = read("src/app/professeur/(espace)/parametres/settings-client.tsx");
const css = read("src/app/globals.css");
const availability = read("src/components/professor/teacher-availability-editor.tsx");
const missionResponseActions = read("src/components/professor/mission-response-actions.tsx");
const rescheduleRequestActions = read("src/components/professor/reschedule-request-actions.tsx");
const rootTabPaths = [
  "src/app/professeur/(espace)/page.tsx",
  "src/app/professeur/(espace)/missions/page.tsx",
  "src/app/professeur/(espace)/disponibilites/page.tsx",
  "src/app/professeur/(espace)/paiements/page.tsx",
  "src/app/professeur/(espace)/messages/page.tsx",
  "src/app/professeur/(espace)/avis/page.tsx",
  "src/app/professeur/(espace)/profil/page.tsx",
  "src/app/professeur/(espace)/notifications/page.tsx",
  "src/app/professeur/(espace)/parametres/page.tsx",
];
const rootTabs = rootTabPaths.map(read);
const missionDetail = read("src/app/professeur/(espace)/missions/[id]/page.tsx");

record(
  "Every professor root tab opts into root navigation semantics",
  rootTabs.every((source) => /<ProfessorPageHeader[\s\S]*?rootTab/.test(source)),
);

record(
  "Root tabs suppress redundant back actions while deep pages keep the default",
  /const shouldShowBack = showBack \?\? !rootTab;/.test(ui)
    && /data-professor-root-header=\{rootTab \? "true" : "false"\}/.test(ui)
    && /<ProfessorPageHeader/.test(missionDetail)
    && !/rootTab/.test(missionDetail),
);

record(
  "Professor page descriptions are compact on narrow mobile screens",
  /data-professor-page-description/.test(ui)
    && /@media \(max-width: 519px\)[\s\S]*?\[data-professor-root-header="true"\][\s\S]*?\[data-professor-page-description\][\s\S]*?display: none !important/.test(css),
);

record(
  "Professor summary screens reuse the compact two-column mobile grid",
  /export function ProfessorStatGrid/.test(ui)
    && /grid grid-cols-2 gap-2 min-\[680px\]:gap-3/.test(ui)
    && rootTabs.filter((source) => /<ProfessorStatGrid/.test(source)).length === 1,
);

record(
  "Professor mobile navigation contains exactly four essential destinations",
  /const mobileNavItems = \[[\s\S]*?label: "Accueil"[\s\S]*?label: "Missions"[\s\S]*?label: "Dispos"[\s\S]*?label: "Paiements"[\s\S]*?\];/.test(layout)
    && /grid grid-cols-4 gap-1/.test(layout)
    && !/label: "Msgs"/.test(layout),
);

record(
  "Professor mobile bottom navigation never masks missions or payout actions",
  /data-professor-main/.test(layout)
    && /professor-main-with-mobile-nav/.test(layout)
    && /data-professor-mobile-nav/.test(layout)
    && /professor-mobile-nav fixed inset-x-0/.test(layout)
    && !/professor-mobile-nav fixed inset-x-3/.test(layout)
    && /style=\{\{\s*bottom:\s*"0px"\s*\}\}/.test(layout)
    && /Mobile app safe area: bottom navigation never covers page content/.test(css)
    && /\.professor-shell main\.professor-main-with-mobile-nav\s*\{[\s\S]*?padding-bottom:\s*calc\(8\.25rem \+ env\(safe-area-inset-bottom\)\)\s*!important;[\s\S]*?\}/.test(css)
    && /\.professor-shell\s*\[data-professor-mobile-nav\][^{]*\{[\s\S]*?bottom:\s*0\s*!important;[\s\S]*?left:\s*0\s*!important;[\s\S]*?right:\s*0\s*!important;[\s\S]*?width:\s*100%\s*!important;[\s\S]*?margin-inline:\s*0\s*!important;[\s\S]*?\}/.test(css)
    && /\.professor-shell\s*\[data-professor-mobile-nav\]\s*>\s*div[^{]*\{[\s\S]*?max-width:\s*28rem;[\s\S]*?margin-inline:\s*auto;[\s\S]*?\}/.test(css),
);

record(
  "Professor dashboard opens with one app hero, one priority action and the exact balance",
  /data-professor-dashboard-priority/.test(dashboard)
    && /data-professor-dashboard-app-hero/.test(dashboard)
    && /data-professor-dashboard-balance-strip/.test(dashboard)
    && /data-professor-dashboard-net-exact/.test(dashboard)
    && /const nextCourse = verifiedUpcomingBookings\[0\]/.test(dashboard)
    && /DashboardBalanceMini label="Retirable"/.test(dashboard)
    && /DashboardBalanceMini label="Bloqué"/.test(dashboard)
    && /DashboardBalanceMini label="Frais payés"/.test(dashboard)
    && /Frais Jèko pris en charge\./.test(dashboard)
    && !/Voir le décompte complet|Tout voir|La prochaine mission confirmée/.test(dashboard)
    && !/PROFESSOR_COMMAND_CENTER_ENABLED/.test(dashboard)
    && !/ProfessorQuickLink|ProfessorActionTile|ProfessorControlStep/.test(dashboard)
    && !/teacherNotification\.findMany/.test(dashboard)
    && !/DashboardBalanceMini label="Déduit de votre net"/.test(dashboard),
);

record(
  "Professor payments open as a simple cashier screen before accounting details",
  /data-professor-payment-pulse/.test(payments)
    && /href="#demande-retrait-professeur"/.test(payments)
    && /id="demande-retrait-professeur"/.test(payoutRequestForm)
    && /data-professor-payout-primary-action/.test(payoutRequestForm)
    && payments.indexOf("<TeacherPayoutRequestForm") > payments.indexOf("data-professor-payment-pulse")
    && payments.indexOf("<TeacherPayoutRequestForm") < payments.indexOf('title="Voir le calcul exact"')
    && /Disponible maintenant\. Aucun frais retiré\./.test(payments)
    && /TeacherExactMetric label="À recevoir" value=\{remaining\} emphasized/.test(payments)
    && /TeacherExactMetric label="En cours" value=\{pendingRequested \+ draftReservedAmount\}/.test(payments)
    && /TeacherExactMetric label="Frais payés" value=\{transferFeesCovered\}/.test(payments),
);

record(
  "Professor payment accounting stays behind progressive disclosure",
  /<ProfessorDisclosure[\s\S]*?title="Voir le calcul exact"[\s\S]*?Net prévu − paiements reçus − retenues validées = reste à recevoir\./.test(payments)
    && /<ProfessorDisclosure[\s\S]*?title="Détail des cours"/.test(payments)
    && /<ProfessorDisclosure[\s\S]*?title="Mes reçus"/.test(payments),
);

record(
  "Professor mission cards prioritize urgent work and reveal secondary details on demand",
  /const orderedBookings = verifiedBookings\.toSorted/.test(missions)
    && /missionNeedsAttention\(left, missionSortNow\)/.test(missions)
    && /leftUpcoming \? -1 : 1/.test(missions)
    && /data-professor-mission-card/.test(missions)
    && /data-professor-mission-decision/.test(missions)
    && /data-professor-mission-snapshot/.test(missions)
    && /data-professor-mission-secondary/.test(missions)
    && /Infos mission/.test(missions)
    && !/Détail complet/.test(missions)
    && /group-open:rotate-180/.test(missions),
);

record(
  "Professor notifications show one priority card and fold the history",
  /data-professor-notification-priority/.test(notifications)
    && /const priorityNotification = notifications\.find/.test(notifications)
    && /const historyNotifications = priorityNotification/.test(notifications)
    && /data-professor-notification-history/.test(notifications)
    && /data-professor-notification-message-details/.test(notifications)
    && /Lire le message complet/.test(notifications)
    && /group-open:rotate-180/.test(notifications)
    && !/toast\.success/.test(markNotificationsRead)
    && /data-professor-notification-read-state/.test(markNotificationsRead),
);

record(
  "Professor messages show one priority and fold compose plus history",
  /data-professor-message-priority/.test(messages)
    && /const priorityMessage =/.test(messages)
    && /const historyMessages = priorityMessage/.test(messages)
    && /data-professor-message-metrics/.test(messages)
    && /data-professor-message-compose/.test(messages)
    && /open=\{messages\.length === 0\}/.test(messages)
    && /data-professor-message-history/.test(messages)
    && !/<ProfessorStatGrid/.test(messages)
    && /data-professor-message-compose-form/.test(serviceClientMessageCompose)
    && /data-professor-message-sent-state/.test(serviceClientMessageCompose)
    && !/toast\.success/.test(serviceClientMessageCompose),
);

record(
  "Odd statistic rows stay visually balanced",
  /data-balance-odd=\{balanceOdd \? "true" : "false"\}/.test(ui)
    && /\[data-professor-stat-grid\]\[data-balance-odd="true"\] > :last-child:nth-child\(odd\)[\s\S]*?grid-column: 1 \/ -1/.test(css),
);

record(
  "Small 320px-class devices receive condensed statistic typography",
  /@media \(max-width: 359px\)[\s\S]*?\[data-professor-stat-icon\],[\s\S]*?\[data-professor-stat-detail\][\s\S]*?display: none !important/.test(css)
    && /data-professor-stat-value/.test(ui)
    && /data-professor-stat-label/.test(ui),
);

record(
  "Availability summary and presets avoid single-column stacking",
  /data-professor-availability-metrics/.test(availability)
    && /grid grid-cols-2 gap-2/.test(availability)
    && /col-span-2 min-\[760px\]:col-span-1/.test(availability),
);

record(
  "Professor routine actions confirm inline instead of floating success toasts",
  /data-professor-availability-saved-state/.test(availability)
    && /data-professor-mission-response-sent/.test(missionResponseActions)
    && /data-professor-reschedule-response-state/.test(rescheduleRequestActions)
    && !/toast\.success|toast\.warning/.test(availability)
    && !/toast\.success|toast\.warning/.test(missionResponseActions)
    && !/toast\.success|toast\.warning/.test(rescheduleRequestActions),
);

record(
  "Professor settings confirm routine updates inline instead of floating success toasts",
  /data-professor-payout-profile-saved/.test(settings)
    && /setPayoutSavedMessage/.test(settings)
    && !/toast\.success|toast\.warning/.test(settings),
);

const failed = checks.filter((check) => !check.passed);
for (const check of checks) {
  console.log(`${check.passed ? "PASS" : "FAIL"}: ${check.label}`);
}

if (failed.length > 0) {
  console.error(`\n${failed.length} professor mobile verification check(s) failed.`);
  process.exit(1);
}

console.log(`\nProfessor mobile verification passed (${checks.length} checks).`);
