import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { calculateBookingPricing } from "../src/lib/pricing";
import { DEFAULT_LOYALTY_GIFT_STEPS, resolveLoyaltyGiftCadence } from "../src/lib/loyalty-constants";

const partnerFirstPurchase = calculateBookingPricing({
  category: "formation_professionnelle",
  schoolSystem: "professionnel",
  deliveryMode: "en_ligne",
  packType: "SINGLE",
  partnerDiscountPercent: 10,
  partnerCommissionPercent: 10,
  minimumPlatformMarginPercent: 5,
});
assert.equal(partnerFirstPurchase.rawCourseAmount, 40_000);
assert.equal(partnerFirstPurchase.partnerDiscountAmount, 4_000);
assert.equal(partnerFirstPurchase.partnerCommissionAmount, 4_000);
assert.equal(partnerFirstPurchase.teacherPayoutAmount, 28_000);
assert.equal(partnerFirstPurchase.platformNetAfterPartnerAmount, 4_000);

const seventhGift = calculateBookingPricing({
  category: "formation_professionnelle",
  schoolSystem: "professionnel",
  deliveryMode: "en_ligne",
  packType: "PACK_4",
  partnerCommissionPercent: 10,
  rewardDiscountPercent: 15,
  minimumPlatformMarginPercent: 5,
});
assert.equal(seventhGift.appliedDiscountKind, "GIFT");
assert.equal(seventhGift.rewardDiscountRate, 0.15);
assert.equal(seventhGift.teacherPayoutAmount, 112_000);
assert.equal(seventhGift.platformNetAfterPartnerAmount, seventhGift.minimumPlatformMarginAmount);

assert.deepEqual(DEFAULT_LOYALTY_GIFT_STEPS, [
  { milestone: 2, discountRate: 12, validityDays: 9, paymentGap: 1 },
  { milestone: 3, discountRate: 9, validityDays: 7, paymentGap: 2 },
  { milestone: 4, discountRate: 10, validityDays: 12, paymentGap: 3 },
  { milestone: 5, discountRate: 13, validityDays: 10, paymentGap: 1 },
  { milestone: 6, discountRate: 8, validityDays: 8, paymentGap: 2 },
  { milestone: 7, discountRate: 15, validityDays: 7, paymentGap: 3 },
]);

let unlockedGifts = 0;
let lastGiftPayment = 1;
const unlockPayments: number[] = [];
for (let payment = 1; payment <= 13; payment += 1) {
  const cadence = resolveLoyaltyGiftCadence({
    rewardCount: unlockedGifts,
    paymentsSinceLastGift: Math.max(0, payment - lastGiftPayment),
    cycleEnabled: false,
  });
  if (cadence.shouldUnlock) {
    unlockPayments.push(payment);
    lastGiftPayment = payment;
    unlockedGifts += 1;
  }
}
assert.deepEqual(unlockPayments, [2, 4, 7, 8, 10, 13]);
assert.ok(DEFAULT_LOYALTY_GIFT_STEPS.every((step) => step.paymentGap >= 1 && step.paymentGap <= 3));

const staticChecks = [
  ["src/app/client/cadeaux/gift-road.tsx", /gift-road-centerline[\s\S]*road-flow/],
  ["src/app/client/cadeaux/gift-road.tsx", /<style jsx global>/],
  ["src/app/client/cadeaux/gift-road.tsx", /stroke="#4D5055"/],
  ["src/app/client/cadeaux/gift-road.tsx", /gift-vehicle-bus/],
  ["src/app/client/cadeaux/gift-road.tsx", /function RoadBranch/],
  ["src/app/client/cadeaux/page.tsx", /Ramassez vos cadeaux sur une route infinie/],
  ["src/components/layouts/client-layout.tsx", /href: "\/client\/cadeaux"/],
  ["src/app/admin/parametres/client.tsx", /Cadeaux & fidélité/],
  ["src/lib/platform-settings.ts", /loyalty_gifts_cycle_enabled: "true"/],
  ["src/lib/platform-settings.ts", /loyalty_gift_7_gap_payments: numericSetting\(1, 3\)/],
  ["src/app/api/client/partner-referral/verify/route.ts", /resolveClientPromotionBenefits/],
  ["src/lib/loyalty-program.ts", /FOR UPDATE/],
  ["src/lib/loyalty-program.ts", /unlockPaymentNumber: absoluteSequence/],
  ["src/lib/loyalty-program.ts", /PARTNER_SELF_REFERRAL_FORBIDDEN/],
  ["src/lib/partner-referrals.ts", /randomBytes\(8\)/],
  ["src/lib/partner-referrals.ts", /recentRequests >= 20/],
  ["src/app/api/admin/partner-referrals/[id]/route.ts", /updateMany\([\s\S]*status: "PAYABLE"/],
  ["prisma/migrations/20260814160000_partner_loyalty_security_constraints/migration.sql", /ClientReward_program_ranges/],
  ["prisma/migrations/20260814200000_loyalty_gift_payment_gaps/migration.sql", /loyalty_gift_7_gap_payments/],
] as const;
for (const [file, pattern] of staticChecks) {
  assert.match(readFileSync(file, "utf8"), pattern, `${file} doit contenir ${pattern}`);
}

const clientGiftPage = readFileSync("src/app/client/cadeaux/page.tsx", "utf8");
assert.doesNotMatch(clientGiftPage, /Aucun cumul ne peut rendre la marge Compétence négative/);
assert.doesNotMatch(clientGiftPage, /le professeur conserve toujours son net officiel/i);

const loyaltySource = readFileSync("src/lib/loyalty-program.ts", "utf8");
assert.doesNotMatch(loyaltySource, /Le professeur reçoit toujours son montant exact/);

console.log("OK loyalty gifts: cadence serveur de 1 à 3 paiements, qualification Jèko, verrou client, récompenses atomiques et route illustrée vérifiés.");
