import Link from "next/link";
import { ReceiptText } from "lucide-react";
import { db } from "@/lib/db";
import { formatDate, formatDateTime, formatFCFA } from "@/lib/format";
import { paymentMethodLabel } from "@/lib/payment-methods";
import { requireTeacher } from "@/lib/teacher-auth";
import { hasVerifiedPayDunyaClientPayment, verifiedPayDunyaBookingWhere } from "@/lib/payment-security";
import { getTeacherFinancialSettlement, isCancellationPenaltyPayout, isTeacherPayableStatus } from "@/lib/teacher-payments";
import { TeacherPayoutReceiptActions } from "@/components/admin/teacher-payout-receipt-actions";
import {
  EmptyProfessorState,
  InfoLine,
  PortalCard,
  ProfessorPageHeader,
  ProfessorStatCard,
  StatusPill,
} from "@/components/professor/professor-ui";
import { TeacherPayoutRequestForm } from "@/components/professor/teacher-payout-request-form";
import { getPlatformRuntimeSettings } from "@/lib/platform-settings";

export const dynamic = "force-dynamic";

export default async function ProfesseurPaiementsPage() {
  const { teacher } = await requireTeacher();
  const platformSettings = await getPlatformRuntimeSettings();
  const [bookings, adjustments, payouts, payoutRequests] = await db.$transaction([
    db.booking.findMany({
      where: verifiedPayDunyaBookingWhere({
        teacherId: teacher.id,
        OR: [
          {
            teacherNetAmount: { gt: 0 },
            status: { notIn: ["CANCELLED", "REFUNDED"] },
          },
          {
            status: { in: ["CANCELLED", "REFUNDED"] },
            paymentStatus: { in: ["PARTIALLY_REFUNDED", "RETAINED"] },
            cancellationPenaltyTeacherAmount: { gt: 0 },
          },
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
        transactions: { where: { type: "CLIENT_PAYMENT" }, select: { type: true, status: true, amount: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
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
              },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 30,
    }),
  ]);

  const verifiedBookings = bookings.filter(hasVerifiedPayDunyaClientPayment);
  const settlementRows = verifiedBookings.map((booking) => ({
    booking,
    settlement: getTeacherFinancialSettlement(booking, adjustments),
  }));
  const totalNet = settlementRows.reduce((sum, row) => sum + row.settlement.payableAmount, 0);
  const totalPaid = settlementRows.reduce((sum, row) => sum + row.settlement.paid, 0);
  const totalRetained = settlementRows.reduce((sum, row) => sum + row.settlement.retained, 0);
  const remaining = settlementRows.reduce((sum, row) => sum + row.settlement.remaining, 0);
  const readyToReceive = settlementRows
    .filter((row) => isTeacherPayableStatus(row.booking))
    .reduce((sum, row) => sum + row.settlement.remaining, 0);
  const blockedAmount = settlementRows
    .filter((row) => row.booking.paymentStatus === "BLOCKED")
    .reduce((sum, row) => sum + row.settlement.remaining, 0);
  const underControlAmount = Math.max(0, remaining - readyToReceive - blockedAmount);
  const pendingRequested = payoutRequests
    .filter((request) => request.status === "PENDING")
    .reduce((sum, request) => sum + request.amount, 0);
  const requestableAmount = Math.max(0, readyToReceive - pendingRequested);

  return (
    <div className="space-y-6">
      <ProfessorPageHeader
        title="Paiements"
        description="Suivi de vos paiements : montants nets, versements enregistrés et reçus de paiement."
      />

      <div className="grid gap-3 min-[680px]:grid-cols-2 xl:grid-cols-6">
        <ProfessorStatCard label="Net total" value={formatFCFA(totalNet)} detail="Cours validés, reports confirmés et indemnités dues" icon="wallet" />
        <ProfessorStatCard label="Déjà payé" value={formatFCFA(totalPaid)} detail="Versements enregistrés par le service client" icon="check" />
        <ProfessorStatCard label="Reste dû" value={formatFCFA(remaining)} detail="Montant encore à traiter côté service client" icon="clock" />
        <ProfessorStatCard label="Prêt à recevoir" value={formatFCFA(readyToReceive)} detail="Montant validé et payable par le service client" icon="wallet" />
        <ProfessorStatCard label="Encore bloqué" value={formatFCFA(blockedAmount)} detail="En attente de confirmation ou contrôle" icon="clock" />
        <ProfessorStatCard label="Retenues" value={formatFCFA(totalRetained)} detail="Retenues validées par le service client" icon="alert" />
      </div>

      <PortalCard>
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
          <div>
            <p className="text-base font-semibold text-[#111827]">Décompte comptable</p>
            <p className="mt-1 text-sm font-semibold leading-6 text-[#64748B]">
              Calcul appliqué : montant payable professeur - versements enregistrés - retenues validées = reste dû. Les suppléments de report confirmés sont inclus dans le net, et les indemnités d'annulation apparaissent séparément lorsque le client a été remboursé ou que les fonds sont retenus.
            </p>
          </div>
          <div className="grid gap-2 text-sm min-[520px]:grid-cols-3 lg:min-w-[36rem]">
            <AccountingMini label="Net total" value={formatFCFA(totalNet)} />
            <AccountingMini label="Déjà payé" value={formatFCFA(totalPaid)} />
            <AccountingMini label="Reste dû" value={formatFCFA(remaining)} strong />
            <AccountingMini label="Prêt à recevoir" value={formatFCFA(readyToReceive)} />
            <AccountingMini label="Encore bloqué" value={formatFCFA(blockedAmount)} />
            <AccountingMini label="En contrôle" value={formatFCFA(underControlAmount)} />
          </div>
        </div>
      </PortalCard>

      <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
        <TeacherPayoutRequestForm
          readyToReceive={readyToReceive}
          pendingRequested={pendingRequested}
          defaultPhone={teacher.defaultPayoutPhone || teacher.phone}
          defaultMethod={teacher.defaultPayoutMethod}
          payoutInstructions={teacher.payoutInstructions}
          minimumProcessingHours={platformSettings.payoutDelay.minimumHours}
          maximumProcessingHours={platformSettings.payoutDelay.maximumHours}
        />

        <PortalCard>
          <div className="flex flex-col gap-2 min-[640px]:flex-row min-[640px]:items-start min-[640px]:justify-between">
            <div>
              <h2 className="text-base font-semibold text-[#111827]">Demandes de paiement</h2>
              <p className="mt-1 text-sm font-semibold leading-6 text-[#64748B]">
                Les demandes restent en attente jusqu'à validation et versement réel par le service client.
              </p>
            </div>
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
                          <p className="text-xs font-semibold uppercase tracking-wide text-[#64748B]">Facture liée</p>
                          <p className="mt-1 font-mono text-sm font-semibold text-[#111827]">{request.payoutRecord.reference}</p>
                          <p className="mt-1 text-xs font-semibold text-[#64748B]">
                            Document généré après validation et versement par le service client.
                          </p>
                        </div>
                        <TeacherPayoutReceiptActions
                          compact
                          teacherName={teacher.professionalName || teacher.fullName}
                          teacherPhone={teacher.phone}
                          record={request.payoutRecord}
                          issuerLabel="Service client"
                        />
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </PortalCard>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.25fr_0.9fr]">
        <PortalCard>
          <h2 className="text-base font-semibold text-[#111827]">Grand livre professeur</h2>
          {settlementRows.length === 0 ? (
            <div className="mt-4">
              <EmptyProfessorState title="Aucune ligne de paiement" description="Les réservations payables apparaîtront ici après validation du service client." />
            </div>
          ) : (
            <div className="mt-4 grid gap-3">
              {settlementRows.map(({ booking, settlement }) => {
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
                    <InfoLine label={cancellationPenalty ? "Indemnité" : "Net"} value={formatFCFA(settlement.payableAmount)} />
                    {rescheduleSupplement > 0 && <InfoLine label="Supplément report" value={formatFCFA(rescheduleSupplement)} />}
                    {cancellationPenalty && <InfoLine label="Net cours initial" value={formatFCFA(booking.teacherNetAmount)} />}
                    <InfoLine label="Payé" value={formatFCFA(settlement.paid)} />
                    <InfoLine label="Retenu" value={formatFCFA(settlement.retained)} />
                    <InfoLine label="Reste" value={formatFCFA(settlement.remaining)} />
                  </div>
                </Link>
              );})}
            </div>
          )}
        </PortalCard>

        <PortalCard>
          <div className="flex items-center gap-2">
            <ReceiptText className="h-5 w-5 text-[#111B4D]" />
            <h2 className="text-base font-semibold text-[#111827]">Factures / reçus de paiement</h2>
          </div>
          {payouts.length === 0 ? (
            <p className="mt-4 text-sm font-semibold leading-6 text-[#64748B]">Aucun versement enregistré pour le moment.</p>
          ) : (
            <div className="mt-4 space-y-3">
              {payouts.map((payout) => (
                <div key={payout.id} className="rounded-lg border border-[#E6EAF3] bg-white p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-[#111827]">{payout.reference}</p>
                      <p className="text-xs font-semibold text-[#64748B]">{formatDateTime(payout.paidAt)}</p>
                    </div>
                    <p className="text-sm font-semibold text-[#111B4D]">{formatFCFA(payout.amount)}</p>
                  </div>
                  <div className="mt-3">
                    <InfoLine label="Méthode" value={payout.method ? paymentMethodLabel(payout.method) : "Non précisée"} />
                    {payout.paymentPhone && <InfoLine label="Numéro payé" value={payout.paymentPhone} />}
                    <InfoLine label="Statut" value={payout.status} />
                    <InfoLine label="Réservations" value={`${payout.allocations.length} ligne(s)`} />
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
                  {payout.note && <p className="mt-3 text-xs font-semibold leading-5 text-[#64748B]">{payout.note}</p>}
                  <div className="mt-3">
                    <TeacherPayoutReceiptActions
                      compact
                      teacherName={teacher.professionalName || teacher.fullName}
                      teacherPhone={teacher.phone}
                      record={payout}
                      issuerLabel="Service client"
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </PortalCard>
      </div>
    </div>
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
