import type { ReactNode } from "react";
import { Calculator, Car, Clock, ShieldCheck, Users } from "lucide-react";
import { Money } from "@/components/shared/money";
import { packTypeLabel } from "@/lib/platform-labels";

type BookingPricingBreakdownBaseProps = {
  unitPrice: number;
  totalPrice: number;
  sessionsCount: number;
  participantsCount: number;
  groupType: string;
  packType: string;
  priceTierKey?: string | null;
  courseAmount?: number | null;
  transportFee?: number | null;
  transportFeeLabel?: string | null;
  transportRouteLabel?: string | null;
  transportRuleLabel?: string | null;
  materialFee?: number | null;
  discountAmount?: number | null;
  paymentServiceFeeAmount?: number | null;
  paymentServiceFeeLabel?: string | null;
  totalBeforePaymentServiceFee?: number | null;
  isQuoteOnly?: boolean | null;
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
  const safeSessionsCount = Math.max(1, Math.round(Number(sessionsCount) || 1));
  const safeParticipantsCount = Math.max(1, Math.round(Number(participantsCount) || 1));
  const extraParticipants = Math.max(0, safeParticipantsCount - 1);
  const transportFee = props.transportFee ?? 0;
  const transportRouteLabel = props.transportRouteLabel;
  const transportRuleLabel = props.transportRuleLabel;
  const discountAmount = props.discountAmount ?? 0;
  const paymentServiceFeeAmount = props.paymentServiceFeeAmount ?? 0;
  const paymentServiceFeeLabel = props.paymentServiceFeeLabel ?? "Frais de service paiement";
  const totalBeforePaymentServiceFee = props.totalBeforePaymentServiceFee ?? Math.max(0, totalPrice - paymentServiceFeeAmount);
  const indicativeSessionAmount = Math.max(0, Math.round(Number(unitPrice) || 0));
  const persistedCourseAmount = props.courseAmount ?? indicativeSessionAmount;
  const courseAmount = persistedCourseAmount > 0
    ? persistedCourseAmount
    : Math.max(0, totalPrice - transportFee);
  const isQuoteOnly = props.isQuoteOnly === true;
  const baseFormulaAmount = indicativeSessionAmount * safeSessionsCount;
  const groupSurchargeAmount = Math.max(0, Math.round(baseFormulaAmount * Math.max(0, safeParticipantsCount - 1) * 0.5));
  const averageSessionPrice = Math.round(courseAmount / safeSessionsCount);
  const totalHours = safeSessionsCount * 2;
  const isGroup = groupType === "SMALL_GROUP" || safeParticipantsCount > 1;
  const adminProps = props as BookingPricingBreakdownAdminProps;

  return (
    <section className="min-w-0 overflow-hidden rounded-lg border border-[#D8DEE9] bg-white p-3 min-[640px]:p-4" data-client-pricing-breakdown>
      <div className="grid gap-3 min-[620px]:grid-cols-[minmax(0,1fr)_minmax(13rem,auto)] min-[620px]:items-start">
        <div className="order-2 flex min-w-0 items-start gap-3 min-[620px]:order-1">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#111B4D] text-white">
            <Calculator className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-[#111827]">Coût de la réservation</p>
            <p className="mt-1 hidden text-sm font-medium leading-6 text-[#64748B] sm:block" data-client-pricing-helper>
              {isQuoteOnly
                ? "Calcul automatique à reprendre avant PayDunya."
                : audience === "client"
                  ? "Séances de 2h, participants, déplacement et frais PayDunya."
                  : "Vue interne avec éléments comptables réservés au service client."}
            </p>
          </div>
        </div>

        <div className="order-1 rounded-lg border border-[#111B4D] bg-[#111B4D] px-4 py-3 text-white min-[620px]:order-2" data-client-pricing-total>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-white">
            {isQuoteOnly ? "Montant" : "Total client"}
          </p>
          <p className="mt-1 text-2xl font-semibold leading-tight">
            {isQuoteOnly ? "Montant à recalculer" : <Money amount={totalPrice} />}
          </p>
          {!isQuoteOnly && (
            <p className="mt-1 text-xs font-semibold leading-5 text-white">
              PayDunya uniquement
            </p>
          )}
        </div>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-2 min-[520px]:grid-cols-3" data-client-pricing-facts>
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
          detail={isGroup ? `+50% x ${extraParticipants}` : "Individuel"}
        />
        <PricingFact
          label="Prix / séance"
          value={isQuoteOnly ? "À recalculer" : <Money amount={indicativeSessionAmount} />}
          detail={`${totalHours}h au total`}
        />
      </div>

      <div className="mt-3 min-w-0 rounded-lg border border-[#D8DEE9] bg-white p-3 min-[560px]:p-3.5" data-client-pricing-detail>
        <div className="flex flex-col gap-1 border-b border-[#E3E8F2] pb-3 min-[620px]:flex-row min-[620px]:items-end min-[620px]:justify-between">
          <div>
            <p className="text-sm font-semibold text-[#111827]">Détail du calcul</p>
            <p className="mt-0.5 hidden text-xs font-medium leading-5 text-[#64748B] min-[430px]:block">
              {isGroup
                ? "Chaque apprenant supplémentaire ajoute 50% du prix de base."
                : "Calcul individuel sur la formule choisie."}
            </p>
          </div>
          {!isQuoteOnly && (
            <p className="text-sm font-semibold text-[#111B4D] min-[620px]:text-right">
              Moyenne <Money amount={averageSessionPrice} /> / séance
            </p>
          )}
        </div>

        <div className="mt-3 space-y-2 text-sm">
          {isQuoteOnly ? (
            <PricingLine label="Montant" value="À recalculer avant PayDunya" strong />
          ) : (
            <>
              {isGroup ? (
                <>
                  <PricingLine label="Base séances" detail={`${safeSessionsCount} x 2h`} value={<Money amount={baseFormulaAmount} />} />
                  <PricingLine label="Majoration groupe" detail={`${extraParticipants} participant${extraParticipants > 1 ? "s" : ""} en plus`} value={<Money amount={groupSurchargeAmount} />} />
                  {discountAmount > 0 && <PricingLine label="Remise pack" value={<Money amount={discountAmount} />} />}
                  <PricingLine label="Sous-total cours" value={<Money amount={courseAmount} />} strong />
                </>
              ) : (
                <PricingLine label="Cours" detail={`${safeSessionsCount} séance${safeSessionsCount > 1 ? "s" : ""}`} value={<Money amount={courseAmount} />} strong />
              )}
              {(transportFee > 0 || transportRouteLabel) && (
                <PricingLine
                  label="Déplacement"
                  detail={transportRouteLabel ?? "Frais selon zone"}
                  value={transportFee > 0 ? <Money amount={transportFee} /> : "Inclus"}
                />
              )}
              {paymentServiceFeeAmount > 0 && (
                <>
                  <PricingLine label="Sous-total réservation" value={<Money amount={totalBeforePaymentServiceFee} />} />
                  <PricingLine label={paymentServiceFeeLabel} value={<Money amount={paymentServiceFeeAmount} />} />
                </>
              )}
              <div className="mt-3 border-t border-[#E3E8F2] pt-3">
                <PricingLine label="Total à payer via PayDunya" value={<Money amount={totalPrice} className="text-[#111B4D]" />} strong />
              </div>
            </>
          )}
        </div>
      </div>

      {transportRuleLabel && audience === "client" && (
        <div className="mt-3 flex items-start gap-2 rounded-lg border border-[#DDE6F7] bg-white px-3 py-2 text-xs font-medium leading-5 text-[#64748B]">
          <Car className="mt-0.5 h-4 w-4 shrink-0 text-[#111B4D]" />
          <span>{formatSentencePart(transportRuleLabel)}.</span>
        </div>
      )}

      {audience === "client" && (
        <div className="mt-3 flex items-start gap-2 rounded-lg border border-[#DDE6F7] bg-white px-3 py-2 text-xs font-semibold leading-5 text-[#64748B]">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#111B4D]" />
          <span>Paiement sécurisé sur PayDunya. Le numéro et le moyen de paiement sont choisis uniquement sur PayDunya, puis vérifiés côté serveur.</span>
        </div>
      )}

      {audience === "admin" && (
        <div className="mt-3 grid grid-cols-1 gap-2 border-t border-[#E3E8F2] pt-3 min-[480px]:grid-cols-3">
          <PricingMini label="Commission" value={<Money amount={adminProps.commissionAmount ?? 0} />} detail={adminProps.commissionRate !== undefined ? `${adminProps.commissionRate}%` : undefined} />
          <PricingMini label="Part prof cours" value={<Money amount={adminProps.teacherPayoutAmount ?? adminProps.teacherNetAmount ?? 0} />} detail="70% du cours" />
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
    <div data-client-pricing-fact className="flex min-w-0 items-start gap-3 rounded-lg border border-[#D8DEE9] bg-white px-3 py-2.5 min-[520px]:flex-col min-[760px]:flex-row">
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
    <div className="flex min-w-0 flex-col gap-1 rounded-lg border border-[#EEF2F7] bg-white px-3 py-2.5 min-[520px]:grid min-[520px]:grid-cols-[minmax(0,1fr)_auto] min-[520px]:items-start min-[520px]:gap-3 min-[520px]:border-0 min-[520px]:px-0 min-[520px]:py-0">
      <span className="min-w-0 [overflow-wrap:anywhere]">
        <span className={strong ? "block font-semibold leading-snug text-[#111827]" : "block font-medium leading-snug text-[#64748B]"}>
          {label}
        </span>
        {detail && <span className="mt-0.5 block text-xs font-medium leading-snug text-[#64748B]">{detail}</span>}
      </span>
      <span className={strong ? "break-words font-semibold tabular-nums leading-snug text-[#111B4D] min-[520px]:whitespace-nowrap min-[520px]:text-right" : "break-words font-semibold tabular-nums leading-snug text-[#111827] min-[520px]:whitespace-nowrap min-[520px]:text-right"}>
        {value}
      </span>
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
