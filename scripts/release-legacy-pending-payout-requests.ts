import path from "node:path";
import fs from "node:fs";
import { createJiti } from "jiti";

loadDatabaseUrl();
if (!process.env.DATABASE_URL) {
  console.log("DATABASE_URL absent localement : dry-run DB ignoré. Exécuter cette commande dans l'environnement Production/Vercel pour auditer ou appliquer la libération.");
  process.exit(0);
}

const jiti = createJiti(import.meta.url, {
  alias: {
    "@": path.resolve("src"),
    "server-only": path.resolve("scripts/server-only-shim.mjs"),
  },
});
const { db } = jiti("../src/lib/db.ts") as typeof import("../src/lib/db");
const { processJekoTeacherPayoutRecord } = jiti("../src/lib/jeko-payout-reconciliation.ts") as typeof import("../src/lib/jeko-payout-reconciliation");

const apply = process.argv.includes("--apply");
const verifyDrafts = !process.argv.includes("--skip-draft-verification");

type PendingLegacyRequest = {
  id: string;
  amount: number;
  payoutRecordId: string | null;
};

async function main() {
  console.log(apply
    ? "APPLY release legacy pending teacher payout requests"
    : "DRY-RUN release legacy pending teacher payout requests");

  const before = await getSnapshot();
  printSnapshot("before", before);

  if (!apply) {
    console.log("DRY-RUN only. Re-run with --apply to cancel blocking legacy PENDING requests.");
    return;
  }

  if (verifyDrafts && before.activeDraftRecords.length > 0) {
    console.log(`Verifying ${before.activeDraftRecords.length} active Jèko DRAFT payout record(s) before releasing legacy requests...`);
    for (const record of before.activeDraftRecords) {
      const result = await processJekoTeacherPayoutRecord(record.id);
      console.log(JSON.stringify({
        payoutRecordId: record.id,
        reference: record.reference,
        action: result.action,
        status: result.status,
        verified: result.verified,
      }));
    }
  }

  const refreshed = await getSnapshot();
  const staleRequests = [
    ...refreshed.pendingWithoutRecord,
    ...refreshed.pendingWithCancelledRecord,
  ];
  const staleIds = [...new Set(staleRequests.map((request) => request.id))];

  if (staleIds.length === 0) {
    console.log("No blocking legacy PENDING request to release.");
    printSnapshot("after", await getSnapshot());
    return;
  }

  const staleAmount = staleRequests.reduce((sum, request) => sum + Math.max(0, request.amount), 0);
  const now = new Date();
  await db.$transaction(async (tx) => {
    await tx.teacherPayoutRequest.updateMany({
      where: { id: { in: staleIds }, status: "PENDING" },
      data: {
        status: "CANCELLED",
        adminNote: "Ancien blocage libéré : les retraits professeurs sont désormais automatiques via Jèko. Aucun débit professeur n'a été appliqué.",
        reviewedAt: now,
        reviewedById: null,
      },
    });
    await tx.adminActionLog.create({
      data: {
        action: "Libération anciens retraits professeurs",
        entityType: "TeacherPayoutRequest",
        entityId: "legacy-pending-batch",
        detail: `${staleIds.length} ancienne(s) demande(s) PENDING annulée(s), ${staleAmount} FCFA rendus disponibles dans les wallets professeurs. Les DRAFT Jèko actifs ont été vérifiés avant libération.`,
        oldStatus: "PENDING",
        newStatus: "CANCELLED",
      },
    });
  }, { isolationLevel: "Serializable" });

  printSnapshot("after", await getSnapshot());
}

function loadDatabaseUrl() {
  if (process.env.DATABASE_URL) return;
  for (const file of [".env", ".env.local"]) {
    if (!fs.existsSync(file)) continue;
    const env = fs.readFileSync(file, "utf8");
    const row = env.split(/\r?\n/).find((line) => line.trim().startsWith("DATABASE_URL="));
    if (row) {
      process.env.DATABASE_URL = row.slice(row.indexOf("=") + 1).trim().replace(/^["']|["']$/g, "");
      return;
    }
  }
}

async function getSnapshot() {
  const [
    requestGroups,
    recordGroups,
    pendingWithoutRecord,
    pendingWithCancelledRecord,
    activeDraftRecords,
    paidRecordSummary,
  ] = await Promise.all([
    db.teacherPayoutRequest.groupBy({
      by: ["status"],
      _count: { _all: true },
      _sum: { amount: true },
    }),
    db.teacherPayoutRecord.groupBy({
      by: ["status", "provider"],
      _count: { _all: true },
      _sum: { amount: true, transferFeeCoveredByPlatform: true },
    }),
    db.teacherPayoutRequest.findMany({
      where: { status: "PENDING", payoutRecordId: null },
      select: { id: true, amount: true, payoutRecordId: true },
      orderBy: { createdAt: "asc" },
    }),
    db.teacherPayoutRequest.findMany({
      where: { status: "PENDING", payoutRecord: { status: "CANCELLED" } },
      select: { id: true, amount: true, payoutRecordId: true },
      orderBy: { createdAt: "asc" },
    }),
    db.teacherPayoutRecord.findMany({
      where: { provider: "JEKO", status: "DRAFT" },
      select: { id: true, reference: true, amount: true },
      orderBy: { createdAt: "asc" },
    }),
    db.teacherPayoutRecord.aggregate({
      where: { status: "PAID" },
      _count: { _all: true },
      _sum: { amount: true },
    }),
  ]);

  return {
    requestGroups,
    recordGroups,
    pendingWithoutRecord,
    pendingWithCancelledRecord,
    activeDraftRecords,
    paidRecordSummary,
  };
}

function printSnapshot(label: string, snapshot: Awaited<ReturnType<typeof getSnapshot>>) {
  const blockingRequests = [
    ...snapshot.pendingWithoutRecord,
    ...snapshot.pendingWithCancelledRecord,
  ];
  const blockingAmount = sumRequests(blockingRequests);
  console.log(JSON.stringify({
    label,
    requestGroups: snapshot.requestGroups,
    recordGroups: snapshot.recordGroups,
    blockingLegacyPending: {
      count: blockingRequests.length,
      amount: blockingAmount,
    },
    pendingWithoutRecord: summarizeRequests(snapshot.pendingWithoutRecord),
    pendingWithCancelledRecord: summarizeRequests(snapshot.pendingWithCancelledRecord),
    activeDraftJeko: {
      count: snapshot.activeDraftRecords.length,
      amount: snapshot.activeDraftRecords.reduce((sum, record) => sum + Math.max(0, record.amount), 0),
    },
    paidRecords: {
      count: snapshot.paidRecordSummary._count._all,
      amount: snapshot.paidRecordSummary._sum.amount ?? 0,
    },
  }, null, 2));
}

function summarizeRequests(requests: PendingLegacyRequest[]) {
  return {
    count: requests.length,
    amount: sumRequests(requests),
  };
}

function sumRequests(requests: PendingLegacyRequest[]) {
  return requests.reduce((sum, request) => sum + Math.max(0, request.amount), 0);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
