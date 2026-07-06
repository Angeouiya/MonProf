import Image from "next/image";
import { cn } from "@/lib/utils";
import { paymentMethodLabel } from "@/lib/payment-methods";

type PaymentMethodLogoProps = {
  method: string;
  className?: string;
};

export function PaymentMethodLogo({ method, className }: PaymentMethodLogoProps) {
  const label = paymentMethodLabel(method);
  const shellClassName = cn(
    "inline-flex h-11 min-w-24 items-center justify-center overflow-hidden rounded-lg border border-[#D7DEE9] bg-white px-2.5",
    className,
  );

  if (method === "WAVE") {
    return (
      <span data-payment-method-logo className={shellClassName} aria-label={label}>
        <Image
          src="/images/payments/wave-mobile-money.png"
          alt=""
          width={230}
          height={101}
          className="h-[82%] w-auto max-w-[94%] object-contain"
          aria-hidden="true"
        />
      </span>
    );
  }

  if (method === "ORANGE_MONEY") {
    return (
      <span data-payment-method-logo className={shellClassName} aria-label={label}>
        <img
          src="/images/payments/orange-money.svg"
          alt=""
          className="h-[72%] w-auto max-w-[94%] object-contain"
          aria-hidden="true"
          loading="lazy"
        />
      </span>
    );
  }

  if (method === "MTN_MONEY") {
    return (
      <span data-payment-method-logo className={shellClassName} aria-label={label}>
        <img
          src="/images/payments/mtn-momo.svg"
          alt=""
          className="h-[94%] w-auto max-w-[94%] object-contain"
          aria-hidden="true"
          loading="lazy"
        />
      </span>
    );
  }

  if (method === "MOOV_MONEY") {
    return (
      <span data-payment-method-logo className={shellClassName} aria-label={label}>
        <Image
          src="/images/payments/moov-money-flooz.png"
          alt=""
          width={512}
          height={512}
          className="h-full w-auto max-w-[94%] object-contain"
          aria-hidden="true"
        />
      </span>
    );
  }

  return (
    <span className={cn("inline-flex h-11 min-w-24 items-center justify-center rounded-lg border border-[#E3E8F2] bg-white px-3 text-xs font-semibold text-[#64748B]", className)}>
      {label}
    </span>
  );
}
