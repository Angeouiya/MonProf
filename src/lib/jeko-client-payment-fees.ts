export const JEKO_CLIENT_PAYMENT_FEE_LABEL = "Frais de paiement Jèko";

export const JEKO_CLIENT_PAYMENT_METHODS = ["wave", "orange", "mtn", "moov", "djamo"] as const;
export type JekoClientPaymentMethod = (typeof JEKO_CLIENT_PAYMENT_METHODS)[number];

type JekoClientPaymentFeeConfig = {
  rateBps: number;
  fixedAmount: number;
  methodLabel: string;
};

export type JekoClientPaymentFeeSnapshot = {
  amount: number;
  baseAmount: number;
  fixedAmount: number;
  label: string;
  method: JekoClientPaymentMethod | null;
  methodLabel: string | null;
  rateBps: number;
};

const DEFAULT_RATE_BPS: Record<JekoClientPaymentMethod, number> = {
  wave: 100,
  orange: 200,
  mtn: 200,
  moov: 200,
  djamo: 200,
};

const RAW_RATE_BPS: Record<JekoClientPaymentMethod, string | undefined> = {
  wave: process.env.NEXT_PUBLIC_JEKO_CLIENT_FEE_WAVE_BPS,
  orange: process.env.NEXT_PUBLIC_JEKO_CLIENT_FEE_ORANGE_BPS,
  mtn: process.env.NEXT_PUBLIC_JEKO_CLIENT_FEE_MTN_BPS,
  moov: process.env.NEXT_PUBLIC_JEKO_CLIENT_FEE_MOOV_BPS,
  djamo: process.env.NEXT_PUBLIC_JEKO_CLIENT_FEE_DJAMO_BPS,
};

const RAW_FIXED_XOF: Record<JekoClientPaymentMethod, string | undefined> = {
  wave: process.env.NEXT_PUBLIC_JEKO_CLIENT_FEE_WAVE_FIXED_XOF,
  orange: process.env.NEXT_PUBLIC_JEKO_CLIENT_FEE_ORANGE_FIXED_XOF,
  mtn: process.env.NEXT_PUBLIC_JEKO_CLIENT_FEE_MTN_FIXED_XOF,
  moov: process.env.NEXT_PUBLIC_JEKO_CLIENT_FEE_MOOV_FIXED_XOF,
  djamo: process.env.NEXT_PUBLIC_JEKO_CLIENT_FEE_DJAMO_FIXED_XOF,
};

const METHOD_LABELS: Record<JekoClientPaymentMethod, string> = {
  wave: "Wave",
  orange: "Orange Money",
  mtn: "MTN Money",
  moov: "Moov Money",
  djamo: "Djamo",
};

const PLATFORM_TO_JEKO_METHOD: Record<string, JekoClientPaymentMethod> = {
  WAVE: "wave",
  ORANGE_MONEY: "orange",
  MTN_MONEY: "mtn",
  MOOV_MONEY: "moov",
  DJAMO: "djamo",
};

export function normalizeJekoClientPaymentMethod(value?: string | null): JekoClientPaymentMethod | null {
  const normalized = (value ?? "").trim().toLowerCase();
  if ((JEKO_CLIENT_PAYMENT_METHODS as readonly string[]).includes(normalized)) {
    return normalized as JekoClientPaymentMethod;
  }
  return PLATFORM_TO_JEKO_METHOD[(value ?? "").trim().toUpperCase()] ?? null;
}

export function jekoClientPaymentMethodLabel(method?: string | null) {
  const normalized = normalizeJekoClientPaymentMethod(method);
  return normalized ? METHOD_LABELS[normalized] : null;
}

export function calculateJekoClientPaymentFee(
  baseAmount: number,
  method?: string | null,
): JekoClientPaymentFeeSnapshot {
  const safeBaseAmount = Math.max(0, Math.round(Number(baseAmount) || 0));
  const normalizedMethod = normalizeJekoClientPaymentMethod(method);
  if (!normalizedMethod || safeBaseAmount <= 0) {
    return {
      amount: 0,
      baseAmount: safeBaseAmount,
      fixedAmount: 0,
      label: JEKO_CLIENT_PAYMENT_FEE_LABEL,
      method: normalizedMethod,
      methodLabel: normalizedMethod ? METHOD_LABELS[normalizedMethod] : null,
      rateBps: 0,
    };
  }

  const config = getJekoClientPaymentFeeConfig(normalizedMethod);
  const amount = calculateGrossedUpFeeAmount(safeBaseAmount, config.rateBps, config.fixedAmount);

  return {
    amount,
    baseAmount: safeBaseAmount,
    fixedAmount: config.fixedAmount,
    label: `${JEKO_CLIENT_PAYMENT_FEE_LABEL} ${config.methodLabel} (${formatBps(config.rateBps)}${config.fixedAmount > 0 ? ` + ${config.fixedAmount.toLocaleString("fr-FR")} FCFA` : ""})`,
    method: normalizedMethod,
    methodLabel: config.methodLabel,
    rateBps: config.rateBps,
  };
}

export function getJekoClientPaymentFeeConfig(method: JekoClientPaymentMethod): JekoClientPaymentFeeConfig {
  return {
    rateBps: readNonNegativeInteger(RAW_RATE_BPS[method], DEFAULT_RATE_BPS[method]),
    fixedAmount: readNonNegativeInteger(RAW_FIXED_XOF[method], 0),
    methodLabel: METHOD_LABELS[method],
  };
}

/**
 * Si Jèko prélève un pourcentage sur le montant brut encaissé, le client doit
 * payer le montant brut qui laisse exactement la réservation nette après frais.
 */
function calculateGrossedUpFeeAmount(baseAmount: number, rateBps: number, fixedAmount: number) {
  const safeRateBps = Math.max(0, Math.min(9_000, Math.round(Number(rateBps) || 0)));
  const safeFixedAmount = Math.max(0, Math.round(Number(fixedAmount) || 0));
  if (safeRateBps <= 0 && safeFixedAmount <= 0) return 0;

  const grossTotal = Math.ceil(((baseAmount + safeFixedAmount) * 10_000) / (10_000 - safeRateBps));
  return Math.max(0, grossTotal - baseAmount);
}

function readNonNegativeInteger(value: string | undefined, fallback: number) {
  if (value == null || value.trim() === "") return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return fallback;
  return Math.round(parsed);
}

function formatBps(rateBps: number) {
  return `${(rateBps / 100).toLocaleString("fr-FR", { maximumFractionDigits: 2 })}%`;
}
