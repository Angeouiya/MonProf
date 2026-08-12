import fs from "node:fs";

const checks = [];
const read = (filePath) => fs.readFileSync(filePath, "utf8");
const record = (label, passed) => checks.push({ label, passed });

const header = read("src/components/shared/page-header.tsx");
const statCard = read("src/components/shared/stat-card.tsx");
const css = read("src/app/globals.css");
const dashboard = read("src/app/admin/page.tsx");
const layout = read("src/components/layouts/admin-layout.tsx");
const reservations = read("src/app/admin/reservations/page.tsx");
const notifications = read("src/app/admin/notifications/page.tsx");
const messages = read("src/app/admin/messages/page.tsx");
const messagesClient = read("src/app/admin/messages/client.tsx");
const subjectsClient = read("src/app/admin/matieres/client.tsx");
const levelsClient = read("src/app/admin/niveaux/client.tsx");
const teamClient = read("src/app/admin/equipe/team-client.tsx");
const rootPagePaths = [
  "src/app/admin/page.tsx",
  "src/app/admin/avis/page.tsx",
  "src/app/admin/centre-operationnel/page.tsx",
  "src/app/admin/clients/page.tsx",
  "src/app/admin/communes/page.tsx",
  "src/app/admin/equipe/page.tsx",
  "src/app/admin/fonds-bloques/page.tsx",
  "src/app/admin/litiges/page.tsx",
  "src/app/admin/matieres/page.tsx",
  "src/app/admin/messages/page.tsx",
  "src/app/admin/mon-compte/page.tsx",
  "src/app/admin/niveaux/page.tsx",
  "src/app/admin/notifications/page.tsx",
  "src/app/admin/paiements/page.tsx",
  "src/app/admin/paiements-a-liberer/page.tsx",
  "src/app/admin/parametres/page.tsx",
  "src/app/admin/professeurs/page.tsx",
  "src/app/admin/professeurs-a-payer/page.tsx",
  "src/app/admin/remboursements/page.tsx",
  "src/app/admin/reservations/page.tsx",
  "src/app/admin/suivi-professeurs/page.tsx",
];
const detailPagePaths = [
  "src/app/admin/clients/[id]/page.tsx",
  "src/app/admin/litiges/[id]/page.tsx",
  "src/app/admin/professeurs/[id]/page.tsx",
  "src/app/admin/professeurs/[id]/modifier/page.tsx",
  "src/app/admin/professeurs/nouveau/page.tsx",
  "src/app/admin/reservations/[id]/page.tsx",
];

record(
  "Every main admin tab opts into root page semantics",
  rootPagePaths.every((filePath) => /<PageHeader[\s\S]*?rootPage/.test(read(filePath))),
);

record(
  "Admin root pages suppress Back while operational detail pages retain it",
  /const shouldShowBack = showBack \?\? !rootPage;/.test(header)
    && /data-admin-root-header=\{rootPage \? "true" : "false"\}/.test(header)
    && detailPagePaths.every((filePath) => /<PageHeader/.test(read(filePath)) && !/rootPage/.test(read(filePath))),
);

record(
  "Admin root descriptions collapse on narrow mobile screens",
  /data-admin-page-description/.test(header)
    && /@media \(max-width: 639px\)[\s\S]*?\[data-admin-root-header="true"\][\s\S]*?\[data-admin-page-description\][\s\S]*?display: none !important/.test(css),
);

record(
  "Admin statistic collections become two balanced columns on mobile",
  /data-admin-stat-card/.test(statCard)
    && /\.admin-shell \.grid:has\(> \[data-admin-stat-card\]\)[\s\S]*?grid-template-columns: repeat\(2, minmax\(0, 1fr\)\) !important/.test(css)
    && /last-child:nth-child\(odd\)[\s\S]*?grid-column: 1 \/ -1/.test(css),
);

record(
  "Admin statistics remain legible on 320px-class devices",
  /data-admin-stat-label/.test(statCard)
    && /data-admin-stat-value/.test(statCard)
    && /@media \(max-width: 359px\)[\s\S]*?\[data-admin-stat-icon\],[\s\S]*?\[data-admin-stat-trend\][\s\S]*?display: none !important/.test(css),
);

record(
  "Admin dashboard opens with one app hero and no card wall",
  /data-admin-dashboard-priority/.test(dashboard)
    && /data-admin-dashboard-app-hero/.test(dashboard)
    && /rounded-\[1\.35rem\]/.test(dashboard)
    && /text-2xl font-black leading-\[1\.05\]/.test(dashboard)
    && !/description="Une priorité\. Tous les montants\."/.test(dashboard)
    && !/Tout voir|Une seule réservation à la fois/.test(dashboard)
    && !/RevenueAreaChart|StatCard|ControlSpaceCard|FinancialOverview/.test(dashboard)
    && /db\.booking\.findFirst/.test(dashboard)
    && !/Dernières réservations payées|Notifications non lues|Espace professeur opérationnel complet/.test(dashboard),
);

record(
  "Admin dashboard keeps critical amounts visible behind the finance permission",
  /\{canViewFinance\s*&&\s*\([\s\S]*?aria-labelledby="admin-finance-title"/.test(dashboard)
    && (dashboard.match(/<AdminAmount /g) ?? []).length === 4
    && (dashboard.match(/<FinanceRow /g) ?? []).length === 8
    && /href="\/admin\/paiements"[\s\S]*?Tableau complet/.test(dashboard),
);

record(
  "Admin navigation exposes essentials first and progressively reveals secondary tools",
  /title: "Essentiel"[\s\S]*?label: "Accueil"[\s\S]*?label: "Opérations"[\s\S]*?label: "Réservations"/.test(layout)
    && /title: "Personnes"[\s\S]*?label: "Professeurs"[\s\S]*?label: "Clients"/.test(layout)
    && /title: "Argent & support"[\s\S]*?label: "Finances"[\s\S]*?label: "Messages"[\s\S]*?label: "Réglages"[\s\S]*?label: "Mon compte"/.test(layout)
    && /const secondaryNavItems:[\s\S]*?<details open=\{secondaryActive \|\| undefined\}[\s\S]*?<span className="flex-1">Plus<\/span>/.test(layout)
    && /secondaryNavItems\.filter\(\(item\) => hasAdminPermission\(permissions, item\.permission\)\)/.test(layout),
);

record(
  "Admin mobile app exposes four thumb-reachable essentials without covering content",
  /const mobileNavPriorityHrefs = \[[\s\S]*?"\/admin"[\s\S]*?"\/admin\/centre-operationnel"[\s\S]*?"\/admin\/reservations"[\s\S]*?"\/admin\/paiements"/.test(layout)
    && /return \[\.\.\.priorityItems, \.\.\.fallbackItems\]\.slice\(0, 4\)/.test(layout)
    && /data-admin-mobile-nav/.test(layout)
    && /data-admin-mobile-item/.test(layout)
    && /className="admin-main-with-mobile-nav/.test(layout)
    && /\.admin-shell main\.admin-main-with-mobile-nav\s*\{[\s\S]*?padding-bottom:\s*calc\(8\.25rem \+ env\(safe-area-inset-bottom\)\)\s*!important;[\s\S]*?\}/.test(css)
    && /\.admin-shell \[data-admin-mobile-nav\][^{]*\{[\s\S]*?bottom:\s*0\s*!important;[\s\S]*?left:\s*0\s*!important;[\s\S]*?right:\s*0\s*!important;[\s\S]*?width:\s*100%\s*!important;[\s\S]*?\}/.test(css)
    && /\.admin-shell \[data-admin-mobile-nav\] > div[^{]*\{[\s\S]*?max-width:\s*28rem;[\s\S]*?margin-inline:\s*auto;[\s\S]*?\}/.test(css),
);

record(
  "Admin reservation mobile cards expose one decision and fold secondary dossier details",
  /data-admin-reservation-mobile-card/.test(reservations)
    && /data-admin-reservation-decision/.test(reservations)
    && /data-admin-reservation-snapshot/.test(reservations)
    && /data-admin-reservation-secondary/.test(reservations)
    && /Infos dossier/.test(reservations)
    && /data-admin-reservation-compact-actions/.test(reservations)
    && /Calcul à reprendre/.test(reservations)
    && !/space-y-2 rounded-lg border border-blue-100 bg-blue-50\/70 p-3/.test(reservations),
);

record(
  "Admin notifications open as one priority screen and fold operational history",
  /data-admin-notification-priority/.test(notifications)
    && /À traiter maintenant/.test(notifications)
    && /data-admin-notification-mini/.test(notifications)
    && /data-admin-notification-campaign-composer/.test(notifications)
    && /data-admin-notification-campaigns/.test(notifications)
    && /data-admin-notification-radar-details/.test(notifications)
    && /data-admin-notification-live-list/.test(notifications)
    && /open=\{Boolean\(filter\)\}/.test(notifications)
    && /data-admin-notification-history-table/.test(notifications)
    && /Tableau d’audit disponible sans occuper l’écran principal/.test(notifications)
    && !/AdminUrgentAlertCard/.test(notifications)
    && !/Radar opérationnel des notifications/.test(notifications),
);

record(
  "Admin messages open on one support priority and fold every history stream",
  /data-admin-message-priority/.test(messages)
    && /const primaryTeacherMessage = teacherAdminMessages\.find/.test(messages)
    && /const primaryContactMessage = messages\.find/.test(messages)
    && /À traiter maintenant/.test(messages)
    && /data-admin-message-contact-history/.test(messages)
    && /data-admin-message-teacher-history/.test(messages)
    && /data-admin-message-client-history/.test(messages)
    && /Les autres échanges restent accessibles dans les historiques ci-dessous\./.test(messages)
    && /data-admin-message-filter/.test(messagesClient)
    && /À traiter/.test(messagesClient)
    && !/toast\.success/.test(messagesClient),
);

record(
  "Admin catalogs confirm routine saves inline instead of floating success toasts",
  /data-admin-catalog-inline-status/.test(subjectsClient)
    && /data-admin-catalog-inline-status/.test(levelsClient)
    && /confirmDeleteOpen/.test(subjectsClient)
    && /confirmDeleteOpen/.test(levelsClient)
    && /onClick=\{\(\) => setConfirmDeleteOpen\(true\)\}/.test(subjectsClient)
    && /onClick=\{\(\) => setConfirmDeleteOpen\(true\)\}/.test(levelsClient)
    && /setNotice\(subject \? "Matière modifiée\." : "Matière créée\."\)/.test(subjectsClient)
    && /setNotice\(`\$\{data\.imported\} matière\(s\) importée\(s\), \$\{data\.skipped\} déjà présente\(s\)\.`\)/.test(subjectsClient)
    && /setNotice\(level \? "Niveau modifié\." : "Niveau créé\."\)/.test(levelsClient)
    && !/toast\.success\(subject \?/.test(subjectsClient)
    && !/toast\.success\(`\$\{data\.imported\}/.test(subjectsClient)
    && !/toast\.success\(level \?/.test(levelsClient),
);

record(
  "Admin team confirms routine access changes inline instead of floating toasts",
  /const \[createStatus, setCreateStatus\] = useState<TeamInlineStatus>\(null\)/.test(teamClient)
    && /const \[statusMessage, setStatusMessage\] = useState<TeamInlineStatus>\(null\)/.test(teamClient)
    && /function TeamInlineStatusBanner/.test(teamClient)
    && /data-admin-team-inline-status=\{status\.tone\}/.test(teamClient)
    && /role=\{status\.tone === "error" \? "alert" : "status"\}/.test(teamClient)
    && /Administrateur ajouté\. Transmettez le mot de passe par canal sécurisé\./.test(teamClient)
    && /Mot de passe remplacé\. Email Compétence pris en charge automatiquement\./.test(teamClient)
    && /Accès retiré\. Historique conservé\./.test(teamClient)
    && !/toast\./.test(teamClient),
);

const failed = checks.filter((check) => !check.passed);
for (const check of checks) {
  console.log(`${check.passed ? "PASS" : "FAIL"}: ${check.label}`);
}

if (failed.length > 0) {
  console.error(`\n${failed.length} admin mobile verification check(s) failed.`);
  process.exit(1);
}

console.log(`\nAdmin mobile verification passed (${checks.length} checks).`);
