import fs from "node:fs";
import { PrismaClient } from "@prisma/client";

loadEnvFile(".env.local");
loadEnvFile(".env");

const values = {
  web_push_vapid_public_key: process.env.NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY?.trim() || "",
  web_push_vapid_private_key: process.env.WEB_PUSH_VAPID_PRIVATE_KEY?.trim() || "",
  web_push_subject: process.env.WEB_PUSH_SUBJECT?.trim() || "mailto:contact@competence.ci",
};

if (values.web_push_vapid_public_key.length < 64 || values.web_push_vapid_private_key.length < 32) {
  throw new Error("Clés VAPID locales absentes ou invalides.");
}

const db = new PrismaClient();
try {
  await db.$transaction(Object.entries(values).map(([key, value]) => db.setting.upsert({
    where: { key },
    create: { key, value },
    update: { value },
  })));
  console.log("Web Push : configuration VAPID enregistrée dans les paramètres privés Supabase (3/3).");
} finally {
  await db.$disconnect();
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
