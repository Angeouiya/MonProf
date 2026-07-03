import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/session";
import { PageHeader } from "@/components/shared/page-header";
import { BookingStatusBadge, PaymentStatusBadge } from "@/components/shared/status-badge";
import { Money } from "@/components/shared/money";
import { ProfessorImage } from "@/components/shared/professor-image";
import { BookingPricingBreakdown } from "@/components/shared/booking-pricing-breakdown";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { formatDate, formatDateTime } from "@/lib/format";
import { packTypeLabel } from "@/lib/platform-labels";
import { cancellationWindowLabel } from "@/lib/cancellation-policy";
import { parsePricingSnapshot } from "@/lib/pricing";
import { dayLabel } from "@/lib/scheduling";
import { reconcilePayDunyaBookingPayment } from "@/lib/paydunya-reconciliation";
import { hasVerifiedPayDunyaClientPayment } from "@/lib/payment-security";
import {
  Home, Video, User, Users, Calendar, Clock, MapPin, MessageSquare,
  CheckCircle2, AlertTriangle, LockKeyhole, ClipboardCheck,
  WalletCards, ShieldCheck, Hourglass, RefreshCw,
} from "lucide-react";
import { BookingActions } from "./actions";

export const dynamic = "force-dynamic";

export default async function ReservationDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ action?: string; paydunya?: string; token?: string }>;
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
      transactions: { where: { type: { in: ["CLIENT_PAYMENT", "REFUND"] } }, orderBy: { createdAt: "asc" } },
      reviews: { where: { clientId: user.id } },
      disputes: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!booking || booking.clientId !== user.id) notFound();

  const paydunyaReturnCheck = sp.paydunya === "return"
    ? await reconcilePayDunyaBookingPayment({
        bookingId: id,
        token: sp.token,
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
        transactions: { where: { type: { in: ["CLIENT_PAYMENT", "REFUND"] } }, orderBy: { createdAt: "asc" } },
        reviews: { where: { clientId: user.id } },
        disputes: { orderBy: { createdAt: "desc" } },
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
  const displayTotalPrice = pricingSnapshot?.totalClientPays ?? booking.totalClientPays ?? booking.totalPrice;
  const displaySessionsCount = pricingSnapshot?.numberOfSessions ?? booking.sessionsCount;
  const displayParticipantsCount = pricingSnapshot?.participantsCount ?? booking.participantsCount;
  const requestedDate = booking.startDate ?? booking.scheduledDate;
  const confirmedDate = booking.scheduledDate;
  const dateShownToClient = confirmedDate ?? requestedDate;
  const dateSourceLabel = confirmedDate
    ? "Date confirmée pour le cours"
    : requestedDate
      ? "Date demandée par le client, en attente de validation admin"
      : "Date à compléter";
  const timeShownToClient = booking.scheduledTime || booking.preferredTime || "Horaire à confirmer";
  const preferredDaysLabel = preferredDays.length
    ? preferredDays.map((day) => dayLabel(day)).join(", ")
    : "Selon le créneau choisi";
  const locationLabel = booking.courseFormat === "HOME"
    ? [booking.commune, booking.quartier, booking.addressHint].filter(Boolean).join(", ") || "Adresse à confirmer"
    : booking.onlineLink || "Lien en ligne à confirmer";
  const paymentConfirmed = hasVerifiedPayDunyaClientPayment(booking);
  const visibleTransactions = paymentConfirmed
    ? booking.transactions
    : booking.transactions.filter((transaction) => transaction.type === "REFUND");
  const paymentAwaitingProof = !booking.isQuoteOnly
    && !paymentConfirmed
    && ["RECEIVED", "BLOCKED", "VALIDATED", "TO_PAY_TEACHER", "TEACHER_PAID"].includes(booking.paymentStatus);
  const returnedFromPayDunya = sp.paydunya === "return";
  const cancelledOnPayDunya = sp.paydunya === "cancelled";

  // Timeline
  const timeline = [
    { label: "Réservation créée", date: booking.createdAt, done: true },
    { label: "Paiement PayDunya vérifié", date: booking.createdAt, done: paymentConfirmed },
    { label: "Validée par l'admin", date: booking.confirmedAt, done: !!booking.confirmedAt || ["CONFIRMED", "ASSIGNED", "IN_PROGRESS", "COURSE_DONE", "PENDING_CLIENT_VALIDATION", "VALIDATED_BY_CLIENT", "PAYMENT_TO_RELEASE", "TEACHER_PAID"].includes(booking.status) },
    { label: "Cours effectué", date: booking.courseDoneAt, done: !!booking.courseDoneAt || ["COURSE_DONE", "PENDING_CLIENT_VALIDATION", "VALIDATED_BY_CLIENT", "PAYMENT_TO_RELEASE", "TEACHER_PAID"].includes(booking.status) },
    { label: "Confirmé par le client", date: booking.clientValidatedAt, done: !!booking.clientValidatedAt || ["VALIDATED_BY_CLIENT", "PAYMENT_TO_RELEASE", "TEACHER_PAID"].includes(booking.status) },
    { label: "Cours clôturé", date: booking.teacherPaidAt, done: booking.status === "TEACHER_PAID" },
  ];
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
      <PageHeader
        title={`Réservation ${booking.reference}`}
        description={`Créée le ${formatDateTime(booking.createdAt)}`}
      >
        <div className="flex flex-wrap items-center gap-2">
          <BookingStatusBadge status={booking.status} audience="client" />
          <PaymentStatusBadge status={booking.paymentStatus} audience="client" quoteOnly={booking.isQuoteOnly} />
        </div>
      </PageHeader>

      {returnedFromPayDunya && paymentConfirmed && (
        <div className="flex items-start gap-3 rounded-[1.25rem] border border-[#DDE6F7] bg-white p-4 shadow-sm">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-[#111B4D]" />
          <div className="text-sm">
            <p className="font-black text-[#111B4D]">Paiement PayDunya confirmé</p>
            <p className="mt-1 leading-6 text-[#64748B]">
              Votre paiement de <strong className="text-[#111827]"><Money amount={displayTotalPrice} /></strong> a été reçu
              et est gardé bloqué jusqu'à la confirmation du cours. Date demandée : <strong className="text-[#111827]">{dateShownToClient ? formatDate(dateShownToClient) : "à confirmer"}</strong>.
              L'administrateur valide votre réservation prochainement.
            </p>
          </div>
        </div>
      )}

      {returnedFromPayDunya && !paymentConfirmed && (
        <div className="flex items-start gap-3 rounded-[1.25rem] border border-[#DDE6F7] bg-white p-4 shadow-sm">
          <Hourglass className="mt-0.5 h-5 w-5 shrink-0 text-[#111B4D]" />
          <div className="text-sm">
            <p className="font-black text-[#111B4D]">Retour PayDunya enregistré</p>
            <p className="mt-1 leading-6 text-[#64748B]">
              Nous attendons la confirmation automatique de PayDunya. Si le paiement a été validé, le statut passera en paiement sécurisé dès réception du webhook.
              {paydunyaReturnCheck?.message ? ` Contrôle serveur: ${paydunyaReturnCheck.message}` : " Aucun paiement n'est validé sans confirmation serveur PayDunya."}
            </p>
          </div>
        </div>
      )}

      {cancelledOnPayDunya && !paymentConfirmed && (
        <div className="flex items-start gap-3 rounded-[1.25rem] border border-[#E3E8F2] bg-white p-4 shadow-sm">
          <RefreshCw className="mt-0.5 h-5 w-5 shrink-0 text-[#111B4D]" />
          <div className="text-sm">
            <p className="font-black text-[#111B4D]">Paiement PayDunya non finalisé</p>
            <p className="mt-1 leading-6 text-[#64748B]">
              Vous pouvez reprendre le paiement depuis les actions du dossier. Le moyen et les informations de paiement restent gérés sur PayDunya.
            </p>
          </div>
        </div>
      )}

      <section className="grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(280px,0.85fr)] lg:items-stretch">
        <div className="order-2 rounded-[1.35rem] border border-[#E3E8F2] bg-white p-4 shadow-sm sm:p-5 lg:order-1">
          <div className="flex flex-col gap-4 min-[520px]:flex-row min-[520px]:items-center">
            <ProfessorImage photoUrl={booking.teacher.photoUrl} name={name} size="md" shape="circle" verified={booking.teacher.badgeVerified} />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-black uppercase tracking-wide text-[#64748B]">Dossier client</p>
              <h2 className="mt-1 text-xl font-black tracking-tight text-[#111827] sm:text-2xl">
                {booking.subjectName} avec {name}
              </h2>
              <p className="mt-1 text-sm font-semibold text-[#64748B]">{booking.teacher.jobTitle}</p>
            </div>
          </div>

          <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            <ReservationHeroMetric
              icon={<Calendar className="h-4 w-4" />}
              label="Date"
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
              value={booking.isQuoteOnly ? "Sur devis" : <Money amount={displayTotalPrice} />}
            />
          </div>
        </div>

        <div className={`order-1 flex flex-col justify-between rounded-[1.35rem] border p-4 shadow-sm sm:p-5 lg:order-2 ${clientSituation.className}`}>
          <div>
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white shadow-sm">
                {clientSituation.icon}
              </span>
              <div className="min-w-0">
                <p className="text-xs font-black uppercase tracking-wide text-[#64748B]">Action attendue</p>
                <h3 className="mt-0.5 text-lg font-black leading-tight">{clientSituation.title}</h3>
              </div>
            </div>
            <p className="mt-4 text-sm font-semibold leading-6 text-[#64748B]">{clientSituation.description}</p>
          </div>
          <div className="mt-4 grid gap-2 min-[420px]:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
            <div className="rounded-2xl border border-[#E3E8F2] bg-white px-3 py-2">
              <p className="text-xs font-bold uppercase tracking-wide text-[#64748B]">Référence</p>
              <p className="mt-1 font-mono text-sm font-black">{booking.reference}</p>
            </div>
            <div className="rounded-2xl border border-[#E3E8F2] bg-white px-3 py-2">
              <p className="text-xs font-bold uppercase tracking-wide text-[#64748B]">Protection</p>
              <p className="mt-1 text-sm font-black">
                {booking.isQuoteOnly ? "Devis admin" : booking.paymentStatus === "BLOCKED" ? "Fonds bloqués" : "Suivi actif"}
              </p>
            </div>
          </div>
        </div>
      </section>

      <div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        {/* Colonne gauche : détails */}
        <div className="order-2 min-w-0 space-y-4 lg:order-1">
          <Card className="overflow-hidden rounded-[1.35rem] border-[#CAD7F2] bg-white">
            <CardContent className="p-4 sm:p-5">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-xs font-black uppercase tracking-wide text-[#64748B]">Planning transmis au paiement</p>
                  <h2 className="mt-1 text-xl font-black tracking-tight text-[#111B4D] sm:text-2xl">
                    {dateShownToClient ? formatDate(dateShownToClient) : "Date à confirmer"}
                  </h2>
                  <p className="mt-1 text-sm font-semibold text-[#64748B]">{dateSourceLabel}</p>
                </div>
                <div className="rounded-2xl border border-[#DDE6F7] bg-white px-4 py-3 text-sm shadow-sm md:min-w-56">
                  <p className="text-xs font-bold uppercase tracking-wide text-[#64748B]">Créneau demandé</p>
                  <p className="mt-1 font-black leading-6 text-[#111827]">{timeShownToClient}</p>
                </div>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <DetailRow icon={<Calendar className="h-4 w-4" />} label="Jours" value={preferredDaysLabel} />
                <DetailRow icon={<Clock className="h-4 w-4" />} label="Formule" value={packTypeLabel(booking.packType)} />
                <DetailRow
                  icon={booking.courseFormat === "HOME" ? <Home className="h-4 w-4" /> : <Video className="h-4 w-4" />}
                  label="Format"
                  value={booking.courseFormat === "HOME" ? "À domicile" : "En ligne"}
                />
                <DetailRow icon={<MapPin className="h-4 w-4" />} label={booking.courseFormat === "HOME" ? "Lieu" : "Accès"} value={locationLabel} />
              </div>
            </CardContent>
          </Card>

          {/* Détails cours */}
          <Card className="rounded-[1.35rem]">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-black text-[#111827]">Détails du cours</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="grid gap-3 sm:grid-cols-2">
                <DetailRow icon={null} label="Matière" value={booking.subjectName} />
                <DetailRow icon={null} label="Niveau" value={booking.levelName} />
                <DetailRow
                  icon={booking.groupType === "INDIVIDUAL" ? <User className="h-4 w-4" /> : <Users className="h-4 w-4" />}
                  label="Type"
                  value={booking.groupType === "INDIVIDUAL" ? "Individuel" : "Petit groupe"}
                />
                <DetailRow icon={<Clock className="h-4 w-4" />} label="Durée" value={`${displaySessionsCount} séance${displaySessionsCount > 1 ? "s" : ""} de 2h`} />
                {booking.schoolProgram && (
                  <div className="rounded-2xl border border-[#DDE6F7] bg-white p-3 sm:col-span-2">
                    <p className="text-xs font-bold uppercase tracking-wide text-[#64748B]">Parcours choisi</p>
                    <p className="mt-1 whitespace-pre-line text-sm font-semibold text-[#111B4D]">{booking.schoolProgram}</p>
                  </div>
                )}
              </div>

              {booking.courseFormat === "HOME" && (
                <>
                  <Separator />
                  <DetailRow icon={<MapPin className="h-4 w-4" />} label="Lieu" value={[booking.commune, booking.quartier, booking.addressHint].filter(Boolean).join(", ") || "Non précisé"} />
                </>
              )}
              {booking.courseFormat === "ONLINE" && booking.onlineLink && (
                <>
                  <Separator />
                  <DetailRow icon={<Video className="h-4 w-4" />} label="Lien" value={booking.onlineLink} />
                </>
              )}

              {booking.objective && (
                <>
                  <Separator />
                  <DetailRow icon={<MessageSquare className="h-4 w-4" />} label="Objectif" value={booking.objective} />
                </>
              )}
              {booking.message && (
                <DetailRow icon={<MessageSquare className="h-4 w-4" />} label="Message" value={booking.message} />
              )}
            </CardContent>
          </Card>

          {isCancelled && (
            <Card className="rounded-[1.35rem] border-[#E3E8F2] bg-white">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-black text-[#111827]">Annulation et remboursement</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="grid gap-3 sm:grid-cols-2">
                  <DetailRow icon={<AlertTriangle className="h-4 w-4" />} label="Motif" value={booking.cancellationReason || "Annulation demandée"} />
                  <DetailRow icon={<Calendar className="h-4 w-4" />} label="Date d'annulation" value={booking.cancelledAt ? formatDateTime(booking.cancelledAt) : "—"} />
                  <DetailRow icon={<Clock className="h-4 w-4" />} label="Règle appliquée" value={cancellationWindowLabel(booking.cancellationWindow)} />
                  <DetailRow
                    icon={<CheckCircle2 className="h-4 w-4" />}
                    label="Statut paiement"
                    value={<PaymentStatusBadge status={booking.paymentStatus} audience="client" quoteOnly={booking.isQuoteOnly} />}
                  />
                </div>
                {booking.cancellationDetail && (
                  <div className="rounded-2xl border border-[#E3E8F2] bg-white p-3">
                    <p className="text-xs font-bold uppercase tracking-wide text-[#64748B]">Message complémentaire</p>
                    <p className="mt-1 whitespace-pre-line text-sm font-semibold text-[#111827]">{booking.cancellationDetail}</p>
                  </div>
                )}
                <div className="grid gap-2 sm:grid-cols-2">
                  <div className="rounded-2xl border border-[#E3E8F2] bg-white p-3">
                    <p className="text-xs text-[#64748B]">Frais retenus</p>
                    <p className="mt-1 text-lg font-black text-[#111827]"><Money amount={booking.cancellationFeeAmount} /></p>
                    <p className="text-xs text-[#64748B]">{booking.cancellationFeeRate}%</p>
                  </div>
                  <div className="rounded-2xl border border-[#E3E8F2] bg-white p-3">
                    <p className="text-xs text-[#64748B]">Remboursement estimé</p>
                    <p className="mt-1 text-lg font-black text-[#111827]"><Money amount={booking.cancellationRefundAmount} /></p>
                    <p className="text-xs text-[#64748B]">Selon la règle appliquée au moment de l'annulation.</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Timeline */}
          <Card className="rounded-[1.35rem]">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-black text-[#111827]">Suivi de la réservation</CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="relative space-y-4 pl-6">
                <span className="absolute left-[7px] top-1 bottom-1 w-px bg-[#DDE6F7]" />
                {timeline.map((t, i) => (
                  <li key={i} className="relative">
                    <span className={`absolute -left-[1.4rem] top-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full ring-4 ring-background ${
                      t.done ? "bg-[#111B4D]" : "border border-[#DDE6F7] bg-white"
                    }`}>
                      {t.done && <CheckCircle2 className="h-3.5 w-3.5 text-white" />}
                    </span>
                    <div className="flex flex-col gap-1 rounded-2xl border border-[#E3E8F2] bg-white px-3 py-2 shadow-sm min-[480px]:flex-row min-[480px]:items-center min-[480px]:justify-between">
                      <p className={`text-sm font-bold ${t.done ? "text-[#111827]" : "text-[#64748B]"}`}>{t.label}</p>
                      {t.date && t.done && (
                        <p className="text-xs font-semibold text-[#64748B] min-[480px]:shrink-0">{formatDate(t.date)}</p>
                      )}
                    </div>
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>

          {/* Transactions */}
          {visibleTransactions.length > 0 && (
            <Card className="rounded-[1.35rem]">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-black text-[#111827]">Historique des transactions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {visibleTransactions.map((tx) => (
                  <div key={tx.id} className="flex flex-col gap-3 rounded-2xl border border-[#E3E8F2] bg-white p-3 text-sm shadow-sm min-[460px]:flex-row min-[460px]:items-center min-[460px]:justify-between">
                    <div>
                      <p className="font-mono text-xs font-black text-[#111827]">{tx.reference}</p>
                      <p className="mt-1 text-xs text-[#64748B]">
                        {tx.type === "CLIENT_PAYMENT" ? "Paiement sécurisé" :
                          tx.type === "REFUND" ? "Remboursement" : "Transaction"}
                        {" • "}{formatDate(tx.createdAt)}
                      </p>
                    </div>
                    <div className="min-[460px]:text-right">
                      <p className="font-black text-[#111827]"><Money amount={tx.amount} /></p>
                      <PaymentStatusBadge status={tx.status} audience="client" />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
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
            isQuoteOnly={booking.isQuoteOnly}
          />

          <BookingActions booking={bookingActionsPayload as any} />
        </div>
      </div>
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
      title: "Support en traitement",
      description: "Votre paiement reste protégé pendant que l'équipe analyse le litige et vous tient informé.",
      icon: <AlertTriangle className="h-5 w-5 text-[#111B4D]" />,
      className: "border-[#E3E8F2] bg-white text-[#111B4D]",
    };
  }
  if (status === "PENDING_CLIENT_VALIDATION") {
    return {
      title: "Confirmation du cours",
      description: "Le cours est marqué comme effectué. Confirmez-le ou signalez un problème depuis les actions du dossier.",
      icon: <ClipboardCheck className="h-5 w-5 text-[#111B4D]" />,
      className: "border-[#E3E8F2] bg-white text-[#111B4D]",
    };
  }
  if (status === "CANCELLED" || status === "REFUNDED") {
    return {
      title: "Dossier annulé",
      description: "Les règles d'annulation et le remboursement estimé sont affichés dans le détail de cette réservation.",
      icon: <RefreshCw className="h-5 w-5 text-slate-700" />,
      className: "border-slate-200 bg-white text-slate-800",
    };
  }
  if (isQuoteOnly) {
    return {
      title: "Devis en validation",
      description: "L'administration vérifie le tarif final avant tout paiement. Vous recevrez un montant clair.",
      icon: <Hourglass className="h-5 w-5 text-[#111B4D]" />,
      className: "border-[#CAD7F2] bg-white text-[#111B4D]",
    };
  }
  if (paymentAwaitingProof) {
    return {
      title: "Paiement en vérification",
      description: "Un statut financier existe, mais l'interface attend encore la preuve serveur PayDunya avant d'afficher le paiement comme confirmé.",
      icon: <Hourglass className="h-5 w-5 text-[#111B4D]" />,
      className: "border-[#CAD7F2] bg-white text-[#111B4D]",
    };
  }
  if (status === "PENDING_PAYMENT" && paymentStatus === "FAILED") {
    return {
      title: "Paiement PayDunya à finaliser",
      description: "Le paiement se fait sur PayDunya. MonProf CI ne collecte pas les informations Mobile Money et ne propose pas de choix de moyen interne.",
      icon: <Hourglass className="h-5 w-5 text-[#111B4D]" />,
      className: "border-[#CAD7F2] bg-white text-[#111B4D]",
    };
  }
  if (paymentStatus === "BLOCKED") {
    return {
      title: "Paiement protégé",
      description: "Les fonds sont gardés en sécurité. Ils ne seront libérés qu'après confirmation du cours.",
      icon: <LockKeyhole className="h-5 w-5 text-[#111B4D]" />,
      className: "border-[#CAD7F2] bg-white text-[#111B4D]",
    };
  }
  if (status === "VALIDATED_BY_CLIENT" || status === "PAYMENT_TO_RELEASE") {
    return {
      title: "Validation enregistrée",
      description: "Votre confirmation est prise en compte. L'administration finalise le paiement du professeur.",
      icon: <ShieldCheck className="h-5 w-5 text-[#111B4D]" />,
      className: "border-[#CAD7F2] bg-white text-[#111B4D]",
    };
  }
  if (status === "TEACHER_PAID" || paymentStatus === "TEACHER_PAID") {
    return {
      title: "Cours clôturé",
      description: "Le dossier est finalisé dans votre espace client avec son historique de paiement.",
      icon: <CheckCircle2 className="h-5 w-5 text-[#111B4D]" />,
      className: "border-[#CAD7F2] bg-white text-[#111B4D]",
    };
  }

  return {
    title: "Validation en cours",
    description: "L'équipe confirme la disponibilité du professeur et garde votre réservation sous suivi.",
    icon: <ShieldCheck className="h-5 w-5 text-[#111B4D]" />,
    className: "border-[#CAD7F2] bg-white text-[#111B4D]",
  };
}

function ReservationHeroMetric({ icon, label, value }: { icon: ReactNode; label: string; value: ReactNode }) {
  return (
    <div className="flex min-w-0 items-start gap-2 rounded-2xl border border-[#E3E8F2] bg-white px-3 py-2.5">
      <span className="mt-0.5 shrink-0 text-[#111B4D]">{icon}</span>
      <div className="min-w-0">
        <p className="text-xs font-bold uppercase tracking-wide text-[#64748B]">{label}</p>
        <div className="mt-0.5 break-words text-sm font-black leading-5 text-[#111827]">{value}</div>
      </div>
    </div>
  );
}

function DetailRow({ icon, label, value }: { icon: ReactNode; label: string; value: ReactNode }) {
  return (
    <div className="flex min-w-0 items-start gap-2 rounded-2xl border border-[#E3E8F2] bg-white px-3 py-2 shadow-sm">
      {icon && <span className="mt-0.5 shrink-0 text-[#64748B]">{icon}</span>}
      <div className="min-w-0">
        <p className="text-xs font-bold uppercase tracking-wide text-[#64748B]">{label}</p>
        <div className="break-words text-sm font-semibold leading-6 text-[#111827]">{value}</div>
      </div>
    </div>
  );
}
