export type LoyaltyGiftStep = {
  milestone: number;
  discountRate: number;
  validityDays: number;
  paymentGap: number;
};

export const DEFAULT_LOYALTY_GIFT_STEPS: LoyaltyGiftStep[] = [
  { milestone: 2, discountRate: 12, validityDays: 9, paymentGap: 1 },
  { milestone: 3, discountRate: 9, validityDays: 7, paymentGap: 2 },
  { milestone: 4, discountRate: 10, validityDays: 12, paymentGap: 3 },
  { milestone: 5, discountRate: 13, validityDays: 10, paymentGap: 1 },
  { milestone: 6, discountRate: 8, validityDays: 8, paymentGap: 2 },
  { milestone: 7, discountRate: 15, validityDays: 7, paymentGap: 3 },
];

export function resolveLoyaltyGiftCadence(input: {
  steps?: readonly LoyaltyGiftStep[];
  rewardCount: number;
  paymentsSinceLastGift: number;
  cycleEnabled: boolean;
}) {
  const steps = input.steps?.length ? input.steps : DEFAULT_LOYALTY_GIFT_STEPS;
  const rewardCount = Math.max(0, Math.trunc(input.rewardCount));
  const completedGiftsInCycle = rewardCount % steps.length;
  const nextRewardCycle = Math.floor(rewardCount / steps.length) + 1;
  const programCompleted = !input.cycleEnabled && rewardCount >= steps.length;
  const nextGift = programCompleted ? null : steps[completedGiftsInCycle];
  const paymentsSinceLastGift = Math.max(0, Math.trunc(input.paymentsSinceLastGift));
  const paymentsUntilNextGift = nextGift
    ? Math.max(0, nextGift.paymentGap - paymentsSinceLastGift)
    : 0;

  return {
    completedGiftsInCycle,
    nextRewardCycle,
    programCompleted,
    nextGift,
    paymentsUntilNextGift,
    shouldUnlock: Boolean(nextGift) && paymentsUntilNextGift === 0,
  };
}

export const PARTNER_ATTRIBUTION_MONTHS = 6;
