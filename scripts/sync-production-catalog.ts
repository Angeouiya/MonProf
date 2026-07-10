import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import {
  ABIDJAN_CITY,
  ABIDJAN_COMMUNES,
  COTE_DIVOIRE_CITY_OPTIONS,
  LOCATION_QUARTIERS,
} from "../src/lib/ivory-coast-locations";

loadLocalEnvironment();
const db = new PrismaClient();

const periUrban = new Set(["Alépé", "Azaguié", "Bonoua", "Dabou", "Grand-Bassam", "Jacqueville"]);
const grandAbidjan = new Set<string>([ABIDJAN_CITY, ...ABIDJAN_COMMUNES]);
const places = Array.from(new Set([
  ...COTE_DIVOIRE_CITY_OPTIONS,
  ...ABIDJAN_COMMUNES,
  ...Object.keys(LOCATION_QUARTIERS),
]));

const settingDefaults: Record<string, string> = {
  platform_name: "Compétence",
  support_phone: "+225 01 61 39 39 39",
  support_email: "contact@competence.ci",
  teacher_payout_min_hours: "1",
  teacher_payout_max_hours: "72",
  transport_same_commune_fee: "1000",
  transport_near_commune_fee: "2500",
  transport_far_commune_fee: "4500",
  transport_interior_fee: "8000",
  notification_cron_enabled: "true",
  notification_delivery_enabled: "true",
  notification_from_name: "Compétence",
};

async function main() {
  const currentCommission = await db.setting.findUnique({ where: { key: "default_commission" } });
  const previousCommission = Number(currentCommission?.value) || 30;
  for (const [key, value] of Object.entries(settingDefaults)) {
    await db.setting.upsert({ where: { key }, update: {}, create: { key, value } });
  }
  await db.setting.upsert({
    where: { key: "default_commission" },
    update: { value: "30" },
    create: { key: "default_commission", value: "30" },
  });
  if (previousCommission !== 30) {
    await db.teacher.updateMany({ where: { commissionRate: previousCommission }, data: { commissionRate: 30 } });
  }

  let quarterCount = 0;
  for (const name of places) {
    const transportClass = grandAbidjan.has(name)
      ? "GRAND_ABIDJAN"
      : periUrban.has(name) ? "PERI_URBAN" : "INTERIOR";
    const commune = await db.commune.upsert({
      where: { name },
      update: { slug: slug(name), transportClass, isActive: true },
      create: {
        name,
        slug: slug(name),
        zone: transportClass === "GRAND_ABIDJAN" ? "District autonome d'Abidjan" : null,
        transportClass,
        isActive: true,
      },
    });
    for (const quarterName of LOCATION_QUARTIERS[name] ?? []) {
      await db.communeQuarter.upsert({
        where: { communeId_name: { communeId: commune.id, name: quarterName } },
        update: { slug: slug(quarterName), isActive: true },
        create: { communeId: commune.id, name: quarterName, slug: slug(quarterName), isActive: true },
      });
      quarterCount += 1;
    }
  }

  const [communeCount, activeQuarterCount] = await Promise.all([
    db.commune.count({ where: { isActive: true } }),
    db.communeQuarter.count({ where: { isActive: true } }),
  ]);
  console.log(JSON.stringify({ ok: true, commission: 30, communes: communeCount, quarters: activeQuarterCount, catalogQuarterEntries: quarterCount }));
}

function slug(value: string) {
  return value.trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[’']/g, "-").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function loadLocalEnvironment() {
  if (process.env.DATABASE_URL) return;
  for (const filename of [".env.local", ".env"]) {
    const file = path.resolve(process.cwd(), filename);
    if (!fs.existsSync(file)) continue;
    for (const row of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
      const match = row.match(/^([A-Z0-9_]+)=(.*)$/);
      if (!match || process.env[match[1]]) continue;
      process.env[match[1]] = match[2].trim().replace(/^['"]|['"]$/g, "");
    }
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => db.$disconnect());
