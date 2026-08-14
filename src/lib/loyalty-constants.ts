export type LoyaltyGiftStep = {
  milestone: number;
  discountRate: number;
  validityDays: number;
};

export const DEFAULT_LOYALTY_GIFT_STEPS: LoyaltyGiftStep[] = [
  { milestone: 2, discountRate: 12, validityDays: 9 },
  { milestone: 3, discountRate: 9, validityDays: 7 },
  { milestone: 4, discountRate: 10, validityDays: 12 },
  { milestone: 5, discountRate: 13, validityDays: 10 },
  { milestone: 6, discountRate: 8, validityDays: 8 },
  { milestone: 7, discountRate: 15, validityDays: 7 },
];

export const PARTNER_ATTRIBUTION_MONTHS = 6;
