import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const sweeper = readFileSync(
  new URL("../src/lib/jeko-reconciliation-sweeper.ts", import.meta.url),
  "utf8",
);
const schema = readFileSync(new URL("../prisma/schema.prisma", import.meta.url), "utf8");
const migration = readFileSync(
  new URL("../prisma/migrations/20260728090000_jeko_payout_sweep_fairness/migration.sql", import.meta.url),
  "utf8",
);
const repricing = readFileSync(
  new URL("./repair-unpaid-draft-pricing.ts", import.meta.url),
  "utf8",
);
const paymentProvider = readFileSync(
  new URL("../src/lib/payment-provider.ts", import.meta.url),
  "utf8",
);
const checkoutRoute = readFileSync(
  new URL("../src/app/api/bookings/[id]/jeko-payment/route.ts", import.meta.url),
  "utf8",
);
const bookingCreateRoute = readFileSync(
  new URL("../src/app/api/bookings/route.ts", import.meta.url),
  "utf8",
);

assert.match(schema, /model TeacherPayoutRecord[\s\S]*?lastCheckedAt\s+DateTime\?/);
assert.match(schema, /TeacherPayoutRecord_jeko_sweep_idx/);
assert.match(schema, /PaymentAttempt_jeko_sweep_idx/);
assert.match(migration, /ADD COLUMN "lastCheckedAt" TIMESTAMP\(3\)/);
assert.match(migration, /CREATE INDEX "TeacherPayoutRecord_jeko_sweep_idx"/);
assert.match(migration, /CREATE INDEX "PaymentAttempt_jeko_sweep_idx"/);
assert.match(migration, /CREATE INDEX "TeacherPayoutRecord_jeko_sweep_due_expr_idx"[\s\S]*?COALESCE\("lastCheckedAt", "createdAt"\)/);
assert.match(migration, /CREATE INDEX "PaymentAttempt_jeko_sweep_due_expr_idx"[\s\S]*?COALESCE\("lastCheckedAt", "updatedAt"\)/);

assert.ok(
  sweeper.includes('COALESCE(attempt."lastCheckedAt", attempt."updatedAt") <= ${input.staleBefore}'),
  "le sweeper doit ne r\u00e9clamer que les tentatives dues",
);
assert.ok(
  sweeper.includes('SET "lastCheckedAt" = ${input.claimedAt}'),
  "le claim doit avancer lastCheckedAt avant chaque appel r\u00e9seau",
);
assert.match(sweeper, /RETURNING attempt\."id", attempt\."purpose"/);
assert.match(sweeper, /attempt\."status" = 'REQUESTING'/);
assert.match(sweeper, /attempt\."status" = 'PENDING'/);
assert.match(sweeper, /attempt\."status" = 'FAILED'/);
assert.match(sweeper, /attempt\."providerOrderId" IS NOT NULL/);
assert.match(sweeper, /attempt\."failureCode" IS DISTINCT FROM 'JEKO_PAYMENT_FAILED'/);
assert.doesNotMatch(sweeper, /paymentAttempt\.findMany/);
assert.equal(
  sweeper.match(/FOR UPDATE SKIP LOCKED/g)?.length,
  2,
  "les tentatives et les retraits doivent tous deux être réclamés atomiquement",
);

assert.ok(
  sweeper.includes('COALESCE(payout."lastCheckedAt", payout."createdAt") <= ${input.staleBefore}'),
  "le sweeper doit ne r\u00e9clamer que les retraits dus",
);
assert.ok(
  sweeper.includes('COALESCE(payout."lastCheckedAt", payout."createdAt") ASC'),
  "la priorit\u00e9 doit combiner cr\u00e9ation initiale et dernier passage",
);
assert.ok(
  sweeper.includes('SET "lastCheckedAt" = ${input.claimedAt}'),
  "la r\u00e9clamation doit faire tourner la file avant l'appel J\u00e8ko",
);
assert.match(sweeper, /RETURNING payout\."id"/);
assert.doesNotMatch(
  sweeper,
  /teacherPayoutRecord\.findMany/,
  "une lecture non verrouill\u00e9e r\u00e9introduirait la concurrence entre crons",
);
assert.match(sweeper, /runLimited\(attemptJobs, attemptConcurrency\)/);
assert.match(sweeper, /runLimited\(payoutJobs, payoutConcurrency\)/);
assert.match(sweeper, /const \[attemptResults, payoutResults\] = await Promise\.all/);
assert.doesNotMatch(
  sweeper,
  /const jobs:[\s\S]*?\.\.\.attempts[\s\S]*?\.\.\.payouts/,
  "les retraits ne doivent jamais rester derri\u00e8re toute la file des paiements clients",
);

const now = new Date("2026-07-28T12:00:00.000Z");
const staleBefore = new Date(now.getTime() - 2 * 60 * 1000);
const candidates = [
  candidate("retry-old", 60, 40),
  candidate("new-old", 30, null),
  candidate("retry-recent", 50, 20),
  candidate("new-recent", 10, null),
];

assert.deepEqual(claimFairBatch(candidates, staleBefore, now, 2), ["retry-old", "new-old"]);
assert.deepEqual(
  claimFairBatch(candidates, new Date(now.getTime() + 8 * 60 * 1000), new Date(now.getTime() + 10 * 60 * 1000), 2),
  ["retry-recent", "new-recent"],
  "les premiers pending contr\u00f4l\u00e9s ne doivent pas monopoliser le lot suivant",
);

const activeAttemptFilter = repricing.match(
  /const reconcilableJekoAttemptWhere = \{[\s\S]*?\} satisfies Prisma\.PaymentAttemptWhereInput;/,
)?.[0] ?? "";
assert.match(activeAttemptFilter, /provider:\s*"JEKO"/);
assert.match(activeAttemptFilter, /status:\s*\{\s*in:\s*\["CREATED",\s*"REQUESTING",\s*"PENDING"\]\s*\}/);
assert.match(activeAttemptFilter, /status:\s*"FAILED",[\s\S]*?providerOrderId:\s*\{\s*not:\s*null\s*\}/);
assert.match(activeAttemptFilter, /failureCode:\s*\{\s*not:\s*"JEKO_PAYMENT_FAILED"\s*\}/);
assert.doesNotMatch(activeAttemptFilter, /SUCCEEDED|CANCELLED|EXPIRED|REJECTED/);
assert.match(repricing, /paymentAttempts:\s*\{\s*none:\s*reconcilableJekoAttemptWhere\s*\}/);
assert.match(repricing, /argument\.startsWith\("--reference="\)/);
assert.match(repricing, /\.\.\.\(targetReference \? \{ reference: targetReference \} : \{\}\)/);
assert.match(repricing, /buildNeighborhoodAliasMap\([\s\S]*?neighborhoodAliasRows\.map/);
assert.match(repricing, /where:\s*repriceableDraftWhere/);
assert.match(repricing, /db\.\$transaction\(async \(tx\)/);
assert.match(repricing, /tx\.booking\.updateMany\(\{[\s\S]*?where:\s*\{\s*id:\s*booking\.id,\s*updatedAt:\s*booking\.updatedAt,\s*\.\.\.repriceableDraftWhere\s*\}/);
assert.match(repricing, /if \(guardedUpdate\.count !== 1\) return false/);
assert.ok(
  repricing.indexOf("if (guardedUpdate.count !== 1) return false")
    < repricing.indexOf("await tx.notification.updateMany"),
  "aucun effet secondaire ne doit précéder la mutation gardée",
);

const bookingLockPattern = /SELECT "id"\s+FROM "Booking"\s+WHERE "id" = \$\{[^}]+\}\s+FOR UPDATE/;
assert.match(repricing, bookingLockPattern);
assert.match(paymentProvider, bookingLockPattern);

const repricingTransaction = sourceSlice(
  repricing,
  "const repriced = await db.$transaction(async (tx) => {",
  "if (!repriced) {",
);
assert.ok(
  repricingTransaction.indexOf("FOR UPDATE")
    < repricingTransaction.indexOf("tx.booking.updateMany"),
  "le repricing doit verrouiller Booking avant de réévaluer la garde",
);
assert.match(repricingTransaction, /\.\.\.repriceableDraftWhere/);
assert.match(repricingTransaction, /FROM "BookingSession"[\s\S]*?FOR UPDATE/);
assert.match(repricingTransaction, /session\.releasedAmount > 0[\s\S]*?session\.paidAmount > 0[\s\S]*?session\.retainedAmount > 0/);
assert.match(repricingTransaction, /bookingSession\.createMany\([\s\S]*?buildBookingSessionRows/);
assert.match(repricingTransaction, /bookingSession\.update\([\s\S]*?teacherNetAmount:\s*teacherCourseAmounts\[index\] \+ transportAmounts\[index\]/);

const checkoutPreparation = sourceSlice(
  paymentProvider,
  "const prepared = await db.$transaction(async (tx) => {",
  "let attempt = prepared.attempt;",
);
assert.ok(checkoutPreparation.indexOf("FOR UPDATE") < checkoutPreparation.indexOf("tx.booking.findUniqueOrThrow"));
assert.ok(checkoutPreparation.indexOf("tx.booking.findUniqueOrThrow") < checkoutPreparation.indexOf("tx.paymentAttempt.create"));
assert.match(checkoutPreparation, /amountXof !== input\.expectedAmountXof/);
assert.match(checkoutPreparation, /booking\.pricingSnapshot !== input\.expectedPricingSnapshot/);
assert.doesNotMatch(checkoutPreparation, /createJekoPaymentRequest|recoverJekoPaymentAttemptIdentity/);
assert.match(checkoutRoute, /expectedAmountXof:\s*booking\.totalClientPays/);
assert.match(checkoutRoute, /expectedPricingSnapshot:\s*booking\.pricingSnapshot/);
assert.match(bookingCreateRoute, /expectedAmountXof:\s*booking\.totalClientPays/);
assert.match(bookingCreateRoute, /expectedPricingSnapshot:\s*booking\.pricingSnapshot/);

console.log("J\u00e8ko sweep fairness and active-attempt repricing guards verified.");

function candidate(id, createdMinutesAgo, checkedMinutesAgo) {
  return {
    id,
    createdAt: new Date(now.getTime() - createdMinutesAgo * 60 * 1000),
    lastCheckedAt: checkedMinutesAgo === null
      ? null
      : new Date(now.getTime() - checkedMinutesAgo * 60 * 1000),
  };
}

function claimFairBatch(rows, dueBefore, claimedAt, batchSize) {
  const selected = rows
    .filter((row) => priorityAt(row) <= dueBefore)
    .sort((left, right) => (
      priorityAt(left).getTime() - priorityAt(right).getTime()
      || left.createdAt.getTime() - right.createdAt.getTime()
      || left.id.localeCompare(right.id)
    ))
    .slice(0, batchSize);
  for (const row of selected) row.lastCheckedAt = claimedAt;
  return selected.map((row) => row.id);
}

function priorityAt(row) {
  return row.lastCheckedAt ?? row.createdAt;
}

function sourceSlice(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start + startMarker.length);
  assert.notEqual(start, -1, `marqueur de début absent: ${startMarker}`);
  assert.notEqual(end, -1, `marqueur de fin absent: ${endMarker}`);
  return source.slice(start, end);
}
