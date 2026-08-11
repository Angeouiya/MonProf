import Image from "next/image";
import { Money } from "@/components/shared/money";
import { PaymentMethodLogo } from "@/components/shared/payment-method-logo";
import { paymentMethodLabel } from "@/lib/payment-methods";
import { cn } from "@/lib/utils";

type JekoHostedCheckoutPreviewProps = {
  amount: number;
  method?: string | null;
  merchantName?: string;
  className?: string;
};

export function JekoHostedCheckoutPreview({
  amount,
  method = "WAVE",
  merchantName = "Boutique Compétence",
  className,
}: JekoHostedCheckoutPreviewProps) {
  const methodLabel = paymentMethodLabel(method || "WAVE");
  const methodDisplay = methodLabel.toLocaleUpperCase("fr-FR");

  return (
    <section
      className={cn(
        "mx-auto w-full max-w-[24rem] overflow-hidden rounded-[1.85rem] border border-[#E3E8F2] bg-white shadow-[0_22px_70px_rgba(17,24,39,0.12)]",
        className,
      )}
      aria-label="Aperçu de la page de paiement Jèko"
      data-jeko-hosted-checkout-preview
    >
      <div className="flex items-start justify-between gap-3 px-4 py-4">
        <p className="max-w-[11rem] truncate text-base font-semibold text-[#111827]" data-jeko-checkout-merchant>
          {merchantName}
        </p>
        <div className="shrink-0 text-right" data-jeko-checkout-amount>
          <p className="text-[11px] font-semibold text-[#7C8798]">Montant à payer</p>
          <Money amount={amount} className="mt-0.5 text-lg font-black text-[#111827]" />
        </div>
      </div>

      <p className="mx-auto max-w-72 px-5 pb-5 text-center text-sm font-medium leading-6 text-[#7C8798]">
        Vous êtes sur le point de payer votre réservation Compétence.CI.
      </p>

      <div className="border-t border-[#EEF2F7] px-4 py-5" data-jeko-checkout-method={method || "WAVE"}>
        <div className="flex items-center justify-between gap-3">
          <p className="text-base font-medium text-[#64748B]">
            Payer par <span className="font-black text-[#111827]">{methodDisplay}</span>
          </p>
          <CheckoutMethodMark method={method || "WAVE"} />
        </div>

        <p className="mx-auto mt-5 max-w-80 text-center text-sm font-medium leading-6 text-[#64748B]">
          Entrez votre numéro de téléphone {methodDisplay} pour lancer le paiement.
        </p>

        <div
          className="mt-4 flex min-h-14 items-center gap-2 rounded-xl border border-[#DDE3EE] bg-white px-3 text-sm font-semibold text-[#111827]"
          data-jeko-checkout-phone-placeholder
        >
          <span aria-hidden="true">🇨🇮</span>
          <span>+225</span>
          <span className="font-medium tracking-[0.14em] text-[#9AA5B5]">0X XX XX XX XX</span>
        </div>

        <div
          className="mt-4 flex min-h-14 items-center justify-center gap-1 rounded-xl bg-[#D1D5DB] px-4 text-sm font-black text-white"
          data-jeko-checkout-disabled-button
          aria-disabled="true"
        >
          <span>Payer</span>
          <Money amount={amount} />
        </div>

        <p className="mt-4 text-center text-sm font-black text-[#111827]">× Fermer</p>
      </div>

      <div
        className="border-t border-[#EEF2F7] px-4 py-4 text-center text-xs font-semibold text-[#7C8798]"
        data-jeko-secured-by-competence
      >
        Paiement sécurisé par <span className="font-black text-[#4938B8]">Jèko</span>
      </div>
    </section>
  );
}

function CheckoutMethodMark({ method }: { method: string }) {
  if (method === "WAVE") {
    return (
      <span
        className="inline-flex h-12 w-12 shrink-0 items-center justify-start overflow-hidden rounded-full bg-[#32C7F4]"
        aria-label="Wave"
        data-payment-method-logo
      >
        <Image
          src="/images/payments/wave-mobile-money.png"
          alt=""
          width={230}
          height={101}
          className="h-12 w-auto max-w-none object-left"
          aria-hidden="true"
        />
      </span>
    );
  }

  return <PaymentMethodLogo method={method} className="h-12 w-20 min-w-0 rounded-full border-[#DDE6F7] px-2" />;
}
