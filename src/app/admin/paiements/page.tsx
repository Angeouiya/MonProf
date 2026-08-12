import Link from "next/link";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { PageHeader, EmptyState } from "@/components/shared/page-header";
import { Money } from "@/components/shared/money";
import { PaymentStatusBadge } from "@/components/shared/status-badge";
import { ProfessorImage } from "@/components/shared/professor-image";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { AlertTriangle, ExternalLink, FileText, Lock, ReceiptText, Wallet } from "lucide-react";
import { formatFCFA, formatDate, formatDateTime } from "@/lib/format";
import { paymentMethodLabel } from "@/lib/platform-labels";
import { PaiementsFiltersClient } from "./filters-client";
import { TeacherPayoutReceiptActions } from "@/components/admin/teacher-payout-receipt-actions";
import { FinancialOverview } from "@/components/admin/financial-overview";
import {
  buildPlatformFinancialSummary,
  providerFeeFinancialFields,
  sumProviderFeeAmounts,
} from "@/lib/financial-summary";
import { hasVerifiedPayDunyaClientPayment, verifiedPayDunyaBookingWhere } from "@/lib/payment-security";
import type { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

const VALID_METHODS = ["WAVE","ORANGE_MONEY","MTN_MONEY","MOOV_MONEY","DJAMO"];
const VALID_STATUSES = ["FAILED","RECEIVED","BLOCKED","VALIDATED","TO_PAY_TEACHER","TEACHER_PAID","DISPUTED","REFUND_PENDING","PARTIAL_REFUND_PENDING","REFUNDED","PARTIALLY_REFUNDED","RETAINED"];

export default async function AdminPaiementsPage({
  searchParams,
}: {
  searchParams: Promise<{ method?: string; status?: string; from?: string; to?: string }>;
}) {
  await requireAdmin("FINANCE_VIEW");
  const sp = await searchParams;
  const method = sp.method && VALID_METHODS.includes(sp.method) ? sp.method : undefined;
  const status = sp.status && VALID_STATUSES.includes(sp.status) ? sp.status : undefined;
  const fromCandidate = sp.from ? new Date(`${sp.from}T00:00:00.000Z`) : undefined;
  const toCandidate = sp.to ? new Date(`${sp.to}T00:00:00.000Z`) : undefined;
  const from = fromCandidate && !Number.isNaN(fromCandidate.getTime()) ? fromCandidate : undefined;
  const to = toCandidate && !Number.isNaN(toCandidate.getTime()) ? toCandidate : undefined;

  const transactionScope: Prisma.TransactionWhereInput = { type: "CLIENT_PAYMENT" };
  if (method) transactionScope.method = method as Prisma.EnumPaymentMethodFilter["equals"];
  if (status) transactionScope.status = status as Prisma.EnumPaymentStatusFilter["equals"];
  if (from || to) {
    const createdAt: Prisma.DateTimeFilter = {};
    if (from) createdAt.gte = from;
    if (to) createdAt.lt = new Date(to.getTime() + 24*60*60*1000);
    transactionScope.createdAt = createdAt;
  }
  const where: Prisma.TransactionWhereInput = {
    ...transactionScope,
    booking: { is: verifiedPayDunyaBookingWhere() },
  };

  const [
    rawTxs,
    rawFilteredStatusTotals,
    cancelledCommissionBookings,
    teacherPayouts,
    financialBookings,
    financialPayouts,
    appliedTeacherAdjustments,
  ] = await db.$transaction([
    db.transaction.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        booking: {
          select: {
            id: true, reference: true, subjectName: true, levelName: true, status: true, paymentStatus: true,
            totalClientPays: true, totalPrice: true, courseAmount: true, transportFee: true,
            paymentServiceFeeRate: true, paymentServiceFeeAmount: true,
            commissionAmount: true, cancellationPenaltyPlatformAmount: true,
            teacherNetAmount: true, teacherPaidAmount: true, cancellationPenaltyTeacherAmount: true,
            paydunyaStatus: true, paydunyaVerifiedAt: true,
            paymentProvider: true, providerPaymentStatus: true, paymentVerifiedAt: true,
            paymentAttempts: {
              where: { provider: "JEKO", purpose: "BOOKING", status: "SUCCEEDED" },
              select: { providerFeeAmountXof: true, providerFeeAmountMinor: true },
            },
            transactions: {
              where: { type: "CLIENT_PAYMENT" },
              select: { type: true, status: true, amount: true },
            },
            teacherPaymentAdjustments: {
              where: { status: "APPLIED" },
              select: { amount: true },
            },
            client: { select: { name: true } },
          },
        },
        teacher: { select: { id: true, fullName: true, professionalName: true, photoUrl: true, badgeVerified: true } },
      },
      take: 300,
    }),
    db.transaction.groupBy({
      by: ["status"],
      where,
      orderBy: { status: "asc" },
      _count: { _all: true },
      _sum: { amount: true, commission: true },
    }),
    db.booking.findMany({
      where: verifiedPayDunyaBookingWhere({
        status: { in: ["CANCELLED", "REFUNDED"] },
        transactions: { some: transactionScope },
      }),
      select: {
        cancellationPenaltyPlatformAmount: true,
        transactions: {
          where: transactionScope,
          select: { commission: true },
        },
      },
    }),
    db.teacherPayoutRecord.findMany({
      where: { status: "PAID" },
      orderBy: { paidAt: "desc" },
      include: {
        teacher: { select: { id: true, fullName: true, professionalName: true, photoUrl: true, badgeVerified: true, phone: true } },
        createdBy: { select: { name: true } },
        allocations: {
          include: { booking: { select: { id: true, reference: true, subjectName: true, levelName: true } } },
        },
      },
      take: 100,
    }),
    db.booking.findMany({
      where: verifiedPayDunyaBookingWhere(),
      select: {
        status: true,
        paymentStatus: true,
        paydunyaStatus: true,
        paydunyaVerifiedAt: true,
        paymentProvider: true,
        providerPaymentStatus: true,
        paymentVerifiedAt: true,
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
  // Prisma perd la forme précise des agrégats groupBy dans le tuple
  // hétérogène de $transaction, bien que ces deux agrégats soient requis
  // explicitement ci-dessus.
  const filteredStatusTotals = rawFilteredStatusTotals as Array<{
    status: string;
    _count: { _all: number };
    _sum: { amount: number | null; commission: number | null };
  }>;
  const txs = rawTxs.filter((tx) => tx.booking && hasVerifiedPayDunyaClientPayment(tx.booking));
  const transactionCount = filteredStatusTotals.reduce((sum, row) => sum + row._count._all, 0);
  const receivedAmount = filteredStatusTotals.reduce((sum, row) => sum + (row._sum.amount ?? 0), 0);
  const recordedCommission = filteredStatusTotals.reduce((sum, row) => sum + (row._sum.commission ?? 0), 0);
  const cancelledRecordedCommission = cancelledCommissionBookings.reduce(
    (sum, booking) => sum + booking.transactions.reduce((bookingSum, transaction) => bookingSum + transaction.commission, 0),
    0,
  );
  const cancellationPenaltyCommission = cancelledCommissionBookings.reduce(
    (sum, booking) => sum + Math.max(0, booking.cancellationPenaltyPlatformAmount),
    0,
  );
  const commissionAmount = Math.max(
    0,
    recordedCommission - cancelledRecordedCommission + cancellationPenaltyCommission,
  );
  const statusAmount = (targetStatus: string) => filteredStatusTotals
    .filter((row) => row.status === targetStatus)
    .reduce((sum, row) => sum + (row._sum.amount ?? 0), 0);
  const blockedAmount = statusAmount("BLOCKED");
  const disputedAmount = statusAmount("DISPUTED");
  const toPayTeacherAmount = statusAmount("TO_PAY_TEACHER");
  const attentionStatuses = new Set(["BLOCKED", "DISPUTED", "TO_PAY_TEACHER", "REFUND_PENDING", "PARTIAL_REFUND_PENDING", "RETAINED"]);
  const financialAttentionCount = filteredStatusTotals
    .filter((row) => attentionStatuses.has(row.status))
    .reduce((sum, row) => sum + row._count._all, 0);
  const financialAttentionAmount = filteredStatusTotals
    .filter((row) => attentionStatuses.has(row.status))
    .reduce((sum, row) => sum + (row._sum.amount ?? 0), 0);
  const averageAmount = transactionCount > 0 ? Math.round(receivedAmount / transactionCount) : 0;
  const hasTruncatedTransactions = transactionCount > txs.length;
  const financialSummary = buildPlatformFinancialSummary(
    financialBookings.filter(hasVerifiedPayDunyaClientPayment).map((booking) => ({
      ...booking,
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
  const providerFeesTotal = financialSummary.providerCollectionFees + financialSummary.rescheduleProviderFees;
  const heroHasAttention = financialAttentionCount > 0;
  const heroAmount = heroHasAttention ? financialAttentionAmount : financialSummary.teacherRemaining;
  const heroEyebrow = heroHasAttention ? "À traiter" : "Reste professeurs";
  const heroTitle = heroHasAttention
    ? `${financialAttentionCount} ligne${financialAttentionCount > 1 ? "s" : ""} à vérifier`
    : "Finance sous contrôle";
  const heroDescription = heroHasAttention
    ? "On contrôle les blocages, litiges, remboursements et libérations avant tout mouvement d'argent."
    : "Le net professeur, les frais et les commissions restent séparés, lisibles et rapprochés.";
  const heroActionHref = heroHasAttention ? "/admin/paiements?status=BLOCKED" : "/admin/professeurs-a-payer";
  const heroActionLabel = heroHasAttention ? "Contrôler" : "Payer les profs";

  return (
    <div className="space-y-5">
      <PageHeader title="Paiements" rootPage />

      <section
        aria-labelledby="admin-payment-hero-title"
        data-admin-payment-app-hero
        className="overflow-hidden rounded-[1.35rem] border border-[#111B4D] bg-[#111B4D] text-white shadow-sm"
      >
        <div className="grid gap-5 p-5 sm:p-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <div className="min-w-0">
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-white/12 text-white ring-1 ring-white/15">
              <Wallet className="h-5 w-5" />
            </span>
            <p className="mt-4 text-xs font-black uppercase tracking-[0.18em] text-white/65">
              {heroEyebrow}
            </p>
            <h2 id="admin-payment-hero-title" className="mt-2 text-2xl font-black leading-[1.05] tracking-tight sm:text-4xl">
              {heroTitle}
            </h2>
            <p className="mt-3 max-w-2xl text-sm font-semibold leading-6 text-white/72">
              {heroDescription}
            </p>
          </div>

          <div className="rounded-2xl border border-white/15 bg-white/10 p-4 lg:min-w-72">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-white/60">
              Montant prioritaire
            </p>
            <Money amount={heroAmount} className="mt-2 block text-3xl font-black leading-none text-white sm:text-4xl" />
            <Button asChild className="mt-4 h-11 w-full rounded-xl bg-white text-[#111B4D] hover:bg-white/90">
              <Link href={heroActionHref}>{heroActionLabel}</Link>
            </Button>
          </div>
        </div>

        <div data-admin-payment-amount-strip className="grid grid-cols-2 gap-2 border-t border-white/15 bg-white/[0.06] p-4 sm:grid-cols-4 sm:px-6">
          <PaymentHeroMetric label="Commission" value={commissionAmount} detail="Filtrée" />
          <PaymentHeroMetric label="Service restant" value={financialSummary.serviceFeesRemaining} detail="Après frais" />
          <PaymentHeroMetric label="Frais Jèko" value={providerFeesTotal} detail="Encaissement" />
          <PaymentHeroMetric label="Reste profs" value={financialSummary.teacherRemaining} detail="Net à libérer" />
        </div>
      </section>

      <FinancialOverview summary={financialSummary} />

      <div className="rounded-xl border border-[#DDE6F7] bg-white p-4">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.14em] text-[#4F46E5]">Registre filtrable</p>
            <h2 className="mt-1 text-lg font-black text-[#111827]">Résultats des filtres</h2>
            <p className="mt-1 text-xs font-semibold text-[#64748B]">
              Les totaux ci-dessous portent sur toutes les transactions correspondantes ; la table affiche au maximum les 300 plus récentes.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline" className="border-indigo-200 bg-indigo-50 text-indigo-800">
              {transactionCount} transaction{transactionCount > 1 ? "s" : ""}
            </Badge>
            <Badge variant="outline" className="border-slate-200 bg-white text-slate-700">
              Moy. {formatFCFA(averageAmount)}
            </Badge>
          </div>
        </div>
        <PaiementsFiltersClient filters={{ method: method ?? "", status: status ?? "", from: sp.from ?? "", to: sp.to ?? "" }} />
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <SignalCard
          title="Fonds bloqués"
          value={formatFCFA(blockedAmount)}
          description="Paiements clients sécurisés en attente de cours, validation ou décision admin."
          tone={blockedAmount ? "amber" : "blue"}
        />
        <SignalCard
          title="À payer professeurs"
          value={formatFCFA(toPayTeacherAmount)}
          description="Montants arrivés au stade de libération après validation du cours."
          tone={toPayTeacherAmount ? "violet" : "blue"}
        />
        <SignalCard
          title="Litiges financiers"
          value={formatFCFA(disputedAmount)}
          description="Sommes suspendues jusqu'à arbitrage, remboursement ou paiement partiel."
          tone={disputedAmount ? "red" : "blue"}
        />
        <SignalCard
          title="À surveiller"
          value={`${financialAttentionCount} ligne${financialAttentionCount > 1 ? "s" : ""}`}
          description="Transactions qui nécessitent une décision, un suivi professeur ou une libération."
          tone={financialAttentionCount ? "amber" : "blue"}
        />
      </div>

      {txs.length === 0 ? (
        <EmptyState icon={Wallet} title="Aucun paiement" description="Aucune transaction ne correspond." />
      ) : (
        <Card>
          <CardHeader className="flex-row items-start justify-between gap-3 space-y-0">
            <div>
              <CardTitle className="text-base">Paiements clients</CardTitle>
              <p className="mt-1 text-xs font-semibold text-muted-foreground">
                {hasTruncatedTransactions
                  ? `${txs.length} lignes affichées sur ${transactionCount} ; les cartes ci-dessus couvrent bien la totalité.`
                  : `${transactionCount} ligne${transactionCount > 1 ? "s" : ""} affichée${transactionCount > 1 ? "s" : ""}.`}
              </p>
            </div>
            {hasTruncatedTransactions && <Badge variant="secondary">300 plus récentes</Badge>}
          </CardHeader>
          <CardContent className="space-y-3 p-4 md:p-0">
            <div className="grid gap-3 md:hidden">
              {txs.map((t) => {
                const teacherName = t.teacher ? t.teacher.professionalName || t.teacher.fullName : "Professeur non attribué";
                return (
                  <Card key={t.id} className="border-violet-100 bg-white">
                    <CardContent className="space-y-4 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-mono text-xs font-bold text-primary">{t.reference}</p>
                          {t.booking ? (
                            <Link href={`/admin/reservations/${t.booking.id}`} className="mt-1 block truncate text-sm font-bold text-foreground">
                              {t.booking.reference}
                            </Link>
                          ) : (
                            <p className="mt-1 truncate text-sm font-bold text-foreground">Réservation indisponible</p>
                          )}
                        </div>
                        <PaymentStatusBadge status={t.status} />
                      </div>

                      <div className="flex min-w-0 items-center gap-3 rounded-lg border border-violet-100 bg-violet-50/50 p-3">
                        {t.teacher ? (
                          <ProfessorImage
                            photoUrl={t.teacher.photoUrl}
                            name={teacherName}
                            size="sm"
                            shape="circle"
                            verified={t.teacher.badgeVerified}
                          />
                        ) : (
                          <ProfessorImage photoUrl={null} name={teacherName} size="sm" shape="circle" verified={false} />
                        )}
                        <div className="min-w-0">
                          {t.teacher ? (
                            <Link href={teacherAccountingHref(t.teacher.id, t.booking?.id)} className="block truncate text-sm font-bold text-foreground">
                              {teacherName}
                            </Link>
                          ) : (
                            <p className="truncate text-sm font-bold text-foreground">{teacherName}</p>
                          )}
                          <p className="truncate text-xs text-muted-foreground">Client : {t.booking?.client?.name ?? "—"}</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div className="rounded-lg border border-violet-100 bg-white px-3 py-2">
                          <p className="text-[11px] font-medium text-muted-foreground">Montant</p>
                          <Money amount={t.amount} className="mt-1 text-xs font-black" />
                        </div>
                        <div className="rounded-lg border border-violet-100 bg-white px-3 py-2">
                          <p className="text-[11px] font-medium text-muted-foreground">Méthode</p>
                          <p className="mt-1 truncate text-xs font-bold text-foreground">{t.method ? paymentMethodLabel(t.method) : "—"}</p>
                        </div>
                        <div className="rounded-lg border border-violet-100 bg-white px-3 py-2">
                          <p className="text-[11px] font-medium text-muted-foreground">Cours</p>
                          <p className="mt-1 truncate text-xs font-bold text-foreground">{t.booking?.subjectName ?? "—"}</p>
                        </div>
                        <div className="rounded-lg border border-violet-100 bg-white px-3 py-2">
                          <p className="text-[11px] font-medium text-muted-foreground">Date</p>
                          <p className="mt-1 truncate text-xs font-bold text-foreground">{formatDate(t.createdAt)}</p>
                        </div>
                      </div>

                      {t.booking && (
                        <BookingFinancialBreakdown
                          provider={t.booking.paymentProvider}
                          legacyPayDunya={Boolean(t.booking.paydunyaVerifiedAt)}
                          courseAmount={t.booking.courseAmount}
                          transportFee={t.booking.transportFee}
                          serviceFeeAmount={t.booking.paymentServiceFeeAmount}
                          providerFeeAmount={sumProviderFeeAmounts(t.booking.paymentAttempts)}
                          commissionAmount={getActualBookingCommission(t.booking)}
                          teacherNetAmount={getActualBookingTeacherNet(t.booking)}
                          teacherPaidAmount={t.booking.teacherPaidAmount}
                          teacherRetainedAmount={sumAppliedBookingRetentions(t.booking)}
                          clientTotal={t.booking.totalClientPays}
                        />
                      )}

                      {t.booking && (
                        <PaymentActions bookingId={t.booking.id} teacherId={t.teacher?.id ?? null} compact />
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            <div className="hidden overflow-x-auto md:block">
            <Table className="min-w-[1480px]">
              <TableHeader>
                <TableRow>
                  <TableHead>Réf</TableHead>
                  <TableHead className="hidden md:table-cell">Réservation</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Professeur</TableHead>
                  <TableHead className="hidden lg:table-cell">Date</TableHead>
                  <TableHead className="hidden md:table-cell">Méthode</TableHead>
                  <TableHead className="text-right">Total client</TableHead>
                  <TableHead className="text-right">Cours</TableHead>
                  <TableHead className="text-right">Transport</TableHead>
                  <TableHead className="text-right">Service 3 %</TableHead>
                  <TableHead className="text-right">Frais Jèko</TableHead>
                  <TableHead className="text-right">Commission</TableHead>
                  <TableHead className="text-right">Net prof</TableHead>
                  <TableHead className="text-right">Payé prof</TableHead>
                  <TableHead className="text-right">Retenues</TableHead>
                  <TableHead className="text-right">Reste prof</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {txs.map((t) => {
                  const teacherName = t.teacher ? t.teacher.professionalName || t.teacher.fullName : "Professeur non attribué";
                  return (
                    <TableRow key={t.id}>
                      <TableCell className="font-mono text-xs">{t.reference}</TableCell>
                      <TableCell className="hidden md:table-cell text-sm text-primary">{t.booking?.reference ?? "—"}</TableCell>
                      <TableCell className="text-sm">{t.booking?.client?.name ?? "—"}</TableCell>
                      <TableCell className="text-sm">
                        <div className="flex min-w-0 items-center gap-2">
                          <ProfessorImage
                            photoUrl={t.teacher?.photoUrl ?? null}
                            name={teacherName}
                            size="sm"
                            shape="circle"
                            verified={Boolean(t.teacher?.badgeVerified)}
                          />
                          <div className="min-w-0">
                            {t.teacher ? (
                              <Link href={teacherAccountingHref(t.teacher.id, t.booking?.id)} className="block truncate font-medium text-foreground hover:text-primary">
                                {teacherName}
                              </Link>
                            ) : (
                              <p className="truncate font-medium text-foreground">{teacherName}</p>
                            )}
                            <p className="truncate text-xs text-muted-foreground">
                              {t.booking ? `${t.booking.subjectName} · ${t.booking.levelName}` : "Cours non lié"}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">{formatDate(t.createdAt)}</TableCell>
                      <TableCell className="hidden md:table-cell text-sm">
                        <p>{t.method ? paymentMethodLabel(t.method) : "—"}</p>
                        <p className="mt-0.5 text-[11px] font-semibold text-muted-foreground">{paymentProviderLabel(t.booking?.paymentProvider, Boolean(t.booking?.paydunyaVerifiedAt))}</p>
                      </TableCell>
                      <FinancialTableAmount value={t.booking?.totalClientPays ?? t.amount} strong />
                      <FinancialTableAmount value={t.booking?.courseAmount ?? 0} />
                      <FinancialTableAmount value={t.booking?.transportFee ?? 0} />
                      <FinancialTableAmount value={t.booking?.paymentServiceFeeAmount ?? 0} />
                      <FinancialTableAmount value={sumProviderFeeAmounts(t.booking?.paymentAttempts)} muted />
                      <FinancialTableAmount value={t.booking ? getActualBookingCommission(t.booking) : t.commission} />
                      <FinancialTableAmount value={t.booking ? getActualBookingTeacherNet(t.booking) : 0} />
                      <FinancialTableAmount value={t.booking?.teacherPaidAmount ?? 0} />
                      <FinancialTableAmount value={t.booking ? sumAppliedBookingRetentions(t.booking) : 0} muted />
                      <FinancialTableAmount value={t.booking ? Math.max(
                        0,
                        getActualBookingTeacherNet(t.booking)
                          - t.booking.teacherPaidAmount
                          - sumAppliedBookingRetentions(t.booking),
                      ) : 0} strong />
                      <TableCell>
                        <div className="space-y-1">
                          <PaymentStatusBadge status={t.status} />
                          {["BLOCKED", "DISPUTED", "TO_PAY_TEACHER", "REFUND_PENDING", "PARTIAL_REFUND_PENDING", "RETAINED"].includes(t.status) && (
                            <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700">Suivi requis</Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        {t.booking ? (
                          <PaymentActions bookingId={t.booking.id} teacherId={t.teacher?.id ?? null} />
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Factures / reçus professeurs</CardTitle>
          <p className="text-sm text-muted-foreground">
            Registre interne des paiements réellement versés aux professeurs, avec allocations, numéro de paiement et document téléchargeable.
          </p>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <div className="grid gap-3 p-4 md:hidden">
            {teacherPayouts.length === 0 ? (
              <p className="rounded-lg border border-dashed border-violet-100 bg-violet-50/30 p-4 text-center text-sm text-muted-foreground">
                Aucun versement professeur enregistré.
              </p>
            ) : (
              teacherPayouts.map((payout) => {
                const teacherName = payout.teacher.professionalName || payout.teacher.fullName;
                return (
                  <Card key={payout.id} className="border-violet-100 bg-white">
                    <CardContent className="space-y-4 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-mono text-xs font-bold text-primary">{payout.reference}</p>
                          <p className="mt-1 truncate text-xs text-muted-foreground">{payout.paidAt ? formatDateTime(payout.paidAt) : "Confirmation indisponible"}</p>
                          <p className="mt-1 text-[11px] font-bold uppercase tracking-wide text-emerald-700">Montant exact reçu</p>
                        </div>
                        <Money amount={payout.amount} className="shrink-0 text-sm font-black" />
                      </div>

                      <div className="grid grid-cols-2 gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs">
                        <PayoutFeeLine label="Net remis au professeur" value={payout.amount} strong />
                        <PayoutFeeLine label="Frais de transfert couverts" value={payout.transferFeeCoveredByPlatform} />
                        <PayoutFeeLine label="Frais réels prestataire" value={payout.transferFeeAmount} />
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-wide text-emerald-700">Prestataire</p>
                          <p className="mt-1 font-black text-[#111827]">{paymentProviderLabel(payout.provider)}</p>
                        </div>
                      </div>

                      <div className="flex min-w-0 items-center gap-3 rounded-lg border border-violet-100 bg-violet-50/50 p-3">
                        <ProfessorImage
                          photoUrl={payout.teacher.photoUrl}
                          name={teacherName}
                          size="sm"
                          shape="circle"
                          verified={payout.teacher.badgeVerified}
                        />
                        <div className="min-w-0">
                          <Link href={teacherAccountingHref(payout.teacher.id, payout.allocations[0]?.booking.id)} className="block truncate text-sm font-bold text-foreground">
                            {teacherName}
                          </Link>
                          <p className="truncate text-xs text-muted-foreground">{paymentMethodLabel(payout.method)}</p>
                          {payout.paymentPhone && (
                            <p className="truncate text-xs text-muted-foreground">Numéro payé : {payout.paymentPhone}</p>
                          )}
                        </div>
                      </div>

                      {payout.allocations.length > 0 && (
                        <div className="space-y-2">
                          <p className="text-xs font-semibold text-muted-foreground">Allocations</p>
                          {payout.allocations.slice(0, 3).map((allocation) => (
                            <Link
                              key={allocation.id}
                              href={`/admin/reservations/${allocation.booking.id}`}
                              className="block rounded-lg border border-violet-100 bg-white px-3 py-2 text-xs text-foreground"
                            >
                              <span className="font-mono font-bold text-primary">{allocation.booking.reference}</span>
                              <span className="ml-1 text-muted-foreground">{allocation.booking.subjectName}</span>
                              <Money amount={allocation.amount} className="mt-1 block font-bold" />
                            </Link>
                          ))}
                          {payout.allocations.length > 3 && (
                            <p className="text-xs text-muted-foreground">+{payout.allocations.length - 3} autre(s) allocation(s)</p>
                          )}
                        </div>
                      )}

                      {payout.note && (
                        <p className="rounded-lg border border-violet-100 bg-violet-50/50 p-3 text-xs text-muted-foreground">{payout.note}</p>
                      )}

                      <Button asChild variant="outline" className="h-11 w-full rounded-lg">
                        <Link href={teacherAccountingHref(payout.teacher.id, payout.allocations[0]?.booking.id)}>Voir comptabilité professeur</Link>
                      </Button>
                      <TeacherPayoutReceiptActions
                        teacherName={teacherName}
                        teacherPhone={payout.teacher.phone}
                        record={payout}
                        compact
                      />
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>

          <div className="hidden overflow-x-auto md:block">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Réf versement</TableHead>
                <TableHead>Professeur</TableHead>
                <TableHead className="hidden md:table-cell">Allocations</TableHead>
                <TableHead className="hidden lg:table-cell">Date</TableHead>
                <TableHead className="hidden md:table-cell">Méthode</TableHead>
                <TableHead className="text-right">Net exact reçu</TableHead>
                <TableHead className="text-right">Frais transfert couverts</TableHead>
                <TableHead>Prestataire</TableHead>
                <TableHead className="hidden xl:table-cell">Admin</TableHead>
                <TableHead className="text-right">Facture/reçu</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {teacherPayouts.length === 0 && (
                <TableRow>
                    <TableCell colSpan={10} className="py-6 text-center text-sm text-muted-foreground">
                    Aucun versement professeur enregistré.
                  </TableCell>
                </TableRow>
              )}
              {teacherPayouts.map((payout) => (
                <TableRow key={payout.id}>
                  <TableCell className="font-mono text-xs">{payout.reference}</TableCell>
                  <TableCell className="text-sm">
                    <div className="flex items-center gap-2">
                      <ProfessorImage
                        photoUrl={payout.teacher.photoUrl}
                        name={payout.teacher.professionalName || payout.teacher.fullName}
                        size="sm"
                        shape="circle"
                        verified={payout.teacher.badgeVerified}
                      />
                        <div className="min-w-0">
                          <Link href={teacherAccountingHref(payout.teacher.id, payout.allocations[0]?.booking.id)} className="block truncate font-medium text-foreground hover:text-primary">
                            {payout.teacher.professionalName || payout.teacher.fullName}
                          </Link>
                          {payout.paymentPhone && <p className="line-clamp-1 text-xs text-muted-foreground">Numéro payé : {payout.paymentPhone}</p>}
                          {payout.note && <p className="line-clamp-1 text-xs text-muted-foreground">{payout.note}</p>}
                        </div>
                      </div>
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-sm">
                    <div className="flex flex-col gap-1">
                      {payout.allocations.map((allocation) => (
                        <Link key={allocation.id} href={`/admin/reservations/${allocation.booking.id}`} className="text-primary hover:underline">
                          {allocation.booking.reference} · {allocation.booking.subjectName} · {formatFCFA(allocation.amount)}
                        </Link>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">{payout.paidAt ? formatDateTime(payout.paidAt) : "Confirmation indisponible"}</TableCell>
                  <TableCell className="hidden md:table-cell text-sm">{payout.method ? paymentMethodLabel(payout.method) : "—"}</TableCell>
                  <TableCell className="text-right"><Money amount={payout.amount} className="text-sm font-black text-emerald-700" /></TableCell>
                  <TableCell className="text-right">
                    <Money amount={payout.transferFeeCoveredByPlatform} className="text-sm font-semibold" />
                    <p className="text-[10px] font-semibold text-muted-foreground">par Compétence</p>
                  </TableCell>
                  <TableCell className="text-sm font-semibold">{paymentProviderLabel(payout.provider)}</TableCell>
                  <TableCell className="hidden xl:table-cell text-sm text-muted-foreground">{payout.createdBy?.name ?? "—"}</TableCell>
                  <TableCell className="text-right">
                    <TeacherPayoutReceiptActions
                      teacherName={payout.teacher.professionalName || payout.teacher.fullName}
                      teacherPhone={payout.teacher.phone}
                      record={payout}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function PaymentHeroMetric({
  label,
  value,
  detail,
}: {
  label: string;
  value: number;
  detail: string;
}) {
  return (
    <div className="rounded-2xl border border-white/12 bg-white/10 px-3 py-3">
      <p className="text-[10px] font-black uppercase tracking-[0.14em] text-white/55">{label}</p>
      <Money amount={value} className="mt-1 block text-sm font-black text-white sm:text-base" />
      <p className="mt-0.5 text-[11px] font-semibold text-white/55">{detail}</p>
    </div>
  );
}

function BookingFinancialBreakdown({
  provider,
  legacyPayDunya,
  courseAmount,
  transportFee,
  serviceFeeAmount,
  providerFeeAmount,
  commissionAmount,
  teacherNetAmount,
  teacherPaidAmount,
  teacherRetainedAmount,
  clientTotal,
}: {
  provider: string | null;
  legacyPayDunya: boolean;
  courseAmount: number;
  transportFee: number;
  serviceFeeAmount: number;
  providerFeeAmount: number;
  commissionAmount: number;
  teacherNetAmount: number;
  teacherPaidAmount: number;
  teacherRetainedAmount: number;
  clientTotal: number;
}) {
  const teacherBalance = teacherNetAmount - teacherPaidAmount - teacherRetainedAmount;
  const teacherRemaining = Math.max(0, teacherBalance);
  const teacherOverpaid = Math.max(0, -teacherBalance);

  return (
    <div className="rounded-lg border border-[#C7D2FE] bg-[#F8FAFF] p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] font-black uppercase tracking-wide text-[#111B4D]">Ventilation financière complète</p>
        <span className="rounded-full border border-[#C7D2FE] bg-white px-2 py-1 text-[10px] font-bold text-[#3730A3]">
          {paymentProviderLabel(provider, legacyPayDunya)}
        </span>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 min-[520px]:grid-cols-3">
        <FinancialMini label="Cours" value={courseAmount} />
        <FinancialMini label="Transport" value={transportFee} />
        <FinancialMini label="Service 3 %" value={serviceFeeAmount} />
        <FinancialMini label="Frais Jèko" value={providerFeeAmount} muted />
        <FinancialMini label="Commission" value={commissionAmount} />
        <FinancialMini label="Total client" value={clientTotal} strong />
        <FinancialMini label="Net professeur" value={teacherNetAmount} />
        <FinancialMini label="Déjà payé" value={teacherPaidAmount} />
        <FinancialMini label="Retenues" value={teacherRetainedAmount} muted />
        <FinancialMini label="Reste professeur" value={teacherRemaining} strong />
        <FinancialMini label="Surpaiement à régulariser" value={teacherOverpaid} strong={teacherOverpaid > 0} muted={teacherOverpaid === 0} />
      </div>
    </div>
  );
}

function FinancialMini({ label, value, strong = false, muted = false }: { label: string; value: number; strong?: boolean; muted?: boolean }) {
  return (
    <div className={strong ? "rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-2" : "rounded-lg border border-[#E2E8F0] bg-white px-2.5 py-2"}>
      <p className="text-[10px] font-bold uppercase tracking-wide text-[#64748B]">{label}</p>
      <Money amount={value} className={muted ? "mt-1 text-xs font-bold text-[#64748B]" : strong ? "mt-1 text-xs font-black text-emerald-800" : "mt-1 text-xs font-black text-[#111827]"} />
    </div>
  );
}

function FinancialTableAmount({ value, strong = false, muted = false }: { value: number; strong?: boolean; muted?: boolean }) {
  return (
    <TableCell className="whitespace-nowrap text-right">
      <Money
        amount={value}
        className={muted ? "text-xs font-semibold text-muted-foreground" : strong ? "text-xs font-black text-[#111B4D]" : "text-xs font-semibold"}
      />
    </TableCell>
  );
}

function PayoutFeeLine({ label, value, strong = false }: { label: string; value: number; strong?: boolean }) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-wide text-emerald-700">{label}</p>
      <Money amount={value} className={strong ? "mt-1 font-black text-emerald-800" : "mt-1 font-black text-[#111827]"} />
    </div>
  );
}

function getActualBookingCommission(booking: {
  status?: string | null;
  commissionAmount?: number | null;
  cancellationPenaltyPlatformAmount?: number | null;
}) {
  return ["CANCELLED", "REFUNDED"].includes(booking.status?.trim().toUpperCase() ?? "")
    ? Math.max(0, booking.cancellationPenaltyPlatformAmount ?? 0)
    : Math.max(0, booking.commissionAmount ?? 0);
}

function getActualBookingTeacherNet(booking: {
  status?: string | null;
  teacherNetAmount?: number | null;
  cancellationPenaltyTeacherAmount?: number | null;
}) {
  return ["CANCELLED", "REFUNDED"].includes(booking.status?.trim().toUpperCase() ?? "")
    ? Math.max(0, booking.cancellationPenaltyTeacherAmount ?? 0)
    : Math.max(0, booking.teacherNetAmount ?? 0);
}

function sumAppliedBookingRetentions(booking: {
  teacherPaymentAdjustments?: Array<{ amount?: number | null }> | null;
}) {
  return (booking.teacherPaymentAdjustments ?? []).reduce(
    (sum, adjustment) => sum + Math.max(0, adjustment.amount ?? 0),
    0,
  );
}

function paymentProviderLabel(provider?: string | null, hasLegacyPayDunyaProof = false) {
  if (provider === "PAYDUNYA" || hasLegacyPayDunyaProof) return "PayDunya (historique)";
  if (provider === "JEKO") return "Jèko";
  return "Versement historique";
}

function SignalCard({
  title,
  value,
  description,
  tone,
}: {
  title: string;
  value: string;
  description: string;
  tone: "amber" | "blue" | "red" | "violet";
}) {
  const toneClass = {
    amber: "border-amber-100 bg-amber-50/80 text-amber-950",
    blue: "border-blue-100 bg-blue-50/75 text-blue-950",
    red: "border-red-100 bg-red-50/75 text-red-950",
    violet: "border-violet-100 bg-violet-50/75 text-violet-950",
  }[tone];
  const iconClass = {
    amber: "text-amber-700",
    blue: "text-blue-700",
    red: "text-red-700",
    violet: "text-violet-700",
  }[tone];
  const Icon = tone === "red" ? AlertTriangle : tone === "amber" ? Lock : tone === "violet" ? ReceiptText : FileText;
  return (
    <div className={`rounded-lg border p-4 ${toneClass}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide opacity-70">{title}</p>
          <p className="mt-1 text-lg font-black">{value}</p>
        </div>
        <Icon className={`h-5 w-5 ${iconClass}`} />
      </div>
      <p className="mt-2 text-sm opacity-75">{description}</p>
    </div>
  );
}

function PaymentActions({
  bookingId,
  teacherId,
  compact,
}: {
  bookingId: string;
  teacherId: string | null;
  compact?: boolean;
}) {
  return (
    <div className={compact ? "grid gap-2" : "flex flex-wrap justify-end gap-2"}>
      <Button asChild size="sm" variant="secondary" className={compact ? "h-11 rounded-lg" : undefined}>
        <Link href={`/admin/reservations/${bookingId}`}>
          <ExternalLink className="mr-1.5 h-4 w-4" />
          Dossier
        </Link>
      </Button>
      {teacherId && (
        <Button asChild size="sm" variant="outline" className={compact ? "h-11 rounded-lg" : undefined}>
          <Link href={teacherAccountingHref(teacherId, bookingId)}>
            <Wallet className="mr-1.5 h-4 w-4" />
            Comptabilité
          </Link>
        </Button>
      )}
    </div>
  );
}

function teacherAccountingHref(teacherId: string, bookingId?: string | null) {
  return bookingId
    ? `/admin/professeurs/${teacherId}?tab=paiements&bookingId=${bookingId}`
    : `/admin/professeurs/${teacherId}?tab=paiements`;
}
