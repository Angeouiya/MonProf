import Image from "next/image";
import { cn } from "@/lib/utils";
import { paymentMethodLabel } from "@/lib/payment-methods";

type PaymentMethodLogoProps = {
  method: string;
  className?: string;
};

export function PaymentMethodLogo({ method, className }: PaymentMethodLogoProps) {
  const label = paymentMethodLabel(method);

  if (method === "WAVE") {
    return (
      <span className={cn("inline-flex h-11 min-w-24 items-center justify-center overflow-hidden rounded-2xl border border-[#E3E8F2] bg-[#26BCEB] px-2", className)} aria-label={label}>
        <Image
          src="/images/payments/wave-logo.webp"
          alt=""
          width={520}
          height={225}
          className="h-9 w-auto max-w-full object-contain"
          aria-hidden="true"
        />
      </span>
    );
  }

  if (method === "ORANGE_MONEY") {
    return (
      <span className={cn("inline-flex h-11 min-w-24 items-center justify-center rounded-2xl border border-[#E3E8F2] bg-white px-3", className)} aria-label={label}>
        <svg viewBox="0 0 104 34" className="h-8 w-full" aria-hidden="true">
          <rect x="3" y="3" width="28" height="28" rx="5" fill="#FF7900" />
          <text x="8" y="25" fill="#fff" fontFamily="Arial, sans-serif" fontSize="7" fontWeight="800">orange</text>
          <text x="38" y="15" fill="#111827" fontFamily="Arial, sans-serif" fontSize="11" fontWeight="800">Orange</text>
          <text x="38" y="27" fill="#FF7900" fontFamily="Arial, sans-serif" fontSize="11" fontWeight="800">Money</text>
        </svg>
      </span>
    );
  }

  if (method === "MTN_MONEY") {
    return (
      <span className={cn("inline-flex h-11 min-w-24 items-center justify-center rounded-2xl border border-[#E3E8F2] bg-white px-3", className)} aria-label={label}>
        <svg viewBox="0 0 102 34" className="h-8 w-full" aria-hidden="true">
          <rect width="102" height="34" rx="17" fill="#FFCC00" />
          <ellipse cx="33" cy="17" rx="24" ry="11" fill="none" stroke="#111827" strokeWidth="2" />
          <text x="18" y="21" fill="#111827" fontFamily="Arial, sans-serif" fontSize="12" fontWeight="900">MTN</text>
          <text x="61" y="21" fill="#111827" fontFamily="Arial, sans-serif" fontSize="10" fontWeight="800">Money</text>
        </svg>
      </span>
    );
  }

  if (method === "MOOV_MONEY") {
    return (
      <span className={cn("inline-flex h-11 min-w-24 items-center justify-center rounded-2xl border border-[#E3E8F2] bg-white px-2", className)} aria-label={label}>
        <Image
          src="/images/payments/moov-money-logo.webp"
          alt=""
          width={520}
          height={315}
          className="h-9 w-auto max-w-full object-contain"
          aria-hidden="true"
        />
      </span>
    );
  }

  return (
    <span className={cn("inline-flex h-11 min-w-24 items-center justify-center rounded-2xl border border-[#E3E8F2] bg-white px-3 text-xs font-semibold text-[#64748B]", className)}>
      {label}
    </span>
  );
}
