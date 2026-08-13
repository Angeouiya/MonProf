import Link from "next/link";
import {
  ArrowRight,
  Banknote,
  CalendarClock,
  CheckCircle2,
  CircleDollarSign,
  GraduationCap,
  MessageSquareText,
  RefreshCw,
  ShieldAlert,
  Wallet,
} from "lucide-react";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { PageHeader } from "@/components/shared/page-header";
import { Money } from "@/components/shared/money";
import { PaymentStatusBadge } from "@/components/shared/status-badge";
import { ProfessorImage } from "@/components/shared/professor-image";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { WebPushControl } from "@/components/shared/web-push-control";
import { formatFCFA, timeAgo } from "@/lib/format";
import { hasVerifiedClientPayment, verifiedPayDunyaBookingWhere } from "@/lib/payment-security";
import { buildPlatformFinancialSummary, providerFeeFinancialFields } from "@/lib/financial-summary";
import { hasAdminPermission } from "@/lib/admin-permissions";
import { parsePricingSnapshot } from "@/lib/pricing";

export const dynamic = "force-dynamic";

export default async function AdminDashboard() {
  const user = await requireAdmin();
  const canViewFinance = hasAdminPermission(user.adminPermissions, "FINANCE_VIEW");
  const now = new Date();

  const [
    openDisputes,
    paidBookingsAwaitingAdmin,
    pendingTeacherConfirmations,
    pendingScheduleProposals,
    teacherMessagesWaitingAdmin,
    pendingPayoutRequests,
    pendingRefundRequests,
    blockedFundsAgg,
    recentPaidBooking,
    financialBookings,
    financialPayouts,
    appliedTeacherAdjustments,
  ] = await db.$transaction([
    db.dispute.count({ where: { status: { in: ["OPEN", "INVESTIGATING"] } } }),
    db.booking.count({
      where: verifiedPayDunyaBookingWhere({
        status: { in: ["PAID", "PENDING_ADMIN_VALIDATION", "CONFIRMED"] },
      }),
    }),
    db.teacherMissionLink.count({
      where: {
        status: { in: ["PENDING_CONFIRMATION", "RELAUNCHED"] },
        expiresAt: { gte: now },
        booking: { is: verifiedPayDunyaBookingWhere() },
      },
    }),
    db.bookingScheduleProposal.count({
      where: { status: "PENDING", booking: { is: verifiedPayDunyaBookingWhere() } },
    }),
    db.teacherAdminMessage.count({
      where: { sender: "TEACHER", status: { in: ["OPEN", "WAITING_ADMIN"] } },
    }),
    db.teacherPayoutRequest.count({ where: { status: "PENDING" } }),
    db.clientRefundRequest.count({ where: { status: { in: ["PENDING", "APPROVED"] } } }),
    db.booking.aggregate({
      where: verifiedPayDunyaBookingWhere({ paymentStatus: "BLOCKED" }),
      _sum: { totalClientPays: true },
    }),
    db.booking.findFirst({
      where: verifiedPayDunyaBookingWhere({
        paymentStatus: { in: ["BLOCKED", "VALIDATED", "TO_PAY_TEACHER", "TEACHER_PAID"] },
      }),
      include: {
        client: { select: { name: true } },
        teacher: {
          select: {
            id: true,
            professionalName: true,
            fullName: true,
            photoUrl: true,
            badgeVerified: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    db.booking.findMany({
      where: verifiedPayDunyaBookingWhere(),
      select: {
        status: true,
        pricingSnapshot: true,
        totalClientPays: true,
        courseAmount: true,
        transportFee: true,
        paymentServiceFeeAmount: true,
        commissionAmount: true,
        teacherNetAmount: true,
        teacherPaidAmount: true,
        cancellationPenaltyTeacherAmount: true,
        cancellationPenaltyPlatformAmount: true,
        teacherPayoutAllocations: {
          where: { payout: { status: "PAID" } },
          select: { amount: true },
        },
        paymentAttempts: {
          where: { provider: "JEKO", purpose: "BOOKING", status: "SUCCEEDED" },
          select: { providerFeeAmountXof: true, providerFeeAmountMinor: true },
        },
        rescheduleRequests: {
          where: { paidAt: { not: null } },
          select: {
            status: true,
            paidAt: true,
            totalToPay: true,
            feeAmount: true,
            paymentServiceFeeAmount: true,
            feePlatformAmount: true,
            feeTeacherAmount: true,
            transaction: { select: { status: true } },
            paymentAttempts: {
              where: { provider: "JEKO", purpose: "RESCHEDULE_FEE", status: "SUCCEEDED" },
              select: { providerFeeAmountXof: true, providerFeeAmountMinor: true },
            },
          },
        },
        transactions: {
          where: { type: { in: ["CLIENT_PAYMENT", "REFUND"] } },
          select: { type: true, amount: true, status: true },
        },
      },
    }),
    db.teacherPayoutRecord.findMany({
      where: { status: { in: ["PAID", "CANCELLED"] } },
      select: {
        amount: true,
        transferFeeCoveredByPlatform: true,
        transferFeeCoveredByPlatformMinor: true,
        status: true,
      },
    }),
    db.teacherPaymentAdjustment.findMany({
      where: { status: "APPLIED" },
      select: { amount: true, status: true },
    }),
  ]);

  const financialSummary = buildPlatformFinancialSummary(
    financialBookings.filter(hasVerifiedClientPayment).map((booking) => ({
      ...booking,
      paymentProviderFeeAmount: parsePricingSnapshot(booking.pricingSnapshot)?.paymentProviderFeeAmount ?? 0,
      paidPayoutAllocationAmount: booking.teacherPayoutAllocations.reduce(
        (sum, allocation) => sum + Math.max(0, allocation.amount),
        0,
      ),
      ...providerFeeFinancialFields(booking.paymentAttempts),
      refunds: booking.transactions.filter((transaction) => (
        transaction.type === "REFUND"
        && ["REFUNDED", "PARTIALLY_REFUNDED"].includes(transaction.status)
      )),
      reschedules: booking.rescheduleRequests.map((request) => ({
        ...request,
        transactionStatus: request.transaction?.status ?? null,
        ...providerFeeFinancialFields(request.paymentAttempts),
      })),
    })),
    financialPayouts,
    appliedTeacherAdjustments,
  );
  const blockedFunds = blockedFundsAgg._sum.totalClientPays ?? 0;
  const adminFinanceActivity = hasAnyAdminAmount([
    financialSummary.clientGross,
    financialSummary.refundsPaid,
    financialSummary.courseRevenue,
    financialSummary.transportCollected,
    financialSummary.serviceFeesCollected,
    financialSummary.clientProviderFeesCollected,
    financialSummary.providerCollectionFees,
    financialSummary.commissionRevenue,
    financialSummary.teacherNetGenerated,
    financialSummary.teacherPaid,
    financialSummary.teacherRetained,
    financialSummary.teacherOverpaid,
    financialSummary.transferFeesCovered,
    blockedFunds,
  ]);
  const allAdminFinanceCards: AdminFinanceCard[] = [
    {
      key: "net",
      show: adminFinanceActivity,
      label: "Net encaissé",
      value: financialSummary.clientNetCollected,
      icon: Wallet,
      tone: "navy" as const,
    },
    {
      key: "commission",
      show: financialSummary.commissionRevenue > 0,
      label: "Commission",
      value: financialSummary.commissionRevenue,
      icon: CircleDollarSign,
      tone: "green" as const,
    },
    {
      key: "service",
      show: financialSummary.serviceFeesRemaining !== 0,
      label: "Service restant",
      value: financialSummary.serviceFeesRemaining,
      icon: Banknote,
      tone: financialSummary.serviceFeesRemaining < 0 ? "red" : "violet",
    },
    {
      key: "teacher",
      show: financialSummary.teacherRemaining > 0,
      label: "Reste professeurs",
      value: financialSummary.teacherRemaining,
      icon: GraduationCap,
      tone: "blue" as const,
    },
  ];
  const adminFinanceCards = allAdminFinanceCards.filter((card) => card.show);
  const allAdminFinanceRows: AdminFinanceRow[] = [
    { label: "Brut encaissé", value: financialSummary.clientGross, required: adminFinanceActivity },
    { label: "Remboursé", value: financialSummary.refundsPaid },
    { label: "Frais de service collectés (3 %)", value: financialSummary.serviceFeesCollected },
    {
      label: "Frais paiement Jèko facturés",
      value: financialSummary.clientProviderFeesCollected,
      showWhen: hasAnyAdminAmount([
        financialSummary.clientProviderFeesCollected,
        financialSummary.providerCollectionFees,
        financialSummary.providerFeeCoverageBalance,
      ]),
    },
    {
      label: "Frais d'encaissement Jèko réels",
      value: financialSummary.providerCollectionFees,
      showWhen: hasAnyAdminAmount([
        financialSummary.clientProviderFeesCollected,
        financialSummary.providerCollectionFees,
        financialSummary.providerFeeCoverageBalance,
      ]),
    },
    {
      label: "Solde frais paiement Jèko",
      value: financialSummary.providerFeeCoverageBalance,
      showWhen: hasAnyAdminAmount([
        financialSummary.clientProviderFeesCollected,
        financialSummary.providerCollectionFees,
        financialSummary.providerFeeCoverageBalance,
      ]),
    },
    { label: "Frais de retrait couverts", value: financialSummary.transferFeesCovered },
    { label: "Fonds clients bloqués", value: blockedFunds },
    { label: "Déjà versé aux professeurs", value: financialSummary.teacherPaid },
    { label: "Retenues professeurs", value: financialSummary.teacherRetained },
  ];
  const adminFinanceRows = allAdminFinanceRows.filter((row) => row.required || row.showWhen || row.value !== 0);
  const priority = openDisputes > 0
    ? {
        eyebrow: "Litige prioritaire",
        title: `${openDisputes} litige${openDisputes > 1 ? "s" : ""} à traiter`,
        detail: "Sécurisez la réservation avant toute libération de fonds.",
        href: "/admin/litiges",
        action: "Traiter",
        icon: ShieldAlert,
      }
    : paidBookingsAwaitingAdmin > 0
      ? {
          eyebrow: "Paiement confirmé",
          title: `${paidBookingsAwaitingAdmin} réservation${paidBookingsAwaitingAdmin > 1 ? "s" : ""} à valider`,
          detail: "Le prestataire a confirmé les fonds. Vérifiez puis activez la mission.",
          href: "/admin/reservations?status=paid",
          action: "Valider",
          icon: CheckCircle2,
        }
      : pendingRefundRequests > 0
        ? {
            eyebrow: "Remboursement",
            title: `${pendingRefundRequests} demande${pendingRefundRequests > 1 ? "s" : ""} en attente`,
            detail: "Contrôlez le dossier avant l'exécution Jèko.",
            href: "/admin/remboursements",
            action: "Contrôler",
            icon: RefreshCw,
          }
        : pendingPayoutRequests > 0
          ? {
              eyebrow: "Retrait professeur",
              title: `${pendingPayoutRequests} demande${pendingPayoutRequests > 1 ? "s" : ""} à contrôler`,
              detail: "Le professeur recevra exactement le net affiché.",
              href: "/admin/professeurs-a-payer",
              action: "Contrôler",
              icon: Banknote,
            }
          : pendingTeacherConfirmations > 0
            ? {
                eyebrow: "Mission professeur",
                title: `${pendingTeacherConfirmations} réponse${pendingTeacherConfirmations > 1 ? "s" : ""} attendue${pendingTeacherConfirmations > 1 ? "s" : ""}`,
                detail: "Relancez ou remplacez le professeur si nécessaire.",
                href: "/admin/communication",
                action: "Suivre",
                icon: GraduationCap,
              }
            : teacherMessagesWaitingAdmin > 0
              ? {
                  eyebrow: "Message professeur",
                  title: `${teacherMessagesWaitingAdmin} message${teacherMessagesWaitingAdmin > 1 ? "s" : ""} à lire`,
                  detail: "Le professeur attend une réponse du service client.",
                  href: "/admin/messages",
                  action: "Répondre",
                  icon: MessageSquareText,
                }
              : pendingScheduleProposals > 0
                ? {
                    eyebrow: "Créneau proposé",
                    title: `${pendingScheduleProposals} proposition${pendingScheduleProposals > 1 ? "s" : ""} à suivre`,
                    detail: "Vérifiez la réponse du client et du professeur.",
                    href: "/admin/reservations",
                    action: "Vérifier",
                    icon: CalendarClock,
                  }
                : {
                    eyebrow: "Tout est à jour",
                    title: "Aucune urgence opérationnelle",
                    detail: "Paiements, missions, retraits et remboursements sont sous contrôle.",
                    href: "/admin/centre-operationnel",
                    action: "Tout vérifier",
                    icon: CheckCircle2,
                  };
  const PriorityIcon = priority.icon;

  return (
    <div className="space-y-5 sm:space-y-6">
      <PageHeader
        title={`Bonjour ${user.name.split(" ")[0]}`}
        rootPage
      />

      <WebPushControl audienceLabel="admin" />

      <Card
        className="overflow-hidden rounded-[1.35rem] border-[#111B4D] bg-[#111B4D] text-white shadow-sm"
        data-admin-dashboard-priority
        data-admin-dashboard-app-hero
      >
        <CardContent className="grid gap-5 p-5 sm:p-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <div className="min-w-0">
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-[#111B4D]">
              <PriorityIcon className="h-5 w-5" aria-hidden />
            </span>
            <p className="mt-5 text-[11px] font-black uppercase tracking-[0.18em] text-[#C7D2FE]">{priority.eyebrow}</p>
            <h2 className="mt-2 max-w-2xl text-2xl font-black leading-[1.05] tracking-tight sm:text-4xl">{priority.title}</h2>
            <p className="mt-3 max-w-xl text-sm font-semibold leading-6 text-[#E0E7FF]">{priority.detail}</p>
          </div>
          <Button asChild className="min-h-12 w-full rounded-2xl bg-white text-[#111B4D] hover:bg-[#EEF2FF] min-[520px]:w-auto">
            <Link href={priority.href}>
              {priority.action}
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          </Button>
        </CardContent>
      </Card>

      {canViewFinance && (
        <section
          className="overflow-hidden rounded-xl border border-[#C7D2FE] bg-white shadow-sm"
          aria-labelledby="admin-finance-title"
          data-admin-finance-surface="light"
        >
          <div className="flex flex-col gap-3 border-b border-[#E0E7FF] bg-[#F8FAFF] p-4 sm:flex-row sm:items-end sm:justify-between sm:p-5">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[#4F46E5]">Vue financière</p>
              <h2 id="admin-finance-title" className="mt-1 text-xl font-black text-[#111827]">L'argent, clairement</h2>
            </div>
            <Button asChild variant="outline" className="min-h-11 rounded-lg border-[#CAD7F2] bg-white text-[#111B4D]">
              <Link href="/admin/paiements">
                Tableau complet
                <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
            </Button>
          </div>

          {adminFinanceCards.length > 0 ? (
            <div className="grid grid-cols-2 gap-2 p-4 sm:gap-3 sm:p-5 lg:grid-cols-4">
              {adminFinanceCards.map((card) => (
                <AdminAmount
                  key={card.key}
                  label={card.label}
                  value={card.value}
                  icon={card.icon}
                  tone={card.tone}
                />
              ))}
            </div>
          ) : (
            <div className="p-4 sm:p-5">
              <div className="rounded-xl border border-dashed border-[#CBD5E1] bg-[#F8FAFC] p-4 text-sm font-semibold leading-6 text-[#475569]">
                Aucune opération financière confirmée pour le moment. Dès qu'un paiement est vérifié côté serveur, les cartes utiles apparaissent ici.
              </div>
            </div>
          )}

          {adminFinanceRows.length > 0 && (
            <div className="border-t border-[#E0E7FF] px-4 py-2 sm:px-5" role="table" aria-label="Montants financiers essentiels">
              {adminFinanceRows.map((row) => (
                <FinanceRow key={row.label} label={row.label} value={row.value} />
              ))}
            </div>
          )}
        </section>
      )}

      <Card className="border-[#E3E8F2] bg-white shadow-sm">
        <CardContent className="p-4 sm:p-5">
          <div className="mb-4">
            <p className="text-base font-black text-[#111827]">Dernier paiement</p>
          </div>
          {!recentPaidBooking ? (
            <div className="rounded-lg border border-dashed border-[#D7DEE9] px-4 py-6 text-center text-sm font-semibold text-[#64748B]">
              Aucun paiement confirmé.
            </div>
          ) : (
            <Link
              href={`/admin/reservations/${recentPaidBooking.id}`}
              className="grid gap-3 rounded-2xl border border-[#E6EAF3] bg-[#F8FAFD] p-4 transition hover:border-[#111B4D] sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center"
            >
              <ProfessorImage
                photoUrl={recentPaidBooking.teacher.photoUrl}
                name={recentPaidBooking.teacher.professionalName || recentPaidBooking.teacher.fullName}
                size="sm"
                shape="circle"
                verified={recentPaidBooking.teacher.badgeVerified}
              />
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-black text-[#111827]">{recentPaidBooking.reference}</p>
                  <PaymentStatusBadge status={recentPaidBooking.paymentStatus} />
                </div>
                <p className="mt-1 truncate text-sm font-semibold text-[#475569]">
                  {recentPaidBooking.client.name} · {recentPaidBooking.teacher.professionalName || recentPaidBooking.teacher.fullName}
                </p>
                <p className="mt-1 text-xs font-semibold text-[#64748B]">Confirmé {timeAgo(recentPaidBooking.createdAt)}</p>
              </div>
              <span className="flex items-center justify-between gap-3 text-sm font-black text-[#111B4D]">
                <Money amount={recentPaidBooking.totalPrice} />
                <ArrowRight className="h-4 w-4" aria-hidden />
              </span>
            </Link>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function AdminAmount({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: number;
  icon: typeof Wallet;
  tone: "navy" | "green" | "violet" | "blue" | "red";
}) {
  const tones = {
    navy: "border-[#C7D2FE] bg-white",
    green: "border-emerald-200 bg-white",
    violet: "border-violet-200 bg-white",
    blue: "border-sky-200 bg-white",
    red: "border-red-200 bg-white",
  } as const;
  const iconTones = {
    navy: "bg-[#EEF2FF] text-[#111B4D]",
    green: "bg-emerald-50 text-emerald-800",
    violet: "bg-violet-50 text-violet-800",
    blue: "bg-sky-50 text-sky-800",
    red: "bg-red-50 text-red-800",
  } as const;

  return (
    <div className={`rounded-xl border p-3 sm:p-4 ${tones[tone]}`} data-admin-finance-card="light">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] font-black uppercase tracking-wide text-[#334155]">{label}</p>
        <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${iconTones[tone]}`}>
          <Icon className="h-4 w-4" aria-hidden />
        </span>
      </div>
      <p className="mt-3 text-base font-black tabular-nums text-[#111827] sm:text-xl">{formatFCFA(value)}</p>
    </div>
  );
}

function FinanceRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex min-h-11 items-center justify-between gap-4 border-b border-[#EEF2F7] py-2 last:border-b-0" role="row">
      <span className="text-sm font-semibold text-[#475569]" role="cell">{label}</span>
      <span className="shrink-0 text-sm font-black tabular-nums text-[#111827]" role="cell">{formatFCFA(value)}</span>
    </div>
  );
}

type AdminFinanceCard = {
  key: string;
  show: boolean;
  label: string;
  value: number;
  icon: typeof Wallet;
  tone: "navy" | "green" | "violet" | "blue" | "red";
};

type AdminFinanceRow = {
  label: string;
  value: number;
  required?: boolean;
  showWhen?: boolean;
};

function hasAnyAdminAmount(values: number[]) {
  return values.some((value) => value !== 0);
}
