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
  const multiplier = 1 + extraParticipants * 0.5;
  const transportFee = props.transportFee ?? 0;
  const transportRouteLabel = props.transportRouteLabel;
  const transportRuleLabel = props.transportRuleLabel;
  const discountAmount = props.discountAmount ?? 0;
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
    <section className="min-w-0 overflow-hidden rounded-[1.35rem] border border-[#E3E8F2] bg-white p-4 shadow-sm">
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-sm font-black text-[#111827]">
            <Calculator className="h-4 w-4 shrink-0 text-[#111B4D]" />
            Coût de la réservation
          </p>
          <p className="mt-1 text-xs font-semibold leading-5 text-[#64748B]">
            {isQuoteOnly ? "Chiffrage manuel avant paiement." : "Séances de 2h, groupe et déplacement inclus si applicable."}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-[11px] font-black uppercase tracking-wide text-[#64748B]">Total</p>
          <p className="mt-0.5 text-lg font-black leading-tight text-[#111B4D]">
            {isQuoteOnly ? "Sur devis" : <Money amount={totalPrice} />}
          </p>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-[repeat(auto-fit,minmax(7.5rem,1fr))] gap-2">
        <PricingFact
          icon={<Clock className="h-3.5 w-3.5" />}
          label="Séances"
          value={`${safeSessionsCount}`}
          detail={`${totalHours}h`}
        />
        <PricingFact
          icon={<Users className="h-3.5 w-3.5" />}
          label="Apprenants"
          value={`${safeParticipantsCount}`}
          detail={isGroup ? "+50%" : "Indiv."}
        />
        <PricingFact
          label="Prix 2h"
          value={isQuoteOnly ? "Devis" : <Money amount={indicativeSessionAmount} />}
          detail="indicatif"
        />
      </div>

      <div className="mt-3 min-w-0 space-y-2 rounded-2xl border border-[#E3E8F2] bg-white p-3 text-sm shadow-sm">
        {isQuoteOnly ? (
          <PricingLine label="Montant" value="Sur devis" strong />
        ) : (
          <>
            {isGroup ? (
              <>
                <PricingLine label="Base séances" value={<Money amount={baseFormulaAmount} />} />
                <PricingLine label={`Majoration groupe (${extraParticipants})`} value={<Money amount={groupSurchargeAmount} />} />
                {discountAmount > 0 && <PricingLine label="Remise pack" value={<Money amount={discountAmount} />} />}
                <PricingLine label="Sous-total cours" value={<Money amount={courseAmount} />} />
              </>
            ) : (
              <PricingLine label="Cours" value={<Money amount={courseAmount} />} />
            )}
            {(transportFee > 0 || transportRouteLabel) && (
              <PricingLine
                label={transportRouteLabel ? `Déplacement` : "Frais de déplacement"}
                value={transportFee > 0 ? <Money amount={transportFee} /> : "Inclus"}
              />
            )}
            <div className="border-t border-[#E3E8F2] pt-2">
              <PricingLine label="Total à payer" value={<Money amount={totalPrice} className="text-[#111B4D]" />} strong />
            </div>
          </>
        )}
      </div>

      {transportRuleLabel && audience === "client" && (
        <div className="mt-2 flex items-start gap-2 rounded-2xl border border-[#DDE6F7] bg-white px-3 py-2 text-xs font-medium leading-5 text-[#64748B]">
          <Car className="mt-0.5 h-4 w-4 shrink-0 text-[#111B4D]" />
          <span>{formatSentencePart(transportRuleLabel)}.</span>
        </div>
      )}

      {audience === "client" && (
        <div className="mt-2 flex items-start gap-2 rounded-2xl border border-[#DDE6F7] bg-white px-3 py-2 text-xs font-semibold leading-5 text-[#64748B] shadow-sm">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#111B4D]" />
          <span>Paiement sécurisé sur PayDunya, libéré après confirmation du cours.</span>
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
    <div className="min-w-0 rounded-2xl border border-[#E3E8F2] bg-white px-2 py-2">
      <div className="flex min-w-0 items-center gap-1.5 text-[#64748B]">
        {icon && <span className="shrink-0 text-[#111B4D]">{icon}</span>}
        <p className="break-words text-[10px] font-black uppercase tracking-normal">{label}</p>
      </div>
      <p className="mt-1 break-words text-sm font-black leading-tight text-[#111827]">{value}</p>
      <p className="mt-0.5 break-words text-[11px] font-semibold leading-tight text-[#64748B]">{detail}</p>
    </div>
  );
}

function PricingLine({ label, value, strong = false }: { label: string; value: ReactNode; strong?: boolean }) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
      <span className={strong ? "min-w-0 font-black leading-snug text-[#111827]" : "min-w-0 leading-snug text-[#64748B]"}>{label}</span>
      <span className={strong ? "text-right font-black tabular-nums leading-snug text-foreground" : "text-right font-semibold tabular-nums leading-snug text-foreground"}>{value}</span>
    </div>
  );
}

function PricingMini({ label, value, detail }: { label: string; value: ReactNode; detail?: string }) {
  return (
    <div className="min-w-0 rounded-2xl border border-[#DDE6F7] bg-white px-3 py-2 shadow-sm">
      <p className="text-xs font-bold uppercase leading-snug tracking-normal text-[#64748B]">{label}</p>
      <p className="mt-1 break-words text-sm font-black leading-tight text-[#111B4D]">{value}</p>
      {detail && <p className="text-xs leading-snug text-[#64748B]">{detail}</p>}
    </div>
  );
}

function formatSentencePart(value: string) {
  return value.trim().replace(/[.!?]+$/, "");
}
