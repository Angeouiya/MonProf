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
  const providerFeeBalanceNegative = summary.providerFeeCoverageBalance < 0;
  const hasFinancialActivity = hasAnyAmount([
    summary.clientGross,
    summary.refundsPaid,
    summary.courseRevenue,
    summary.transportCollected,
    summary.rescheduleFeesCollected,
    summary.serviceFeesCollected,
    summary.clientProviderFeesCollected,
    summary.providerCollectionFees,
    summary.commissionRevenue,
    summary.teacherNetGenerated,
    summary.teacherPaid,
    summary.teacherRetained,
    summary.teacherOverpaid,
    summary.transferFeesCovered,
  ]);
  const providerFeeActivity = hasAnyAmount([
    summary.clientProviderFeesCollected,
    summary.providerCollectionFees,
    summary.providerFeeCoverageBalance,
  ]);
  const providerFeeMetricValue = summary.clientProviderFeesCollected > 0
    ? summary.clientProviderFeesCollected
    : summary.providerCollectionFees;
  const providerFeeMetricLabel = summary.clientProviderFeesCollected > 0
    ? "Frais paiement Jèko"
    : "Frais Jèko réels";
  const providerFeeMetricDetail = summary.clientProviderFeesCollected > 0
    ? "Payés séparément par le client"
    : "Frais prestataire à rapprocher";
  const serviceFeeActivity = hasAnyAmount([
    summary.serviceFeesCollected,
    summary.transferFeesCovered,
    summary.serviceFeesRemaining,
  ]);
  const rescheduleActivity = hasAnyAmount([
    summary.rescheduleGross,
    summary.rescheduleFeesCollected,
    summary.rescheduleServiceFees,
    summary.rescheduleProviderFees,
    summary.rescheduleCommissionRevenue,
    summary.rescheduleTeacherNetGenerated,
  ]);
  const teacherSettlementActivity = hasAnyAmount([
    summary.teacherNetGenerated,
    summary.teacherPaid,
    summary.teacherRetained,
    summary.teacherRemaining,
    summary.teacherOverpaid,
  ]);
  const primaryMetrics = [
    {
      key: "course",
      show: summary.courseRevenue > 0,
      icon: Banknote,
      label: "Cours",
      value: summary.courseRevenue,
      detail: "Prestations hors suppléments",
      tone: "navy" as const,
    },
    {
      key: "transport",
      show: summary.transportCollected > 0,
      icon: Car,
      label: "Transport",
      value: summary.transportCollected,
      detail: "Collecté selon chaque trajet",
      tone: "blue" as const,
    },
    {
      key: "commission",
      show: summary.commissionRevenue > 0,
      icon: BadgePercent,
      label: "Commission",
      value: summary.commissionRevenue,
      detail: "Cours et reports, comptés une fois",
      tone: "green" as const,
    },
    {
      key: "service",
      show: summary.serviceFeesCollected > 0,
      icon: WalletCards,
      label: "Frais de service (3 %)",
      value: summary.serviceFeesCollected,
      detail: "Distincts des frais Jèko",
      tone: "violet" as const,
    },
    {
      key: "jeko-client",
      show: providerFeeMetricValue > 0,
      icon: WalletCards,
      label: providerFeeMetricLabel,
      value: providerFeeMetricValue,
      detail: providerFeeMetricDetail,
      tone: "blue" as const,
    },
  ].filter((metric) => metric.show);
  const teacherAmounts: TeacherAmountItem[] = [
    { key: "generated", label: "Net généré", value: summary.teacherNetGenerated, show: summary.teacherNetGenerated > 0 },
    { key: "paid", label: "Déjà versé", value: summary.teacherPaid, show: summary.teacherPaid > 0 },
    {
      key: "retained",
      label: "Retenues appliquées",
      value: summary.teacherRetained,
      show: summary.teacherRetained > 0,
      retained: true,
    },
    {
      key: "remaining",
      label: "Reste à verser",
      value: summary.teacherRemaining,
      show: summary.teacherRemaining > 0,
      emphasized: true,
    },
    {
      key: "overpaid",
      label: "Surpaiement à régulariser",
      value: summary.teacherOverpaid,
      show: summary.teacherOverpaid > 0,
      retained: true,
    },
  ].filter((item) => item.show);
  const controlRows: FinancialControlRowItem[] = [
    {
      label: "Encaissement brut clients",
      kind: "Encaissement",
      detail: "Réservations + suppléments de report confirmés",
      value: summary.clientGross,
      required: hasFinancialActivity,
    },
    {
      label: "Remboursements exécutés",
      kind: "Sortie client",
      detail: "Transactions REFUND réellement finalisées",
      value: summary.refundsPaid,
      tone: "cost",
    },
    {
      label: "Encaissement net clients",
      kind: "Trésorerie nette",
      detail: "Encaissement brut moins remboursements exécutés",
      value: summary.clientNetCollected,
      tone: clientNetNegative ? "warning" : "primary",
      strong: true,
      required: hasFinancialActivity,
    },
    { label: "Prestations de cours", kind: "Activité", detail: "Valeur des cours confirmés", value: summary.courseRevenue },
    { label: "Transport collecté", kind: "Transit professeur", detail: "Déplacements calculés par trajet", value: summary.transportCollected },
    { label: "Frais de service collectés", kind: "Couverture technique", detail: "3 % facturés au client", value: summary.serviceFeesCollected, tone: "positive" },
    {
      label: "Frais paiement Jèko facturés",
      kind: "Pass-through client",
      detail: "Frais du moyen choisi, séparés du service 3 %",
      value: summary.clientProviderFeesCollected,
      tone: "positive",
      showWhen: providerFeeActivity,
    },
    {
      label: "Frais d'encaissement Jèko réels",
      kind: "Rapprochement Jèko",
      detail: "Frais réels retournés par Jèko",
      value: summary.providerCollectionFees,
      tone: "cost",
      showWhen: providerFeeActivity,
    },
    {
      label: "Solde frais paiement Jèko",
      kind: "Solde Jèko",
      detail: "Facturé client moins frais réel Jèko",
      value: summary.providerFeeCoverageBalance,
      tone: providerFeeBalanceNegative ? "warning" : "positive",
      strong: true,
      showWhen: providerFeeActivity,
    },
    { label: "Frais de retrait couverts", kind: "Coût Compétence", detail: "Jamais déduits du retrait professeur", value: summary.transferFeesCovered, tone: "cost" },
    {
      label: "Solde frais de service",
      kind: "Solde",
      detail: "Service 3 % moins frais de retrait couverts",
      value: summary.serviceFeesRemaining,
      tone: serviceBalanceNegative ? "warning" : "positive",
      strong: true,
      showWhen: serviceFeeActivity,
    },
    { label: "Commission Compétence", kind: "Revenu plateforme", detail: "Commission distincte des frais de service", value: summary.commissionRevenue, tone: "positive", strong: true },
    { label: "Net professeur généré", kind: "Dette professeur", detail: "Cours, transport et suppléments acquis", value: summary.teacherNetGenerated },
    { label: "Net professeur versé", kind: "Décaissé", detail: "Retraits Jèko confirmés", value: summary.teacherPaid },
    { label: "Retenues professeur appliquées", kind: "Retenue validée", detail: "Ajustements APPLIED, distincts des versements", value: summary.teacherRetained, tone: "cost" },
    {
      label: "Net professeur restant",
      kind: "À verser",
      detail: "Net généré moins versements et retenues",
      value: summary.teacherRemaining,
      tone: "primary",
      strong: true,
    },
    {
      label: "Surpaiement professeur",
      kind: "Anomalie",
      detail: "Versements et retenues au-delà du net généré",
      value: summary.teacherOverpaid,
      tone: "warning",
      strong: true,
    },
  ];
  const visibleControlRows = controlRows.filter((row) => row.required || row.showWhen || row.value !== 0);
  const headerAmounts: HeaderAmountItem[] = [
    {
      key: "gross",
      show: hasFinancialActivity,
      label: "Brut encaissé",
      value: summary.clientGross,
      detail: summary.rescheduleGross > 0
        ? `Base ${formatFCFA(summary.baseClientGross)} · reports ${formatFCFA(summary.rescheduleGross)}`
        : `Base ${formatFCFA(summary.baseClientGross)}`,
    },
    {
      key: "refunds",
      show: summary.refundsPaid > 0,
      label: "Remboursé",
      value: summary.refundsPaid,
      detail: "Remboursements exécutés",
      tone: "refund" as const,
    },
    {
      key: "net",
      show: hasFinancialActivity,
      label: "Net encaissé",
      value: summary.clientNetCollected,
      detail: "Brut moins remboursements",
      tone: clientNetNegative ? "warning" as const : "net" as const,
      emphasized: true,
    },
  ].filter((amount) => amount.show);

  return (
    <section aria-labelledby="financial-overview-title" className="overflow-hidden rounded-xl border border-[#C7D2FE] bg-white shadow-sm">
      <div
        className="grid gap-5 bg-[#111B4D] px-4 py-5 text-white sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(420px,0.8fr)] lg:items-end"
        data-admin-financial-overview-hero
      >
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#C7D2FE]">Vue financière consolidée</p>
          <h2 id="financial-overview-title" className="mt-1 text-xl font-black sm:text-2xl">Tous les montants, sans frais cachés</h2>
          <p className="mt-2 max-w-3xl text-sm font-medium leading-6 text-[#E0E7FF]">
            Les frais de service Compétence, les frais techniques Jèko et les versements professeurs restent séparés pour permettre un contrôle ligne par ligne.
          </p>
          <p className="mt-2 text-xs font-bold uppercase tracking-wide text-[#A5B4FC]">Périmètre : toutes les opérations vérifiées, toutes périodes</p>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {headerAmounts.length > 0 ? (
            headerAmounts.map((amount) => (
              <HeaderAmount
                key={amount.key}
                label={amount.label}
                value={amount.value}
                detail={amount.detail}
                tone={amount.tone}
                emphasized={amount.emphasized}
              />
            ))
          ) : (
            <div className="col-span-2 rounded-xl border border-white/20 bg-white/10 px-3 py-3 text-sm font-semibold leading-5 text-[#E0E7FF] sm:col-span-3">
              Aucun paiement vérifié côté serveur pour le moment.
            </div>
          )}
        </div>
      </div>

      <div className={cn("grid gap-3 p-4 sm:p-5", compact ? "md:grid-cols-3" : "sm:grid-cols-2 xl:grid-cols-5")}>
        {primaryMetrics.length > 0 ? (
          primaryMetrics.map((metric) => (
            <FinancialMetric
              key={metric.key}
              icon={metric.icon}
              label={metric.label}
              value={metric.value}
              detail={metric.detail}
              tone={metric.tone}
            />
          ))
        ) : (
          <div className="rounded-xl border border-dashed border-[#CBD5E1] bg-[#F8FAFC] p-4 text-sm font-semibold leading-6 text-[#475569] sm:col-span-2 xl:col-span-5">
            Aucune opération financière confirmée pour le moment. Les cartes chiffrées apparaîtront dès qu'un paiement vérifié existe.
          </div>
        )}
      </div>

      {rescheduleActivity && (
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
            {summary.rescheduleFeesCollected > 0 && <ReportAmount label="Frais de report" value={summary.rescheduleFeesCollected} />}
            {summary.rescheduleServiceFees > 0 && <ReportAmount label="Service 3 %" value={summary.rescheduleServiceFees} />}
            {summary.rescheduleProviderFees > 0 && <ReportAmount label="Frais Jèko" value={summary.rescheduleProviderFees} muted />}
            {summary.rescheduleCommissionRevenue > 0 && <ReportAmount label="Commission" value={summary.rescheduleCommissionRevenue} />}
            {summary.rescheduleTeacherNetGenerated > 0 && <ReportAmount label="Net professeur" value={summary.rescheduleTeacherNetGenerated} strong />}
          </div>
        </div>
      )}

      {(serviceFeeActivity || providerFeeActivity || teacherSettlementActivity) && (
        <div className="grid gap-4 border-t border-[#E0E7FF] bg-[#F8FAFF] p-4 sm:p-5 xl:grid-cols-[1fr_1fr]">
          {serviceFeeActivity && (
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
          <div className="mt-4 grid gap-2 sm:grid-cols-[1fr_auto_1fr_auto_1fr] sm:items-center">
            <FormulaAmount label="Service 3 %" value={summary.serviceFeesCollected} positive />
            <ArrowRight aria-hidden className="hidden h-4 w-4 text-[#94A3B8] sm:block" />
            <FormulaAmount label="Retraits couverts" value={summary.transferFeesCovered} zeroLabel="—" />
            <ArrowRight aria-hidden className="hidden h-4 w-4 text-[#94A3B8] sm:block" />
            <FormulaAmount label="Solde" value={summary.serviceFeesRemaining} result />
          </div>
          <p className="mt-3 text-xs font-medium leading-5 text-[#64748B]">
            Formule : frais de service collectés − frais de transfert professeur pris en charge par Compétence.
            Les frais de transfert confirmés par Jèko restent comptés même lorsqu'une tentative échoue, sans débiter le professeur.
          </p>
            </div>
          )}

          {providerFeeActivity && (
            <div className="rounded-xl border border-[#C7D2FE] bg-white p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-[#64748B]">Couverture frais paiement Jèko</p>
              <p className={cn("mt-1 text-2xl font-black tabular-nums", providerFeeBalanceNegative ? "text-red-700" : "text-emerald-700")}>
                {formatFCFA(summary.providerFeeCoverageBalance)}
              </p>
            </div>
            <span className={cn(
              "rounded-full border px-3 py-1 text-xs font-bold",
              providerFeeBalanceNegative
                ? "border-red-200 bg-red-50 text-red-700"
                : "border-emerald-200 bg-emerald-50 text-emerald-700",
            )}>
              {providerFeeBalanceNegative ? "Écart à absorber" : "Frais Jèko couverts"}
            </span>
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-[1fr_auto_1fr_auto_1fr] sm:items-center">
            <FormulaAmount label="Facturé client" value={summary.clientProviderFeesCollected} positive zeroLabel="Non isolé" />
            <ArrowRight aria-hidden className="hidden h-4 w-4 text-[#94A3B8] sm:block" />
            <FormulaAmount label="Réel Jèko" value={summary.providerCollectionFees} zeroLabel="—" />
            <ArrowRight aria-hidden className="hidden h-4 w-4 text-[#94A3B8] sm:block" />
            <FormulaAmount label="Solde" value={summary.providerFeeCoverageBalance} result />
          </div>
          <p className="mt-3 text-xs font-medium leading-5 text-[#64748B]">
            Les frais de paiement Jèko sont facturés au client selon le moyen choisi. Ils ne remplacent jamais les 3 % de service Compétence.
          </p>
            </div>
          )}

          {teacherSettlementActivity && (
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
            {teacherAmounts.map((item) => (
              <TeacherAmount
                key={item.key}
                label={item.label}
                value={item.value}
                emphasized={item.emphasized}
                retained={item.retained}
              />
            ))}
          </div>
          <p className="mt-3 text-xs font-semibold leading-5 text-[#64748B]">
            Calcul : net généré − versements confirmés − retenues validées. Dont pénalités réelles dues après annulation : {formatFCFA(summary.cancellationTeacherNetGenerated)}.
          </p>
            </div>
          )}
        </div>
      )}

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
              {visibleControlRows.map((row) => (
                <FinancialControlRow
                  key={row.label}
                  label={row.label}
                  kind={row.kind}
                  detail={row.detail}
                  value={row.value}
                  tone={row.tone}
                  strong={row.strong}
                />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

type FinancialControlRowItem = {
  label: string;
  kind: string;
  detail: string;
  value: number;
  tone?: "neutral" | "primary" | "positive" | "cost" | "warning";
  strong?: boolean;
  required?: boolean;
  showWhen?: boolean;
};

type TeacherAmountItem = {
  key: string;
  label: string;
  value: number;
  show: boolean;
  emphasized?: boolean;
  retained?: boolean;
};

type HeaderAmountItem = {
  key: string;
  show: boolean;
  label: string;
  value: number;
  detail: string;
  tone?: "neutral" | "refund" | "net" | "warning";
  emphasized?: boolean;
};

function hasAnyAmount(values: number[]) {
  return values.some((value) => value !== 0);
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
        <p className="text-xs font-black uppercase tracking-wide text-[#334155]">{label}</p>
        <Icon className="h-5 w-5 text-[#111B4D]" aria-hidden />
      </div>
      <p className="mt-3 text-xl font-black tabular-nums text-[#111827]">{formatFCFA(value)}</p>
      <p className="mt-1 text-xs font-semibold leading-5 text-[#475569]">{detail}</p>
    </div>
  );
}

function FormulaAmount({
  label,
  value,
  positive = false,
  result = false,
  zeroLabel,
}: {
  label: string;
  value: number;
  positive?: boolean;
  result?: boolean;
  zeroLabel?: string;
}) {
  const displayValue = zeroLabel && value === 0 ? zeroLabel : formatFCFA(value);

  return (
    <div className={cn("rounded-lg border px-3 py-2", result ? "border-[#818CF8] bg-[#EEF2FF]" : "border-[#E2E8F0] bg-white")}>
      <p className="text-[10px] font-bold uppercase tracking-wide text-[#64748B]">{positive ? "+ " : result ? "= " : "− "}{label}</p>
      <p className="mt-1 text-sm font-black tabular-nums text-[#111827]">{displayValue}</p>
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
    neutral: "border-white/20 bg-white/10",
    refund: "border-rose-300/40 bg-rose-400/10",
    net: "border-emerald-300/50 bg-emerald-400/15",
    warning: "border-red-300/50 bg-red-400/15",
  } as const;

  return (
    <div className={cn(
      "rounded-xl border px-3 py-3",
      emphasized && "col-span-2 sm:col-span-1",
      tones[tone],
    )} data-admin-financial-header-amount>
      <p className="text-[10px] font-bold uppercase tracking-wide text-[#E0E7FF]">{label}</p>
      <p className={cn("mt-1 font-black tabular-nums text-white", emphasized ? "text-2xl" : "text-lg")}>{formatFCFA(value)}</p>
      <p className="mt-1 text-[10px] font-semibold leading-4 text-[#C7D2FE]">{detail}</p>
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
