import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const checks = [];
const record = (label, ok) => checks.push({ label, ok: Boolean(ok) });
const read = (filePath) => fs.readFileSync(path.join(root, filePath), "utf8");
const exists = (filePath) => fs.existsSync(path.join(root, filePath));

const packageJson = JSON.parse(read("package.json"));
const prismaSchema = read("prisma/schema.prisma");
const webPush = read("src/lib/web-push.ts");
const queueLib = read("src/lib/web-push-queue.ts");
const queueRoute = read("src/app/api/queues/web-push/route.ts");
const cronRoute = read("src/app/api/cron/web-push/route.ts");
const subscriptionRoute = read("src/app/api/push/subscriptions/route.ts");
const realtime = read("src/components/shared/web-push-realtime.tsx");
const control = read("src/components/shared/web-push-control.tsx");
const webPushClient = read("src/lib/web-push-client.ts");
const serviceWorker = read("public/sw.js");
const cloudflareWorker = read("cloudflare-worker.ts");
const wranglerConfig = read("wrangler.jsonc");
const vercelJson = JSON.parse(read("vercel.json"));

record("Dépendance Vercel Queues installée", Boolean(packageJson.dependencies?.["@vercel/queue"]));
record("Script verify:push-scale déclaré", packageJson.scripts?.["verify:push-scale"] === "node scripts/verify-web-push-scale.mjs");
record("build:quality vérifie le mode push 100k", packageJson.scripts?.["build:quality"]?.includes("verify:push-scale"));

record("Modèle WebPushDelivery présent", /model\s+WebPushDelivery\s+\{/.test(prismaSchema));
record("Statuts livraison appareil présents", /enum\s+WebPushDeliveryStatus\s+\{[\s\S]*PENDING[\s\S]*PROCESSING[\s\S]*ACCEPTED[\s\S]*FAILED[\s\S]*EXPIRED[\s\S]*REVOKED/.test(prismaSchema));
record("Abonnements enrichis par appareil", [
  "deviceId",
  "platform",
  "browser",
  "os",
  "pwaInstalled",
  "supportsVibration",
  "supportsBadging",
  "lastSeenAt",
].every((field) => prismaSchema.includes(field)));
record("Migration WebPushDelivery créée", exists("prisma/migrations/20260813120000_web_push_scale_delivery/migration.sql"));
record(
  "Déclencheurs outbox versionnés dans une migration",
  exists("prisma/migrations/20260901190000_web_push_outbox_triggers/migration.sql")
    && read("prisma/migrations/20260901190000_web_push_outbox_triggers/migration.sql").includes("notification_web_push_outbox")
    && read("prisma/migrations/20260901190000_web_push_outbox_triggers/migration.sql").includes("teacher_notification_web_push_outbox"),
);

record("Outbox traitée par lots de 500", /MAX_BATCH_SIZE\s*=\s*500/.test(webPush) && /LIMIT\s+\$\{batchLimit\}/.test(webPush));
record("Priorité CRITICAL/URGENT avant NORMAL", webPush.includes("WHEN 'CRITICAL' THEN 1") && webPush.includes("WHEN 'URGENT' THEN 2"));
record("Livraisons suivies par abonnement", webPush.includes("db.webPushDelivery.upsert") && webPush.includes("outboxId_subscriptionId"));
record("Endpoints 404/410 révoqués automatiquement", webPush.includes("statusCode === 404 || statusCode === 410") && webPush.includes('enabled: false'));
record("Accepté provider n'est pas assimilé à lu", webPush.includes('status: "ACCEPTED"') && !webPush.includes("read: true"));
record("Retry PARTIAL sans redoubler ACCEPTED/REVOKED", webPush.includes("'PARTIAL'") && webPush.includes("alreadyFinalBySubscription"));

record("Topic queue web-push-events défini", queueLib.includes('WEB_PUSH_QUEUE_TOPIC = "web-push-events"'));
record("Publication queue avec idempotence", queueLib.includes("idempotencyKey") && queueLib.includes("DuplicateMessageError"));
record("Région Vercel Queue explicite hors Vercel", queueLib.includes('process.env.VERCEL_REGION || "lhr1"') && queueRoute.includes('process.env.VERCEL_REGION || "lhr1"'));
record("Worker queue privé avec retry", queueRoute.includes("handleCallback<WebPushQueueMessage>") && queueRoute.includes("visibilityTimeoutSeconds: 600") && queueRoute.includes("retry:"));
record("Cron secours chaque minute côté route", cronRoute.includes("publishWebPushFlushEvent(\"cron_recovery\"") && cronRoute.includes("flushWebPushOutbox(500)"));
record("Vercel Queues configuré dans vercel.json", JSON.stringify(vercelJson.functions || {}).includes("web-push-events"));
record("Cron Vercel /api/cron/web-push toutes les minutes", (vercelJson.crons || []).some((cron) => cron.path === "/api/cron/web-push" && cron.schedule === "* * * * *"));
record(
  "Cloudflare réveille la file après chaque mutation API",
  cloudflareWorker.includes("scheduleImmediateWebPushWake")
    && cloudflareWorker.includes('reason: "outbox_created"')
    && cloudflareWorker.includes("env.WEB_PUSH_QUEUE.send"),
);
record(
  "Cloudflare consomme les push en une seconde maximum",
  (wranglerConfig.match(/web-push-events[^\n]+max_batch_timeout\": 1/g) || []).length === 2,
);

record("API abonnement reçoit le suivi appareil", [
  "deviceId",
  "platform",
  "browser",
  "os",
  "pwaInstalled",
  "supportsVibration",
  "supportsBadging",
].every((field) => subscriptionRoute.includes(field)));
record(
  "Polling global supprimé pour 100k sessions",
  !realtime.includes("setInterval")
    && realtime.includes("COMPETENCE_PUSH_RECEIVED")
    && realtime.includes("visibilitychange")
    && realtime.includes('window.addEventListener("focus"'),
);
record("Contrôle push compact avec test appareil", control.includes("data-web-push-control") && control.includes("Tester sur cet appareil"));
record("Guide installation PWA retiré du bandeau", !control.includes("data-pwa-install-guide") && !control.includes("Installer l’application Compétence"));
record("Client envoie capacités appareil", control.includes("buildSubscriptionPayload") && webPushClient.includes("supportsVibration") && webPushClient.includes("supportsBadging"));
record(
  "Abonnements VAPID anciens sont remplacés automatiquement",
  webPushClient.includes("ensureCurrentPushSubscription")
    && webPushClient.includes("subscriptionUsesPublicKey")
    && realtime.includes("ensureCurrentPushSubscription")
    && control.includes("ensureCurrentPushSubscription"),
);
record(
  "Abonnement appareil resynchronisé au retour dans l'application",
  realtime.includes("synchronizePushSubscription")
    && realtime.includes("syncResponse.ok")
    && realtime.includes("onFocus")
    && realtime.includes('document.visibilityState === "visible"'),
);
record(
  "Interface activée uniquement après confirmation serveur",
  control.includes("syncResponse.ok")
    && control.includes("const current = await inspect()")
    && control.includes("current.status !== \"enabled\""),
);
record("Tuile monogramme Compétence disponible", exists("public/images/brand/competence-notification-monogram-tile-512.png"));
record("Badge monogramme transparent disponible", exists("public/images/brand/competence-notification-monogram-badge-192.png"));
record("Icône notification utilise le grand monogramme Compétence", serviceWorker.includes("competence-notification-monogram-tile-512.png?v=9"));
record("Badge système utilise le grand monogramme transparent", serviceWorker.includes("competence-notification-monogram-badge-192.png?v=9"));
record("Service Worker icône Compétence + badge + vibration", [
  "competence-notification-monogram-tile-512.png?v=9",
  "setAppBadge",
  "vibrate",
  "renotify",
  "silent",
  "skipWaiting",
  "clients.claim",
].every((needle) => serviceWorker.includes(needle)));
record("Les push ne sont jamais rendus silencieux par Compétence", webPush.includes("silent: false") && !webPush.includes('silent: !["URGENT", "CRITICAL"].includes'));
record("La santé production contrôle les déclencheurs d'outbox", read("src/app/api/health/route.ts").includes("webPushOutboxReady") && read("src/app/api/health/route.ts").includes("teacher_notification_web_push_outbox"));

record("Vue admin Santé notifications disponible", exists("src/app/admin/notifications/sante/page.tsx"));
record("API admin Santé notifications disponible", exists("src/app/api/admin/web-push-health/route.ts"));
record("Entrée métier unique enqueueNotificationEvent disponible", exists("src/lib/notification-events.ts") && read("src/lib/notification-events.ts").includes("enqueueNotificationEvent"));

for (const check of checks) {
  console.log(`${check.ok ? "OK" : "FAIL"} ${check.label}`);
}

const failed = checks.filter((check) => !check.ok);
if (failed.length > 0) {
  console.error(`FAIL Web Push scale incomplet : ${failed.length} contrôle(s) en échec.`);
  process.exitCode = 1;
} else {
  console.log("OK Web Push haute charge, PWA et observabilité vérifiés.");
}
