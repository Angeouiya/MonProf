import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { marketplaceCommission, parseMarketplaceSlot, rankMarketplaceTeacher, walletAvailable, isWithinStartWindow } from "../src/lib/marketplace-core";
import {
  formatMarketplaceDuration,
  marketplaceCourseAmount,
  marketplacePreciseLevels,
  resolveMarketplaceLevelName,
} from "../src/lib/marketplace-pricing";
import { scheduleSlotsConflict } from "../src/lib/schedule-conflict-core";
import { calculateGrandAbidjanTransportFee } from "../src/lib/pricing";
import { isTeacherQualifiedForPreciseLevel, teacherNeedsPreciseLevelReview, teacherPreciseLevelOptions, validateTeacherPreciseLevels } from "../src/lib/teacher-precise-levels";

function source(path: string) { return readFileSync(path, "utf8"); }
function rejects(fn: () => unknown) { assert.throws(fn); }

const priceAnchors = [
  ["ivoirien", "CP1", "ONLINE", 5_000, 10_000],
  ["ivoirien", "CP1", "HOME", 7_000, 13_000],
  ["ivoirien", "CM2", "ONLINE", 5_500, 11_000],
  ["ivoirien", "CM2", "HOME", 7_500, 14_000],
  ["ivoirien", "3e", "ONLINE", 6_500, 13_000],
  ["ivoirien", "3e", "HOME", 8_500, 16_000],
  ["ivoirien", "Terminale", "ONLINE", 7_500, 15_000],
  ["ivoirien", "Terminale", "HOME", 9_500, 18_000],
  ["francais", "CP", "ONLINE", 6_000, 12_000],
  ["francais", "CP", "HOME", 8_000, 15_000],
  ["francais", "CM2", "ONLINE", 7_000, 14_000],
  ["francais", "CM2", "HOME", 9_000, 17_000],
  ["francais", "3e", "ONLINE", 8_000, 16_000],
  ["francais", "3e", "HOME", 10_000, 19_000],
  ["francais", "Terminale", "ONLINE", 10_000, 20_000],
  ["francais", "Terminale", "HOME", 12_000, 23_000],
  ["professionnel", "Formation adulte", "ONLINE", 20_000, 40_000],
  ["professionnel", "Formation adulte", "HOME", 20_000, 40_000],
] as const;
for (const [journey, level, format, oneHour, twoHours] of priceAnchors) {
  assert.equal(marketplaceCourseAmount(journey, level, format, 60), oneHour);
  assert.equal(marketplaceCourseAmount(journey, level, format, 120), twoHours);
  let previous = 0;
  for (let duration = 60; duration <= 360; duration += 5) {
    const amount = marketplaceCourseAmount(journey, level, format, duration);
    assert.ok(amount > previous, `${journey} ${level} ${format}: tarif non croissant à ${duration} min`);
    assert.equal(amount % 100, 0);
    previous = amount;
  }
}
const legacyCatalogLevels = [
  ["Maternelle", 13_000],
  ["CP - CE1", 13_000],
  ["CE2 - CM2", 14_000],
  ["Primaire", 14_000],
  ["CEPE", 14_000],
  ["Collège", 16_000],
  ["BEPC", 16_000],
  ["Lycée", 18_000],
  ["BAC", 18_000],
  ["2nde A", 16_000],
  ["1ère D", 16_000],
  ["Terminale D", 18_000],
] as const;
for (const [level, twoHoursHome] of legacyCatalogLevels) {
  assert.equal(marketplaceCourseAmount("ivoirien", level, "HOME", 120), twoHoursHome, level);
}
assert.equal(marketplaceCourseAmount("francais", "Première générale", "HOME", 120), 19_000);
assert.equal(marketplaceCourseAmount("francais", "Terminale technologique", "HOME", 120), 23_000);
rejects(() => marketplaceCourseAmount("ivoirien", "Niveau inconnu", "HOME", 60));
rejects(() => marketplaceCourseAmount("francais", "BTS", "HOME", 60));
assert.deepEqual(marketplacePreciseLevels("ivoirien", "CP - CE1"), ["CP1", "CP2", "CE1"]);
assert.deepEqual(marketplacePreciseLevels("francais", "CP - CE1"), ["CP", "CE1"]);
assert.deepEqual(marketplacePreciseLevels("ivoirien", "CE2 - CM2"), ["CE2", "CM1", "CM2"]);
assert.deepEqual(marketplacePreciseLevels("ivoirien", "CEPE"), ["CM2"]);
assert.deepEqual(marketplacePreciseLevels("francais", "CEPE"), []);
assert.deepEqual(marketplacePreciseLevels("ivoirien", "Collège"), ["6e", "5e", "4e", "3e"]);
assert.deepEqual(marketplacePreciseLevels("ivoirien", "BEPC"), ["3e"]);
assert.deepEqual(marketplacePreciseLevels("francais", "BEPC"), []);
assert.deepEqual(marketplacePreciseLevels("francais", "Première"), ["Première générale", "Première technologique"]);
assert.deepEqual(marketplacePreciseLevels("ivoirien", "Terminale"), ["Terminale A1", "Terminale A2", "Terminale C", "Terminale D", "Terminale E"]);
assert.deepEqual(marketplacePreciseLevels("francais", "BAC"), ["Terminale générale", "Terminale technologique"]);
assert.deepEqual(marketplacePreciseLevels("ivoirien", "Maternelle"), []);
assert.deepEqual(marketplacePreciseLevels("professionnel", "Formation professionnelle"), []);
assert.equal(resolveMarketplaceLevelName("ivoirien", "CE2 - CM2", "CM2"), "CM2");
assert.equal(marketplaceCourseAmount("ivoirien", resolveMarketplaceLevelName("ivoirien", "CE2 - CM2", "CE2"), "HOME", 120), 13_000);
assert.equal(marketplaceCourseAmount("ivoirien", resolveMarketplaceLevelName("ivoirien", "CE2 - CM2", "CM2"), "HOME", 120), 14_000);
assert.equal(resolveMarketplaceLevelName("professionnel", "Formation professionnelle", undefined), "Formation professionnelle");
rejects(() => resolveMarketplaceLevelName("ivoirien", "CE2 - CM2", "3e"));
rejects(() => resolveMarketplaceLevelName("ivoirien", "CE2 - CM2", undefined));
rejects(() => resolveMarketplaceLevelName("francais", "CEPE", "CM2"));
assert.equal(marketplaceCourseAmount("ivoirien", "CP1", "HOME", 75), 8_500);
assert.equal(marketplaceCourseAmount("ivoirien", "CP1", "HOME", 80), 9_000);
assert.equal(marketplaceCourseAmount("ivoirien", "CP1", "HOME", 95), 10_500);
assert.equal(marketplaceCourseAmount("ivoirien", "CP1", "HOME", 150), 16_000);
assert.equal(marketplaceCourseAmount("ivoirien", "CP1", "HOME", 180), 19_000);
assert.equal(marketplaceCourseAmount("ivoirien", "CM2", "HOME", 75), 9_200);
assert.equal(formatMarketplaceDuration(80), "1 h 20");
assert.equal(formatMarketplaceDuration(180), "3 h");
rejects(() => marketplaceCourseAmount("ivoirien", "CP1", "HOME", 61));
rejects(() => marketplaceCourseAmount("ivoirien", "CP1", "HOME", 365));
const selectedSchoolLevels = [{ name: "Primaire", order: 4 }, { name: "Collège", order: 13 }];
const selectedSchoolSubjects = [{ id: "math", name: "Mathématiques" }, { id: "english", name: "Anglais" }];
assert.ok(teacherPreciseLevelOptions("ivoirien", selectedSchoolLevels).includes("CP1"));
const schoolEligibility = { offersIvorianSystem: true, offersFrenchSystem: false, offersProfessionalTraining: false };
assert.deepEqual(validateTeacherPreciseLevels(
  [{ journey: "ivoirien", className: "CP1", subjectId: "math" }], schoolEligibility, selectedSchoolLevels, selectedSchoolSubjects,
  { requireForMarketplace: true },
), [{ journey: "ivoirien", className: "CP1", subjectId: "math" }]);
rejects(() => validateTeacherPreciseLevels([], schoolEligibility, selectedSchoolLevels, selectedSchoolSubjects, { requireForMarketplace: true }));
rejects(() => validateTeacherPreciseLevels(
  [{ journey: "francais", className: "CP", subjectId: "math" }], schoolEligibility, selectedSchoolLevels, selectedSchoolSubjects,
  { requireForMarketplace: true },
));
rejects(() => validateTeacherPreciseLevels(
  [{ journey: "ivoirien", className: "Terminale D", subjectId: "math" }], schoolEligibility, selectedSchoolLevels, selectedSchoolSubjects,
  { requireForMarketplace: true },
));
const explicitTeaching = [
  { journey: "ivoirien", className: "CP1", subjectId: "math" },
  { journey: "ivoirien", className: "3e", subjectId: "english" },
];
assert.equal(isTeacherQualifiedForPreciseLevel("ivoirien", "CP1", "math", explicitTeaching), true);
assert.equal(isTeacherQualifiedForPreciseLevel("ivoirien", "3e", "english", explicitTeaching), true);
assert.equal(isTeacherQualifiedForPreciseLevel("ivoirien", "3e", "math", explicitTeaching), false);
assert.equal(isTeacherQualifiedForPreciseLevel("ivoirien", "CP1", "english", explicitTeaching), false);
assert.equal(isTeacherQualifiedForPreciseLevel("francais", "CP", "math", explicitTeaching), false);
assert.equal(isTeacherQualifiedForPreciseLevel("ivoirien", "CP1", "math", []), false);
assert.equal(teacherNeedsPreciseLevelReview({
  ...schoolEligibility, portalAccessEnabled: true, status: "ACTIVE",
  preciseLevels: [],
}), true);
assert.equal(teacherNeedsPreciseLevelReview({
  ...schoolEligibility, portalAccessEnabled: true, status: "ACTIVE",
  preciseLevels: [{ journey: "ivoirien", className: "3e", subjectId: "english" }],
}), false);
assert.equal(teacherNeedsPreciseLevelReview({
  offersIvorianSystem: false, offersFrenchSystem: false, offersProfessionalTraining: true,
  portalAccessEnabled: true, status: "ACTIVE", preciseLevels: [],
}), false);
assert.equal(marketplaceCommission(40_000), 12_000);
assert.equal(marketplaceCommission(13_000), 3_900);
assert.equal(walletAvailable(20_000, 8_000), 12_000);
rejects(() => walletAvailable(8_000, 9_000));
assert.ok(rankMarketplaceTeacher({ sameQuartier: true, sameCommune: true, rating: 2, ratingCount: 1, featured: false })
  > rankMarketplaceTeacher({ sameQuartier: false, sameCommune: true, rating: 5, ratingCount: 30, featured: true }));

const now = new Date("2026-11-02T08:00:00.000Z");
const slot = parseMarketplaceSlot("2026-11-03", "18:00", 120, now);
assert.equal(slot.durationMinutes, 120);
assert.equal(parseMarketplaceSlot("2026-11-03", "18:00", 80, now).durationMinutes, 80);
assert.equal(parseMarketplaceSlot("2026-11-03", "08:00", 360, now).durationMinutes, 360);
rejects(() => parseMarketplaceSlot("2026-11-03", "21:30", 60, now));
rejects(() => parseMarketplaceSlot("2026-11-03", "18:00", 61, now));
rejects(() => parseMarketplaceSlot("2026-11-03", "18:00", 365, now));
rejects(() => parseMarketplaceSlot("2026-11-03", "18:15", 60, now));
rejects(() => parseMarketplaceSlot("2026-11-02", "08:00", 60, now));
assert.equal(isWithinStartWindow(new Date("2026-11-03T18:00:00.000Z"), new Date("2026-11-03T17:50:00.000Z")), true);
assert.equal(isWithinStartWindow(new Date("2026-11-03T18:00:00.000Z"), new Date("2026-11-03T19:00:00.000Z")), false);

const occupied = { ...slot, courseFormat: "HOME", commune: "Cocody", quartier: "Angré" };
assert.equal(scheduleSlotsConflict({ ...slot, scheduledTime: "19:00", durationMinutes: 60, courseFormat: "HOME", commune: "Cocody", quartier: "Angré" }, occupied)?.kind, "OVERLAP");
assert.equal(scheduleSlotsConflict({ ...slot, scheduledTime: "17:00", durationMinutes: 60, courseFormat: "HOME", commune: "Cocody", quartier: "Angré" }, occupied)?.kind, "TRAVEL_BUFFER");
assert.equal(scheduleSlotsConflict({ ...slot, scheduledTime: "16:00", durationMinutes: 60, courseFormat: "HOME", commune: "Cocody", quartier: "Angré" }, occupied), null);
assert.equal(scheduleSlotsConflict(
  { ...slot, scheduledTime: "16:00", durationMinutes: 60, courseFormat: "HOME", commune: "Cocody", quartier: "Angré" },
  occupied, { sameNeighborhood: 90 },
)?.kind, "TRAVEL_BUFFER");
assert.equal(calculateGrandAbidjanTransportFee({
  teacherCommune: "Cocody", teacherQuartier: "Angré", clientCommune: "Cocody", clientQuartier: "Riviera",
  transportFeeAmounts: { sameCommune: 1_700 },
}).amount, 1_700);
const occupiedEightyMinutes = { ...occupied, durationMinutes: 80 };
assert.equal(scheduleSlotsConflict({ ...occupied, scheduledTime: "19:00", durationMinutes: 60 }, occupiedEightyMinutes)?.kind, "OVERLAP");
assert.equal(scheduleSlotsConflict({ ...occupied, scheduledTime: "19:30", durationMinutes: 60 }, occupiedEightyMinutes)?.kind, "TRAVEL_BUFFER");
assert.equal(scheduleSlotsConflict({ ...occupied, scheduledTime: "20:00", durationMinutes: 60 }, occupiedEightyMinutes), null);

const missions = source("src/lib/marketplace-missions.ts");
const requestRoute = source("src/app/api/marketplace/requests/route.ts");
const clientSearch = source("src/components/marketplace/client-marketplace-search.tsx");
assert.match(clientSearch, /quotedTotalClientPrice: selectedTeacher\.totalClientPrice/);
assert.match(requestRoute, /quotedTotalClientPrice: body\.quotedTotalClientPrice/);
assert.match(missions, /Number\.isSafeInteger\(input\.quotedTotalClientPrice\)/);
assert.match(missions, /preferred\.totalClientPrice > input\.quotedTotalClientPrice/);
assert.match(missions, /Le prix de ce cours a changé[\s\S]*?, 409\)/);
assert.match(source("src/lib/marketplace-input.ts"), /resolveMarketplaceLevelName\(journey, level\.name, value\.preciseLevel\)/);
assert.doesNotMatch(source("src/lib/marketplace-pricing.ts"), /from ["']@\/lib\/pricing["']/);
const wallet = source("src/lib/marketplace-wallet.ts");
const search = source("src/lib/marketplace-search.ts");
const publicTariffs = source("src/app/tarifs/page.tsx");
const webhook = source("src/app/api/webhooks/jeko/route.ts");
const migration = source("prisma/migrations/20261102090000_marketplace_missions_wallet/migration.sql");
const sharedSchedule = source("src/lib/teacher-schedule-conflicts.ts");
const sweep = source("src/lib/jeko-reconciliation-sweeper.ts");
assert.match(search, /wallet: \{ is: \{ available: \{ gte: commissionAmount \} \} \}/);
assert.match(search, /isTeacherQualifiedForPreciseLevel/);
assert.match(missions, /isTeacherQualifiedForPreciseLevel/);
assert.match(search, /journey: input\.journey, className: input\.levelName, subjectId: input\.subjectId/);
assert.match(search, /getPlatformRuntimeSettings\(\)/);
assert.match(search, /scheduleSlotsConflict\(requestSlot, request, settings\.scheduleBuffers\)/);
assert.match(search, /transportFeeAmounts: settings\.transportFees/);
assert.match(missions, /request\.subjectId, teacher\.preciseLevels/);
assert.equal((missions.match(/teacher\.portalPasswordMustChange/g) ?? []).length, 2);
assert.match(source("src/app/api/admin/teachers/route.ts"), /validateTeacherPreciseLevels/);
assert.match(source("src/app/api/admin/teachers\/\[id\]\/route.ts"), /tx\.teacherPreciseLevel\.createMany/);
assert.match(search, /marketplaceCourseAmount\(input\.journey, input\.levelName, input\.courseFormat, input\.durationMinutes\)/);
assert.match(clientSearch, /useState\(60\)/);
assert.match(clientSearch, /marketplacePreciseLevels\(journey, level\.name\)/);
assert.match(clientSearch, /Le prix évolue par tranche de 5 minutes/);
assert.doesNotMatch(clientSearch, /le prix du cours reste identique/i);
assert.match(publicTariffs, /if \(marketplaceEnabled\(\)\) return <MarketplaceTariffsPage/);
assert.match(search, /photoUrl: \{ not: null \}/);
assert.match(search, /scheduleSlotsConflict\(requestSlot, request, settings\.scheduleBuffers\)/);
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
