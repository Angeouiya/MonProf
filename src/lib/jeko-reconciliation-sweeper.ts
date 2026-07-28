import "server-only";

import { Prisma } from "@prisma/client";
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
    claimJekoPaymentAttemptSweepCandidates({
      batchSize,
      staleBefore,
      claimedAt: startedAt,
    }),
    claimJekoPayoutSweepCandidates({
      batchSize,
      staleBefore,
      claimedAt: startedAt,
    }),
  ]);

  const attemptJobs: SweepJob[] = attempts.map((attempt) => ({
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
  }));
  const payoutJobs: SweepJob[] = payouts.map((payout) => ({
    id: payout.id,
    kind: "payout" as const,
    run: async () => {
      const result = await verifyJekoTeacherPayoutRecord(payout.id, { config });
      return {
        action: result.action,
        ok: !["rejected", "failed"].includes(result.action),
      };
    },
  }));

  // Les appels de paiement client et les retraits disposent chacun de workers
  // réservés. Ainsi, une série de tentatives lentes ne place jamais tous les
  // retraits en fin de file jusqu'au timeout du cron.
  const bothQueuesHaveJobs = attemptJobs.length > 0 && payoutJobs.length > 0;
  const attemptConcurrency = bothQueuesHaveJobs ? Math.ceil(CONCURRENCY / 2) : CONCURRENCY;
  const payoutConcurrency = bothQueuesHaveJobs ? Math.floor(CONCURRENCY / 2) : CONCURRENCY;
  const [attemptResults, payoutResults] = await Promise.all([
    runLimited(attemptJobs, attemptConcurrency),
    runLimited(payoutJobs, payoutConcurrency),
  ]);
  const results = [...attemptResults, ...payoutResults];
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

/**
 * Comme pour les retraits, le claim des tentatives doit précéder le réseau :
 * si Jèko lève une exception, lastCheckedAt reste avancé et les autres
 * tentatives dues peuvent entrer dans les lots suivants. Le verrouillage rend
 * aussi deux crons concurrents mutuellement exclusifs sur une même tentative.
 */
async function claimJekoPaymentAttemptSweepCandidates(input: {
  batchSize: number;
  staleBefore: Date;
  claimedAt: Date;
}) {
  return db.$queryRaw<Array<{ id: string; purpose: "BOOKING" | "RESCHEDULE_FEE" }>>(Prisma.sql`
    WITH "eligibleAttempts" AS (
      SELECT attempt."id"
      FROM "PaymentAttempt" AS attempt
      WHERE attempt."provider" = 'JEKO'::"PaymentProvider"
        AND attempt."purpose" IN (
          'BOOKING'::"PaymentAttemptPurpose",
          'RESCHEDULE_FEE'::"PaymentAttemptPurpose"
        )
        AND (
          attempt."status" = 'REQUESTING'::"PaymentAttemptStatus"
          OR (
            attempt."status" = 'PENDING'::"PaymentAttemptStatus"
            AND attempt."providerOrderId" IS NOT NULL
          )
          OR (
            attempt."status" = 'FAILED'::"PaymentAttemptStatus"
            AND attempt."providerOrderId" IS NOT NULL
            AND attempt."failureCode" IS DISTINCT FROM 'JEKO_PAYMENT_FAILED'
          )
        )
        AND COALESCE(attempt."lastCheckedAt", attempt."updatedAt") <= ${input.staleBefore}
      ORDER BY
        COALESCE(attempt."lastCheckedAt", attempt."updatedAt") ASC,
        attempt."createdAt" ASC,
        attempt."id" ASC
      FOR UPDATE SKIP LOCKED
      LIMIT ${input.batchSize}
    )
    UPDATE "PaymentAttempt" AS attempt
    SET "lastCheckedAt" = ${input.claimedAt}
    FROM "eligibleAttempts" AS candidate
    WHERE attempt."id" = candidate."id"
    RETURNING attempt."id", attempt."purpose"
  `);
}

/**
 * Réclame atomiquement les retraits dus avant tout appel réseau.
 *
 * COALESCE(lastCheckedAt, createdAt) forme une file FIFO des passages dus :
 * un DRAFT encore jamais vu ne reste pas derrière un ancien DRAFT pending,
 * et une reprise déjà contrôlée ne peut pas non plus être affamée par un
 * flux continu de nouveaux retraits. SKIP LOCKED empêche deux crons concurrents
 * de consommer les mêmes places du lot.
 */
async function claimJekoPayoutSweepCandidates(input: {
  batchSize: number;
  staleBefore: Date;
  claimedAt: Date;
}) {
  return db.$queryRaw<Array<{ id: string }>>(Prisma.sql`
    WITH "eligiblePayouts" AS (
      SELECT payout."id"
      FROM "TeacherPayoutRecord" AS payout
      WHERE payout."provider" = 'JEKO'::"PaymentProvider"
        AND payout."status" = 'DRAFT'::"TeacherPayoutRecordStatus"
        AND COALESCE(payout."lastCheckedAt", payout."createdAt") <= ${input.staleBefore}
      ORDER BY
        COALESCE(payout."lastCheckedAt", payout."createdAt") ASC,
        payout."createdAt" ASC,
        payout."id" ASC
      FOR UPDATE SKIP LOCKED
      LIMIT ${input.batchSize}
    )
    UPDATE "TeacherPayoutRecord" AS payout
    SET "lastCheckedAt" = ${input.claimedAt}
    FROM "eligiblePayouts" AS candidate
    WHERE payout."id" = candidate."id"
    RETURNING payout."id"
  `);
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
