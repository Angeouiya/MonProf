import type { PaymentMethod } from "@prisma/client";

export const ACTIVE_PAYMENT_METHODS = [
  "WAVE",
  "ORANGE_MONEY",
  "MTN_MONEY",
  "MOOV_MONEY",
] as const satisfies readonly PaymentMethod[];

export type ActivePaymentMethod = (typeof ACTIVE_PAYMENT_METHODS)[number];

export const paymentMethodLabels: Record<string, string> = {
  WAVE: "Wave",
  ORANGE_MONEY: "Orange Money",
  MTN_MONEY: "MTN Money",
  MOOV_MONEY: "Moov Money",
  CARD: "Méthode retirée",
};

export const activePaymentMethodOptions = ACTIVE_PAYMENT_METHODS.map((value) => ({
  value,
  label: paymentMethodLabels[value],
}));

export const PAYDUNYA_CI_CHANNELS = ["wave-ci", "orange-money-ci", "mtn-ci", "moov-ci"] as const;

export function isActivePaymentMethod(value: unknown): value is ActivePaymentMethod {
  return typeof value === "string" && ACTIVE_PAYMENT_METHODS.includes(value as ActivePaymentMethod);
}

export function paymentMethodLabel(method?: string | null) {
  return method ? paymentMethodLabels[method] ?? method : "Méthode non renseignée";
}
