import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { calculateBookingPricing } from "../src/lib/pricing";

loadLocalEnvironment();
const db = new PrismaClient();

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
  console.log(`OK ${message}`);
}

async function main() {
  const configured = calculateBookingPricing({
    category: "soutien_scolaire",
    levelName: "Collège",
    subjectName: "Mathématiques",
    deliveryMode: "domicile",
    packType: "SINGLE",
    teacherPricePerSession: 10_000,
    teacherCommune: "Cocody",
    teacherQuartier: "Riviera 2",
    clientCommune: "Cocody",
    clientQuartier: "Angré 8e tranche",
    platformCommissionPercent: 24,
    transportFeeAmounts: { sameCommune: 1_750, nearCommune: 2_750, farCommune: 4_750, interior: 8_750 },
  });
  assert(configured.platformCommissionRate === 0.24, "Dynamic commission is applied to new pricing snapshots");
  assert(configured.platformCommissionAmount === 2_400, "Dynamic commission amount is computed from the course amount");
  assert(configured.transportFee === 1_750, "Dynamic same-commune transport fee is applied");

  const sameQuarter = calculateBookingPricing({
    category: "soutien_scolaire",
    deliveryMode: "domicile",
    packType: "SINGLE",
    teacherPricePerSession: 10_000,
    teacherCommune: "Cocody",
    teacherQuartier: "Riviera 2",
    clientCommune: "Cocody",
    clientQuartier: "Riviera 2",
    clientCommuneTransportFeeOverride: 9_000,
  });
  assert(sameQuarter.transportFee === 0, "Exact same neighborhood always remains transport-free");

  const [commission, communes, quarters] = await Promise.all([
    db.setting.findUnique({ where: { key: "default_commission" } }),
    db.commune.count({ where: { isActive: true } }),
    db.communeQuarter.count({ where: { isActive: true } }),
  ]);
  assert(commission?.value === "30", "Production default commission is 30 percent");
  assert(communes >= 100, "Production has a broad Ivorian commune catalog");
  assert(quarters >= 400, "Production has a searchable neighborhood catalog");
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
