import Link from "next/link";
import { ArrowRight, Bell, BookOpenCheck, CalendarClock, ClipboardList, CreditCard, MessageSquareText, UserRound } from "lucide-react";
import { db } from "@/lib/db";
import { formatDate, formatFCFA } from "@/lib/format";
import { requireTeacher } from "@/lib/teacher-auth";
import { getTeacherRemainingAmount, isTeacherPayableStatus } from "@/lib/teacher-payments";
import { courseFormatLabel } from "@/lib/platform-labels";
import { paymentMethodLabel } from "@/lib/payment-methods";
import { hasVerifiedPayDunyaClientPayment, verifiedPayDunyaBookingWhere } from "@/lib/payment-security";
import { ProfessorImage } from "@/components/shared/professor-image";
import { Button } from "@/components/ui/button";
import {
  EmptyProfessorState,
  InfoLine,
  PortalCard,
  ProfessorPageHeader,
  ProfessorStatCard,
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
    fullTeacher,
    upcomingBookings,
    todayBookings,
    pendingMissions,
    openTasks,
    recentNotifications,
    paymentBookings,
    adjustments,
    unreadServiceClientMessageCount,
    pendingScheduleProposalCount,
    pendingPayoutRequestCount,
  ] = await db.$transaction([
    db.teacher.findUnique({
      where: { id: teacher.id },
      include: {
        subjects: { include: { subject: true }, orderBy: { isPrimary: "desc" } },
        levels: { include: { level: true } },
        zones: { include: { commune: true } },
        reviews: { where: { published: true }, orderBy: { createdAt: "desc" }, take: 3 },
      },
    }),
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
            transactions: { where: { type: "CLIENT_PAYMENT" }, select: { type: true, status: true, amount: true } },
          },
        },
      },
      orderBy: [{ priority: "desc" }, { dueAt: "asc" }],
      take: 4,
    }),
    db.teacherNotification.findMany({ where: { teacherId: teacher.id }, orderBy: { createdAt: "desc" }, take: 4 }),
    db.booking.findMany({
      where: verifiedPayDunyaBookingWhere({
        teacherId: teacher.id,
        OR: [
          { teacherNetAmount: { gt: 0 }, status: { notIn: ["CANCELLED", "REFUNDED"] } },
          { status: { in: ["CANCELLED", "REFUNDED"] }, paymentStatus: { in: ["PARTIALLY_REFUNDED", "RETAINED"] }, cancellationPenaltyTeacherAmount: { gt: 0 } },
        ],
      }),
      select: {
        id: true, status: true, teacherNetAmount: true, teacherPaidAmount: true,
        cancellationPenaltyTeacherAmount: true, paymentStatus: true, totalClientPays: true,
        totalPrice: true, paydunyaStatus: true, paydunyaVerifiedAt: true,
        transactions: { where: { type: "CLIENT_PAYMENT" }, select: { type: true, status: true, amount: true } },
      },
    }),
    db.teacherPaymentAdjustment.findMany({ where: { teacherId: teacher.id }, select: { bookingId: true, amount: true, status: true } }),
    db.teacherAdminMessage.count({ where: { teacherId: teacher.id, sender: "ADMIN", readByTeacherAt: null } }),
    db.bookingScheduleProposal.count({
      where: { teacherId: teacher.id, status: "PENDING", booking: { is: verifiedPayDunyaBookingWhere({ teacherId: teacher.id }) } },
    }),
    db.teacherPayoutRequest.count({ where: { teacherId: teacher.id, status: "PENDING" } }),
  ]);

  const verifiedUpcomingBookings = upcomingBookings.filter(hasVerifiedPayDunyaClientPayment);
  const verifiedTodayBookings = todayBookings.filter(hasVerifiedPayDunyaClientPayment);
  const verifiedPendingMissions = pendingMissions.filter((mission) => hasVerifiedPayDunyaClientPayment(mission.booking));
  const verifiedOpenTasks = openTasks.filter((task) => task.booking && hasVerifiedPayDunyaClientPayment(task.booking));
  const verifiedPaymentBookings = paymentBookings.filter(hasVerifiedPayDunyaClientPayment);
  const amountToReceive = verifiedPaymentBookings.reduce((sum, booking) => (
    sum + getTeacherRemainingAmount(booking, adjustments)
  ), 0);
  const readyToRequestAmount = verifiedPaymentBookings
    .filter(isTeacherPayableStatus)
    .reduce((sum, booking) => sum + getTeacherRemainingAmount(booking, adjustments), 0);
  const blockedTeacherAmount = verifiedPaymentBookings
    .filter((booking) => booking.paymentStatus === "BLOCKED")
    .reduce((sum, booking) => sum + getTeacherRemainingAmount(booking, adjustments), 0);
  const realizedCount = verifiedPaymentBookings.filter((booking) => booking.paymentStatus === "TEACHER_PAID").length;
  const primarySubject = fullTeacher?.subjects.find((item) => item.isPrimary)?.subject.name
    ?? fullTeacher?.subjects[0]?.subject.name
    ?? "Matière à confirmer";
  const payoutProfileReady = Boolean(fullTeacher?.defaultPayoutMethod && fullTeacher?.defaultPayoutPhone);
  const profileReady = Boolean(fullTeacher?.careerSummary || fullTeacher?.workHistory || fullTeacher?.skills);

  return (
    <div className="space-y-6">
      <ProfessorPageHeader
        title={`Bonjour ${teacherName}`}
        description="Missions, disponibilités et paiements."
        showBack={false}
        action={(
          <Button asChild className="rounded-lg bg-[#111B4D] text-white hover:bg-[#1E2A78]">
            <Link href="/professeur/missions">
              Voir mes missions
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        )}
      />

      <div className="grid grid-cols-2 gap-2 lg:grid-cols-3 xl:grid-cols-6">
        <ProfessorQuickLink
          href="/professeur/missions"
          label="Missions"
          value={verifiedPendingMissions.length > 0 ? `${verifiedPendingMissions.length} à confirmer` : "À jour"}
        />
        <ProfessorQuickLink href="/professeur/disponibilites" label="Disponibilités" value="Créneaux 2h" />
        <ProfessorQuickLink
          href="/professeur/paiements"
          label="Paiements"
          value={readyToRequestAmount > 0 ? formatFCFA(readyToRequestAmount) : "Suivi comptable"}
        />
        <ProfessorQuickLink
          href="/professeur/messages"
          label="Service client"
          value={unreadServiceClientMessageCount > 0 ? `${unreadServiceClientMessageCount} non lu(s)` : "Écrire"}
        />
        <ProfessorQuickLink href="/professeur/avis" label="Avis & qualité" value={`${fullTeacher?.qualityScore ?? 0}/100`} />
        <ProfessorQuickLink href="/professeur/profil" label="Profil & mini-CV" value={profileReady ? "Complet" : "À compléter"} />
      </div>

      <PortalCard className="grid gap-4 lg:grid-cols-[auto_1fr_auto] lg:items-center">
        <ProfessorImage photoUrl={teacher.photoUrl} name={teacherName} size="lg" verified />
        <div>
          <p className="text-xl font-semibold text-[#111827]">{teacherName}</p>
          <p className="mt-1 text-sm font-semibold text-[#64748B]">{fullTeacher?.jobTitle || "Professeur Compétence"}</p>
          <div className="mt-3 flex flex-wrap gap-2 text-xs font-bold text-[#475569]">
            <span>{primarySubject}</span>
            <span>•</span>
            <span>{fullTeacher?.commune || "Commune à confirmer"}</span>
            <span>•</span>
            <span>Score qualité {fullTeacher?.qualityScore ?? 0}/100</span>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2 lg:w-[30rem]">
          <Button asChild variant="outline" className="min-h-11 rounded-lg px-2 text-xs sm:text-sm">
            <Link href="/professeur/disponibilites">
              <CalendarClock className="h-4 w-4" />
              <span className="hidden min-[430px]:inline">Disponibilités</span>
              <span className="min-[430px]:hidden">Dispos</span>
            </Link>
          </Button>
          <Button asChild variant="outline" className="min-h-11 rounded-lg px-2 text-xs sm:text-sm">
            <Link href="/professeur/paiements">
              <CreditCard className="h-4 w-4" />
              <span className="hidden min-[430px]:inline">Paiements</span>
              <span className="min-[430px]:hidden">Paie</span>
            </Link>
          </Button>
          <Button asChild variant="outline" className="min-h-11 rounded-lg px-2 text-xs sm:text-sm">
            <Link href="/professeur/messages">
              <MessageSquareText className="h-4 w-4" />
              Service client
            </Link>
          </Button>
        </div>
      </PortalCard>

      <div className="grid gap-3 min-[680px]:grid-cols-2 xl:grid-cols-4">
        <ProfessorStatCard label="Cours aujourd'hui" value={verifiedTodayBookings.length} detail="Séances prévues sur la journée" icon="calendar" />
        <ProfessorStatCard label="Missions à confirmer" value={verifiedPendingMissions.length} detail="Répondez rapidement pour éviter les relances" icon="clock" />
        <ProfessorStatCard label="Tâches ouvertes" value={verifiedOpenTasks.length} detail="Demandes du service client en attente" icon="alert" />
        <ProfessorStatCard label="Reste à recevoir" value={formatFCFA(amountToReceive)} detail={`${realizedCount} paiement(s) déjà soldé(s)`} icon="wallet" />
      </div>

      <PortalCard>
        <div className="flex flex-col gap-2 min-[640px]:flex-row min-[640px]:items-end min-[640px]:justify-between">
          <div>
            <p className="text-base font-semibold text-[#111827]">Espace professeur opérationnel complet</p>
            <p className="mt-1 text-sm font-semibold leading-6 text-[#64748B]">
              Chaque action est reliée au suivi service client : missions, disponibilités, paiements, messages, qualité, profil professionnel et suivi opérationnel restent historisés.
            </p>
          </div>
          <Button asChild variant="outline" className="min-h-11 rounded-lg">
            <Link href="/professeur/messages">
              Contacter le service client
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
        <div className="mt-4 grid gap-2 min-[520px]:grid-cols-2 xl:grid-cols-4">
          <ProfessorControlStep
            href="/professeur/missions"
            label="Missions reçues"
            value={verifiedPendingMissions.length > 0 ? `${verifiedPendingMissions.length} à répondre` : "À jour"}
            detail="Confirmer, refuser ou signaler un problème."
            urgent={verifiedPendingMissions.length > 0}
          />
          <ProfessorControlStep
            href="/professeur/missions"
            label="Cours du jour"
            value={`${verifiedTodayBookings.length} prévu(s)`}
            detail="Client, contact, lieu et consignes visibles."
            urgent={verifiedTodayBookings.length > 0}
          />
          <ProfessorControlStep
            href="/professeur/missions"
            label="Créneaux proposés"
            value={pendingScheduleProposalCount > 0 ? `${pendingScheduleProposalCount} en attente` : "Aucun"}
            detail="Le client accepte ou refuse depuis son espace."
            urgent={pendingScheduleProposalCount > 0}
          />
          <ProfessorControlStep
            href="/professeur/messages"
            label="Service client"
            value={unreadServiceClientMessageCount > 0 ? `${unreadServiceClientMessageCount} non lu(s)` : "Disponible"}
            detail="Contacter le service client avec historique."
            urgent={unreadServiceClientMessageCount > 0}
          />
          <ProfessorControlStep
            href="/professeur/paiements"
            label="Paiement demandable"
            value={readyToRequestAmount > 0 ? formatFCFA(readyToRequestAmount) : "0 FCFA"}
            detail="Demande possible uniquement sur fonds validés."
            urgent={readyToRequestAmount > 0}
          />
          <ProfessorControlStep
            href="/professeur/paiements"
            label="Demandes envoyées"
            value={pendingPayoutRequestCount > 0 ? `${pendingPayoutRequestCount} en attente` : "Aucune"}
            detail="Validation et reçu créés par le service client."
            urgent={pendingPayoutRequestCount > 0}
          />
          <ProfessorControlStep
            href="/professeur/paiements"
            label="Fonds bloqués"
            value={formatFCFA(blockedTeacherAmount)}
            detail="Non payables avant confirmation client/service client."
            urgent={blockedTeacherAmount > 0}
          />
          <ProfessorControlStep
            href={!profileReady ? "/professeur/profil" : !payoutProfileReady ? "/professeur/parametres" : "/professeur/profil"}
            label="Profil & paiement"
            value={profileReady && payoutProfileReady ? "Complet" : "À compléter"}
            detail="Mini-CV, compétences et numéro de paiement."
            urgent={!profileReady || !payoutProfileReady}
          />
        </div>
        <div className="mt-4 grid gap-3 min-[680px]:grid-cols-2 xl:grid-cols-3">
          <ProfessorActionTile
            href="/professeur/missions"
            icon={BookOpenCheck}
            title="Confirmer ou refuser une mission"
            detail={verifiedPendingMissions.length > 0 ? `${verifiedPendingMissions.length} mission(s) attendent une réponse.` : "Aucune mission en attente de réponse."}
            state={verifiedPendingMissions.length > 0 ? "Action requise" : "À jour"}
            urgent={verifiedPendingMissions.length > 0}
          />
          <ProfessorActionTile
            href="/professeur/disponibilites"
            icon={CalendarClock}
            title="Mettre à jour vos créneaux"
            detail="Le service client et le client s'appuient sur ces disponibilités pour les réservations et reports."
            state="Planning"
          />
          <ProfessorActionTile
            href="/professeur/paiements"
            icon={CreditCard}
            title="Demander un paiement"
            detail={readyToRequestAmount > 0
              ? `${formatFCFA(readyToRequestAmount)} est prêt à demander. ${blockedTeacherAmount > 0 ? `${formatFCFA(blockedTeacherAmount)} reste encore bloqué.` : "Aucun fonds bloqué."}`
              : amountToReceive > 0
                ? `${formatFCFA(amountToReceive)} est suivi, mais pas encore demandable.`
                : "Aucun montant payable immédiat."}
            state={readyToRequestAmount > 0 ? "Demandable" : amountToReceive > 0 ? "En attente" : "Soldé"}
            urgent={readyToRequestAmount > 0}
          />
          <ProfessorActionTile
            href="/professeur/messages"
            icon={MessageSquareText}
            title="Échanger avec le service client"
            detail={unreadServiceClientMessageCount > 0 ? `${unreadServiceClientMessageCount} message(s) du service client à consulter.` : "Écrivez au service client pour une mission, un paiement ou un incident."}
            state={unreadServiceClientMessageCount > 0 ? "Réponse attendue" : "Disponible"}
            urgent={unreadServiceClientMessageCount > 0}
          />
          <ProfessorActionTile
            href="/professeur/avis"
            icon={ClipboardList}
            title="Suivre avis et qualité"
            detail={`Score qualité actuel : ${fullTeacher?.qualityScore ?? 0}/100. Les avertissements et sanctions sont visibles ici.`}
            state="Qualité"
          />
          <ProfessorActionTile
            href="/professeur/profil"
            icon={UserRound}
            title="Compléter mini-CV et compétences"
            detail={profileReady ? "Votre parcours, vos expériences et vos compétences sont renseignés." : "Ajoutez votre parcours, vos expériences et vos compétences visibles côté client."}
            state={profileReady ? "Complet" : "À compléter"}
            urgent={!profileReady}
          />
        </div>
      </PortalCard>

      <PortalCard className="grid gap-3 min-[720px]:grid-cols-[minmax(0,1fr)_auto] min-[640px]:items-center">
        <div>
          <p className="text-base font-semibold text-[#111827]">
            {payoutProfileReady ? "Coordonnées de paiement configurées" : "Coordonnées de paiement à compléter"}
          </p>
          <p className="mt-1 text-sm font-semibold leading-6 text-[#64748B]">
            {payoutProfileReady
              ? `Moyen préféré : ${paymentMethodLabel(fullTeacher?.defaultPayoutMethod)}. Numéro confirmé : ${fullTeacher?.defaultPayoutPhone}.`
              : "Ajoutez votre moyen de paiement et confirmez votre numéro pour accélérer vos demandes de paiement."}
          </p>
        </div>
        <Button asChild variant={payoutProfileReady ? "outline" : "default"} className="min-h-11 rounded-lg">
          <Link href="/professeur/parametres">
            {payoutProfileReady ? "Modifier" : "Compléter"}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
      </PortalCard>

      <div className="grid gap-5 xl:grid-cols-[1.35fr_0.9fr]">
        <PortalCard>
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-base font-semibold text-[#111827]">Prochaines missions</p>
              <p className="text-sm font-medium text-[#64748B]">Cours attribués à votre fiche professeur.</p>
            </div>
            <Button asChild variant="ghost" className="rounded-lg">
              <Link href="/professeur/missions">Tout voir</Link>
            </Button>
          </div>
          {verifiedUpcomingBookings.length === 0 ? (
            <EmptyProfessorState title="Aucune mission attribuée" description="Les prochaines réservations confirmées par le service client apparaîtront ici." />
          ) : (
            <div className="grid gap-3">
              {verifiedUpcomingBookings.map((booking) => (
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

        <div className="space-y-5">
          <PortalCard>
            <div className="mb-4 flex items-center gap-2">
              <ClipboardList className="h-5 w-5 text-[#111B4D]" />
              <p className="text-base font-semibold text-[#111827]">Tâches urgentes</p>
            </div>
            {verifiedOpenTasks.length === 0 ? (
              <p className="text-sm font-semibold text-[#64748B]">Aucune tâche ouverte pour le moment.</p>
            ) : (
              <div className="space-y-3">
                {verifiedOpenTasks.map((task) => (
                  <div key={task.id} className="rounded-lg border border-[#E6EAF3] bg-white p-3">
                    <div className="flex flex-wrap gap-2">
                      <StatusPill status={task.priority} type="priority" />
                      <StatusPill status={task.status} type="task" />
                    </div>
                    <p className="mt-2 text-sm font-semibold text-[#111827]">{task.title}</p>
                    <p className="mt-1 line-clamp-2 text-xs font-medium leading-5 text-[#64748B]">{task.description}</p>
                  </div>
                ))}
              </div>
            )}
          </PortalCard>

          <PortalCard>
            <div className="mb-4 flex items-center gap-2">
              <Bell className="h-5 w-5 text-[#111B4D]" />
              <p className="text-base font-semibold text-[#111827]">Dernières notifications</p>
            </div>
            {recentNotifications.length === 0 ? (
              <p className="text-sm font-semibold text-[#64748B]">Aucune notification reçue.</p>
            ) : (
              <div className="space-y-2">
                {recentNotifications.map((notification) => (
                  <div key={notification.id} className="rounded-lg border border-[#E6EAF3] bg-white p-3">
                    <InfoLine label={notification.title} value={formatDate(notification.createdAt)} />
                    <p className="mt-2 line-clamp-2 text-xs font-medium leading-5 text-[#64748B]">{notification.message}</p>
                  </div>
                ))}
              </div>
            )}
          </PortalCard>
        </div>
      </div>
    </div>
  );
}

function ProfessorControlStep({
  href,
  label,
  value,
  detail,
  urgent = false,
}: {
  href: string;
  label: string;
  value: string;
  detail: string;
  urgent?: boolean;
}) {
  return (
    <Link
      href={href}
      className={urgent
        ? "group rounded-lg border border-[#111B4D] bg-white p-3 transition hover:border-[#111827]"
        : "group rounded-lg border border-[#E6EAF3] bg-white p-3 transition hover:border-[#111B4D]"
      }
    >
      <div className="flex items-start justify-between gap-3">
        <p className="min-w-0 text-[11px] font-semibold uppercase tracking-wide text-[#64748B]">{label}</p>
        <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-[#111B4D]" />
      </div>
      <p className="mt-2 truncate text-sm font-semibold text-[#111827]">{value}</p>
      <p className="mt-1 line-clamp-2 text-xs font-semibold leading-5 text-[#64748B]">{detail}</p>
    </Link>
  );
}

function ProfessorQuickLink({
  href,
  label,
  value,
}: {
  href: string;
  label: string;
  value: string;
}) {
  return (
    <Link
      href={href}
      className="group flex min-h-[4.45rem] flex-col justify-between rounded-lg border border-[#E6EAF3] bg-white px-2.5 py-2.5 transition hover:border-[#111B4D] sm:px-3 sm:py-3"
    >
      <span className="text-[11px] font-semibold uppercase tracking-wide text-[#64748B]">{label}</span>
      <span className="mt-2 flex items-center justify-between gap-2 text-sm font-semibold text-[#111827]">
        <span className="truncate">{value}</span>
        <ArrowRight className="h-4 w-4 shrink-0 text-[#111B4D]" />
      </span>
    </Link>
  );
}

function ProfessorActionTile({
  href,
  icon: Icon,
  title,
  detail,
  state,
  urgent = false,
}: {
  href: string;
  icon: typeof BookOpenCheck;
  title: string;
  detail: string;
  state: string;
  urgent?: boolean;
}) {
  return (
    <Link
      href={href}
      className="group grid min-h-40 gap-4 rounded-lg border border-[#E6EAF3] bg-white p-4 transition hover:border-[#111B4D]"
    >
      <div className="flex items-start justify-between gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#111B4D] text-white">
          <Icon className="h-5 w-5" />
        </span>
        <span className={urgent ? "rounded-full border border-[#B42318] bg-white px-2.5 py-1 text-[11px] font-semibold text-[#B42318]" : "rounded-full border border-[#D7DEE9] bg-white px-2.5 py-1 text-[11px] font-semibold text-[#111B4D]"}>
          {state}
        </span>
      </div>
      <div>
        <p className="text-sm font-semibold text-[#111827]">{title}</p>
        <p className="mt-1 text-xs font-semibold leading-5 text-[#64748B]">{detail}</p>
      </div>
      <span className="mt-auto inline-flex items-center gap-1 text-sm font-semibold text-[#111B4D]">
        Ouvrir <ArrowRight className="h-4 w-4" />
      </span>
    </Link>
  );
}
