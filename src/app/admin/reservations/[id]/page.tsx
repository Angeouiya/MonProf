import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { notFound } from "next/navigation";
import Link from "next/link";
import { PageHeader } from "@/components/shared/page-header";
import { Money } from "@/components/shared/money";
import { BookingStatusBadge, PaymentStatusBadge } from "@/components/shared/status-badge";
import { ProfessorImage } from "@/components/shared/professor-image";
import { BookingPricingBreakdown } from "@/components/shared/booking-pricing-breakdown";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  MapPin, Phone, Mail, Clock, Calendar, User, GraduationCap,
  Video, Home, Users, CheckCircle2, XCircle, CalendarClock,
} from "lucide-react";
import { BookingActionsClient } from "./actions-client";
import { ClientCommunicationClient } from "./client-communication-client";
import { ReplacementHistoryTable } from "@/components/admin/teacher-operational-components";
import { formatFCFA, formatDateTime, formatDate, initials } from "@/lib/format";
import { getTeacherFinancialSettlement } from "@/lib/teacher-payments";
import { disputeStatusLabel, packTypeLabel, paymentMethodLabel, transactionTypeLabel } from "@/lib/platform-labels";
import { cancellationActorLabel, cancellationWindowLabel } from "@/lib/cancellation-policy";
import { COURSE_CATEGORIES, SCHOOL_SYSTEMS } from "@/lib/course-catalog";
import { parsePricingSnapshot } from "@/lib/pricing";

export const dynamic = "force-dynamic";

function categoryLabel(value?: string | null) {
  return COURSE_CATEGORIES.find((category) => category.code === value)?.label ?? value ?? "—";
}

function schoolSystemLabel(value?: string | null) {
  return SCHOOL_SYSTEMS.find((system) => system.value === value)?.label ?? value ?? "—";
}

export default async function ReservationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;

  const booking = await db.booking.findUnique({
    where: { id },
    include: {
      client: { select: { id: true, name: true, email: true, phone: true, commune: true, quartier: true } },
      teacher: {
        select: {
          id: true, fullName: true, professionalName: true, photoUrl: true, phone: true, email: true, badgeVerified: true,
          commune: true, quartier: true, addressHint: true, commissionRate: true,
        },
      },
      transactions: { orderBy: { createdAt: "desc" } },
      reviews: { include: { client: { select: { name: true } } } },
      disputes: { include: { openedBy: { select: { name: true } } }, orderBy: { createdAt: "desc" } },
      scheduleProposals: {
        include: {
          teacher: { select: { fullName: true, professionalName: true, photoUrl: true, badgeVerified: true } },
        },
        orderBy: { createdAt: "desc" },
      },
      replacements: {
        include: {
          booking: { select: { reference: true, client: { select: { name: true, phone: true } } } },
          oldTeacher: { select: { fullName: true, professionalName: true, photoUrl: true, phone: true, badgeVerified: true } },
          newTeacher: { select: { fullName: true, professionalName: true, photoUrl: true, phone: true, badgeVerified: true } },
        },
        orderBy: { createdAt: "desc" },
      },
      teacherPaymentAdjustments: { orderBy: { createdAt: "desc" } },
      clientCommunications: {
        include: { sentBy: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
        take: 30,
      },
      clientRefundRequests: {
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!booking) notFound();
  const teacherSettlement = getTeacherFinancialSettlement(booking, booking.teacherPaymentAdjustments);
  const teacherPaidAmount = teacherSettlement.paid;
  const teacherRemainingAmount = teacherSettlement.remaining;
  const pricingSnapshot = parsePricingSnapshot(booking.pricingSnapshot);
  const displayUnitPrice = pricingSnapshot?.unitSessionAmount ?? booking.unitPrice;
  const displayCourseAmount = pricingSnapshot?.courseAmount ?? booking.courseAmount;
  const displayTransportFee = pricingSnapshot?.transportFee ?? booking.transportFee;
  const displayMaterialFee = pricingSnapshot?.materialFee ?? booking.materialFee;
  const displayDiscountAmount = pricingSnapshot?.discountAmount ?? booking.discountAmount;
  const displayPaymentServiceFeeAmount = pricingSnapshot?.paymentServiceFeeAmount ?? booking.paymentServiceFeeAmount;
  const displayPaymentServiceFeeLabel = pricingSnapshot?.paymentServiceFeeLabel ?? booking.paymentServiceFeeLabel;
  const displayTotalPrice = pricingSnapshot?.totalClientPays ?? booking.totalClientPays ?? booking.totalPrice;
  const displayTotalBeforePaymentServiceFee = pricingSnapshot?.totalBeforePaymentServiceFee
    ?? Math.max(0, displayTotalPrice - displayPaymentServiceFeeAmount);
  const displaySessionsCount = pricingSnapshot?.numberOfSessions ?? booking.sessionsCount;
  const displayParticipantsCount = pricingSnapshot?.participantsCount ?? booking.participantsCount;
  const displayCommissionAmount = pricingSnapshot?.platformCommissionAmount ?? booking.commissionAmount;
  const displayTeacherCoursePayout = pricingSnapshot?.teacherPayoutAmount ?? booking.teacherPayoutAmount;
  const displayTeacherTotalReceives = pricingSnapshot?.totalTeacherReceives ?? booking.totalTeacherReceives;

  const timeline = [
    { label: "Créée", date: booking.createdAt },
    { label: "Confirmée (admin)", date: booking.confirmedAt },
    { label: "Affectée au prof", date: booking.assignedAt },
    { label: "Cours effectué", date: booking.courseDoneAt },
    { label: "Validée par client", date: booking.clientValidatedAt },
    { label: "Professeur payé", date: booking.teacherPaidAt },
  ].filter((t) => t.date);

  return (
    <div className="space-y-5">
      <PageHeader title={`Réservation ${booking.reference}`} description={`Créée le ${formatDateTime(booking.createdAt)}`} />

      {/* Status header */}
      <Card>
        <CardContent className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <BookingStatusBadge status={booking.status} />
            <PaymentStatusBadge status={booking.paymentStatus} quoteOnly={booking.isQuoteOnly} />
            {booking.paymentMethod && <Badge variant="outline">{paymentMethodLabel(booking.paymentMethod)}</Badge>}
          </div>
          <div className="text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5">
              {booking.scheduledDate ? <Calendar className="h-4 w-4" /> : <Clock className="h-4 w-4" />}
              {booking.scheduledDate
                ? `${formatDate(booking.scheduledDate)} à ${booking.scheduledTime || booking.preferredTime || "—"}`
                : `Date souhaitée: ${booking.startDate ? formatDate(booking.startDate) : "—"} · Créneau: ${booking.preferredTime}`}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Actions contextuelles */}
      <BookingActionsClient booking={JSON.parse(JSON.stringify(booking))} />

      <ClientCommunicationClient
        booking={JSON.parse(JSON.stringify({
          id: booking.id,
          reference: booking.reference,
          subjectName: booking.subjectName,
          levelName: booking.levelName,
          courseFormat: booking.courseFormat,
          totalPrice: booking.totalPrice,
          paymentStatus: booking.paymentStatus,
          status: booking.status,
          preferredTime: booking.preferredTime,
          startDate: booking.startDate,
          scheduledDate: booking.scheduledDate,
          scheduledTime: booking.scheduledTime,
          client: {
            id: booking.client.id,
            name: booking.client.name,
            phone: booking.client.phone,
            email: booking.client.email,
          },
          teacher: {
            id: booking.teacher.id,
            fullName: booking.teacher.fullName,
            professionalName: booking.teacher.professionalName,
            photoUrl: booking.teacher.photoUrl,
            phone: booking.teacher.phone,
            badgeVerified: booking.teacher.badgeVerified,
          },
        }))}
        communications={JSON.parse(JSON.stringify(booking.clientCommunications))}
      />

      {booking.cancelledAt && (
        <Card className="border-orange-200 bg-orange-50/40">
          <CardHeader><CardTitle className="text-base">Annulation et remboursement</CardTitle></CardHeader>
          <CardContent className="grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
            <Detail icon={XCircle} label="Annulée par" value={cancellationActorLabel(booking.cancelledBy)} />
            <Detail icon={Calendar} label="Date d'annulation" value={formatDateTime(booking.cancelledAt)} />
            <Detail icon={Clock} label="Fenêtre appliquée" value={cancellationWindowLabel(booking.cancellationWindow)} />
            <Detail icon={CheckCircle2} label="Motif" value={booking.cancellationReason ?? "—"} />
            <AmountBox label="Frais retenus" value={booking.cancellationFeeAmount} tone="warning" sub={`${booking.cancellationFeeRate}%`} />
            <AmountBox label="Remboursement client" value={booking.cancellationRefundAmount} tone="primary" />
            <AmountBox
              label="Part professeur"
              value={booking.cancellationPenaltyTeacherAmount}
              tone={booking.cancellationPenaltyTeacherAmount > 0 ? "primary" : "success"}
              sub={`${booking.cancellationPenaltyTeacherRate}% pénalité`}
            />
            <AmountBox
              label="Part plateforme"
              value={booking.cancellationPenaltyPlatformAmount}
              tone={booking.cancellationPenaltyPlatformAmount > 0 ? "warning" : "success"}
              sub={`${booking.cancellationPenaltyPlatformRate}% pénalité`}
            />
            {booking.cancellationDetail && (
              <div className="rounded-lg border border-orange-100 bg-white p-3 sm:col-span-2">
                <p className="text-xs text-muted-foreground">Détail</p>
                <p className="mt-1 text-sm text-foreground">{booking.cancellationDetail}</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {booking.cancellationRefundAmount > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Remboursement client</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-3">
              <AmountBox label="Montant à déposer" value={booking.cancellationRefundAmount} tone="primary" />
              <AmountBox label="Frais service non remboursés" value={booking.paymentServiceFeeAmount} tone={booking.paymentServiceFeeAmount > 0 ? "warning" : "success"} />
              <AmountBox label="Frais annulation" value={booking.cancellationFeeAmount} tone={booking.cancellationFeeAmount > 0 ? "danger" : "success"} />
              <AmountBox label="Professeur à compenser" value={booking.cancellationPenaltyTeacherAmount} tone={booking.cancellationPenaltyTeacherAmount > 0 ? "primary" : "success"} />
            </div>
            {booking.cancellationPenaltyTeacherAmount > 0 && (
              <div className="flex flex-col gap-2 rounded-lg border border-blue-100 bg-white p-3 text-sm sm:flex-row sm:items-center sm:justify-between">
                <p className="text-muted-foreground">
                  La part professeur est traitée dans la comptabilité interne du professeur, avec reçu et déduction automatique après versement.
                </p>
                <Button asChild variant="outline" className="shrink-0">
                  <Link href={`/admin/professeurs/${booking.teacher.id}?tab=paiements&bookingId=${booking.id}`}>Ouvrir comptabilité</Link>
                </Button>
              </div>
            )}
            {booking.clientRefundRequests.length === 0 ? (
              <p className="rounded-lg border border-dashed border-border bg-white p-4 text-sm text-muted-foreground">
                Le client n'a pas encore renseigné le numéro de remboursement.
              </p>
            ) : (
              <div className="grid gap-3 lg:grid-cols-2">
                {booking.clientRefundRequests.map((request) => (
                  <div key={request.id} className="rounded-lg border border-border bg-white p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-mono text-xs font-bold text-primary">{request.reference}</p>
                      <Badge variant="outline">{clientRefundStatusLabel(request.status)}</Badge>
                    </div>
                    <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                      <Detail icon={Clock} label="Montant" value={formatFCFA(request.amount)} />
                      <Detail icon={Phone} label="Moyen" value={paymentMethodLabel(request.method)} />
                      <Detail icon={Phone} label="Numéro dépôt" value={request.paymentPhone} />
                      <Detail icon={User} label="Titulaire" value={request.accountName ?? "—"} />
                    </div>
                    {request.note && (
                      <p className="mt-3 rounded-lg border border-border bg-white px-3 py-2 text-sm text-muted-foreground">
                        Note client : {request.note}
                      </p>
                    )}
                    {request.externalReference && (
                      <p className="mt-2 text-xs text-muted-foreground">Référence externe : {request.externalReference}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Client card */}
        <Card>
          <CardHeader><CardTitle className="text-base">Client</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex items-center gap-3">
              <Avatar className="h-10 w-10">
                <AvatarFallback className="bg-violet-50 text-violet-700">{initials(booking.client.name)}</AvatarFallback>
              </Avatar>
              <div>
                <Link href={`/admin/clients/${booking.client.id}`} className="inline-flex min-h-10 items-center font-medium text-foreground hover:text-primary">{booking.client.name}</Link>
                <p className="text-xs text-muted-foreground">Client</p>
              </div>
            </div>
            <Separator />
            <p className="flex items-center gap-2"><Mail className="h-4 w-4 text-muted-foreground" /> {booking.client.email}</p>
            <p className="flex items-center gap-2"><Phone className="h-4 w-4 text-muted-foreground" /> {booking.client.phone ?? "—"}</p>
            <p className="flex items-center gap-2"><MapPin className="h-4 w-4 text-muted-foreground" /> {booking.client.commune ?? "—"} {booking.client.quartier ? `• ${booking.client.quartier}` : ""}</p>
          </CardContent>
        </Card>

        {/* Teacher card */}
        <Card>
          <CardHeader><CardTitle className="text-base">Professeur</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex items-center gap-3">
              <ProfessorImage
                photoUrl={booking.teacher.photoUrl}
                name={booking.teacher.professionalName || booking.teacher.fullName}
                size="sm"
                shape="circle"
                verified={booking.teacher.badgeVerified}
              />
              <div>
                <Link href={`/admin/professeurs/${booking.teacher.id}?tab=cours&bookingId=${booking.id}`} className="inline-flex min-h-10 items-center font-medium text-foreground hover:text-primary">{booking.teacher.professionalName || booking.teacher.fullName}</Link>
                <p className="text-xs text-muted-foreground">Professeur</p>
              </div>
            </div>
            <Separator />
            <p className="flex items-center gap-2"><Phone className="h-4 w-4 text-muted-foreground" /> {booking.teacher.phone}</p>
            <p className="flex items-center gap-2"><Mail className="h-4 w-4 text-muted-foreground" /> {booking.teacher.email ?? "—"}</p>
            <p className="flex items-center gap-2"><MapPin className="h-4 w-4 text-muted-foreground" /> {booking.teacher.commune ?? "—"} {booking.teacher.quartier ? `• ${booking.teacher.quartier}` : ""}</p>
            {booking.teacher.addressHint && <p className="text-xs text-muted-foreground">Indice adresse: {booking.teacher.addressHint}</p>}
          </CardContent>
        </Card>
      </div>

      {/* Course details */}
      <Card>
        <CardHeader><CardTitle className="text-base">Détails du cours</CardTitle></CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Detail icon={GraduationCap} label="Matière" value={booking.subjectName} />
          <Detail icon={User} label="Niveau" value={booking.levelName} />
          <Detail icon={booking.courseFormat === "HOME" ? Home : Video} label="Format" value={booking.courseFormat === "HOME" ? "À domicile" : "En ligne"} />
          <Detail icon={Users} label="Type" value={booking.groupType === "INDIVIDUAL" ? "Individuel" : "Petit groupe"} />
          <Detail icon={Calendar} label="Pack" value={packTypeLabel(booking.packType)} />
          <Detail icon={Clock} label="Séances" value={`${booking.sessionsCount}`} />
          <Detail icon={Calendar} label="Jours souhaités" value={(() => { try { return JSON.parse(booking.preferredDays).join(", "); } catch { return booking.preferredDays; } })()} />
          <Detail icon={Calendar} label="Date souhaitée client" value={booking.startDate ? formatDate(booking.startDate) : "—"} />
          <Detail icon={Clock} label="Horaire souhaité" value={booking.preferredTime} />
          <Detail icon={Calendar} label="Date planifiée" value={booking.scheduledDate ? `${formatDate(booking.scheduledDate)} à ${booking.scheduledTime ?? booking.preferredTime ?? "—"}` : booking.startDate ? `${formatDate(booking.startDate)} (souhaitée)` : "Non planifiée"} />
          <Detail icon={Users} label="Type client" value={booking.clientType ?? "—"} />
          <Detail icon={GraduationCap} label="Catégorie" value={categoryLabel(booking.courseCategory)} />
          <Detail icon={GraduationCap} label="Système scolaire" value={schoolSystemLabel(booking.schoolSystem)} />
          <Detail icon={User} label="Niveau précis" value={booking.preciseLevel ?? "—"} />
          <Detail icon={GraduationCap} label="Cours catalogue" value={booking.courseCatalogName ?? "—"} />
          {booking.commune && <Detail icon={MapPin} label="Commune" value={booking.commune} />}
          {booking.quartier && <Detail icon={MapPin} label="Quartier" value={booking.quartier} />}
          {booking.onlineLink && <Detail icon={Video} label="Lien en ligne" value={booking.onlineLink} />}
          {booking.objective && (
            <div className="sm:col-span-2 lg:col-span-3">
              <p className="text-xs text-muted-foreground">Objectif</p>
              <p className="mt-1 text-sm">{booking.objective}</p>
            </div>
          )}
          {booking.schoolProgram && (
            <div className="sm:col-span-2 lg:col-span-3 rounded-lg border border-violet-100 bg-violet-50/45 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-violet-900/65">Programme / contexte scolaire</p>
              <p className="mt-1 whitespace-pre-line text-sm text-violet-950/85">{booking.schoolProgram}</p>
            </div>
          )}
          {booking.needDescription && (
            <div className="sm:col-span-2 lg:col-span-3 rounded-lg border border-amber-100 bg-amber-50/65 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-amber-900/70">Besoin précis du client</p>
              <p className="mt-1 whitespace-pre-line text-sm text-amber-950/85">{booking.needDescription}</p>
            </div>
          )}
          {booking.message && (
            <div className="sm:col-span-2 lg:col-span-3">
              <p className="text-xs text-muted-foreground">Message du client</p>
              <p className="mt-1 text-sm">{booking.message}</p>
            </div>
          )}
          {booking.addressHint && (
            <div className="sm:col-span-2 lg:col-span-3">
              <p className="text-xs text-muted-foreground">Indice adresse (cours à domicile)</p>
              <p className="mt-1 text-sm">{booking.addressHint}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Montants */}
      <Card>
        <CardHeader><CardTitle className="text-base">Montants</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <BookingPricingBreakdown
            unitPrice={displayUnitPrice}
            totalPrice={displayTotalPrice}
            sessionsCount={displaySessionsCount}
            participantsCount={displayParticipantsCount}
            groupType={booking.groupType}
            packType={booking.packType}
            audience="admin"
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
            teacherNetAmount={booking.teacherNetAmount}
            teacherPayoutAmount={displayTeacherCoursePayout}
            totalTeacherReceives={displayTeacherTotalReceives}
            commissionAmount={displayCommissionAmount}
            commissionRate={booking.commissionRate}
          />
          {booking.isQuoteOnly && (
            <div className="rounded-lg border border-amber-100 bg-amber-50/70 p-4 text-sm text-amber-950">
              <p className="font-black">Dossier sur devis</p>
              <p className="mt-1 text-amber-950/75">
                Aucun paiement client n'est encore encaissé. L'administration doit valider le prix du cours, le déplacement et les frais éventuels avant paiement.
              </p>
            </div>
          )}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
            <AmountBox label="Prix séance" value={displayUnitPrice} sub="2h" />
            <AmountBox label="Prix du cours" value={displayCourseAmount || displayUnitPrice} />
            <AmountBox label="Déplacement" value={displayTransportFee} sub={pricingSnapshot?.transportRouteLabel ?? undefined} tone={displayTransportFee > 0 ? "primary" : "success"} />
            <AmountBox label="Total client" value={displayTotalPrice} />
            <AmountBox label="Commission plateforme" value={displayCommissionAmount} sub={`${booking.commissionRate}%`} tone="warning" />
            <AmountBox label="Part prof cours" value={displayTeacherCoursePayout || booking.teacherNetAmount} tone="primary" />
            <AmountBox label="Total professeur" value={displayTeacherTotalReceives || booking.teacherNetAmount} tone="primary" />
            <AmountBox label="Déjà payé prof" value={teacherPaidAmount} tone="success" />
            <AmountBox label="Retenues validées" value={teacherSettlement.retained} tone={teacherSettlement.retained > 0 ? "danger" : "success"} />
            <AmountBox label="Reste dû prof" value={teacherRemainingAmount} tone={teacherRemainingAmount > 0 ? "danger" : "success"} />
          </div>
        </CardContent>
      </Card>

      {/* Timeline */}
      {booking.scheduleProposals.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Propositions de créneau professeur</CardTitle></CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2">
            {booking.scheduleProposals.map((proposal) => (
              <div key={proposal.id} className="rounded-lg border border-border bg-white p-4">
                <div className="flex items-start gap-3">
                  <ProfessorImage
                    photoUrl={proposal.teacher.photoUrl}
                    name={proposal.teacher.professionalName || proposal.teacher.fullName}
                    size="sm"
                    shape="circle"
                    verified={proposal.teacher.badgeVerified}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline">{scheduleProposalStatusLabel(proposal.status)}</Badge>
                      <span className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
                        <CalendarClock className="h-3.5 w-3.5" />
                        {formatDate(proposal.createdAt)}
                      </span>
                    </div>
                    <p className="mt-2 text-sm font-semibold text-foreground">
                      {formatDate(proposal.proposedDate)} · {proposal.proposedTime}
                    </p>
                    {proposal.reason && (
                      <p className="mt-2 whitespace-pre-line text-sm text-muted-foreground">Motif professeur : {proposal.reason}</p>
                    )}
                    {proposal.clientResponse && (
                      <p className="mt-2 rounded-lg border border-border bg-white px-3 py-2 text-sm text-foreground">
                        Réponse client : {proposal.clientResponse}
                      </p>
                    )}
                    {proposal.status === "REJECTED" && (
                      <Button asChild size="sm" className="mt-3 rounded-lg">
                        <Link href={`/admin/reservations/${booking.id}?action=replace`}>Remplacer ou annuler</Link>
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Timeline */}
      {booking.replacements.length > 0 && (
        <ReplacementHistoryTable replacements={booking.replacements} />
      )}

      {/* Timeline */}
      <Card>
        <CardHeader><CardTitle className="text-base">Suivi des statuts</CardTitle></CardHeader>
        <CardContent>
          {timeline.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucun événement.</p>
          ) : (
            <ol className="relative border-l border-border pl-6">
              {timeline.map((t, i) => (
                <li key={i} className="mb-4 last:mb-0">
                  <span className="absolute -left-2 flex h-4 w-4 items-center justify-center rounded-full bg-primary">
                    <CheckCircle2 className="h-3 w-3 text-primary-foreground" />
                  </span>
                  <p className="text-sm font-medium text-foreground">{t.label}</p>
                  <p className="text-xs text-muted-foreground">{formatDateTime(t.date)}</p>
                </li>
              ))}
            </ol>
          )}
        </CardContent>
      </Card>

      {/* Transactions */}
      <Card>
        <CardHeader><CardTitle className="text-base">Transactions</CardTitle></CardHeader>
        <CardContent className="p-0">
          <div className="grid gap-3 p-4 md:hidden">
            {booking.transactions.length === 0 ? (
              <p className="rounded-lg border border-dashed border-violet-100 bg-violet-50/30 p-4 text-center text-sm text-muted-foreground">
                Aucune transaction.
              </p>
            ) : (
              booking.transactions.map((t) => (
                <div key={t.id} className="space-y-3 rounded-lg border border-violet-100 bg-white p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-mono text-xs font-bold text-primary">{t.reference}</p>
                      <p className="mt-1 truncate text-xs text-muted-foreground">{transactionTypeLabel(t.type)}</p>
                    </div>
                    <PaymentStatusBadge status={t.status} />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-lg border border-violet-100 bg-white px-3 py-2">
                      <p className="text-[11px] font-medium text-muted-foreground">Montant</p>
                      <Money amount={t.amount} className="mt-1 text-xs font-black" />
                    </div>
                    <div className="rounded-lg border border-violet-100 bg-white px-3 py-2">
                      <p className="text-[11px] font-medium text-muted-foreground">Net professeur</p>
                      <Money amount={t.teacherNet} className="mt-1 text-xs font-black" />
                    </div>
                    <div className="rounded-lg border border-violet-100 bg-white px-3 py-2">
                      <p className="text-[11px] font-medium text-muted-foreground">Commission</p>
                      <Money amount={t.commission} className="mt-1 text-xs font-black" />
                    </div>
                    <div className="rounded-lg border border-violet-100 bg-white px-3 py-2">
                      <p className="text-[11px] font-medium text-muted-foreground">Date</p>
                      <p className="mt-1 truncate text-xs font-bold text-foreground">{formatDate(t.createdAt)}</p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="hidden overflow-x-auto md:block">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Réf</TableHead>
                <TableHead className="hidden md:table-cell">Type</TableHead>
                <TableHead className="hidden lg:table-cell">Date</TableHead>
                <TableHead className="text-right">Montant</TableHead>
                <TableHead className="text-right hidden md:table-cell">Commission</TableHead>
                <TableHead className="text-right">Net prof</TableHead>
                <TableHead>Statut</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {booking.transactions.length === 0 && (
                <TableRow><TableCell colSpan={7} className="py-6 text-center text-sm text-muted-foreground">Aucune transaction.</TableCell></TableRow>
              )}
              {booking.transactions.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="font-mono text-xs">{t.reference}</TableCell>
                  <TableCell className="hidden md:table-cell text-sm">{transactionTypeLabel(t.type)}</TableCell>
                  <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">{formatDate(t.createdAt)}</TableCell>
                  <TableCell className="text-right"><Money amount={t.amount} className="text-sm" /></TableCell>
                  <TableCell className="text-right hidden md:table-cell"><Money amount={t.commission} className="text-sm" muted /></TableCell>
                  <TableCell className="text-right"><Money amount={t.teacherNet} className="text-sm font-medium" /></TableCell>
                  <TableCell><PaymentStatusBadge status={t.status} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          </div>
        </CardContent>
      </Card>

      {/* Litiges */}
      {booking.disputes.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Litiges</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {booking.disputes.map((d) => (
              <div key={d.id} className="rounded-lg border border-violet-100 bg-white p-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-foreground">{d.reason}</p>
                  <Badge variant="outline">{disputeStatusLabel(d.status)}</Badge>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{d.description}</p>
                <p className="mt-1 text-xs text-muted-foreground">Ouvert par {d.openedBy.name} • {formatDateTime(d.createdAt)}</p>
                {d.resolution && (
                  <p className="mt-2 rounded-lg border border-violet-100 bg-white p-3 text-sm">Résolution: {d.resolution}</p>
                )}
                <Button asChild size="sm" variant="ghost" className="mt-2">
                  <Link href={`/admin/litiges/${d.id}`}>Voir le litige</Link>
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Reviews */}
      {booking.reviews.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Avis client</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {booking.reviews.map((r) => (
              <div key={r.id} className="rounded-lg border border-violet-100 bg-white p-3">
                <p className="text-sm font-medium">{r.client.name} — Note: {r.rating}/5</p>
                {r.comment && <p className="mt-1 text-sm">{r.comment}</p>}
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Detail({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div>
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Icon className="h-3.5 w-3.5" /> {label}
      </p>
      <p className="mt-1 text-sm font-medium text-foreground">{value}</p>
    </div>
  );
}

function AmountBox({ label, value, sub, tone = "default" }: { label: string; value: number; sub?: string; tone?: "default" | "warning" | "primary" | "success" | "danger" }) {
  const cls = {
    default: "border-violet-100 bg-white",
    warning: "border-amber-200 bg-amber-50/50",
    primary: "border-violet-200 bg-violet-50/70",
    success: "border-blue-200 bg-blue-50/70",
    danger: "border-red-200 bg-red-50/60",
  }[tone];
  return (
    <div className={`rounded-lg border ${cls} p-3`}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-semibold text-foreground"><Money amount={value} /></p>
      {sub && <p className="text-[10px] text-muted-foreground">{sub}</p>}
    </div>
  );
}

function scheduleProposalStatusLabel(status: string) {
  const labels: Record<string, string> = {
    PENDING: "Réponse client attendue",
    ACCEPTED: "Acceptée",
    REJECTED: "Refusée",
    CANCELLED: "Remplacée",
  };
  return labels[status] ?? status;
}

function clientRefundStatusLabel(status: string) {
  const labels: Record<string, string> = {
    PENDING: "À traiter",
    APPROVED: "Validé",
    PAID: "Payé",
    REJECTED: "Rejeté",
    CANCELLED: "Annulé",
  };
  return labels[status] ?? status;
}
