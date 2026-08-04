import Link from "next/link";
import { ArrowRight, BookOpenCheck, CalendarClock, ClipboardList, CreditCard, MessageSquareText, ShieldCheck } from "lucide-react";
import { db } from "@/lib/db";
import { formatDate, formatFCFA } from "@/lib/format";
import { requireTeacher } from "@/lib/teacher-auth";
import {
  calculateTeacherPayoutAvailability,
  getTeacherFinancialSettlement,
  getTeacherGlobalRetentionLedger,
} from "@/lib/teacher-payments";
import { courseFormatLabel } from "@/lib/platform-labels";
import { hasVerifiedPayDunyaClientPayment, verifiedPayDunyaBookingWhere } from "@/lib/payment-security";
import { Button } from "@/components/ui/button";
import {
  EmptyProfessorState,
  PortalCard,
  ProfessorPageHeader,
  StatusPill,
} from "@/components/professor/professor-ui";

export const dynamic = "force-dynamic";

export default async function ProfesseurDashboardPage() {
  const { teacher } = await requireTeacher();
  const teacherName = teacher.professionalName || teacher.fullName;
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(todayStart);
  todayEnd.setDate(todayEnd.getDate() + 1);

  const [
    upcomingBookings,
    todayBookings,
    pendingMissions,
    openTasks,
    paymentBookings,
    adjustments,
    unreadServiceClientMessageCount,
    pendingScheduleProposalCount,
    pendingPayoutRequestSummary,
    payoutFeesCoveredAgg,
    historicalSessionRetentions,
    historicalLegacyRetentions,
    draftPayoutAllocations,
  ] = await db.$transaction([
    db.booking.findMany({
      where: verifiedPayDunyaBookingWhere({ teacherId: teacher.id, status: { notIn: ["CANCELLED", "REFUNDED"] } }),
      include: {
        client: { select: { name: true, phone: true } },
        transactions: { where: { type: "CLIENT_PAYMENT" } },
        missionLinks: { orderBy: { createdAt: "desc" }, take: 1 },
      },
      orderBy: [{ scheduledDate: "asc" }, { createdAt: "desc" }],
      take: 5,
    }),
    db.booking.findMany({
      where: verifiedPayDunyaBookingWhere({
        teacherId: teacher.id,
        scheduledDate: { gte: todayStart, lt: todayEnd },
        status: { notIn: ["CANCELLED", "REFUNDED"] },
      }),
      include: {
        client: { select: { name: true, phone: true } },
        transactions: { where: { type: "CLIENT_PAYMENT" } },
      },
      orderBy: [{ scheduledDate: "asc" }, { createdAt: "asc" }],
      take: 5,
    }),
    db.teacherMissionLink.findMany({
      where: {
        teacherId: teacher.id,
        status: { in: ["PENDING_CONFIRMATION", "RELAUNCHED"] },
        expiresAt: { gte: new Date() },
        booking: { is: verifiedPayDunyaBookingWhere({ teacherId: teacher.id }) },
      },
      include: {
        booking: {
          include: {
            client: { select: { name: true, phone: true } },
            transactions: { where: { type: "CLIENT_PAYMENT" } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 3,
    }),
    db.teacherTask.findMany({
      where: {
        teacherId: teacher.id,
        status: { in: ["TODO", "SENT_TO_TEACHER", "SEEN_BY_TEACHER", "IN_PROGRESS", "LATE"] },
        booking: { is: verifiedPayDunyaBookingWhere({ teacherId: teacher.id }) },
      },
      include: {
        booking: {
          select: {
            reference: true, subjectName: true, levelName: true, paymentStatus: true,
            totalClientPays: true, totalPrice: true, paydunyaStatus: true, paydunyaVerifiedAt: true,
            paymentProvider: true, providerPaymentStatus: true, paymentVerifiedAt: true,
            transactions: { where: { type: "CLIENT_PAYMENT" }, select: { type: true, status: true, amount: true } },
          },
        },
      },
      orderBy: [{ priority: "desc" }, { dueAt: "asc" }],
      take: 4,
    }),
    db.booking.findMany({
      where: verifiedPayDunyaBookingWhere({
        AND: [
          { OR: [{ teacherId: teacher.id }, { sessions: { some: { teacherId: teacher.id } } }] },
          { OR: [
            { teacherNetAmount: { gt: 0 }, status: { notIn: ["CANCELLED", "REFUNDED"] } },
            { status: { in: ["CANCELLED", "REFUNDED"] }, paymentStatus: { in: ["PARTIALLY_REFUNDED", "RETAINED"] }, cancellationPenaltyTeacherAmount: { gt: 0 } },
          ] },
        ],
      }),
      select: {
        id: true, status: true, teacherNetAmount: true, teacherPaidAmount: true,
        cancellationPenaltyTeacherAmount: true, paymentStatus: true, totalClientPays: true,
        totalPrice: true, paydunyaStatus: true, paydunyaVerifiedAt: true,
        paymentProvider: true, providerPaymentStatus: true, paymentVerifiedAt: true,
        transactions: { where: { type: "CLIENT_PAYMENT" }, select: { type: true, status: true, amount: true } },
        sessions: {
          where: { teacherId: teacher.id },
          select: { status: true, teacherNetAmount: true, releasedAmount: true, paidAmount: true, retainedAmount: true },
        },
      },
    }),
    db.teacherPaymentAdjustment.findMany({ where: { teacherId: teacher.id }, select: { bookingId: true, amount: true, status: true } }),
    db.teacherAdminMessage.count({ where: { teacherId: teacher.id, sender: "ADMIN", readByTeacherAt: null } }),
    db.bookingScheduleProposal.count({
      where: { teacherId: teacher.id, status: "PENDING", booking: { is: verifiedPayDunyaBookingWhere({ teacherId: teacher.id }) } },
    }),
    db.teacherPayoutRequest.aggregate({
      where: { teacherId: teacher.id, status: "PENDING" },
      _count: { _all: true },
      _sum: { amount: true },
    }),
    db.teacherPayoutRecord.aggregate({
      where: { teacherId: teacher.id, status: "PAID" },
      _sum: { transferFeeCoveredByPlatform: true },
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

  const verifiedUpcomingBookings = upcomingBookings.filter(hasVerifiedPayDunyaClientPayment);
  const verifiedTodayBookings = todayBookings.filter(hasVerifiedPayDunyaClientPayment);
  const verifiedPendingMissions = pendingMissions.filter((mission) => hasVerifiedPayDunyaClientPayment(mission.booking));
  const verifiedOpenTasks = openTasks.filter((task) => task.booking && hasVerifiedPayDunyaClientPayment(task.booking));
  const verifiedPaymentBookings = paymentBookings.filter(hasVerifiedPayDunyaClientPayment);
  const paymentSettlementRows = verifiedPaymentBookings.map((booking) => ({
    booking,
    settlement: getTeacherFinancialSettlement(booking, adjustments),
  }));
  const globalRetentionLedger = getTeacherGlobalRetentionLedger(
    adjustments,
    historicalSessionRetentions,
    historicalLegacyRetentions,
  );
  const payoutAvailability = calculateTeacherPayoutAvailability({
    settlements: paymentSettlementRows.map(({ booking, settlement }) => ({
      bookingId: booking.id,
      remaining: settlement.remaining,
      totalOutstanding: settlement.totalOutstanding,
    })),
    globalRetentionLedger,
    pendingRequestedAmount: pendingPayoutRequestSummary._sum.amount,
    draftReservations: draftPayoutAllocations.map((allocation) => ({
      amount: allocation.amount,
      payoutRequestStatus: allocation.payout.payoutRequest?.status ?? null,
    })),
  });
  const amountToReceive = payoutAvailability.totalOutstanding;
  const readyToRequestAmount = payoutAvailability.requestableAmount;
  const blockedTeacherAmount = paymentSettlementRows
    .reduce((sum, row) => sum + row.settlement.blocked, 0);
  const payoutProfileReady = Boolean(teacher.defaultPayoutMethod && teacher.defaultPayoutPhone);
  const payoutFeesCovered = payoutFeesCoveredAgg._sum.transferFeeCoveredByPlatform ?? 0;
  const priority = verifiedPendingMissions.length > 0
    ? {
        eyebrow: "Mission à confirmer",
        title: `${verifiedPendingMissions[0].booking.subjectName} · ${verifiedPendingMissions[0].booking.levelName}`,
        detail: "Répondez avant l'expiration de la proposition.",
        href: "/professeur/missions",
        action: "Répondre",
        icon: BookOpenCheck,
      }
    : verifiedTodayBookings.length > 0
      ? {
          eyebrow: "Cours aujourd'hui",
          title: `${verifiedTodayBookings[0].subjectName} · ${verifiedTodayBookings[0].levelName}`,
          detail: `${verifiedTodayBookings[0].scheduledTime || verifiedTodayBookings[0].preferredTime} · ${courseFormatLabel(verifiedTodayBookings[0].courseFormat)}`,
          href: `/professeur/missions/${verifiedTodayBookings[0].id}`,
          action: "Ouvrir",
          icon: CalendarClock,
        }
      : verifiedOpenTasks.length > 0
        ? {
            eyebrow: "Action demandée",
            title: verifiedOpenTasks[0].title,
            detail: "Le service client attend votre réponse.",
            href: "/professeur/missions",
            action: "Traiter",
            icon: ClipboardList,
          }
        : unreadServiceClientMessageCount > 0
          ? {
              eyebrow: "Nouveau message",
              title: `${unreadServiceClientMessageCount} message${unreadServiceClientMessageCount > 1 ? "s" : ""} à lire`,
              detail: "Consultez la réponse du service client.",
              href: "/professeur/messages",
              action: "Lire",
              icon: MessageSquareText,
            }
          : !payoutProfileReady
            ? {
                eyebrow: "Paiement à configurer",
                title: "Ajoutez votre numéro de retrait",
                detail: "Votre moyen de paiement est nécessaire avant une demande de retrait.",
                href: "/professeur/parametres",
                action: "Configurer",
                icon: CreditCard,
              }
            : readyToRequestAmount > 0
              ? {
                  eyebrow: "Retrait disponible",
                  title: formatFCFA(readyToRequestAmount),
                  detail: "Ce montant net peut être demandé maintenant.",
                  href: "/professeur/paiements",
                  action: "Retirer",
                  icon: CreditCard,
                }
              : pendingScheduleProposalCount > 0
                ? {
                    eyebrow: "Créneau proposé",
                    title: `${pendingScheduleProposalCount} proposition${pendingScheduleProposalCount > 1 ? "s" : ""} en attente`,
                    detail: "Vérifiez le créneau proposé au client.",
                    href: "/professeur/missions",
                    action: "Vérifier",
                    icon: CalendarClock,
                  }
                : {
                    eyebrow: "Tout est à jour",
                    title: "Aucune action urgente",
                    detail: "Nous vous préviendrons dès qu'une action sera nécessaire.",
                    href: "/professeur/disponibilites",
                    action: "Mes disponibilités",
                    icon: ShieldCheck,
                  };
  const PriorityIcon = priority.icon;

  return (
    <div className="space-y-6">
      <ProfessorPageHeader
        title={`Bonjour ${teacherName}`}
        description="Missions, disponibilités et paiements."
        rootTab
      />

      <section aria-label="Solde professeur exact" className="overflow-hidden rounded-xl border border-[#1E2A78] bg-[#111B4D] text-white shadow-sm">
        <div className="grid gap-4 p-5 sm:p-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
          <div>
            <div className="flex items-center gap-2 text-[#C7D2FE]">
              <ShieldCheck className="h-5 w-5" aria-hidden />
              <p className="text-xs font-black uppercase tracking-[0.16em]">Votre solde, sans déduction</p>
            </div>
            <p className="mt-2 text-3xl font-black tabular-nums">{formatFCFA(amountToReceive)}</p>
            <p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-[#E0E7FF]">
              Vous recevez exactement le net affiché. Les frais de transfert Jèko sont payés par Compétence et ne diminuent jamais ce montant.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2 lg:min-w-[25rem]">
            <DashboardBalanceMini label="Demandable" value={readyToRequestAmount} emphasized />
            <DashboardBalanceMini label="Encore bloqué" value={blockedTeacherAmount} />
            <DashboardBalanceMini label="Frais couverts" value={payoutFeesCovered} />
          </div>
        </div>
        <div className="border-t border-white/15 bg-white/5 px-5 py-3 sm:px-6">
          <Link href="/professeur/paiements" className="inline-flex items-center text-sm font-black text-white hover:text-[#C7D2FE]">
            Voir le décompte complet
            <ArrowRight className="ml-2 h-4 w-4" aria-hidden />
          </Link>
        </div>
      </section>

      <PortalCard className="grid gap-4 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center" data-professor-dashboard-priority>
        <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-[#111B4D] text-white">
          <PriorityIcon className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[#64748B]">{priority.eyebrow}</p>
          <p className="mt-1 text-lg font-semibold leading-6 text-[#111827]">{priority.title}</p>
          <p className="mt-1 text-sm font-medium leading-6 text-[#64748B]">{priority.detail}</p>
        </div>
        <Button asChild className="min-h-11 w-full rounded-lg bg-[#111B4D] text-white hover:bg-[#1E2A78] sm:w-auto">
          <Link href={priority.href}>
            {priority.action}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
      </PortalCard>

      <div className="grid gap-5">
        <PortalCard>
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-base font-semibold text-[#111827]">Prochain cours</p>
              <p className="text-sm font-medium text-[#64748B]">La prochaine mission confirmée.</p>
            </div>
            <Button asChild variant="ghost" className="rounded-lg">
              <Link href="/professeur/missions">Tout voir</Link>
            </Button>
          </div>
          {verifiedUpcomingBookings.length === 0 ? (
            <EmptyProfessorState title="Aucune mission attribuée" description="Les prochaines réservations confirmées par le service client apparaîtront ici." />
          ) : (
            <div className="grid gap-3">
              {verifiedUpcomingBookings.slice(0, 1).map((booking) => (
                <Link
                  key={booking.id}
                  href={`/professeur/missions/${booking.id}`}
                  className="grid gap-3 rounded-lg border border-[#E6EAF3] bg-white p-4 transition hover:border-[#111B4D] min-[720px]:grid-cols-[1fr_auto] min-[640px]:items-center"
                >
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-[#111827]">{booking.reference}</p>
                      <StatusPill status={booking.status} />
                    </div>
                    <p className="mt-1 text-sm font-bold text-[#111827]">{booking.subjectName} - {booking.levelName}</p>
                    <p className="mt-1 text-xs font-semibold text-[#64748B]">
                      {formatDate(booking.scheduledDate ?? booking.startDate ?? booking.createdAt)} · {booking.scheduledTime || booking.preferredTime} · {courseFormatLabel(booking.courseFormat)}
                    </p>
                  </div>
                  <span className="inline-flex items-center gap-1 text-sm font-semibold text-[#111B4D]">
                    Ouvrir <ArrowRight className="h-4 w-4" />
                  </span>
                </Link>
              ))}
            </div>
          )}
        </PortalCard>

      </div>
    </div>
  );
}

function DashboardBalanceMini({ label, value, emphasized = false }: { label: string; value: number; emphasized?: boolean }) {
  return (
    <div className={emphasized ? "rounded-lg border border-emerald-300 bg-emerald-400/15 px-3 py-3" : "rounded-lg border border-white/15 bg-white/10 px-3 py-3"}>
      <p className="text-[10px] font-bold uppercase tracking-wide text-[#C7D2FE]">{label}</p>
      <p className="mt-1 text-sm font-black tabular-nums text-white">{formatFCFA(value)}</p>
    </div>
  );
}
