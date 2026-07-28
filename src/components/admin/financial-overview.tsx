import { ArrowRight, BadgePercent, Banknote, Car, CircleDollarSign, Landmark, WalletCards } from "lucide-react";
import { formatFCFA } from "@/lib/format";
import type { PlatformFinancialSummary } from "@/lib/financial-summary";
import { cn } from "@/lib/utils";

export function FinancialOverview({
  summary,
  compact = false,
}: {
  summary: PlatformFinancialSummary;
  compact?: boolean;
}) {
  const serviceBalanceNegative = summary.serviceFeesRemaining < 0;
  const clientNetNegative = summary.clientNetCollected < 0;

  return (
    <section aria-labelledby="financial-overview-title" className="overflow-hidden rounded-xl border border-[#C7D2FE] bg-white shadow-sm">
      <div className="grid gap-5 bg-[#111B4D] px-4 py-5 text-white sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(420px,0.8fr)] lg:items-end">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#C7D2FE]">Vue financière consolidée</p>
          <h2 id="financial-overview-title" className="mt-1 text-xl font-black sm:text-2xl">Tous les montants, sans frais cachés</h2>
          <p className="mt-2 max-w-3xl text-sm font-medium leading-6 text-[#E0E7FF]">
            Les frais de service Compétence, les frais techniques Jèko et les versements professeurs restent séparés pour permettre un contrôle ligne par ligne.
          </p>
          <p className="mt-2 text-xs font-bold uppercase tracking-wide text-[#A5B4FC]">Périmètre : toutes les opérations vérifiées, toutes périodes</p>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <HeaderAmount label="Brut encaissé" value={summary.clientGross} detail={`Base ${formatFCFA(summary.baseClientGross)} · reports ${formatFCFA(summary.rescheduleGross)}`} />
          <HeaderAmount label="Remboursé" value={summary.refundsPaid} detail="Remboursements exécutés" tone="refund" />
          <HeaderAmount
            label="Net encaissé"
            value={summary.clientNetCollected}
            detail="Brut moins remboursements"
            tone={clientNetNegative ? "warning" : "net"}
            emphasized
          />
        </div>
      </div>

      <div className={cn("grid gap-3 p-4 sm:p-5", compact ? "md:grid-cols-3" : "sm:grid-cols-2 xl:grid-cols-4")}>
        <FinancialMetric icon={Banknote} label="Cours" value={summary.courseRevenue} detail="Prestations hors suppléments" tone="navy" />
        <FinancialMetric icon={Car} label="Transport" value={summary.transportCollected} detail="Collecté selon chaque trajet" tone="blue" />
        <FinancialMetric icon={BadgePercent} label="Commission" value={summary.commissionRevenue} detail="Cours et reports, comptés une fois" tone="green" />
        <FinancialMetric icon={WalletCards} label="Frais de service (3 %)" value={summary.serviceFeesCollected} detail="Distincts des frais Jèko" tone="violet" />
      </div>

      <div className="border-t border-[#E0E7FF] bg-[#EEF2FF] p-4 sm:p-5">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.14em] text-[#3730A3]">Suppléments de report confirmés</p>
            <p className="mt-1 text-xs font-semibold leading-5 text-[#64748B]">
              Les encaissements, frais, commissions et parts professeurs des changements de créneau sont isolés puis inclus une seule fois dans les totaux ci-dessus.
            </p>
          </div>
          <p className="text-lg font-black tabular-nums text-[#111B4D]">{formatFCFA(summary.rescheduleGross)}</p>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
          <ReportAmount label="Total encaissé" value={summary.rescheduleGross} strong />
          <ReportAmount label="Frais de report" value={summary.rescheduleFeesCollected} />
          <ReportAmount label="Service 3 %" value={summary.rescheduleServiceFees} />
          <ReportAmount label="Frais Jèko" value={summary.rescheduleProviderFees} muted />
          <ReportAmount label="Commission" value={summary.rescheduleCommissionRevenue} />
          <ReportAmount label="Net professeur" value={summary.rescheduleTeacherNetGenerated} strong />
        </div>
      </div>

      <div className="grid gap-4 border-t border-[#E0E7FF] bg-[#F8FAFF] p-4 sm:p-5 xl:grid-cols-[1.08fr_0.92fr]">
        <div className="rounded-xl border border-[#C7D2FE] bg-white p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-[#64748B]">Solde des frais de service</p>
              <p className={cn("mt-1 text-2xl font-black tabular-nums", serviceBalanceNegative ? "text-red-700" : "text-emerald-700")}>
                {formatFCFA(summary.serviceFeesRemaining)}
              </p>
            </div>
            <span className={cn(
              "rounded-full border px-3 py-1 text-xs font-bold",
              serviceBalanceNegative
                ? "border-red-200 bg-red-50 text-red-700"
                : "border-emerald-200 bg-emerald-50 text-emerald-700",
            )}>
              {serviceBalanceNegative ? "Coût absorbé par Compétence" : "Reste après frais techniques"}
            </span>
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-[1fr_auto_1fr_auto_1fr_auto_1fr] sm:items-center">
            <FormulaAmount label="Service 3 %" value={summary.serviceFeesCollected} positive />
            <ArrowRight aria-hidden className="hidden h-4 w-4 text-[#94A3B8] sm:block" />
            <FormulaAmount label="Encaissement Jèko" value={summary.providerCollectionFees} />
            <ArrowRight aria-hidden className="hidden h-4 w-4 text-[#94A3B8] sm:block" />
            <FormulaAmount label="Retraits couverts" value={summary.transferFeesCovered} />
            <ArrowRight aria-hidden className="hidden h-4 w-4 text-[#94A3B8] sm:block" />
            <FormulaAmount label="Solde" value={summary.serviceFeesRemaining} result />
          </div>
          <p className="mt-3 text-xs font-medium leading-5 text-[#64748B]">
            Formule : frais de service collectés − frais d'encaissement Jèko − frais de transfert professeur pris en charge par Compétence.
            Les frais de transfert confirmés par Jèko restent comptés même lorsqu'une tentative échoue, sans débiter le professeur.
          </p>
        </div>

        <div className="rounded-xl border border-[#C7D2FE] bg-white p-4">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#EEF2FF] text-[#3730A3]">
              <Landmark className="h-5 w-5" />
            </span>
            <div>
              <p className="text-sm font-black text-[#111827]">Solde professeur exact</p>
              <p className="mt-1 text-xs font-medium leading-5 text-[#64748B]">Aucun frais de retrait n'est déduit du montant affiché au professeur.</p>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-1 gap-2 min-[420px]:grid-cols-2 xl:grid-cols-5">
            <TeacherAmount label="Net généré" value={summary.teacherNetGenerated} />
            <TeacherAmount label="Déjà versé" value={summary.teacherPaid} />
            <TeacherAmount label="Retenues appliquées" value={summary.teacherRetained} retained />
            <TeacherAmount label="Reste à verser" value={summary.teacherRemaining} emphasized />
            <TeacherAmount label="Surpaiement à régulariser" value={summary.teacherOverpaid} retained={summary.teacherOverpaid > 0} />
          </div>
          <p className="mt-3 text-xs font-semibold leading-5 text-[#64748B]">
            Calcul : net généré − versements confirmés − retenues validées. Dont pénalités réelles dues après annulation : {formatFCFA(summary.cancellationTeacherNetGenerated)}.
          </p>
        </div>
      </div>

      <div className="border-t border-[#C7D2FE] bg-white p-4 sm:p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#4F46E5]">Tableau de contrôle</p>
            <h3 className="mt-1 text-lg font-black text-[#111827]">Lecture complète des flux financiers</h3>
          </div>
          <p className="max-w-xl text-xs font-semibold leading-5 text-[#64748B]">
            Encaissements, revenus, coûts techniques et dette professeur sont affichés séparément pour faciliter le rapprochement.
          </p>
        </div>

        <div className="mt-4 overflow-x-auto rounded-xl border border-[#DDE6F7]">
          <table className="w-full min-w-[760px] border-collapse text-sm" aria-label="Tableau de contrôle financier Compétence">
            <thead className="bg-[#111B4D] text-left text-[11px] font-bold uppercase tracking-wide text-white">
              <tr>
                <th className="px-4 py-3">Indicateur</th>
                <th className="px-4 py-3">Nature</th>
                <th className="px-4 py-3">Lecture</th>
                <th className="px-4 py-3 text-right">Montant</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E6EAF3] bg-white">
              <FinancialControlRow label="Encaissement brut clients" kind="Encaissement" detail="Réservations + suppléments de report confirmés" value={summary.clientGross} />
              <FinancialControlRow label="Remboursements exécutés" kind="Sortie client" detail="Transactions REFUND réellement finalisées" value={summary.refundsPaid} tone="cost" />
              <FinancialControlRow label="Encaissement net clients" kind="Trésorerie nette" detail="Encaissement brut moins remboursements exécutés" value={summary.clientNetCollected} tone={clientNetNegative ? "warning" : "primary"} strong />
              <FinancialControlRow label="Prestations de cours" kind="Activité" detail="Valeur des cours confirmés" value={summary.courseRevenue} />
              <FinancialControlRow label="Transport collecté" kind="Transit professeur" detail="Déplacements calculés par trajet" value={summary.transportCollected} />
              <FinancialControlRow label="Frais de service collectés" kind="Couverture technique" detail="3 % facturés au client" value={summary.serviceFeesCollected} tone="positive" />
              <FinancialControlRow label="Frais d'encaissement Jèko" kind="Coût Compétence" detail="Frais réels retournés par Jèko" value={summary.providerCollectionFees} tone="cost" />
              <FinancialControlRow label="Frais de retrait couverts" kind="Coût Compétence" detail="Jamais déduits du retrait professeur" value={summary.transferFeesCovered} tone="cost" />
              <FinancialControlRow label="Solde frais de service" kind="Solde" detail="Service 3 % moins les deux coûts Jèko" value={summary.serviceFeesRemaining} tone={serviceBalanceNegative ? "warning" : "positive"} strong />
              <FinancialControlRow label="Commission Compétence" kind="Revenu plateforme" detail="Commission distincte des frais de service" value={summary.commissionRevenue} tone="positive" strong />
              <FinancialControlRow label="Net professeur généré" kind="Dette professeur" detail="Cours, transport et suppléments acquis" value={summary.teacherNetGenerated} />
              <FinancialControlRow label="Net professeur versé" kind="Décaissé" detail="Retraits Jèko confirmés" value={summary.teacherPaid} />
              <FinancialControlRow label="Retenues professeur appliquées" kind="Retenue validée" detail="Ajustements APPLIED, distincts des versements" value={summary.teacherRetained} tone="cost" />
              <FinancialControlRow label="Net professeur restant" kind="À verser" detail="Net généré moins versements et retenues" value={summary.teacherRemaining} tone="primary" strong />
              <FinancialControlRow label="Surpaiement professeur" kind="Anomalie" detail="Versements et retenues au-delà du net généré" value={summary.teacherOverpaid} tone={summary.teacherOverpaid > 0 ? "warning" : "positive"} strong />
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

function FinancialControlRow({
  label,
  kind,
  detail,
  value,
  tone = "neutral",
  strong = false,
}: {
  label: string;
  kind: string;
  detail: string;
  value: number;
  tone?: "neutral" | "primary" | "positive" | "cost" | "warning";
  strong?: boolean;
}) {
  const amountTone = {
    neutral: "text-[#111827]",
    primary: "text-[#111B4D]",
    positive: "text-emerald-700",
    cost: "text-amber-700",
    warning: "text-red-700",
  }[tone];

  return (
    <tr className={cn("hover:bg-[#F8FAFF]", strong && "bg-[#F8FAFF]")}>
      <th scope="row" className={cn("px-4 py-3 text-left text-sm text-[#111827]", strong ? "font-black" : "font-bold")}>{label}</th>
      <td className="px-4 py-3">
        <span className="inline-flex rounded-full border border-[#DDE6F7] bg-white px-2.5 py-1 text-[11px] font-bold text-[#475569]">{kind}</span>
      </td>
      <td className="px-4 py-3 text-xs font-semibold text-[#64748B]">{detail}</td>
      <td className={cn("px-4 py-3 text-right tabular-nums", amountTone, strong ? "text-base font-black" : "font-bold")}>{formatFCFA(value)}</td>
    </tr>
  );
}

function FinancialMetric({
  icon: Icon,
  label,
  value,
  detail,
  tone,
}: {
  icon: typeof CircleDollarSign;
  label: string;
  value: number;
  detail: string;
  tone: "navy" | "blue" | "green" | "violet";
}) {
  const tones = {
    navy: "border-[#CBD5E1] bg-[#F8FAFC] text-[#111B4D]",
    blue: "border-sky-200 bg-sky-50 text-sky-800",
    green: "border-emerald-200 bg-emerald-50 text-emerald-800",
    violet: "border-violet-200 bg-violet-50 text-violet-800",
  } as const;

  return (
    <div className={cn("rounded-xl border p-4", tones[tone])}>
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-black uppercase tracking-wide">{label}</p>
        <Icon className="h-5 w-5" aria-hidden />
      </div>
      <p className="mt-3 text-xl font-black tabular-nums text-[#111827]">{formatFCFA(value)}</p>
      <p className="mt-1 text-xs font-semibold leading-5 opacity-80">{detail}</p>
    </div>
  );
}

function FormulaAmount({ label, value, positive = false, result = false }: { label: string; value: number; positive?: boolean; result?: boolean }) {
  return (
    <div className={cn("rounded-lg border px-3 py-2", result ? "border-[#818CF8] bg-[#EEF2FF]" : "border-[#E2E8F0] bg-white")}>
      <p className="text-[10px] font-bold uppercase tracking-wide text-[#64748B]">{positive ? "+ " : result ? "= " : "− "}{label}</p>
      <p className="mt-1 text-sm font-black tabular-nums text-[#111827]">{formatFCFA(value)}</p>
    </div>
  );
}

function TeacherAmount({
  label,
  value,
  emphasized = false,
  retained = false,
}: {
  label: string;
  value: number;
  emphasized?: boolean;
  retained?: boolean;
}) {
  return (
    <div className={cn(
      "rounded-lg border px-3 py-3",
      emphasized
        ? "border-emerald-300 bg-emerald-50"
        : retained
          ? "border-amber-200 bg-amber-50"
          : "border-[#E2E8F0] bg-[#F8FAFC]",
    )}>
      <p className="text-[10px] font-bold uppercase tracking-wide text-[#64748B]">{label}</p>
      <p className={cn(
        "mt-1 text-sm font-black tabular-nums",
        emphasized ? "text-emerald-800" : retained ? "text-amber-800" : "text-[#111827]",
      )}>{formatFCFA(value)}</p>
    </div>
  );
}

function HeaderAmount({
  label,
  value,
  detail,
  tone = "neutral",
  emphasized = false,
}: {
  label: string;
  value: number;
  detail: string;
  tone?: "neutral" | "refund" | "net" | "warning";
  emphasized?: boolean;
}) {
  const tones = {
    neutral: "border-white/20 bg-white/10 text-white",
    refund: "border-rose-300/40 bg-rose-400/10 text-rose-100",
    net: "border-emerald-300/50 bg-emerald-400/15 text-emerald-100",
    warning: "border-red-300/50 bg-red-400/15 text-red-100",
  } as const;

  return (
    <div className={cn(
      "rounded-xl border px-3 py-3",
      emphasized && "col-span-2 sm:col-span-1",
      tones[tone],
    )}>
      <p className="text-[10px] font-bold uppercase tracking-wide opacity-80">{label}</p>
      <p className={cn("mt-1 font-black tabular-nums", emphasized ? "text-2xl" : "text-lg")}>{formatFCFA(value)}</p>
      <p className="mt-1 text-[10px] font-semibold leading-4 opacity-80">{detail}</p>
    </div>
  );
}

function ReportAmount({
  label,
  value,
  strong = false,
  muted = false,
}: {
  label: string;
  value: number;
  strong?: boolean;
  muted?: boolean;
}) {
  return (
    <div className={cn(
      "rounded-lg border px-3 py-3",
      strong ? "border-indigo-300 bg-white" : "border-[#D8DEFA] bg-white/80",
    )}>
      <p className="text-[10px] font-bold uppercase tracking-wide text-[#64748B]">{label}</p>
      <p className={cn(
        "mt-1 text-sm font-black tabular-nums",
        muted ? "text-[#64748B]" : strong ? "text-[#111B4D]" : "text-[#111827]",
      )}>
        {formatFCFA(value)}
      </p>
    </div>
  );
}
