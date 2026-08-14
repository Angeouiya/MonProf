import type { ReactNode } from "react";
import { Calculator, Car, Clock, ShieldCheck, Users } from "lucide-react";
import { Money } from "@/components/shared/money";
import { packTypeLabel } from "@/lib/platform-labels";
import { groupPricingDetails } from "@/lib/group-pricing";

type BookingPricingBreakdownBaseProps = {
  unitPrice: number;
  totalPrice: number;
  sessionsCount: number;
  participantsCount: number;
  groupType: string;
  packType: string;
  priceTierKey?: string | null;
  priceTierLabel?: string | null;
  paymentProviderLabel?: string | null;
  courseAmount?: number | null;
  transportFee?: number | null;
  transportFeeLabel?: string | null;
  transportFeePending?: boolean | null;
  transportRouteLabel?: string | null;
  transportRuleLabel?: string | null;
  materialFee?: number | null;
  discountAmount?: number | null;
  appliedDiscountKind?: "NONE" | "PACK" | "PARTNER" | "GIFT" | null;
  partnerDiscountAmount?: number | null;
  rewardDiscountAmount?: number | null;
  paymentServiceFeeAmount?: number | null;
  paymentServiceFeeLabel?: string | null;
  totalBeforePaymentServiceFee?: number | null;
  paymentProviderFeeAmount?: number | null;
  paymentProviderFeeLabel?: string | null;
  totalBeforePaymentProviderFee?: number | null;
  isQuoteOnly?: boolean | null;
  presentation?: "full" | "checkout";
};

type BookingPricingBreakdownClientProps = BookingPricingBreakdownBaseProps & {
  audience?: "client";
  teacherNetAmount?: never;
  commissionAmount?: never;
  commissionRate?: never;
};

type BookingPricingBreakdownAdminProps = BookingPricingBreakdownBaseProps & {
  audience: "admin";
  teacherNetAmount?: number;
  teacherPayoutAmount?: number | null;
  totalTeacherReceives?: number | null;
  commissionAmount?: number;
  commissionRate?: number;
  partnerCommissionAmount?: number;
  platformNetAfterPartnerAmount?: number;
};

type BookingPricingBreakdownProps = BookingPricingBreakdownClientProps | BookingPricingBreakdownAdminProps;

export function BookingPricingBreakdown(props: BookingPricingBreakdownProps) {
  const {
    unitPrice,
    totalPrice,
    sessionsCount,
    participantsCount,
    groupType,
    packType,
  } = props;
  const audience = props.audience ?? "client";
  const isCheckout = audience === "client" && props.presentation === "checkout";
  const safeSessionsCount = Math.max(1, Math.round(Number(sessionsCount) || 1));
  const safeParticipantsCount = Math.max(1, Math.round(Number(participantsCount) || 1));
  const extraParticipants = Math.max(0, safeParticipantsCount - 1);
  const groupPricing = groupPricingDetails(safeParticipantsCount);
  const transportFee = props.transportFee ?? 0;
  const transportFeePending = props.transportFeePending === true;
  const transportRouteLabel = props.transportRouteLabel;
  const transportRuleLabel = props.transportRuleLabel;
  const materialFee = Math.max(0, Math.round(Number(props.materialFee) || 0));
  const discountAmount = props.discountAmount ?? 0;
  const partnerDiscountAmount = props.partnerDiscountAmount ?? 0;
  const rewardDiscountAmount = props.rewardDiscountAmount ?? 0;
  const discountLabel = partnerDiscountAmount > 0 || props.appliedDiscountKind === "PARTNER"
    ? "Réduction partenaire"
    : rewardDiscountAmount > 0 || props.appliedDiscountKind === "GIFT"
      ? "Cadeau Compétence"
      : "Économie pack";
  const paymentServiceFeeAmount = props.paymentServiceFeeAmount ?? 0;
  const paymentServiceFeeLabel = props.paymentServiceFeeLabel ?? "Frais de service Compétence";
  const paymentProviderFeeAmount = Math.max(0, Math.round(Number(props.paymentProviderFeeAmount) || 0));
  const paymentProviderFeeLabel = props.paymentProviderFeeLabel ?? "Frais de paiement Jèko";
  const paymentProviderLabel = props.paymentProviderLabel?.trim() || "le prestataire de paiement sécurisé";
  const totalBeforePaymentProviderFee = props.totalBeforePaymentProviderFee
    ?? Math.max(0, totalPrice - paymentProviderFeeAmount);
  const totalBeforePaymentServiceFee = props.totalBeforePaymentServiceFee
    ?? Math.max(0, totalBeforePaymentProviderFee - paymentServiceFeeAmount);
  const indicativeSessionAmount = Math.max(0, Math.round(Number(unitPrice) || 0));
  const persistedCourseAmount = props.courseAmount ?? indicativeSessionAmount;
  const courseAmount = persistedCourseAmount > 0
    ? persistedCourseAmount
    : Math.max(0, totalPrice - transportFee);
  const isQuoteOnly = props.isQuoteOnly === true;
  const baseFormulaAmount = indicativeSessionAmount * safeSessionsCount;
  // courseAmount est le brut moins la remise. Le reconstituer ainsi garantit
  // que l'équation affichée reste exacte, y compris pour un pack de groupe.
  const rawFormulaAmount = Math.max(baseFormulaAmount, courseAmount + discountAmount);
  const groupSurchargeAmount = Math.max(0, rawFormulaAmount - baseFormulaAmount);
  const effectiveDiscountPercent = rawFormulaAmount > 0
    ? Number(((discountAmount / rawFormulaAmount) * 100).toFixed(1))
    : 0;
  const averageSessionPrice = Math.round(courseAmount / safeSessionsCount);
  const totalHours = safeSessionsCount * 2;
  const isGroup = groupType === "SMALL_GROUP" || groupType === "LARGE_GROUP" || safeParticipantsCount > 1;
  const groupRateDetail = groupPricing.isLargeGroup
    ? `11 × 50 % puis ${groupPricing.largeGroupExtraParticipants} × 40 %`
    : `+50 % × ${extraParticipants}`;
  const adminProps = props as BookingPricingBreakdownAdminProps;
  const teacherCourseRate = adminProps.commissionRate === undefined
    ? null
    : Math.min(100, Math.max(0, 100 - adminProps.commissionRate));

  return (
    <section
      className="min-w-0 overflow-hidden rounded-lg border border-[#D8DEE9] bg-white p-3 min-[640px]:p-4"
      data-client-pricing-breakdown
      style={{ containerType: "inline-size" }}
    >
      <div className="grid gap-3" data-client-pricing-header>
        <div className="order-2 flex min-w-0 items-start gap-3" data-client-pricing-heading>
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#111B4D] text-white">
            <Calculator className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-[#111827]">Coût de la réservation</p>
            <p className="mt-1 hidden text-sm font-medium leading-6 text-[#64748B] sm:block" data-client-pricing-helper>
              {isQuoteOnly
                ? "Calcul automatique à reprendre avant le paiement."
                : audience === "client"
                  ? `Séances de 2h, niveau, participants${transportFeePending ? ", déplacement à calculer" : transportFee > 0 ? ", déplacement" : ""}, frais de service et frais Jèko séparés.`
                  : "Vue interne avec éléments comptables réservés au service client."}
            </p>
          </div>
        </div>

        <div className="order-1 rounded-lg border border-[#111B4D] bg-[#111B4D] px-4 py-3 text-white" data-client-pricing-total>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-white">
            {isQuoteOnly ? "Montant" : "Total client"}
          </p>
          <p className="mt-1 text-2xl font-semibold leading-tight">
            {isQuoteOnly ? "Montant à recalculer" : <Money amount={totalPrice} />}
          </p>
          {!isQuoteOnly && (
            <p className="mt-1 text-xs font-semibold leading-5 text-white">
              Paiement via {paymentProviderLabel}
            </p>
          )}
        </div>
      </div>

      {!isCheckout && (
        <div className="mt-3 grid grid-cols-1 gap-2" data-client-pricing-facts>
          <PricingFact
            icon={<Clock className="h-4 w-4" />}
            label="Formule"
            value={packTypeLabel(packType)}
            detail={`${safeSessionsCount} séance${safeSessionsCount > 1 ? "s" : ""} de 2h`}
          />
          <PricingFact
            icon={<Users className="h-4 w-4" />}
            label="Apprenants"
            value={`${safeParticipantsCount} ${safeParticipantsCount > 1 ? "participants" : "participant"}`}
            detail={isGroup ? groupRateDetail : "Individuel"}
          />
          <PricingFact
            label="Prix / séance"
            value={isQuoteOnly ? "À recalculer" : <Money amount={indicativeSessionAmount} />}
            detail={`${totalHours}h au total`}
          />
        </div>
      )}

      {audience === "client" && !isQuoteOnly && !isCheckout && (
        <div className="mt-3 rounded-lg border border-[#C7D2FE] bg-[#EEF2FF] px-3 py-3 text-xs font-medium leading-5 text-[#312E81]">
          <p className="font-bold">Grille officielle appliquée</p>
          <p className="mt-1">
            Le tarif du cours vient uniquement de la grille officielle du parcours et de la classe. Le professeur ne peut pas le modifier.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <span className="rounded-md border border-[#C7D2FE] bg-white px-2 py-1 font-semibold">
              Palier appliqué : {props.priceTierLabel || props.priceTierKey || "calcul automatique"}
            </span>
            <span className="rounded-md border border-[#C7D2FE] bg-white px-2 py-1 font-semibold">
              Prix retenu : <Money amount={indicativeSessionAmount} /> / séance
            </span>
          </div>
        </div>
      )}

      {isCheckout && !isQuoteOnly && (
        <div className="mt-3 divide-y divide-[#EEF2F7] rounded-lg border border-[#D8DEE9] bg-white px-3" data-client-checkout-pricing-summary>
          <CheckoutPricingLine
            label="Cours"
            detail={props.priceTierLabel || "Grille officielle"}
            value={<Money amount={courseAmount} />}
          />
          {discountAmount > 0 && (
            <CheckoutPricingLine label={discountLabel} detail={partnerDiscountAmount > 0 || rewardDiscountAmount > 0 ? "Appliquée uniquement au montant du cours" : undefined} value={<>- <Money amount={discountAmount} /></>} />
          )}
          <CheckoutPricingLine
            label="Déplacement"
            detail={transportRouteLabel ?? undefined}
            value={transportFeePending ? "En attente" : transportFee === 0 ? "Gratuit" : <Money amount={transportFee} />}
          />
          {materialFee > 0 && <CheckoutPricingLine label="Matériel" value={<Money amount={materialFee} />} />}
          <CheckoutPricingLine label={paymentServiceFeeLabel} value={<Money amount={paymentServiceFeeAmount} />} />
          {paymentProviderFeeAmount > 0 && (
            <CheckoutPricingLine label={paymentProviderFeeLabel} detail="Frais du moyen choisi, distincts des 3 % Compétence" value={<Money amount={paymentProviderFeeAmount} />} />
          )}
        </div>
      )}

      <details
        className="mt-3 min-w-0 rounded-lg border border-[#D8DEE9] bg-white p-3 min-[560px]:p-3.5"
        data-client-pricing-detail
        open={audience === "admin" ? true : undefined}
      >
        <summary className={audience === "client"
          ? "cursor-pointer list-none text-sm font-semibold text-[#111B4D] marker:hidden"
          : "sr-only"}
        >
          {isCheckout ? "Comprendre le calcul" : "Voir le détail du calcul"}
        </summary>
        <div className={audience === "client" ? "mt-3 border-t border-[#E3E8F2] pt-3" : undefined}>
          <div className="flex flex-col gap-1 border-b border-[#E3E8F2] pb-3" data-client-pricing-detail-header>
          <div>
            <p className="text-sm font-semibold text-[#111827]">Détail du calcul</p>
            <p className="mt-0.5 hidden text-xs font-medium leading-5 text-[#64748B] min-[430px]:block">
              {isGroup
                ? groupPricing.isLargeGroup
                  ? "Les participants 2 à 12 ajoutent 50 % chacun ; chaque participant au-delà de 12 ajoute 40 %."
                  : "Chaque apprenant supplémentaire ajoute 50 % du prix de base."
                : "Calcul individuel sur la formule choisie."}
            </p>
          </div>
          {!isQuoteOnly && (
            <p className="text-sm font-semibold text-[#111B4D]" data-client-pricing-average>
              Moyenne <Money amount={averageSessionPrice} /> / séance
            </p>
          )}
          </div>

          <div className="mt-3 space-y-2 text-sm">
          {isQuoteOnly ? (
            <PricingLine label="Montant" value="À recalculer avant paiement" strong />
          ) : (
            <>
              {isGroup ? (
                <>
                  <PricingLine label="Base brute des séances" detail={`${safeSessionsCount} x 2h`} value={<Money amount={baseFormulaAmount} />} />
                  <PricingLine label="Majoration groupe brute" detail={`${extraParticipants} participant${extraParticipants > 1 ? "s" : ""} en plus`} value={<Money amount={groupSurchargeAmount} />} />
                  {discountAmount > 0 && (
                    <PricingLine
                      label={discountLabel}
                      detail={`Taux réellement appliqué : ${effectiveDiscountPercent.toLocaleString("fr-FR")} %`}
                      value={<>- <Money amount={discountAmount} /></>}
                    />
                  )}
                  <PricingLine
                    label={discountAmount > 0 ? "Cours après remise" : "Sous-total cours"}
                    detail={formatCourseEquation(baseFormulaAmount, groupSurchargeAmount, discountAmount, courseAmount)}
                    value={<Money amount={courseAmount} />}
                    strong
                  />
                </>
              ) : discountAmount > 0 ? (
                <>
                  <PricingLine label="Base brute des séances" detail={`${safeSessionsCount} x 2h`} value={<Money amount={baseFormulaAmount} />} />
                  <PricingLine
                    label={discountLabel}
                    detail={`Taux réellement appliqué : ${effectiveDiscountPercent.toLocaleString("fr-FR")} %`}
                    value={<>- <Money amount={discountAmount} /></>}
                  />
                  <PricingLine
                    label="Cours après remise"
                    detail={formatCourseEquation(baseFormulaAmount, 0, discountAmount, courseAmount)}
                    value={<Money amount={courseAmount} />}
                    strong
                  />
                </>
              ) : (
                <PricingLine label="Cours" detail={`${safeSessionsCount} séance${safeSessionsCount > 1 ? "s" : ""}`} value={<Money amount={courseAmount} />} strong />
              )}
              {transportFeePending ? (
                <PricingLine
                  label="Déplacement"
                  detail="Choisissez la commune du client pour obtenir le forfait exact."
                  value="En attente"
                />
              ) : (transportFee > 0 || transportRouteLabel) && (
                <PricingLine
                  label="Déplacement"
                  detail={`${transportRouteLabel ?? "Frais selon zone"}${safeSessionsCount > 1 ? ` · ${Math.round(transportFee / safeSessionsCount).toLocaleString("fr-FR")} FCFA x ${safeSessionsCount} séances` : ""}`}
                  value={<Money amount={transportFee} />}
                />
              )}
              {materialFee > 0 && (
                <PricingLine
                  label="Matériel"
                  detail="Inclus dans le total, hors assiette des frais de service"
                  value={<Money amount={materialFee} />}
                />
              )}
              {paymentServiceFeeAmount > 0 && (
                <>
                  <PricingLine label="Sous-total réservation" value={<Money amount={totalBeforePaymentServiceFee} />} />
                  <PricingLine label={paymentServiceFeeLabel} value={<Money amount={paymentServiceFeeAmount} />} />
                </>
              )}
              {paymentProviderFeeAmount > 0 && (
                <>
                  <PricingLine
                    label="Sous-total avant frais Jèko"
                    value={<Money amount={totalBeforePaymentProviderFee} />}
                  />
                  <PricingLine
                    label={paymentProviderFeeLabel}
                    detail="Frais du moyen de paiement choisi, ajoutés en plus du frais de service Compétence"
                    value={<Money amount={paymentProviderFeeAmount} />}
                  />
                </>
              )}
              <div className="mt-3 border-t border-[#E3E8F2] pt-3">
                <PricingLine label={`Total à payer via ${paymentProviderLabel}`} value={<Money amount={totalPrice} className="text-[#111B4D]" />} strong />
              </div>
            </>
          )}
          </div>
        </div>
      </details>

      {transportRuleLabel && audience === "client" && (
        <div className="mt-3 flex items-start gap-2 rounded-lg border border-[#DDE6F7] bg-white px-3 py-2 text-xs font-medium leading-5 text-[#64748B]">
          <Car className="mt-0.5 h-4 w-4 shrink-0 text-[#111B4D]" />
          <span>{formatSentencePart(transportRuleLabel)}.</span>
        </div>
      )}

      {audience === "client" && (
        <div className="mt-3 flex items-start gap-2 rounded-lg border border-[#DDE6F7] bg-white px-3 py-2 text-xs font-semibold leading-5 text-[#64748B]">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#111B4D]" />
          <span>Paiement sécurisé via {paymentProviderLabel}. La réservation n'est activée qu'après confirmation signée et vérification côté serveur.</span>
        </div>
      )}

      {audience === "admin" && (
        <div className="mt-3 grid grid-cols-1 gap-2 border-t border-[#E3E8F2] pt-3" data-client-pricing-admin>
          <PricingMini label="Commission" value={<Money amount={adminProps.commissionAmount ?? 0} />} detail={adminProps.commissionRate !== undefined ? `${adminProps.commissionRate}%` : undefined} />
          {(adminProps.partnerCommissionAmount ?? 0) > 0 && (
            <PricingMini label="Commission partenaire" value={<Money amount={adminProps.partnerCommissionAmount ?? 0} />} detail="10 % du cours éligible" />
          )}
          {adminProps.platformNetAfterPartnerAmount !== undefined && (
            <PricingMini label="Marge Compétence nette" value={<Money amount={adminProps.platformNetAfterPartnerAmount} />} detail="Après avantage client et partenaire" />
          )}
          <PricingMini
            label="Part prof cours"
            value={<Money amount={adminProps.teacherPayoutAmount ?? adminProps.teacherNetAmount ?? 0} />}
            detail={teacherCourseRate === null ? "Part professeur du cours" : `${teacherCourseRate}% du cours`}
          />
          <PricingMini label="Total prof" value={<Money amount={adminProps.totalTeacherReceives ?? adminProps.teacherNetAmount ?? 0} />} detail={transportFee > 0 ? "Part cours + déplacement" : "Part cours"} />
        </div>
      )}
    </section>
  );
}

function PricingFact({
  label,
  value,
  detail,
  icon,
}: {
  label: string;
  value: ReactNode;
  detail: string;
  icon?: ReactNode;
}) {
  return (
    <div data-client-pricing-fact className="flex min-w-0 items-start gap-3 rounded-lg border border-[#D8DEE9] bg-white px-3 py-2.5">
      {icon && (
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[#D8DEE9] text-[#111B4D]">
          {icon}
        </span>
      )}
      <div className="min-w-0">
        <p className="break-words text-[10px] font-semibold uppercase leading-3 tracking-wide text-[#64748B] min-[380px]:text-[10.5px]">{label}</p>
        <p className="mt-0.5 break-words text-sm font-semibold leading-tight text-[#111827]">{value}</p>
        <p className="mt-0.5 break-words text-[11px] font-medium leading-4 text-[#64748B]">{detail}</p>
      </div>
    </div>
  );
}

function PricingLine({
  label,
  value,
  detail,
  strong = false,
}: {
  label: string;
  value: ReactNode;
  detail?: string;
  strong?: boolean;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1 rounded-lg border border-[#EEF2F7] bg-white px-3 py-2.5" data-client-pricing-line>
      <span className="min-w-0 [overflow-wrap:anywhere]">
        <span className={strong ? "block font-semibold leading-snug text-[#111827]" : "block font-medium leading-snug text-[#64748B]"}>
          {label}
        </span>
        {detail && <span className="mt-0.5 block text-xs font-medium leading-snug text-[#64748B]">{detail}</span>}
      </span>
      <span className={strong ? "break-words font-semibold tabular-nums leading-snug text-[#111B4D]" : "break-words font-semibold tabular-nums leading-snug text-[#111827]"}>
        {value}
      </span>
    </div>
  );
}

function CheckoutPricingLine({
  label,
  value,
  detail,
}: {
  label: string;
  value: ReactNode;
  detail?: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-3 text-sm">
      <span className="min-w-0">
        <span className="block font-medium text-[#64748B]">{label}</span>
        {detail && <span className="mt-0.5 block break-words text-xs font-medium leading-4 text-[#94A3B8]">{detail}</span>}
      </span>
      <span className="shrink-0 font-semibold tabular-nums text-[#111827]">{value}</span>
    </div>
  );
}

function PricingMini({ label, value, detail }: { label: string; value: ReactNode; detail?: string }) {
  return (
    <div className="min-w-0 rounded-lg border border-[#DDE6F7] bg-white px-3 py-2">
      <p className="text-xs font-semibold uppercase leading-snug tracking-wide text-[#64748B]">{label}</p>
      <p className="mt-1 break-words text-sm font-semibold leading-tight text-[#111B4D]">{value}</p>
      {detail && <p className="text-xs leading-snug text-[#64748B]">{detail}</p>}
    </div>
  );
}

function formatSentencePart(value: string) {
  return value.trim().replace(/[.!?]+$/, "");
}

function formatCourseEquation(
  baseAmount: number,
  groupSurchargeAmount: number,
  discountAmount: number,
  courseAmount: number,
) {
  const baseAndGroup = groupSurchargeAmount > 0
    ? `${formatXof(baseAmount)} + ${formatXof(groupSurchargeAmount)}`
    : formatXof(baseAmount);
  const discount = discountAmount > 0 ? ` - ${formatXof(discountAmount)}` : "";
  return `${baseAndGroup}${discount} = ${formatXof(courseAmount)}`;
}

function formatXof(amount: number) {
  return `${Math.max(0, Math.round(Number(amount) || 0)).toLocaleString("fr-FR")} FCFA`;
}
