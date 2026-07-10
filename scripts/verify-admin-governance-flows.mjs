import fs from "node:fs";
import path from "node:path";
import { createJiti } from "jiti";
import { PrismaClient } from "@prisma/client";

function loadDatabaseUrl() {
  if (process.env.DATABASE_URL || !fs.existsSync(".env")) return;
  const env = fs.readFileSync(".env", "utf8");
  const row = env.split(/\r?\n/).find((line) => line.trim().startsWith("DATABASE_URL="));
  if (row) process.env.DATABASE_URL = row.slice(row.indexOf("=") + 1).trim().replace(/^["']|["']$/g, "");
}

loadDatabaseUrl();
const jiti = createJiti(import.meta.url, { alias: { "@": path.resolve("src") } });
const { getTeacherFinancialSettlement } = jiti("../src/lib/teacher-payments.ts");
const { ADMIN_ROLE_PERMISSIONS } = jiti("../src/lib/admin-permissions.ts");

const before = getTeacherFinancialSettlement({
  id: "verification",
  status: "VALIDATED_BY_CLIENT",
  teacherNetAmount: 12_000,
  teacherPaidAmount: 3_500,
  paymentStatus: "TO_PAY_TEACHER",
});
const after = getTeacherFinancialSettlement({
  id: "verification",
  status: "VALIDATED_BY_CLIENT",
  teacherNetAmount: 12_000,
  teacherPaidAmount: 4_500,
  paymentStatus: "TO_PAY_TEACHER",
});

const errors = [];
const payoutRouteSource = fs.readFileSync("src/app/api/admin/teacher-payouts/route.ts", "utf8");
if (before.remaining !== 8_500 || after.remaining !== 7_500 || before.remaining - after.remaining !== 1_000) {
  errors.push("Un versement de 1 000 FCFA ne débite pas exactement 1 000 FCFA du reste professeur.");
}
if (!ADMIN_ROLE_PERMISSIONS.FINANCE.includes("FINANCE_MANAGE")) errors.push("Le rôle Finance ne peut pas traiter les paiements.");
if (ADMIN_ROLE_PERMISSIONS.OBSERVER.includes("FINANCE_MANAGE")) errors.push("Le rôle Lecture seule peut modifier les paiements.");
if (ADMIN_ROLE_PERMISSIONS.SUPPORT.includes("TEAM_MANAGE")) errors.push("Le Service client peut gérer l'équipe admin.");
if (!payoutRouteSource.includes('isolationLevel: "Serializable"')) errors.push("Les paiements professeur ne sont pas isolés contre les validations simultanées.");
const verifiesLegacyBalance = payoutRouteSource.includes("teacherPaidAmount: item.paid");
const verifiesSessionBalance = payoutRouteSource.includes("paidAmount: item.session.paidAmount")
  && payoutRouteSource.includes("releasedAmount: item.session.releasedAmount")
  && payoutRouteSource.includes("PAYOUT_BALANCE_CHANGED");
if (!verifiesLegacyBalance || !verifiesSessionBalance) errors.push("Le débit professeur ne vérifie pas le solde précédent de la réservation et de la séance avant mise à jour.");
if (!payoutRouteSource.includes('status: "PENDING", payoutRecordId: null')) errors.push("Une demande de paiement peut être réutilisée après traitement.");

const prisma = new PrismaClient();
try {
  const [records, paidRequests, campaignCount, ownerCount] = await Promise.all([
    prisma.teacherPayoutRecord.findMany({ include: { allocations: true }, take: 500, orderBy: { createdAt: "desc" } }),
    prisma.teacherPayoutRequest.findMany({ where: { status: "PAID" }, include: { payoutRecord: true }, take: 500 }),
    prisma.communicationCampaign.count(),
    prisma.user.count({ where: { role: "ADMIN", adminTeamRole: "OWNER", adminAccountStatus: "ACTIVE", adminAccessEnabled: true } }),
  ]);
  for (const record of records) {
    const allocated = record.allocations.reduce((sum, allocation) => sum + allocation.amount, 0);
    if (record.allocations.length > 0 && allocated !== record.amount) {
      errors.push(`Le reçu ${record.reference} vaut ${record.amount} FCFA mais ses allocations totalisent ${allocated} FCFA.`);
    }
  }
  for (const request of paidRequests) {
    if (!request.payoutRecord) errors.push(`La demande payée ${request.reference} n'a pas de reçu.`);
    else if (request.payoutRecord.amount !== request.amount) errors.push(`La demande ${request.reference} et son reçu ont des montants différents.`);
  }
  if (ownerCount < 1) errors.push("Aucun compte propriétaire admin actif n'est configuré.");

  console.log(JSON.stringify({
    debitScenario: { before: before.remaining, payment: 1_000, after: after.remaining },
    auditedPayoutRecords: records.length,
    auditedPaidRequests: paidRequests.length,
    communicationCampaigns: campaignCount,
    activeOwners: ownerCount,
    errors,
  }, null, 2));
} finally {
  await prisma.$disconnect();
}

process.exitCode = errors.length ? 1 : 0;
