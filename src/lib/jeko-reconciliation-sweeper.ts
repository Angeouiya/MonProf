import "server-only";

import { db } from "@/lib/db";
import { getJekoServerConfig } from "@/lib/jeko-config";
import { verifyJekoTeacherPayoutRecord } from "@/lib/jeko-payout-reconciliation";
import { reconcileJekoPaymentAttempt } from "@/lib/jeko-reconciliation";
import { reconcileJekoReschedulePaymentAttempt } from "@/lib/jeko-reschedule-reconciliation";

const DEFAULT_BATCH_SIZE = 20;
const MAX_BATCH_SIZE = 50;
const CONCURRENCY = 4;

type SweepItemResult = {
  id: string;
  kind: "booking" | "reschedule" | "payout";
  action: string;
  ok: boolean;
  error?: string;
};

type SweepJob = Pick<SweepItemResult, "id" | "kind"> & {
  run: () => Promise<Pick<SweepItemResult, "action" | "ok">>;
};

/**
 * Filet de sécurité serveur-à-serveur après les retries webhook Jèko.
 * Toutes les fonctions appelées possèdent leurs propres transitions
 * conditionnelles/idempotentes : deux exécutions concurrentes ne créditent ni
 * ne débitent donc le ledger deux fois.
 */
export async function runJekoReconciliationSweep(input: { batchSize?: number } = {}) {
  const config = getJekoServerConfig();
  if (!config) throw new Error("JEKO_NOT_CONFIGURED");

  const batchSize = Math.min(
    MAX_BATCH_SIZE,
    Math.max(1, Math.round(input.batchSize ?? DEFAULT_BATCH_SIZE)),
  );
  const staleBefore = new Date(Date.now() - 2 * 60 * 1000);
  const startedAt = new Date();

  const [attempts, payouts] = await Promise.all([
    db.paymentAttempt.findMany({
      where: {
        provider: "JEKO",
        purpose: { in: ["BOOKING", "RESCHEDULE_FEE"] },
        AND: [
          {
            OR: [
              // REQUESTING sans ID est précisément le cas d'un POST ambigu :
              // le rapprochement le recherche par référence, sans nouveau POST.
              { status: "REQUESTING" },
              { status: { in: ["PENDING", "FAILED"] }, providerOrderId: { not: null } },
            ],
          },
          {
            OR: [
              { lastCheckedAt: null, updatedAt: { lte: staleBefore } },
              { lastCheckedAt: { lte: staleBefore } },
            ],
          },
        ],
      },
      select: { id: true, purpose: true },
      orderBy: { updatedAt: "asc" },
      take: batchSize,
    }),
    db.teacherPayoutRecord.findMany({
      where: {
        provider: "JEKO",
        status: "DRAFT",
        createdAt: { lte: staleBefore },
      },
      select: { id: true },
      orderBy: { createdAt: "asc" },
      take: batchSize,
    }),
  ]);

  const jobs: SweepJob[] = [
    ...attempts.map((attempt) => ({
      id: attempt.id,
      kind: attempt.purpose === "RESCHEDULE_FEE" ? "reschedule" as const : "booking" as const,
      run: async () => {
        const result = attempt.purpose === "RESCHEDULE_FEE"
          ? await reconcileJekoReschedulePaymentAttempt(attempt.id, { config })
          : await reconcileJekoPaymentAttempt(attempt.id, { config });
        return {
          action: result.action,
          ok: !["rejected", "failed"].includes(result.action),
        };
      },
    })),
    ...payouts.map((payout) => ({
      id: payout.id,
      kind: "payout" as const,
      run: async () => {
        const result = await verifyJekoTeacherPayoutRecord(payout.id, { config });
        return {
          action: result.action,
          ok: !["rejected", "failed"].includes(result.action),
        };
      },
    })),
  ];

  const results = await runLimited(jobs, CONCURRENCY);
  const failures = results.filter((result) => !result.ok);
  return {
    ok: failures.length === 0,
    startedAt: startedAt.toISOString(),
    finishedAt: new Date().toISOString(),
    scanned: {
      paymentAttempts: attempts.length,
      payouts: payouts.length,
    },
    processed: results.length,
    succeeded: results.length - failures.length,
    failed: failures.length,
    actions: countActions(results),
    failures: failures.slice(0, 10),
  };
}

async function runLimited(
  jobs: SweepJob[],
  concurrency: number,
) {
  const results = new Array<SweepItemResult>(jobs.length);
  let cursor = 0;
  async function worker() {
    while (cursor < jobs.length) {
      const index = cursor++;
      const job = jobs[index];
      try {
        const outcome = await job.run();
        results[index] = { id: job.id, kind: job.kind, ...outcome };
      } catch (error) {
        const message = error instanceof Error ? error.message : "Erreur de rapprochement inconnue.";
        console.error("[jeko:reconciliation_sweep_item_failed]", { index, message });
        results[index] = {
          id: job.id,
          kind: job.kind,
          action: "exception",
          ok: false,
          error: message.slice(0, 300),
        };
      }
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(concurrency, jobs.length) }, () => worker()),
  );
  return results;
}

function countActions(results: SweepItemResult[]) {
  return results.reduce<Record<string, number>>((counts, result) => {
    counts[result.action] = (counts[result.action] ?? 0) + 1;
    return counts;
  }, {});
}
