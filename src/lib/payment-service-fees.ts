export const PAYMENT_SERVICE_FEE_RATE_BPS = readFeeRateBps();
export const PAYMENT_SERVICE_FEE_LABEL = "Frais de service paiement";

export function calculatePaymentServiceFee(amount: number) {
  const baseAmount = Math.max(0, Math.round(Number(amount) || 0));
  if (baseAmount <= 0 || PAYMENT_SERVICE_FEE_RATE_BPS <= 0) return 0;
  return Math.max(0, Math.round((baseAmount * PAYMENT_SERVICE_FEE_RATE_BPS) / 10000));
}

export function paymentServiceFeeRatePercent() {
  return PAYMENT_SERVICE_FEE_RATE_BPS / 100;
}

export function paymentServiceFeeDescription() {
  return `${paymentServiceFeeRatePercent().toLocaleString("fr-FR", {
    maximumFractionDigits: 2,
  })}% du montant cours + déplacement`;
}

function readFeeRateBps() {
  const raw = process.env.NEXT_PUBLIC_PAYMENT_SERVICE_FEE_RATE_BPS ?? "300";
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < 0) return 300;
  return Math.round(parsed);
}
