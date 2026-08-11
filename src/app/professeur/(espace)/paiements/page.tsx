import Link from "next/link";
import type { ReactNode } from "react";
import { ChevronDown, ReceiptText, ShieldCheck, WalletCards } from "lucide-react";
import { db } from "@/lib/db";
import { formatDate, formatDateTime, formatFCFA } from "@/lib/format";
import { paymentMethodLabel } from "@/lib/payment-methods";
import { requireTeacher } from "@/lib/teacher-auth";
import { hasVerifiedPayDunyaClientPayment, verifiedPayDunyaBookingWhere } from "@/lib/payment-security";
import {
  calculateTeacherPayoutAvailability,
  getTeacherFinancialSettlement,
  getTeacherGlobalRetentionLedger,
  isCancellationPenaltyPayout,
} from "@/lib/teacher-payments";
import { TeacherPayoutReceiptActions } from "@/components/admin/teacher-payout-receipt-actions";
import {
  EmptyProfessorState,
  InfoLine,
  ProfessorPageHeader,
  StatusPill,
} from "@/components/professor/professor-ui";
import { TeacherPayoutRequestForm } from "@/components/professor/teacher-payout-request-form";
import { getPlatformRuntimeSettings } from "@/lib/platform-settings";

export const dynamic = "force-dynamic";

export default async function ProfesseurPaiementsPage() {
  const { teacher } = await requireTeacher();
  const platformSettings = await getPlatformRuntimeSettings();
  const [
    bookings,
    adjustments,
    payouts,
    payoutRequests,
    payoutFeeSummary,
    pendingRequestSummary,
    historicalSessionRetentions,
    historicalLegacyRetentions,
    draftAllocations,
  ] = await db.$transaction([
    db.booking.findMany({
      where: verifiedPayDunyaBookingWhere({
        AND: [
          { OR: [{ teacherId: teacher.id }, { sessions: { some: { teacherId: teacher.id } } }] },
          { OR: [
            {
              teacherNetAmount: { gt: 0 },
              status: { notIn: ["CANCELLED", "REFUNDED"] },
            },
            {
              status: { in: ["CANCELLED", "REFUNDED"] },
              paymentStatus: { in: ["PARTIALLY_REFUNDED", "RETAINED"] },
              cancellationPenaltyTeacherAmount: { gt: 0 },
            },
          ] },
        ],
      }),
      select: {
        id: true,
        reference: true,
        subjectName: true,
        levelName: true,
        scheduledDate: true,
        startDate: true,
        createdAt: true,
        paymentStatus: true,
        status: true,
        teacherNetAmount: true,
        teacherPaidAmount: true,
        cancellationPenaltyTeacherAmount: true,
        cancellationPenaltyTeacherRate: true,
        cancellationPenaltyPlatformAmount: true,
        cancellationPenaltyPlatformRate: true,
        rescheduleRequests: {
          where: { status: "APPLIED" },
          select: { feeTeacherAmount: true },
        },
        totalClientPays: true,
        totalPrice: true,
        paydunyaStatus: true,
        paydunyaVerifiedAt: true,
        paymentProvider: true,
        providerPaymentStatus: true,
        paymentVerifiedAt: true,
        transactions: { where: { type: "CLIENT_PAYMENT" }, select: { type: true, status: true, amount: true } },
        sessions: {
          where: { teacherId: teacher.id },
          select: { status: true, teacherNetAmount: true, releasedAmount: true, paidAmount: true, retainedAmount: true },
          orderBy: { sequence: "asc" },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    db.teacherPaymentAdjustment.findMany({
      where: { teacherId: teacher.id },
      select: { bookingId: true, amount: true, status: true },
    }),
    db.teacherPayoutRecord.findMany({
      where: { teacherId: teacher.id },
      include: {
        createdBy: { select: { name: true } },
        allocations: {
          include: {
            booking: { select: { reference: true, subjectName: true, levelName: true } },
            bookingSession: { select: { sequence: true } },
          },
        },
      },
      orderBy: { paidAt: "desc" },
      take: 50,
    }),
    db.teacherPayoutRequest.findMany({
      where: { teacherId: teacher.id },
      include: {
        payoutRecord: {
          include: {
            createdBy: { select: { name: true } },
            allocations: {
              include: {
                booking: { select: { reference: true, subjectName: true, levelName: true } },
                bookingSession: { select: { sequence: true } },
              },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 30,
    }),
    db.teacherPayoutRecord.aggregate({
      where: { teacherId: teacher.id, status: "PAID" },
      _sum: { transferFeeCoveredByPlatform: true },
    }),
    db.teacherPayoutRequest.aggregate({
      where: { teacherId: teacher.id, status: "PENDING" },
      _sum: { amount: true },
    }),
    db.bookingSession.findMany({
      where: { teacherId: teacher.id, retainedAmount: { gt: 0 } },
      select: { bookingId: true, retainedAmount: true },
    }),
    db.teacherPayoutAllocation.findMany({
      where: {
        bookingSessionId: null,
        retainedAmountSnapshot: { gt: 0 },
        payout: { teacherId: teacher.id, status: { in: ["DRAFT", "PAID"] } },
      },
      select: { bookingId: true, retainedAmountSnapshot: true },
    }),
    db.teacherPayoutAllocation.findMany({
      where: { payout: { teacherId: teacher.id, provider: "JEKO", status: "DRAFT" } },
      select: {
        amount: true,
        payout: { select: { payoutRequest: { select: { status: true } } } },
      },
    }),
  ]);

  const verifiedBookings = bookings.filter(hasVerifiedPayDunyaClientPayment);
  const settlementRows = verifiedBookings.map((booking) => ({
    booking,
    settlement: getTeacherFinancialSettlement(booking, adjustments),
  }));
  const visibleSettlementRows = settlementRows.slice(0, 100);
  const globalRetentionLedger = getTeacherGlobalRetentionLedger(
    adjustments,
    historicalSessionRetentions,
    historicalLegacyRetentions,
  );
  const availability = calculateTeacherPayoutAvailability({
    settlements: settlementRows.map(({ booking, settlement }) => ({
      bookingId: booking.id,
      remaining: settlement.remaining,
      totalOutstanding: settlement.totalOutstanding,
    })),
    globalRetentionLedger,
    pendingRequestedAmount: pendingRequestSummary._sum.amount,
    draftReservations: draftAllocations.map((allocation) => ({
      amount: allocation.amount,
      payoutRequestStatus: allocation.payout.payoutRequest?.status ?? null,
    })),
  });
  const totalNet = settlementRows.reduce((sum, row) => sum + row.settlement.expectedAmount, 0);
  const totalReleased = settlementRows.reduce((sum, row) => sum + row.settlement.released, 0);
  const totalPaid = settlementRows.reduce((sum, row) => sum + row.settlement.paid, 0);
  const totalRetained = settlementRows.reduce((sum, row) => sum + row.settlement.retained, 0)
    + availability.retentionNotRepresentedInSettlements;
  const remaining = availability.totalOutstanding;
  const readyToReceive = availability.readyToReceive;
  const blockedAmount = settlementRows.reduce((sum, row) => sum + row.settlement.blocked, 0);
  const underControlAmount = Math.max(0, remaining - readyToReceive - blockedAmount);
  const pendingRequested = availability.pendingRequestedAmount;
  const draftReservedAmount = availability.draftReservedAmount;
  const requestableAmount = availability.requestableAmount;
  const transferFeesCovered = Math.max(0, payoutFeeSummary._sum.transferFeeCoveredByPlatform ?? 0);

  return (
    <div className="space-y-6">
      <ProfessorPageHeader
        title="Paiements"
        description="Retraits et reçus."
        rootTab
      />

      <section
        data-professor-payment-pulse
        aria-labelledby="teacher-exact-balance"
        className="overflow-hidden rounded-[1.35rem] border border-[#1E2A78] bg-[#111B4D] text-white shadow-sm"
      >
        <div className="grid gap-5 p-5 sm:p-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <div>
            <div className="flex items-center gap-2 text-[#C7D2FE]">
              <ShieldCheck className="h-5 w-5" aria-hidden />
              <p className="text-xs font-black uppercase tracking-[0.16em]">Net professeur</p>
            </div>
            <h2 id="teacher-exact-balance" className="mt-2 text-4xl font-black leading-none tracking-[-0.04em] sm:text-5xl">
              {formatFCFA(requestableAmount)}
            </h2>
            <p className="mt-2 text-sm font-semibold leading-6 text-[#E0E7FF]">
              Disponible maintenant. Aucun frais retiré.
            </p>
          </div>
          <a
            href="#demande-retrait-professeur"
            className="inline-flex min-h-12 items-center justify-center rounded-xl bg-white px-6 text-sm font-black text-[#111B4D] shadow-sm transition hover:bg-[#EEF2FF] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#111B4D]"
          >
            Retirer
          </a>
        </div>
        <div className="grid grid-cols-3 gap-2 border-t border-white/15 bg-white/5 p-4 sm:px-6">
          <TeacherExactMetric label="À recevoir" value={remaining} emphasized />
          <TeacherExactMetric label="En cours" value={pendingRequested + draftReservedAmount} />
          <TeacherExactMetric label="Frais payés" value={transferFeesCovered} />
        </div>
      </section>

      <ProfessorDisclosure
        title="Voir le calcul exact"
        description="Net, fonds bloqués, retenues et transferts en cours."
      >
        <p className="mb-3 text-xs font-semibold leading-5 text-[#64748B]">
          Net prévu − paiements reçus − retenues validées = reste à recevoir.
        </p>
        <div className="grid gap-2 text-sm min-[520px]:grid-cols-3">
            <AccountingMini label="Net prévu" value={formatFCFA(totalNet)} />
            <AccountingMini label="Déjà payé" value={formatFCFA(totalPaid)} />
            <AccountingMini label="Reste dû" value={formatFCFA(remaining)} strong />
            <AccountingMini label="Déjà libéré" value={formatFCFA(totalReleased)} />
            <AccountingMini label="Payable brut" value={formatFCFA(readyToReceive)} />
            <AccountingMini label="Demandes en attente" value={formatFCFA(pendingRequested)} />
            <AccountingMini label="Transferts en cours" value={formatFCFA(draftReservedAmount)} />
            <AccountingMini label="Demandable" value={formatFCFA(requestableAmount)} strong />
            <AccountingMini label="Encore bloqué" value={formatFCFA(blockedAmount)} />
            <AccountingMini label="Retenues validées" value={formatFCFA(totalRetained)} />
            <AccountingMini label="En contrôle" value={formatFCFA(underControlAmount)} />
        </div>
      </ProfessorDisclosure>

      <TeacherPayoutRequestForm
        readyToReceive={readyToReceive}
        pendingRequested={pendingRequested}
        draftReservedAmount={draftReservedAmount}
        defaultPhone={teacher.defaultPayoutPhone || teacher.phone}
        defaultMethod={teacher.defaultPayoutMethod}
        payoutInstructions={teacher.payoutInstructions}
        minimumProcessingHours={platformSettings.payoutDelay.minimumHours}
        maximumProcessingHours={platformSettings.payoutDelay.maximumHours}
      />

      <ProfessorDisclosure
        title="Mes demandes"
        description="Demandes en attente et paiements traités."
        count={payoutRequests.length}
      >
          <div className="flex justify-end">
            <div className="rounded-lg border border-[#E6EAF3] bg-white px-3 py-2 text-right">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[#64748B]">Demandable</p>
              <p className="text-sm font-semibold text-[#111B4D]">{formatFCFA(requestableAmount)}</p>
            </div>
          </div>
          {payoutRequests.length === 0 ? (
            <p className="mt-4 rounded-lg border border-dashed border-[#D7DEE9] bg-white p-4 text-sm font-semibold leading-6 text-[#64748B]">
              Aucune demande envoyée pour le moment.
            </p>
          ) : (
            <div className="mt-4 grid gap-3">
              {payoutRequests.map((request) => (
                <div key={request.id} className="rounded-lg border border-[#E6EAF3] bg-white p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-mono text-xs font-semibold text-[#111B4D]">{request.reference}</p>
                      <p className="mt-1 text-sm font-semibold text-[#111827]">{formatFCFA(request.amount)}</p>
                    </div>
                    <StatusPill status={request.status} />
                  </div>
                  <div className="mt-3">
                    <InfoLine label="Méthode" value={paymentMethodLabel(request.method)} />
                    <InfoLine label="Numéro" value={request.paymentPhone} />
                    <InfoLine label="Envoyée" value={formatDateTime(request.createdAt)} />
                    {request.reviewedAt && <InfoLine label="Traitée" value={formatDateTime(request.reviewedAt)} />}
                  </div>
                  {request.note && <p className="mt-3 text-xs font-semibold leading-5 text-[#64748B]">{request.note}</p>}
                  {request.adminNote && (
                    <div className="mt-3 rounded-lg border border-[#E6EAF3] bg-white p-3 text-xs font-semibold leading-5 text-[#64748B]">
                      <p className="mb-1 text-[11px] uppercase tracking-wide text-[#111B4D]">Note du service client</p>
                      <p>{request.adminNote}</p>
                    </div>
                  )}
                  {request.payoutRecord && (
                    <div className="mt-3 rounded-lg border border-[#D7DEE9] bg-white p-3">
                      <div className="flex flex-col gap-2 min-[640px]:flex-row min-[640px]:items-start min-[640px]:justify-between">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wide text-[#64748B]">
                            {request.payoutRecord.status === "PAID" ? "Facture liée" : "Transfert lié"}
                          </p>
                          <p className="mt-1 font-mono text-sm font-semibold text-[#111827]">{request.payoutRecord.reference}</p>
                           <p className="mt-1 text-xs font-semibold text-[#64748B]">
                             {request.payoutRecord.status === "PAID"
                               ? "Document généré après validation et versement par le service client."
                               : "Transfert Jèko en attente de confirmation. Votre solde n'est pas encore marqué comme payé."}
                           </p>
                           {request.payoutRecord.status === "PAID" && (
                             <p className="mt-2 text-xs font-black text-emerald-700">
                               Net exact reçu : {formatFCFA(request.payoutRecord.amount)} · Frais couverts : {formatFCFA(request.payoutRecord.transferFeeCoveredByPlatform)}
                             </p>
                           )}
                        </div>
                        {request.payoutRecord.status === "PAID" && (
                          <TeacherPayoutReceiptActions
                            compact
                            teacherName={teacher.professionalName || teacher.fullName}
                            teacherPhone={teacher.phone}
                            record={request.payoutRecord}
                            issuerLabel="Service client"
                          />
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
      </ProfessorDisclosure>

      <div className="grid gap-5 xl:grid-cols-[1.25fr_0.9fr]">
        <ProfessorDisclosure
          title="Détail des cours"
          description="Montants générés par chaque cours."
          count={visibleSettlementRows.length}
        >
          <p className="text-xs font-semibold leading-5 text-[#64748B]">
            100 dernières lignes affichées. Les totaux ci-dessus couvrent toutes les périodes.
          </p>
          {visibleSettlementRows.length === 0 ? (
            <div className="mt-4">
              <EmptyProfessorState title="Aucune ligne de paiement" description="Les réservations payables apparaîtront ici après validation du service client." />
            </div>
          ) : (
            <div className="mt-4 grid gap-3">
              {visibleSettlementRows.map(({ booking, settlement }) => {
                const cancellationPenalty = isCancellationPenaltyPayout(booking);
                const rescheduleSupplement = booking.rescheduleRequests.reduce((sum, request) => sum + Math.max(0, request.feeTeacherAmount), 0);
                return (
                <Link
                  key={booking.id}
                  href={`/professeur/missions/${booking.id}`}
                  className="grid gap-3 rounded-lg border border-[#E6EAF3] bg-white p-4 transition hover:border-[#111B4D] lg:grid-cols-[1fr_auto]"
                >
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-[#111827]">{booking.reference}</p>
                      <StatusPill status={booking.paymentStatus} />
                      {cancellationPenalty && <StatusPill status="INDEMNITÉ ANNULATION" />}
                    </div>
                    <p className="mt-1 text-sm font-bold text-[#111827]">{booking.subjectName} - {booking.levelName}</p>
                    <p className="mt-1 text-xs font-semibold text-[#64748B]">{formatDate(booking.scheduledDate ?? booking.startDate ?? booking.createdAt)}</p>
                  </div>
                  <div className="grid min-w-[220px] gap-1 text-sm">
                    <InfoLine label={cancellationPenalty ? "Indemnité" : "Net prévu"} value={formatFCFA(settlement.expectedAmount)} />
                    {!cancellationPenalty && <InfoLine label="Libéré" value={formatFCFA(settlement.released)} />}
                    {!cancellationPenalty && <InfoLine label="Bloqué" value={formatFCFA(settlement.blocked)} />}
                    {rescheduleSupplement > 0 && <InfoLine label="Supplément report" value={formatFCFA(rescheduleSupplement)} />}
                    {cancellationPenalty && <InfoLine label="Net cours initial" value={formatFCFA(booking.teacherNetAmount)} />}
                    <InfoLine label="Payé" value={formatFCFA(settlement.paid)} />
                    <InfoLine label="Retenu" value={formatFCFA(settlement.retained)} />
                    <InfoLine label="Payable maintenant" value={formatFCFA(settlement.remaining)} />
                  </div>
                </Link>
              );})}
            </div>
          )}
        </ProfessorDisclosure>

        <ProfessorDisclosure
          title="Mes reçus"
          description="Preuves des transferts confirmés."
          count={payouts.length}
          icon={<ReceiptText className="h-5 w-5" aria-hidden />}
        >
          {payouts.length === 0 ? (
            <p className="text-sm font-semibold leading-6 text-[#64748B]">Aucun versement enregistré pour le moment.</p>
          ) : (
            <div className="mt-4 space-y-3">
              {payouts.map((payout) => (
                <div key={payout.id} className="rounded-lg border border-[#E6EAF3] bg-white p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-[#111827]">{payout.reference}</p>
                      <p className="text-xs font-semibold text-[#64748B]">
                        {payout.paidAt
                          ? `Confirmé le ${formatDateTime(payout.paidAt)}`
                          : `Initié le ${formatDateTime(payout.createdAt)}`}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className={payout.status === "PAID"
                        ? "text-[10px] font-black uppercase tracking-wide text-emerald-700"
                        : payout.status === "DRAFT"
                          ? "text-[10px] font-black uppercase tracking-wide text-amber-700"
                          : "text-[10px] font-black uppercase tracking-wide text-red-700"}
                      >
                        {payout.status === "PAID"
                          ? "Net exact reçu"
                          : payout.status === "DRAFT" ? "Montant en traitement" : "Tentative annulée"}
                      </p>
                      <p className={payout.status === "PAID"
                        ? "mt-0.5 text-sm font-black text-emerald-800"
                        : payout.status === "DRAFT"
                          ? "mt-0.5 text-sm font-black text-amber-800"
                          : "mt-0.5 text-sm font-black text-red-800"}
                      >
                        {formatFCFA(payout.amount)}
                      </p>
                    </div>
                  </div>
                  <div className="mt-3">
                    <InfoLine label="Méthode" value={payout.method ? paymentMethodLabel(payout.method) : "Non précisée"} />
                    {payout.paymentPhone && <InfoLine label="Numéro payé" value={payout.paymentPhone} />}
                    <InfoLine label="Statut" value={payoutStatusLabel(payout.status)} />
                    <InfoLine label="Réservations" value={`${payout.allocations.length} ligne(s)`} />
                    <InfoLine label="Frais de transfert pris en charge" value={formatFCFA(payout.transferFeeCoveredByPlatform)} />
                    <InfoLine label="Montant déduit du net" value={formatFCFA(0)} />
                  </div>
                  {payout.allocations.length > 0 && (
                    <div className="mt-3 grid gap-2">
                      {payout.allocations.map((allocation) => (
                        <div key={allocation.id} className="rounded-lg border border-[#E6EAF3] bg-white px-3 py-2 text-xs">
                          <p className="font-semibold text-[#111827]">{allocation.booking.reference} · {allocation.booking.subjectName}</p>
                          <p className="mt-0.5 font-semibold text-[#111B4D]">{formatFCFA(allocation.amount)}</p>
                        </div>
                      ))}
                    </div>
                  )}
                  {publicPayoutNote(payout.note) && (
                    <p className="mt-3 text-xs font-semibold leading-5 text-[#64748B]">{publicPayoutNote(payout.note)}</p>
                  )}
                  {payout.status !== "PAID" && (
                    <p className={payout.status === "DRAFT"
                      ? "mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold leading-5 text-amber-900"
                      : "mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold leading-5 text-red-800"}
                    >
                      {payout.status === "DRAFT"
                        ? "En attente de confirmation Jèko : ce montant n'est pas encore comptabilisé comme reçu."
                        : "La tentative a été annulée sans débit de votre solde. Le montant reste demandable s'il est toujours payable."}
                    </p>
                  )}
                  {payout.status === "PAID" && (
                    <div className="mt-3">
                      <TeacherPayoutReceiptActions
                        compact
                        teacherName={teacher.professionalName || teacher.fullName}
                        teacherPhone={teacher.phone}
                        record={payout}
                        issuerLabel="Service client"
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </ProfessorDisclosure>
      </div>
    </div>
  );
}

function ProfessorDisclosure({
  title,
  description,
  count,
  icon,
  children,
}: {
  title: string;
  description: string;
  count?: number;
  icon?: ReactNode;
  children: ReactNode;
}) {
  return (
    <details data-professor-payment-disclosure className="group overflow-hidden rounded-lg border border-[#E3E8F2] bg-white">
      <summary className="flex min-h-16 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#111B4D] [&::-webkit-details-marker]:hidden">
        <span className="flex min-w-0 items-center gap-3">
          {icon ? <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#111B4D] text-white">{icon}</span> : null}
          <span className="min-w-0">
            <span className="block text-sm font-semibold text-[#111827]">{title}</span>
            <span className="mt-0.5 line-clamp-1 block text-xs font-semibold text-[#64748B]">{description}</span>
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-2 text-[#111B4D]">
          {typeof count === "number" ? <span className="text-xs font-semibold tabular-nums">{count}</span> : null}
          <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" aria-hidden />
        </span>
      </summary>
      <div className="border-t border-[#EEF2F7] p-4 min-[640px]:p-5">
        {children}
      </div>
    </details>
  );
}

function AccountingMini({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={strong ? "rounded-lg border border-[#111B4D] bg-white px-3 py-2" : "rounded-lg border border-[#E6EAF3] bg-white px-3 py-2"}>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-[#64748B]">{label}</p>
      <p className={strong ? "mt-0.5 text-sm font-semibold text-[#111B4D]" : "mt-0.5 text-sm font-semibold text-[#111827]"}>{value}</p>
    </div>
  );
}

function TeacherExactMetric({ label, value, emphasized = false }: { label: string; value: number; emphasized?: boolean }) {
  return (
    <div className={emphasized ? "rounded-xl border border-emerald-300 bg-emerald-400/15 px-3 py-3" : "rounded-xl border border-white/15 bg-white/10 px-3 py-3"}>
      <WalletCards className="h-4 w-4 text-[#C7D2FE]" aria-hidden />
      <p className="mt-2 text-[10px] font-bold uppercase tracking-wide text-[#C7D2FE]">{label}</p>
      <p className="mt-1 text-sm font-black tabular-nums text-white">{formatFCFA(value)}</p>
    </div>
  );
}

function payoutStatusLabel(status: string) {
  if (status === "PAID") return "Payé";
  if (status === "DRAFT") return "En attente de confirmation Jèko";
  if (status === "CANCELLED") return "Annulé sans débit";
  return status;
}

function publicPayoutNote(note: string | null) {
  const publicPart = note?.split(/\n\[/, 1)[0]?.trim();
  return publicPart && !publicPart.startsWith("[") ? publicPart : null;
}
