import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { marketplaceCommission, marketplaceCourseAmount, parseMarketplaceSlot, rankMarketplaceTeacher, walletAvailable, isWithinStartWindow } from "../src/lib/marketplace-core";
import { scheduleSlotsConflict } from "../src/lib/schedule-conflict-core";

function source(path: string) { return readFileSync(path, "utf8"); }
function rejects(fn: () => unknown) { assert.throws(fn); }

assert.equal(marketplaceCourseAmount("ivoirien", "CP1"), 15_000);
assert.equal(marketplaceCourseAmount("francais", "Terminale"), 75_000);
assert.equal(marketplaceCourseAmount("professionnel", "Formation adulte"), 40_000);
assert.equal(marketplaceCommission(40_000), 12_000);
assert.equal(walletAvailable(20_000, 8_000), 12_000);
rejects(() => walletAvailable(8_000, 9_000));
assert.ok(rankMarketplaceTeacher({ sameQuartier: true, sameCommune: true, rating: 2, ratingCount: 1, featured: false })
  > rankMarketplaceTeacher({ sameQuartier: false, sameCommune: true, rating: 5, ratingCount: 30, featured: true }));

const now = new Date("2026-11-02T08:00:00.000Z");
const slot = parseMarketplaceSlot("2026-11-03", "18:00", 120, now);
assert.equal(slot.durationMinutes, 120);
rejects(() => parseMarketplaceSlot("2026-11-03", "21:30", 120, now));
rejects(() => parseMarketplaceSlot("2026-11-03", "18:15", 60, now));
rejects(() => parseMarketplaceSlot("2026-11-02", "08:00", 60, now));
assert.equal(isWithinStartWindow(new Date("2026-11-03T18:00:00.000Z"), new Date("2026-11-03T17:50:00.000Z")), true);
assert.equal(isWithinStartWindow(new Date("2026-11-03T18:00:00.000Z"), new Date("2026-11-03T19:00:00.000Z")), false);

const occupied = { ...slot, courseFormat: "HOME", commune: "Cocody", quartier: "Angré" };
assert.equal(scheduleSlotsConflict({ ...slot, scheduledTime: "19:00", durationMinutes: 60, courseFormat: "HOME", commune: "Cocody", quartier: "Angré" }, occupied)?.kind, "OVERLAP");
assert.equal(scheduleSlotsConflict({ ...slot, scheduledTime: "17:00", durationMinutes: 60, courseFormat: "HOME", commune: "Cocody", quartier: "Angré" }, occupied)?.kind, "TRAVEL_BUFFER");
assert.equal(scheduleSlotsConflict({ ...slot, scheduledTime: "16:00", durationMinutes: 60, courseFormat: "HOME", commune: "Cocody", quartier: "Angré" }, occupied), null);

const missions = source("src/lib/marketplace-missions.ts");
const wallet = source("src/lib/marketplace-wallet.ts");
const search = source("src/lib/marketplace-search.ts");
const webhook = source("src/app/api/webhooks/jeko/route.ts");
const migration = source("prisma/migrations/20261102090000_marketplace_missions_wallet/migration.sql");
const sharedSchedule = source("src/lib/teacher-schedule-conflicts.ts");
const sweep = source("src/lib/jeko-reconciliation-sweeper.ts");
assert.match(search, /wallet: \{ is: \{ available: \{ gte: commissionAmount \} \} \}/);
assert.match(search, /photoUrl: \{ not: null \}/);
assert.match(search, /scheduleSlotsConflict\(requestSlot, request\)/);
assert.match(search, /paymentProvider: "PAYDUNYA"/);
assert.match(sharedSchedule, /client\.marketplaceRequest\.findMany/);
assert.match(sharedSchedule, /paydunyaVerifiedAt: \{ not: null \}/);
assert.match(missions, /await lockTeacherSchedule\(tx, teacherId\)/);
assert.match(missions, /await assertTeacherScheduleAvailable\(tx/);
assert.match(missions, /idempotencyKey: `marketplace-commission:\$\{requestId\}`/);
assert.match(missions, /clientId_clientKey/);
assert.match(missions, /startCodeAttempts >= 5/);
assert.match(missions, /cancelAcceptedMarketplaceOffer/);
assert.match(wallet, /confirmation\.storeId === config\.storeId/);
assert.match(wallet, /transaction\?\.id === incoming\.id/);
assert.match(wallet, /idempotencyKey: `jeko-wallet-topup:\$\{current\.id\}`/);
assert.match(wallet, /verifyTeacherWalletTopUpByProvider/);
assert.match(sweep, /claimTeacherWalletTopUpCandidates/);
assert.match(sweep, /runLimited\(walletJobs, 2\)/);
assert.match(webhook, /reconcileTeacherWalletTopUp/);
assert.match(migration, /"available" \+ "reserved" = "balance"/);
assert.match(migration, /MarketplaceReview_requestId_key/);
assert.match(migration, /MarketplaceRequest_clientId_clientKey_key/);
console.log("Marketplace V2 : règles, conflits, ledger et branchement webhook vérifiés.");
