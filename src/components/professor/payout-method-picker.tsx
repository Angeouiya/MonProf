"use client";

import { CheckCircle2 } from "lucide-react";
import { PaymentMethodLogo } from "@/components/shared/payment-method-logo";
import { activePaymentMethodOptions } from "@/lib/payment-methods";

export function PayoutMethodPicker({
  value,
  onChange,
  disabled = false,
}: {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <div
      role="radiogroup"
      aria-label="Moyen de paiement pour recevoir les fonds"
      className="grid grid-cols-2 gap-2 min-[720px]:grid-cols-4"
      data-professor-payout-method-picker
    >
      {activePaymentMethodOptions.map((option) => {
        const selected = value === option.value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={disabled}
            onClick={() => onChange(option.value)}
            className={`relative flex min-h-24 min-w-0 flex-col items-center justify-center gap-2 rounded-lg border bg-white px-2 py-3 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#111B4D] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${
              selected ? "border-[#111B4D] text-[#111B4D]" : "border-[#DDE6F7] text-[#475569] hover:border-[#111B4D]"
            }`}
          >
            <PaymentMethodLogo method={option.value} className="h-10 w-full min-w-0" />
            <span className="text-xs font-semibold leading-4">{option.label}</span>
            {selected && (
              <CheckCircle2 className="absolute right-2 top-2 h-4 w-4 text-[#111B4D]" aria-hidden="true" />
            )}
          </button>
        );
      })}
    </div>
  );
}
