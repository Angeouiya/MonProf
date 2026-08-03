import assert from "node:assert/strict";
import { calculateBookingPricing } from "../src/lib/pricing";

const academicCases = [
  ["ivoirien", "CP1", 15_000],
  ["ivoirien", "CM1", 15_000],
  ["ivoirien", "CM2", 20_000],
  ["ivoirien", "4e", 20_000],
  ["ivoirien", "3e", 25_000],
  ["ivoirien", "1ère D", 25_000],
  ["ivoirien", "Terminale C", 30_000],
  ["francais", "CP1 / CP", 37_500],
  ["francais", "CM1", 37_500],
  ["francais", "CM2", 50_000],
  ["francais", "4e", 50_000],
  ["francais", "3e", 62_500],
  ["francais", "Première", 62_500],
  ["francais", "Terminale", 75_000],
] as const;

for (const [schoolSystem, preciseLevel, expectedAmount] of academicCases) {
  const pricing = calculateBookingPricing({
    category: "soutien_scolaire",
    schoolSystem,
    preciseLevel,
    deliveryMode: "en_ligne",
    packType: "SINGLE",
    participantsCount: 3,
  });

  assert.equal(pricing.unitSessionAmount, expectedAmount, `${schoolSystem} ${preciseLevel}`);
  assert.equal(pricing.courseAmount, expectedAmount, `${schoolSystem} ${preciseLevel} course amount`);
  assert.equal(pricing.transportFee, 0, `${schoolSystem} ${preciseLevel} online transport`);
  assert.equal(pricing.groupMultiplier, 1, `${schoolSystem} ${preciseLevel} participant surcharge`);
}

const professional = calculateBookingPricing({
  category: "formation_professionnelle",
  deliveryMode: "en_ligne",
  packType: "SINGLE",
});
assert.equal(professional.unitSessionAmount, 40_000, "professional session");
assert.equal(professional.courseAmount, 40_000, "professional course amount");

const fourSessions = calculateBookingPricing({
  category: "soutien_scolaire",
  schoolSystem: "ivoirien",
  preciseLevel: "CP1",
  deliveryMode: "en_ligne",
  packType: "PACK_4",
});
assert.equal(fourSessions.numberOfSessions, 4, "four-session pack count");
assert.equal(fourSessions.courseAmount, 60_000, "four-session pack uses the official unit price");
assert.equal(fourSessions.discountAmount, 0, "no unapproved pack discount");

console.log(`Official pricing verified (${academicCases.length + 2} cases).`);
