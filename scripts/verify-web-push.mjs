import fs from "node:fs";
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();
const checks = [];
const record = (label, ok) => checks.push({ label, ok });

loadEnvFile(".env.local");
loadEnvFile(".env");

try {
  record("Service worker Web Push présent", fs.existsSync("public/sw.js"));
  record("Contrôle d'activation partagé présent", fs.existsSync("src/components/shared/web-push-control.tsx"));
  record("Pont temps réel partagé présent", fs.existsSync("src/components/shared/web-push-realtime.tsx"));
  const vapidSettings = await db.setting.findMany({
    where: { key: { in: ["web_push_vapid_public_key", "web_push_vapid_private_key"] } },
    select: { key: true, value: true },
  });
  const vapid = new Map(vapidSettings.map((row) => [row.key, row.value.trim()]));
  record("Clé VAPID publique configurée", Boolean(process.env.NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY || vapid.get("web_push_vapid_public_key")));
  record("Clé VAPID privée configurée", Boolean(process.env.WEB_PUSH_VAPID_PRIVATE_KEY || vapid.get("web_push_vapid_private_key")));

  const tables = await db.$queryRaw`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'competence'
      AND table_name IN ('WebPushSubscription', 'WebPushOutbox')
  `;
  record("Tables Web Push disponibles dans Supabase", tables.length === 2);

  const triggers = await db.$queryRaw`
    SELECT trigger_name
    FROM information_schema.triggers
    WHERE event_object_schema = 'competence'
      AND trigger_name IN ('notification_web_push_outbox', 'teacher_notification_web_push_outbox')
  `;
  record("Déclencheurs d'outbox installés", triggers.length === 2);

  const marker = `push-verification-${Date.now()}`;
  let triggerCaptured = false;
  try {
    await db.$transaction(async (tx) => {
      const notification = await tx.notification.create({
        data: {
          title: "Vérification Web Push",
          message: marker,
          type: "WEB_PUSH_VERIFICATION",
          recipientType: "ADMIN",
          priority: "NORMAL",
        },
      });
      triggerCaptured = Boolean(await tx.webPushOutbox.findUnique({
        where: { notificationId: notification.id },
        select: { id: true },
      }));
      throw new Error("ROLLBACK_WEB_PUSH_VERIFICATION");
    });
  } catch (error) {
    if (!(error instanceof Error) || error.message !== "ROLLBACK_WEB_PUSH_VERIFICATION") throw error;
  }
  record("Toute notification alimente automatiquement l'outbox", triggerCaptured);
} finally {
  await db.$disconnect();
}

for (const check of checks) console.log(`${check.ok ? "OK" : "FAIL"} ${check.label}`);
const failed = checks.filter((check) => !check.ok);
if (failed.length > 0) {
  console.error(`FAIL Web Push incomplet : ${failed.length} contrôle(s) en échec.`);
  process.exitCode = 1;
} else {
  console.log("OK Web Push client, professeur et administration vérifié.");
}

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separator = trimmed.indexOf("=");
    if (separator < 1) continue;
    const key = trimmed.slice(0, separator).trim();
    if (process.env[key]) continue;
    process.env[key] = trimmed.slice(separator + 1).trim().replace(/^["']|["']$/g, "");
  }
}
