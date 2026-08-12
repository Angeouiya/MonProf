import { readFileSync } from "node:fs";

const checks = [
  {
    label: "Client connected shell exposes CGU and privacy links on desktop and mobile drawer",
    file: "src/components/layouts/client-layout.tsx",
    patterns: [
      /data-client-connected-legal-links/,
      /href: "\/conditions-utilisation", label: "CGU"/,
      /href: "\/politique-confidentialite", label: "Confidentialité"/,
      /<SidebarContent userName=\{userName\} isActive=\{isActive\} notificationCount=\{notificationCount\} \/>/,
      /<SidebarContent userName=\{userName\} isActive=\{isActive\} notificationCount=\{notificationCount\} onNavigate=\{closeMobileSurfaces\} compactAccount \/>/,
    ],
  },
  {
    label: "Professor connected shell exposes CGU and privacy links on desktop and mobile drawer",
    file: "src/components/layouts/professor-layout.tsx",
    patterns: [
      /data-professor-connected-legal-links/,
      /href="\/conditions-utilisation"/,
      /href="\/politique-confidentialite"/,
      /<SidebarContent[\s\S]*?onNavigate=\{\(\) => setOpen\(false\)\}/,
    ],
  },
  {
    label: "Admin connected shell exposes CGU and privacy links on desktop and mobile drawer",
    file: "src/components/layouts/admin-layout.tsx",
    patterns: [
      /data-admin-connected-legal-links/,
      /href: "\/conditions-utilisation", label: "CGU"/,
      /href: "\/politique-confidentialite", label: "Confidentialité"/,
      /<SidebarContent userName=\{userName\} isActive=\{isActive\} notificationCount=\{summary\.total\} notificationSummary=\{summary\} permissions=\{permissions\} teamRole=\{teamRole\} \/>/,
      /<SidebarContent userName=\{userName\} isActive=\{isActive\} notificationCount=\{summary\.total\} notificationSummary=\{summary\} permissions=\{permissions\} teamRole=\{teamRole\} onNavigate=\{\(\) => setOpen\(false\)\} \/>/,
    ],
  },
];

const failures = [];

for (const check of checks) {
  const content = readFileSync(check.file, "utf8");
  for (const pattern of check.patterns) {
    if (!pattern.test(content)) {
      failures.push(`${check.label}: missing ${pattern}`);
    }
  }
}

if (failures.length > 0) {
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log("Connected legal links verification passed.");
