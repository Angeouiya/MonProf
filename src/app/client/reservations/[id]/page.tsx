import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/session";
import {
  ClientPageHeader,
  ClientProcessTracker,
  ClientSectionTitle,
  ClientSurface,
} from "@/components/shared/client-page-primitives";
import { Money } from "@/components/shared/money";
import { ProfessorImage } from "@/components/shared/professor-image";
import { BookingPricingBreakdown } from "@/components/shared/booking-pricing-breakdown";
import { Button } from "@/components/ui/button";
import { formatDate, formatDateTime } from "@/lib/format";
import { packTypeLabel } from "@/lib/platform-labels";
import { cancellationWindowLabel } from "@/lib/cancellation-policy";
import { parsePricingSnapshot } from "@/lib/pricing";
import { dayLabel } from "@/lib/scheduling";
import { reconcilePayDunyaBookingPayment } from "@/lib/paydunya-reconciliation";
import { reconcilePayDunyaReschedulePayment } from "@/lib/paydunya-reschedule-reconciliation";
import { hasVerifiedPayDunyaClientPayment } from "@/lib/payment-security";
import {
  Home, Video, User, Users, Calendar, Clock, MapPin, MessageSquare,
  CheckCircle2, AlertTriangle, LockKeyhole, ClipboardCheck,
  WalletCards, ShieldCheck, Hourglass, RefreshCw, LifeBuoy,
} from "lucide-react";
import { BookingActions, BookingPrimaryAction } from "./actions";
import { ScheduleProposalActions } from "./schedule-proposal-actions";
import { ReplacementProposalActions } from "./replacement-proposal-actions";
import { ClientRescheduleRequestPanel } from "./reschedule-request-panel";

export const dynamic = "force-dynamic";

const CLIENT_BOOKING_STATUS_LABELS: Record<string, string> = {
  PENDING_PAYMENT: "Brouillon non réservé",
  PAID: "Réservation reçue",
  PENDING_ADMIN_VALIDATION: "Validation service client",
  CONFIRMED: "Réservation confirmée",
  ASSIGNED: "Professeur confirmé",
  IN_PROGRESS: "Cours en cours",
  COURSE_DONE: "Cours effectué",
  PENDING_CLIENT_VALIDATION: "Votre confirmation attendue",
  VALIDATED_BY_CLIENT: "Cours confirmé",
  PAYMENT_TO_RELEASE: "Traitement service client",
  TEACHER_PAID: "Cours clôturé",
  DISPUTED: "Litige en cours",
  CANCELLED: "Réservation annulée",
  REFUNDED: "Remboursement traité",
};

const CLIENT_PAYMENT_STATUS_LABELS: Record<string, string> = {
  FAILED: "Paiement à finaliser",
  RECEIVED: "Paiement reçu",
  BLOCKED: "Paiement sécurisé",
  VALIDATED: "Cours validé",
  TO_PAY_TEACHER: "Traitement service client",
  TEACHER_PAID: "Cours clôturé",
  DISPUTED: "Litige en cours",
  REFUND_PENDING: "Remboursement en traitement",
  PARTIAL_REFUND_PENDING: "Remboursement partiel en traitement",
  REFUNDED: "Remboursé",
  PARTIALLY_REFUNDED: "Remboursement partiel",
  RETAINED: "Frais appliqués",
};

export default async function ReservationDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = await getSessionUser();
  if (!user) return null;
  const { id } = await params;
  const sp = await searchParams;

  let booking = await db.booking.findUnique({
    where: { id },
    include: {
      teacher: {
        select: { id: true, fullName: true, professionalName: true, photoUrl: true, jobTitle: true, commune: true, phone: true, badgeVerified: true },
      },
      transactions: { where: { type: { in: ["CLIENT_PAYMENT", "RESCHEDULE_FEE", "REFUND"] } }, orderBy: { createdAt: "asc" } },
      reviews: { where: { clientId: user.id } },
      disputes: { orderBy: { createdAt: "desc" } },
      clientRefundRequests: { orderBy: { createdAt: "desc" } },
      rescheduleRequests: {
        orderBy: { createdAt: "desc" },
        include: { transaction: true },
        take: 5,
      },
      scheduleProposals: {
        orderBy: { createdAt: "desc" },
        include: {
          teacher: { select: { id: true, fullName: true, professionalName: true, photoUrl: true } },
        },
      },
      replacements: {
        where: { status: { in: ["DRAFT", "CLIENT_NOTIFIED", "APPLIED", "CANCELLED"] } },
        orderBy: { createdAt: "desc" },
        take: 5,
        include: {
          oldTeacher: { select: { id: true, fullName: true, professionalName: true, photoUrl: true } },
          newTeacher: {
            select: {
              id: true, fullName: true, professionalName: true, photoUrl: true,
              jobTitle: true, commune: true, rating: true, qualityScore: true, badgeVerified: true,
            },
          },
        },
      },
    },
  });
  if (!booking || booking.clientId !== user.id) notFound();

  const paydunyaReturnToken = extractPayDunyaReturnToken(sp);
  const isPayDunyaReturn = sp.paydunya === "return" || Boolean(paydunyaReturnToken);
  const isReschedulePayDunyaReturn = Boolean(paydunyaReturnToken && paydunyaReturnToken !== booking.paydunyaToken) || sp.reschedulePaydunya === "return";
  const paydunyaReturnCheck = isPayDunyaReturn
    ? isReschedulePayDunyaReturn
      ? await reconcilePayDunyaReschedulePayment({
          bookingId: id,
          token: paydunyaReturnToken,
          expectedClientId: user.id,
          source: "client_return",
          incomingPayload: sp,
        })
      : await reconcilePayDunyaBookingPayment({
          bookingId: id,
          token: paydunyaReturnToken,
          expectedClientId: user.id,
          source: "client_return",
          incomingPayload: sp,
        })
    : null;

  if (paydunyaReturnCheck) {
    const refreshedBooking = await db.booking.findUnique({
      where: { id },
      include: {
        teacher: {
          select: { id: true, fullName: true, professionalName: true, photoUrl: true, jobTitle: true, commune: true, phone: true, badgeVerified: true },
        },
        transactions: { where: { type: { in: ["CLIENT_PAYMENT", "RESCHEDULE_FEE", "REFUND"] } }, orderBy: { createdAt: "asc" } },
        reviews: { where: { clientId: user.id } },
        disputes: { orderBy: { createdAt: "desc" } },
        clientRefundRequests: { orderBy: { createdAt: "desc" } },
        rescheduleRequests: {
          orderBy: { createdAt: "desc" },
          include: { transaction: true },
          take: 5,
        },
        scheduleProposals: {
          orderBy: { createdAt: "desc" },
          include: {
            teacher: { select: { id: true, fullName: true, professionalName: true, photoUrl: true } },
          },
        },
        replacements: {
          where: { status: { in: ["DRAFT", "CLIENT_NOTIFIED", "APPLIED", "CANCELLED"] } },
          orderBy: { createdAt: "desc" },
          take: 5,
          include: {
            oldTeacher: { select: { id: true, fullName: true, professionalName: true, photoUrl: true } },
            newTeacher: {
              select: {
                id: true, fullName: true, professionalName: true, photoUrl: true,
                jobTitle: true, commune: true, rating: true, qualityScore: true, badgeVerified: true,
              },
            },
          },
        },
      },
    });
    if (!refreshedBooking || refreshedBooking.clientId !== user.id) notFound();
    booking = refreshedBooking;
  }

  const name = booking.teacher.professionalName || booking.teacher.fullName;
  const preferredDays: string[] = booking.preferredDays ? JSON.parse(booking.preferredDays) : [];
  const pricingSnapshot = parsePricingSnapshot(booking.pricingSnapshot);
  const displayUnitPrice = pricingSnapshot?.unitSessionAmount ?? booking.unitPrice;
  const displayCourseAmount = pricingSnapshot?.courseAmount ?? booking.courseAmount;
  const displayTransportFee = pricingSnapshot?.transportFee ?? booking.transportFee;
  const displayMaterialFee = pricingSnapshot?.materialFee ?? booking.materialFee;
  const displayDiscountAmount = pricingSnapshot?.discountAmount ?? booking.discountAmount;
  const displayPaymentServiceFeeAmount = pricingSnapshot?.paymentServiceFeeAmount ?? booking.paymentServiceFeeAmount;
  const displayPaymentServiceFeeLabel = pricingSnapshot?.paymentServiceFeeLabel ?? booking.paymentServiceFeeLabel;
  const displayTotalBeforePaymentServiceFee = pricingSnapshot?.totalBeforePaymentServiceFee
    ?? Math.max(0, (pricingSnapshot?.totalClientPays ?? booking.totalClientPays ?? booking.totalPrice) - displayPaymentServiceFeeAmount);
  const displayTotalPrice = firstPositiveAmount(
    pricingSnapshot?.totalClientPays,
    booking.totalClientPays,
    booking.totalPrice,
  );
  const displaySessionsCount = pricingSnapshot?.numberOfSessions ?? booking.sessionsCount;
  const displayParticipantsCount = pricingSnapshot?.participantsCount ?? booking.participantsCount;
  const requestedDate = booking.startDate ?? booking.scheduledDate;
  const paymentConfirmed = hasVerifiedPayDunyaClientPayment(booking);
  const canShowOperationalProgress = booking.isQuoteOnly || paymentConfirmed;
  const confirmedDate = canShowOperationalProgress ? booking.scheduledDate : null;
  const dateShownToClient = confirmedDate ?? requestedDate;
  const timeShownToClient = booking.scheduledTime || booking.preferredTime || "Horaire à confirmer";
  const preferredDaysLabel = preferredDays.length
    ? preferredDays.map((day) => dayLabel(day)).join(", ")
    : "Selon le créneau choisi";
  const schoolProgramDisplay = formatSchoolProgramDisplay(booking.schoolProgram);
  const visibleTransactions = paymentConfirmed
    ? booking.transactions
    : booking.transactions.filter((transaction) => transaction.type === "REFUND");
  const paymentAwaitingProof = !booking.isQuoteOnly
    && !paymentConfirmed
    && ["RECEIVED", "BLOCKED", "VALIDATED", "TO_PAY_TEACHER", "TEACHER_PAID"].includes(booking.paymentStatus);
  const returnedFromPayDunya = isPayDunyaReturn;
  const cancelledOnPayDunya = sp.paydunya === "cancelled";
  const scheduleProposals = booking.scheduleProposals.map((proposal) => ({
    id: proposal.id,
    proposedDate: proposal.proposedDate.toISOString(),
    proposedTime: proposal.proposedTime,
    reason: proposal.reason,
    status: proposal.status,
    clientResponse: proposal.clientResponse,
    createdAt: proposal.createdAt.toISOString(),
    respondedAt: proposal.respondedAt?.toISOString() ?? null,
    teacher: proposal.teacher
      ? {
          fullName: proposal.teacher.fullName,
          professionalName: proposal.teacher.professionalName,
        }
      : null,
  }));
  const replacementProposals = booking.replacements.map((replacement) => ({
    id: replacement.id,
    status: replacement.status,
    reason: replacement.reason,
    details: replacement.details,
    financialImpact: replacement.financialImpact,
    clientMessage: replacement.clientMessage,
    createdAt: replacement.createdAt.toISOString(),
    appliedAt: replacement.appliedAt?.toISOString() ?? null,
    oldTeacher: {
      id: replacement.oldTeacher.id,
      fullName: replacement.oldTeacher.fullName,
      professionalName: replacement.oldTeacher.professionalName,
      photoUrl: replacement.oldTeacher.photoUrl,
    },
    newTeacher: {
      id: replacement.newTeacher.id,
      fullName: replacement.newTeacher.fullName,
      professionalName: replacement.newTeacher.professionalName,
      photoUrl: replacement.newTeacher.photoUrl,
      jobTitle: replacement.newTeacher.jobTitle,
      commune: replacement.newTeacher.commune,
      rating: replacement.newTeacher.rating,
      qualityScore: replacement.newTeacher.qualityScore,
      badgeVerified: replacement.newTeacher.badgeVerified,
    },
  }));
  const rescheduleRequests = booking.rescheduleRequests.map((request) => ({
    id: request.id,
    status: request.status,
    oldScheduledDate: request.oldScheduledDate?.toISOString() ?? null,
    oldScheduledTime: request.oldScheduledTime,
    proposedDate: request.proposedDate.toISOString(),
    proposedTime: request.proposedTime,
    reason: request.reason,
    feeWindow: request.feeWindow,
    feeBaseAmount: request.feeBaseAmount,
    feeRate: request.feeRate,
    feeAmount: request.feeAmount,
    feeTeacherAmount: request.feeTeacherAmount,
    feePlatformAmount: request.feePlatformAmount,
    paymentServiceFeeAmount: request.paymentServiceFeeAmount,
    paymentServiceFeeLabel: request.paymentServiceFeeLabel,
    totalToPay: request.totalToPay,
    paydunyaStatus: request.paydunyaStatus,
    paydunyaCheckoutUrl: request.paydunyaCheckoutUrl,
    paidAt: request.paidAt?.toISOString() ?? null,
    teacherResponse: request.teacherResponse,
    teacherRespondedAt: request.teacherRespondedAt?.toISOString() ?? null,
    appliedAt: request.appliedAt?.toISOString() ?? null,
    createdAt: request.createdAt.toISOString(),
    transactionStatus: request.transaction?.status ?? null,
  }));

  // Timeline
  const timeline = [
    { label: canShowOperationalProgress ? "Réservation créée" : "Brouillon créé", date: booking.createdAt, done: true },
    { label: canShowOperationalProgress ? "Paiement PayDunya vérifié" : "Paiement PayDunya à finaliser", date: paymentConfirmed ? booking.createdAt : null, done: paymentConfirmed },
    {
      label: canShowOperationalProgress ? "Validée par le service client" : "Validation service client après paiement",
      date: canShowOperationalProgress ? booking.confirmedAt : null,
      done: canShowOperationalProgress && (
        !!booking.confirmedAt
        || ["CONFIRMED", "ASSIGNED", "IN_PROGRESS", "COURSE_DONE", "PENDING_CLIENT_VALIDATION", "VALIDATED_BY_CLIENT", "PAYMENT_TO_RELEASE", "TEACHER_PAID"].includes(booking.status)
      ),
    },
    {
      label: canShowOperationalProgress ? "Cours effectué" : "Cours après validation",
      date: canShowOperationalProgress ? booking.courseDoneAt : null,
      done: canShowOperationalProgress && (
        !!booking.courseDoneAt
        || ["COURSE_DONE", "PENDING_CLIENT_VALIDATION", "VALIDATED_BY_CLIENT", "PAYMENT_TO_RELEASE", "TEACHER_PAID"].includes(booking.status)
      ),
    },
    {
      label: canShowOperationalProgress ? "Confirmé par le client" : "Confirmation client après cours",
      date: canShowOperationalProgress ? booking.clientValidatedAt : null,
      done: canShowOperationalProgress && (
        !!booking.clientValidatedAt
        || ["VALIDATED_BY_CLIENT", "PAYMENT_TO_RELEASE", "TEACHER_PAID"].includes(booking.status)
      ),
    },
    {
      label: canShowOperationalProgress ? "Cours clôturé" : "Clôture après confirmation",
      date: canShowOperationalProgress ? booking.teacherPaidAt : null,
      done: canShowOperationalProgress && booking.status === "TEACHER_PAID",
    },
  ];
  const timelineDescription = canShowOperationalProgress
    ? "Chaque étape reste visible jusqu'à la clôture du cours."
    : "Aucune étape opérationnelle ne démarre tant que PayDunya n'a pas confirmé le paiement côté serveur.";
  const firstPendingTimelineIndex = timeline.findIndex((step) => !step.done);
  const processSteps = timeline.map((step, index) => ({
    label: step.label,
    date: step.done && step.date ? formatDate(step.date) : undefined,
    hint: getTimelineStepHint(step.label, canShowOperationalProgress),
    state: step.done
      ? "done" as const
      : index === firstPendingTimelineIndex
        ? "current" as const
        : "pending" as const,
  }));
  const isCancelled = booking.status === "CANCELLED" || booking.status === "REFUNDED";
  const clientSituation = getClientSituation({
    status: booking.status,
    paymentStatus: booking.paymentStatus,
    isQuoteOnly: booking.isQuoteOnly,
    hasDispute: booking.disputes.length > 0,
    paymentAwaitingProof,
  });
  const {
    paydunyaToken: _paydunyaToken,
    paydunyaCheckoutUrl: _paydunyaCheckoutUrl,
    paydunyaLastPayload: _paydunyaLastPayload,
    ...bookingActionsPayload
  } = booking as any;

  return (
    <div className="space-y-6">
      <ClientPageHeader
        eyebrow="Dossier"
        title={`Réservation ${booking.reference}`}
        description={`Créée le ${formatDateTime(booking.createdAt)}`}
      >
        <div className="grid w-full gap-2 min-[520px]:w-auto min-[520px]:grid-cols-2">
          <ReservationStatusChip label="Statut" value={formatClientBookingStatus(booking.status)} />
          <ReservationStatusChip label="Paiement" value={formatClientPaymentStatus(booking.paymentStatus, booking.isQuoteOnly)} />
        </div>
      </ClientPageHeader>

      {returnedFromPayDunya && paymentConfirmed && (
        <div className="flex items-start gap-3 rounded-lg border border-[#DDE6F7] bg-white p-4">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-[#111B4D]" />
          <div className="text-sm">
            <p className="font-semibold text-[#111B4D]">Paiement PayDunya confirmé</p>
            <p className="mt-1 leading-6 text-[#64748B]">
              {isReschedulePayDunyaReturn
                ? "Votre supplément de modification a été reçu. Le professeur doit maintenant confirmer le nouveau créneau."
                : (
                    <>
                      Votre paiement de <strong className="text-[#111827]"><Money amount={displayTotalPrice} /></strong> a été reçu
                      et est gardé bloqué jusqu'à la confirmation du cours. Date demandée : <strong className="text-[#111827]">{dateShownToClient ? formatDate(dateShownToClient) : "à confirmer"}</strong>.
                      Le service client valide votre réservation prochainement.
                    </>
                  )}
            </p>
          </div>
        </div>
      )}

      {returnedFromPayDunya && !paymentConfirmed && (
        <div className="flex items-start gap-3 rounded-lg border border-[#DDE6F7] bg-white p-4">
          <Hourglass className="mt-0.5 h-5 w-5 shrink-0 text-[#111B4D]" />
          <div className="text-sm">
            <p className="font-semibold text-[#111B4D]">Retour PayDunya enregistré</p>
            <p className="mt-1 leading-6 text-[#64748B]">
              Nous attendons la confirmation automatique de PayDunya. Si le paiement a été validé, le statut passera en paiement sécurisé dès réception de la confirmation serveur.
              {paydunyaReturnCheck?.message ? ` Contrôle serveur: ${paydunyaReturnCheck.message}` : " Aucun paiement n'est validé sans confirmation serveur PayDunya."}
            </p>
          </div>
        </div>
      )}

      {cancelledOnPayDunya && !paymentConfirmed && (
        <div className="flex items-start gap-3 rounded-lg border border-[#E3E8F2] bg-white p-4">
          <RefreshCw className="mt-0.5 h-5 w-5 shrink-0 text-[#111B4D]" />
          <div className="text-sm">
            <p className="font-semibold text-[#111B4D]">Paiement PayDunya non finalisé</p>
            <p className="mt-1 leading-6 text-[#64748B]">
              Vous pouvez reprendre le paiement depuis les actions du dossier. Le moyen et les informations de paiement restent gérés sur PayDunya.
            </p>
          </div>
        </div>
      )}

      <section className="grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(280px,0.85fr)] lg:items-stretch">
        <div className="order-2 rounded-lg border border-[#E3E8F2] bg-white p-4 sm:p-5 lg:order-1">
          <div className="flex flex-col gap-4 min-[520px]:flex-row min-[520px]:items-center">
            <ProfessorImage photoUrl={booking.teacher.photoUrl} name={name} size="md" shape="circle" verified={booking.teacher.badgeVerified} />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-[#64748B]">Dossier client</p>
              <h2 className="mt-1 text-xl font-semibold tracking-normal text-[#111827] sm:text-2xl">
                {booking.subjectName} avec {name}
              </h2>
              <p className="mt-1 text-sm font-semibold text-[#64748B]">{booking.teacher.jobTitle}</p>
            </div>
          </div>

          <div className="mt-4 grid gap-2 min-[560px]:grid-cols-2 xl:grid-cols-4">
            <ReservationHeroMetric
              icon={<Calendar className="h-4 w-4" />}
              label={confirmedDate ? "Date confirmée" : "Date demandée"}
              value={dateShownToClient ? formatDate(dateShownToClient) : "À confirmer"}
            />
            <ReservationHeroMetric
              icon={<Clock className="h-4 w-4" />}
              label="Créneau"
              value={timeShownToClient}
            />
            <ReservationHeroMetric
              icon={booking.courseFormat === "HOME" ? <Home className="h-4 w-4" /> : <Video className="h-4 w-4" />}
              label="Format"
              value={booking.courseFormat === "HOME" ? "À domicile" : "En ligne"}
            />
            <ReservationHeroMetric
              icon={<WalletCards className="h-4 w-4" />}
              label={booking.isQuoteOnly ? "Montant" : paymentConfirmed ? "Payé" : "À payer"}
              value={booking.isQuoteOnly ? "Prix à finaliser" : <Money amount={displayTotalPrice} />}
            />
          </div>
        </div>

        <div className={`order-1 flex flex-col justify-between rounded-lg border p-4 sm:p-5 lg:order-2 ${clientSituation.className}`}>
          <div>
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-white">
                {clientSituation.icon}
              </span>
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wide text-[#64748B]">Action attendue</p>
                <h3 className="mt-0.5 text-lg font-semibold leading-tight">{clientSituation.title}</h3>
              </div>
            </div>
            <p className="mt-4 text-sm font-semibold leading-6 text-[#64748B]">{clientSituation.description}</p>
            <BookingPrimaryAction booking={bookingActionsPayload as any} />
          </div>
        </div>
      </section>

      <div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        {/* Colonne gauche : détails */}
        <div className="order-2 min-w-0 space-y-4 lg:order-1">
          {/* Détails cours */}
          <ClientSurface className="space-y-4">
            <ClientSectionTitle
              eyebrow="Cours"
              title="Détails du cours"
              description="Matière, niveau, format et consignes du dossier."
            />
            <div className="space-y-3 text-sm">
              <div className="grid gap-3 min-[560px]:grid-cols-2">
                <DetailRow icon={null} label="Matière" value={booking.subjectName} />
                <DetailRow icon={null} label="Niveau" value={booking.levelName} />
                <DetailRow icon={<Calendar className="h-4 w-4" />} label="Jours" value={preferredDaysLabel} />
                <DetailRow icon={<Clock className="h-4 w-4" />} label="Formule" value={packTypeLabel(booking.packType)} />
                <DetailRow
                  icon={booking.groupType === "INDIVIDUAL" ? <User className="h-4 w-4" /> : <Users className="h-4 w-4" />}
                  label="Type"
                  value={booking.groupType === "INDIVIDUAL" ? "Individuel" : "Petit groupe"}
                />
                <DetailRow icon={<Clock className="h-4 w-4" />} label="Durée" value={`${displaySessionsCount} séance${displaySessionsCount > 1 ? "s" : ""} de 2h`} />
                {schoolProgramDisplay && (
                  <div className="rounded-lg border border-[#DDE6F7] bg-white p-3 sm:col-span-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-[#64748B]">Parcours choisi</p>
                    <p className="mt-1 whitespace-pre-line text-sm font-semibold text-[#111B4D]">{schoolProgramDisplay}</p>
                  </div>
                )}
              </div>

              {booking.courseFormat === "HOME" && (
                <DetailRow icon={<MapPin className="h-4 w-4" />} label="Lieu" value={[booking.commune, booking.quartier, booking.addressHint].filter(Boolean).join(", ") || "Non précisé"} />
              )}
              {booking.courseFormat === "ONLINE" && booking.onlineLink && (
                <DetailRow icon={<Video className="h-4 w-4" />} label="Lien" value={booking.onlineLink} />
              )}

              {booking.objective && (
                <DetailRow icon={<MessageSquare className="h-4 w-4" />} label="Objectif" value={booking.objective} />
              )}
              {booking.message && (
                <DetailRow icon={<MessageSquare className="h-4 w-4" />} label="Message" value={booking.message} />
              )}
            </div>
          </ClientSurface>

          {isCancelled && (
            <ClientSurface className="space-y-4">
              <ClientSectionTitle
                eyebrow="Service client"
                title="Annulation et remboursement"
                description="Règle appliquée, frais retenus et montant estimé."
              />
              <div className="space-y-3 text-sm">
                <div className="grid gap-3 min-[560px]:grid-cols-2">
                  <DetailRow icon={<AlertTriangle className="h-4 w-4" />} label="Motif" value={booking.cancellationReason || "Annulation demandée"} />
                  <DetailRow icon={<Calendar className="h-4 w-4" />} label="Date d'annulation" value={booking.cancelledAt ? formatDateTime(booking.cancelledAt) : "—"} />
                  <DetailRow icon={<Clock className="h-4 w-4" />} label="Règle appliquée" value={cancellationWindowLabel(booking.cancellationWindow)} />
                  <DetailRow
                    icon={<CheckCircle2 className="h-4 w-4" />}
                    label="Statut paiement"
                    value={formatClientPaymentStatus(booking.paymentStatus, booking.isQuoteOnly)}
                  />
                </div>
                {booking.cancellationDetail && (
                  <div className="rounded-lg border border-[#E3E8F2] bg-white p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-[#64748B]">Message complémentaire</p>
                    <p className="mt-1 whitespace-pre-line text-sm font-semibold text-[#111827]">{booking.cancellationDetail}</p>
                  </div>
                )}
                <div className="grid gap-2 min-[560px]:grid-cols-2">
                  <div className="rounded-lg border border-[#E3E8F2] bg-white p-3">
                    <p className="text-xs text-[#64748B]">Frais retenus</p>
                    <p className="mt-1 text-lg font-semibold text-[#111827]"><Money amount={booking.cancellationFeeAmount} /></p>
                    <p className="text-xs text-[#64748B]">{booking.cancellationFeeRate}%</p>
                  </div>
                  <div className="rounded-lg border border-[#E3E8F2] bg-white p-3">
                    <p className="text-xs text-[#64748B]">Frais service non remboursés</p>
                    <p className="mt-1 text-lg font-semibold text-[#111827]"><Money amount={booking.paymentServiceFeeAmount} /></p>
                    <p className="text-xs text-[#64748B]">Frais du moyen de paiement</p>
                  </div>
                  <div className="rounded-lg border border-[#E3E8F2] bg-white p-3">
                    <p className="text-xs text-[#64748B]">Remboursement estimé</p>
                    <p className="mt-1 text-lg font-semibold text-[#111827]"><Money amount={booking.cancellationRefundAmount} /></p>
                    <p className="text-xs text-[#64748B]">Selon la règle appliquée au moment de l'annulation.</p>
                  </div>
                </div>
              </div>
            </ClientSurface>
          )}

          {/* Timeline */}
          <ClientSurface className="space-y-4">
            <ClientSectionTitle
              eyebrow="Progression"
              title="Suivi de la réservation"
              description={timelineDescription}
            />
            <ClientProcessTracker steps={processSteps} />
          </ClientSurface>

          {/* Transactions */}
          {visibleTransactions.length > 0 && (
            <ClientSurface className="space-y-4">
              <ClientSectionTitle
                eyebrow="Paiement"
                title="Historique des transactions"
                description="Paiements et remboursements confirmés par le système."
              />
              <div className="space-y-2">
                {visibleTransactions.map((tx) => (
                  <div key={tx.id} className="flex flex-col gap-3 rounded-lg border border-[#E3E8F2] bg-white p-3 text-sm min-[460px]:flex-row min-[460px]:items-center min-[460px]:justify-between">
                    <div className="min-w-0">
                      <p className="break-all font-mono text-xs font-semibold leading-5 text-[#111827]">{tx.reference}</p>
                      <p className="mt-1 text-xs text-[#64748B]">
                        {tx.type === "CLIENT_PAYMENT" ? "Paiement sécurisé" :
                          tx.type === "RESCHEDULE_FEE" ? "Supplément modification créneau" :
                            tx.type === "REFUND" ? "Remboursement" : "Transaction"}
                        {" • "}{formatDate(tx.createdAt)}
                      </p>
                    </div>
                    <div className="min-w-0 min-[460px]:shrink-0 min-[460px]:text-right">
                      <p className="font-semibold text-[#111827]"><Money amount={tx.amount} /></p>
                      <p className="mt-1 break-words text-xs font-semibold leading-5 text-[#111B4D]">{formatClientPaymentStatus(tx.status)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </ClientSurface>
          )}
        </div>

        {/* Colonne droite : montants + actions */}
        <div className="order-1 min-w-0 space-y-4 lg:order-2 lg:sticky lg:top-24 lg:self-start">
          <BookingPricingBreakdown
            unitPrice={displayUnitPrice}
            totalPrice={displayTotalPrice}
            sessionsCount={displaySessionsCount}
            participantsCount={displayParticipantsCount}
            groupType={booking.groupType}
            packType={booking.packType}
            priceTierKey={booking.priceTierKey}
            courseAmount={displayCourseAmount}
            transportFee={displayTransportFee}
            transportFeeLabel={pricingSnapshot?.transportFeeLabel}
            transportRouteLabel={pricingSnapshot?.transportRouteLabel}
            transportRuleLabel={pricingSnapshot?.transportRuleLabel}
            materialFee={displayMaterialFee}
            discountAmount={displayDiscountAmount}
            paymentServiceFeeAmount={displayPaymentServiceFeeAmount}
            paymentServiceFeeLabel={displayPaymentServiceFeeLabel}
            totalBeforePaymentServiceFee={displayTotalBeforePaymentServiceFee}
            isQuoteOnly={booking.isQuoteOnly}
          />

          <ScheduleProposalActions bookingId={booking.id} proposals={scheduleProposals} />

          <ReplacementProposalActions bookingId={booking.id} proposals={replacementProposals} />

          <ClientRescheduleRequestPanel bookingId={booking.id} requests={rescheduleRequests} />

          <BookingActions booking={bookingActionsPayload as any} />
        </div>
      </div>
    </div>
  );
}

function ReservationStatusChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-h-16 min-w-0 rounded-lg border border-[#DDE6F7] bg-white px-3 py-2 text-left">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-[#64748B]">{label}</p>
      <p className="mt-0.5 break-words text-sm font-semibold leading-5 text-[#111B4D]">{value}</p>
    </div>
  );
}

function getClientSituation({
  status,
  paymentStatus,
  isQuoteOnly,
  hasDispute,
  paymentAwaitingProof,
}: {
  status: string;
  paymentStatus: string;
  isQuoteOnly: boolean;
  hasDispute: boolean;
  paymentAwaitingProof: boolean;
}) {
  if (status === "DISPUTED" || paymentStatus === "DISPUTED" || hasDispute) {
    return {
      title: "Service client en traitement",
      description: "Votre paiement reste protégé pendant l'analyse.",
      icon: <AlertTriangle className="h-5 w-5 text-[#111B4D]" />,
      className: "border-[#E3E8F2] bg-white text-[#111B4D]",
    };
  }
  if (status === "PENDING_CLIENT_VALIDATION") {
    return {
      title: "Confirmation du cours",
      description: "Confirmez le cours ou signalez un problème.",
      icon: <ClipboardCheck className="h-5 w-5 text-[#111B4D]" />,
      className: "border-[#E3E8F2] bg-white text-[#111B4D]",
    };
  }
  if (status === "CANCELLED" || status === "REFUNDED") {
    return {
      title: "Dossier annulé",
      description: "Remboursement et frais restent visibles dans le dossier.",
      icon: <RefreshCw className="h-5 w-5 text-[#111B4D]" />,
      className: "border-[#E3E8F2] bg-white text-[#111B4D]",
    };
  }
  if (isQuoteOnly) {
    return {
      title: "Prix en validation",
      description: "Le service client valide le montant avant paiement.",
      icon: <Hourglass className="h-5 w-5 text-[#111B4D]" />,
      className: "border-[#CAD7F2] bg-white text-[#111B4D]",
    };
  }
  if (paymentAwaitingProof) {
    return {
      title: "Paiement en vérification",
      description: "Confirmation serveur PayDunya en attente.",
      icon: <Hourglass className="h-5 w-5 text-[#111B4D]" />,
      className: "border-[#CAD7F2] bg-white text-[#111B4D]",
    };
  }
  if (status === "PENDING_PAYMENT" && paymentStatus === "FAILED") {
    return {
      title: "Brouillon non réservé",
      description: "Le paiement se fait uniquement sur PayDunya. Aucun professeur n'est notifié tant que PayDunya n'a pas confirmé le paiement côté serveur.",
      icon: <Hourglass className="h-5 w-5 text-[#111B4D]" />,
      className: "border-[#CAD7F2] bg-white text-[#111B4D]",
    };
  }
  if (paymentStatus === "BLOCKED") {
    return {
      title: "Paiement protégé",
      description: "Les fonds restent bloqués jusqu'à confirmation.",
      icon: <LockKeyhole className="h-5 w-5 text-[#111B4D]" />,
      className: "border-[#CAD7F2] bg-white text-[#111B4D]",
    };
  }
  if (status === "VALIDATED_BY_CLIENT" || status === "PAYMENT_TO_RELEASE") {
    return {
      title: "Validation enregistrée",
      description: "Le service client finalise le paiement professeur.",
      icon: <ShieldCheck className="h-5 w-5 text-[#111B4D]" />,
      className: "border-[#CAD7F2] bg-white text-[#111B4D]",
    };
  }
  if (status === "TEACHER_PAID" || paymentStatus === "TEACHER_PAID") {
    return {
      title: "Cours clôturé",
      description: "Historique et paiement sont archivés ici.",
      icon: <CheckCircle2 className="h-5 w-5 text-[#111B4D]" />,
      className: "border-[#CAD7F2] bg-white text-[#111B4D]",
    };
  }

  return {
    title: "Validation en cours",
    description: "L'équipe confirme la disponibilité du professeur.",
    icon: <ShieldCheck className="h-5 w-5 text-[#111B4D]" />,
    className: "border-[#CAD7F2] bg-white text-[#111B4D]",
  };
}

function ReservationHeroMetric({ icon, label, value }: { icon: ReactNode; label: string; value: ReactNode }) {
  return (
    <div className="flex min-w-0 items-start gap-2 rounded-lg border border-[#E3E8F2] bg-white px-3 py-2.5">
      <span className="mt-0.5 shrink-0 text-[#111B4D]">{icon}</span>
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-wide text-[#64748B]">{label}</p>
        <div className="mt-0.5 break-words text-sm font-semibold leading-5 text-[#111827]">{value}</div>
      </div>
    </div>
  );
}

function DetailRow({ icon, label, value }: { icon: ReactNode; label: string; value: ReactNode }) {
  return (
    <div className="flex min-w-0 items-start gap-2 rounded-lg border border-[#E3E8F2] bg-white px-3 py-2">
      {icon && <span className="mt-0.5 shrink-0 text-[#64748B]">{icon}</span>}
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-wide text-[#64748B]">{label}</p>
        <div className="break-words text-sm font-semibold leading-6 text-[#111827]">{value}</div>
      </div>
    </div>
  );
}

function extractPayDunyaReturnToken(searchParams: Record<string, string | undefined>) {
  const directToken = firstQueryValue(
    searchParams.token,
    searchParams.invoice_token,
    searchParams.invoiceToken,
    searchParams.paydunya_token,
    searchParams.paydunyaToken,
  );
  if (directToken) return directToken;

  for (const value of Object.values(searchParams)) {
    const token = extractTokenFromQueryLikeValue(value);
    if (token) return token;
  }

  return undefined;
}

function firstQueryValue(...values: Array<string | undefined>) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return undefined;
}

function extractTokenFromQueryLikeValue(value?: string) {
  const trimmed = value?.trim();
  if (!trimmed || !trimmed.includes("=")) return undefined;

  const queryPart = trimmed.includes("?")
    ? trimmed.slice(trimmed.indexOf("?") + 1)
    : trimmed;
  const parsed = new URLSearchParams(queryPart);
  return firstQueryValue(
    parsed.get("token") ?? undefined,
    parsed.get("invoice_token") ?? undefined,
    parsed.get("invoiceToken") ?? undefined,
    parsed.get("paydunya_token") ?? undefined,
    parsed.get("paydunyaToken") ?? undefined,
  );
}

function formatClientBookingStatus(status: string) {
  return CLIENT_BOOKING_STATUS_LABELS[status] ?? "Suivi en cours";
}

function formatClientPaymentStatus(status: string, quoteOnly = false) {
  if (quoteOnly) return "Prix à finaliser";
  return CLIENT_PAYMENT_STATUS_LABELS[status] ?? "Suivi paiement";
}

function firstPositiveAmount(...values: Array<number | null | undefined>) {
  for (const value of values) {
    const amount = Math.round(Number(value) || 0);
    if (amount > 0) return amount;
  }
  return 0;
}

function hasBlockingClientState(status: string, paymentStatus: string, disputeCount: number) {
  return disputeCount > 0
    || ["DISPUTED", "CANCELLED", "REFUNDED"].includes(status)
    || ["DISPUTED", "REFUND_PENDING", "PARTIAL_REFUND_PENDING", "REFUNDED", "PARTIALLY_REFUNDED"].includes(paymentStatus);
}

function formatSchoolProgramDisplay(value?: string | null) {
  if (!value?.trim()) return "";
  const parts = value
    .split("|")
    .map((part) => part.trim())
    .map((part) => {
      const separatorIndex = part.indexOf(":");
      if (separatorIndex === -1) return part;

      const key = part.slice(0, separatorIndex).trim().toLowerCase();
      const label = part.slice(separatorIndex + 1).trim();
      if (!label) return "";
      if (key.includes("type client")) return "";
      if (key.includes("catégorie") || key.includes("categorie")) return label;
      return label;
    })
    .filter(Boolean);

  return parts.length > 0 ? parts.join(" · ") : value.trim();
}

function getTimelineStepHint(label: string, canShowOperationalProgress: boolean) {
  if (!canShowOperationalProgress) {
    if (label.includes("Paiement")) return "À faire sur PayDunya";
    if (label.includes("Validation")) return "Après confirmation serveur";
    return "En attente du paiement";
  }
  if (label.includes("Paiement")) return "Vérifié côté serveur";
  if (label.includes("Validée")) return "Disponibilité suivie";
  if (label.includes("Cours effectué")) return "Déclaré après séance";
  if (label.includes("client")) return "Action client";
  if (label.includes("clôturé")) return "Historique conservé";
  return "Dossier créé";
}
