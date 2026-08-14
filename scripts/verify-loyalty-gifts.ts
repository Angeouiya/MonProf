import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { calculateBookingPricing } from "../src/lib/pricing";
import { DEFAULT_LOYALTY_GIFT_STEPS } from "../src/lib/loyalty-program";

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
  { milestone: 2, discountRate: 12, validityDays: 9 },
  { milestone: 3, discountRate: 9, validityDays: 7 },
  { milestone: 4, discountRate: 10, validityDays: 12 },
  { milestone: 5, discountRate: 13, validityDays: 10 },
  { milestone: 6, discountRate: 8, validityDays: 8 },
  { milestone: 7, discountRate: 15, validityDays: 7 },
]);

const staticChecks = [
  ["src/app/client/cadeaux/gift-road.tsx", /gift-road-centerline[\s\S]*road-flow/],
  ["src/app/client/cadeaux/gift-road.tsx", /<style jsx global>/],
  ["src/app/client/cadeaux/gift-road.tsx", /background: #fff/],
  ["src/app/client/cadeaux/page.tsx", /Ramassez vos cadeaux sur une route infinie/],
  ["src/components/layouts/client-layout.tsx", /href: "\/client\/cadeaux"/],
  ["src/app/admin/parametres/client.tsx", /Cadeaux & fidélité/],
  ["src/lib/platform-settings.ts", /loyalty_gifts_cycle_enabled: "true"/],
  ["src/app/api/client/partner-referral/verify/route.ts", /resolveClientPromotionBenefits/],
] as const;
for (const [file, pattern] of staticChecks) {
  assert.match(readFileSync(file, "utf8"), pattern, `${file} doit contenir ${pattern}`);
}

console.log("OK loyalty gifts: 6-month attribution, 10% partner/client, 7 milestones, margin floor and animated road verified.");
