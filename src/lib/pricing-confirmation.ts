import { createHash } from "node:crypto";

export type ConfirmablePricing = {
  unitSessionAmount: number;
  courseAmount: number;
  transportFee: number;
  paymentServiceFeeAmount: number;
  paymentProviderFeeAmount: number;
  paymentProviderFeeMethod: string | null;
  totalClientPays: number;
  priceTierKey: string;
  partnerDiscountAmount: number;
  rewardDiscountAmount: number;
  partnerCommissionAmount: number;
};

type PricingLike = ConfirmablePricing & {
  priceTierLabel?: string;
  transportFeeLabel?: string | null;
  transportRouteLabel?: string | null;
  paymentProviderFeeLabel?: string | null;
  numberOfSessions?: number | null;
};

const NUMERIC_FIELDS = [
  "unitSessionAmount",
  "courseAmount",
  "transportFee",
  "paymentServiceFeeAmount",
  "paymentProviderFeeAmount",
  "totalClientPays",
  "partnerDiscountAmount",
  "rewardDiscountAmount",
  "partnerCommissionAmount",
] as const;

export function confirmablePricing(pricing: PricingLike): ConfirmablePricing {
  return {
    unitSessionAmount: pricing.unitSessionAmount,
    courseAmount: pricing.courseAmount,
    transportFee: pricing.transportFee,
    paymentServiceFeeAmount: pricing.paymentServiceFeeAmount,
    paymentProviderFeeAmount: pricing.paymentProviderFeeAmount,
    paymentProviderFeeMethod: pricing.paymentProviderFeeMethod ?? null,
    totalClientPays: pricing.totalClientPays,
    priceTierKey: pricing.priceTierKey,
    partnerDiscountAmount: pricing.partnerDiscountAmount,
    rewardDiscountAmount: pricing.rewardDiscountAmount,
    partnerCommissionAmount: pricing.partnerCommissionAmount,
  };
}

export function expectedPricingMatches(value: unknown, canonical: ConfirmablePricing) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const expected = value as Record<string, unknown>;

  return NUMERIC_FIELDS.every((field) => (
    Number.isSafeInteger(expected[field]) && expected[field] === canonical[field]
  )) && expected.priceTierKey === canonical.priceTierKey
    && (expected.paymentProviderFeeMethod ?? null) === canonical.paymentProviderFeeMethod;
}

export function createPricingConfirmationFingerprint(
  canonical: ConfirmablePricing,
  clientCreationKey: string,
) {
  const serialized = [
    "v1",
    clientCreationKey,
    canonical.priceTierKey,
    canonical.paymentProviderFeeMethod ?? "",
    ...NUMERIC_FIELDS.map((field) => canonical[field]),
  ].join(":");

  return `price_v1_${createHash("sha256").update(serialized).digest("hex")}`;
}

export function publicAuthoritativePricing(pricing: PricingLike) {
  return {
    ...confirmablePricing(pricing),
    priceTierLabel: pricing.priceTierLabel ?? pricing.priceTierKey,
    transportFeeLabel: pricing.transportFeeLabel ?? null,
    transportRouteLabel: pricing.transportRouteLabel ?? null,
    paymentProviderFeeLabel: pricing.paymentProviderFeeLabel ?? null,
    numberOfSessions: pricing.numberOfSessions ?? 0,
  };
}
