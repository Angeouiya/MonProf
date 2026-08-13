import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const checks = [];
const read = (filePath) => fs.readFileSync(path.join(root, filePath), "utf8");
const exists = (filePath) => fs.existsSync(path.join(root, filePath));
const record = (label, ok) => checks.push({ label, ok: Boolean(ok) });

const packageJson = JSON.parse(read("package.json"));
const prismaSchema = read("prisma/schema.prisma");
const campaignsLib = read("src/lib/communication-campaigns.ts");
const campaignsRoute = read("src/app/api/admin/communication-campaigns/route.ts");
const recipientsRoute = read("src/app/api/admin/communication-recipients/route.ts");
const composer = read("src/app/admin/notifications/campaign-composer.tsx");
const adminPage = read("src/app/admin/notifications/page.tsx");
const adminLayout = read("src/components/layouts/admin-layout.tsx");
const retentionRoute = read("src/app/api/cron/notification-retention/route.ts");
const vercelJson = JSON.parse(read("vercel.json"));

record("Script verify:communication-center déclaré", packageJson.scripts?.["verify:communication-center"] === "node scripts/verify-communication-center.mjs");
record("build:quality vérifie le centre communication", packageJson.scripts?.["build:quality"]?.includes("verify:communication-center"));

record("Page /admin/communication compatible", exists("src/app/admin/communication/page.tsx"));
record("Entrée admin renommée Communication", adminLayout.includes('href: "/admin/communication"') && adminLayout.includes('label: "Communication"'));
record("Composer sans préchargement 1000 utilisateurs", composer.includes("/api/admin/communication-recipients") && !composer.includes("clients:") && !composer.includes("teachers:"));
record("Recherche serveur clients/profs disponible", recipientsRoute.includes("communication-recipients") || recipientsRoute.includes("COMMUNICATIONS_SEND"));
record("Campagnes passent en SENDING", campaignsRoute.includes('status: "SENDING"') && campaignsRoute.includes("publishCommunicationCampaignEvent"));
record("Traitement par lots de 500", campaignsLib.includes("COMMUNICATION_CAMPAIGN_BATCH_SIZE = 500"));
record("Outbox Web Push créée pour clients", campaignsLib.includes("notificationId: notification.id") && campaignsLib.includes('recipientType: "CLIENT"'));
record("Outbox Web Push créée pour professeurs", campaignsLib.includes("teacherNotificationId: notification.id") && campaignsLib.includes('recipientType: "TEACHER"'));
record("Relance immédiate outbox après campagne", campaignsLib.includes("publishWebPushFlushEvent"));
record("Suppression campagne soft-delete", exists("src/app/api/admin/communication-campaigns/[id]/route.ts") && read("src/app/api/admin/communication-campaigns/[id]/route.ts").includes("deletedAt"));
record("Rétention 90 jours dans le modèle", prismaSchema.includes("deletedAt") && prismaSchema.includes("expiresAt") && campaignsLib.includes("COMMUNICATION_RETENTION_DAYS = 90"));
record("Cron rétention configuré", retentionRoute.includes("notification-retention") && (vercelJson.crons || []).some((cron) => cron.path === "/api/cron/notification-retention"));
record("Santé push expose test admin", exists("src/app/api/admin/web-push-test/route.ts") && read("src/app/admin/notifications/sante/actions-client.tsx").includes("Tester mon appareil"));
record("Activation push visible dashboards", [
  "src/app/client/page.tsx",
  "src/app/professeur/(espace)/page.tsx",
  "src/app/admin/page.tsx",
].every((filePath) => read(filePath).includes("WebPushControl")));
record("Notifications expirées filtrées admin", adminPage.includes("deletedAt: null") && adminPage.includes("expiresAt"));

for (const check of checks) {
  console.log(`${check.ok ? "OK" : "FAIL"} ${check.label}`);
}

const failed = checks.filter((check) => !check.ok);
if (failed.length > 0) {
  console.error(`FAIL Centre communication incomplet : ${failed.length} contrôle(s) en échec.`);
  process.exitCode = 1;
} else {
  console.log("OK Centre de communication, push appareil et rétention vérifiés.");
}
