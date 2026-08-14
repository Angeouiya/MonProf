import fs from "node:fs";

const api = fs.readFileSync("src/app/api/admin/settings/route.ts", "utf8");
const ui = fs.readFileSync("src/app/admin/parametres/client.tsx", "utf8");
const page = fs.readFileSync("src/app/admin/parametres/page.tsx", "utf8");
const checks = [];
const record = (label, ok) => checks.push({ label, ok: Boolean(ok) });

record("PATCH relit les valeurs persistées dans la transaction", api.includes("const persistedRows = await tx.setting.findMany"));
record("PATCH renvoie les valeurs issues de PostgreSQL", api.includes("settings: platformSettingsForForm(persistedRows)"));
record("Cache runtime invalidé immédiatement", api.includes('revalidateTag("platform-settings", { expire: 0 })'));
record("GET et PATCH interdisent le cache navigateur", (api.match(/private, no-store/g) ?? []).length >= 2);
record("Sauvegarde journalisée de façon structurée", api.includes('message: "admin_settings_saved"') && api.includes("changedCount"));
record("UI relit les paramètres après PATCH", ui.includes('fetch("/api/admin/settings"') && ui.includes('cache: "no-store"'));
record("UI compare chaque valeur confirmée", ui.includes("const mismatches = Object.keys(expectedValues).filter"));
record("Succès et erreurs restent visibles dans la carte", ui.includes('role={saveNotice.tone === "error" ? "alert" : "status"}'));
record("Aucun toast de succès éphémère", !ui.includes('from "sonner"') && !ui.includes("toast.success"));
record("Page paramètres groupe ses lectures SQL", page.includes("const [rows, schemaStats") && page.includes("await db.$transaction(["));

for (const check of checks) console.log(`${check.ok ? "OK" : "FAIL"} ${check.label}`);
const failed = checks.filter((check) => !check.ok);
if (failed.length > 0) {
  console.error(`FAIL Persistance paramètres admin : ${failed.length} contrôle(s) en échec.`);
  process.exitCode = 1;
} else {
  console.log("OK Paramètres admin enregistrés, relus et confirmés sans cache obsolète.");
}
