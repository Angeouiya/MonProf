import fs from "node:fs";

const checks = [];
const read = (filePath) => fs.readFileSync(filePath, "utf8");
const record = (label, passed) => checks.push({ label, passed });

const ui = read("src/components/professor/professor-ui.tsx");
const css = read("src/app/globals.css");
const availability = read("src/components/professor/teacher-availability-editor.tsx");
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
  "Professor statistics use a reusable two-column mobile grid",
  /export function ProfessorStatGrid/.test(ui)
    && /grid grid-cols-2 gap-2 min-\[680px\]:gap-3/.test(ui)
    && rootTabs.filter((source) => /<ProfessorStatGrid/.test(source)).length === 4,
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

const failed = checks.filter((check) => !check.passed);
for (const check of checks) {
  console.log(`${check.passed ? "PASS" : "FAIL"}: ${check.label}`);
}

if (failed.length > 0) {
  console.error(`\n${failed.length} professor mobile verification check(s) failed.`);
  process.exit(1);
}

console.log(`\nProfessor mobile verification passed (${checks.length} checks).`);
