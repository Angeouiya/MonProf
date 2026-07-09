import Link from "next/link";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/session";
import {
  ClientCompactFacts,
  ClientInfoPill,
  ClientMetricStrip,
  ClientPageHeader,
  ClientProcessTracker,
  ClientRecordStatusLine,
  ClientSurface,
  ClientTabBar,
} from "@/components/shared/client-page-primitives";
import { ProfessorImage } from "@/components/shared/professor-image";
import { Money } from "@/components/shared/money";
import { Button } from "@/components/ui/button";
import { formatDate, formatFCFA } from "@/lib/format";
import { hasVerifiedPayDunyaClientPayment, verifiedPayDunyaBookingWhere } from "@/lib/payment-security";
import { BookOpen, ArrowRight, Clock, Calendar, CheckCircle2, MessageSquare, WalletCards, Search, ExternalLink } from "lucide-react";
import { BookingStatus, PaymentStatus } from "@prisma/client";
import { CourseListClient, type ClientCourseListItem } from "./course-list-client";

export const dynamic = "force-dynamic";

const TABS = [
  { id: "avenir", label: "À venir", statuses: ["CONFIRMED", "ASSIGNED", "IN_PROGRESS", "PENDING_ADMIN_VALIDATION", "PAYMENT_TO_RELEASE"] },
  { id: "encours", label: "En cours", statuses: ["IN_PROGRESS"] },
  { id: "termines", label: "Terminés", statuses: ["COURSE_DONE", "PENDING_CLIENT_VALIDATION", "VALIDATED_BY_CLIENT", "TEACHER_PAID"] },
];
const COURSE_STATUSES = Array.from(new Set(TABS.flatMap((tab) => tab.statuses)));

export default async function CoursPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const user = await getSessionUser();
  if (!user) return null;
  const sp = await searchParams;
  const tabId = sp.tab ?? "avenir";
  const tab = TABS.find((t) => t.id === tabId) ?? TABS[0];

  const [rawBookings, rawOverviewBookings, pendingCourseBookings] = await db.$transaction([
    db.booking.findMany({
      where: verifiedPayDunyaBookingWhere({
        clientId: user.id,
        status: { in: tab.statuses as any },
        isQuoteOnly: false,
      }),
      orderBy: [{ scheduledDate: "asc" }, { startDate: "asc" }, { createdAt: "desc" }],
      include: {
        teacher: {
          select: { id: true, fullName: true, professionalName: true, photoUrl: true, jobTitle: true, commune: true, badgeVerified: true },
        },
        transactions: {
          where: { type: "CLIENT_PAYMENT" },
          select: { type: true, status: true, amount: true },
        },
      },
    }),
    db.booking.findMany({
      where: verifiedPayDunyaBookingWhere({
        clientId: user.id,
        status: { in: COURSE_STATUSES as any },
        isQuoteOnly: false,
      }),
      orderBy: [{ scheduledDate: "asc" }, { startDate: "asc" }, { createdAt: "desc" }],
      select: {
        id: true,
        status: true,
        paymentStatus: true,
        totalPrice: true,
        totalClientPays: true,
        paydunyaStatus: true,
        paydunyaVerifiedAt: true,
        isQuoteOnly: true,
        reference: true,
        subjectName: true,
        levelName: true,
        courseFormat: true,
        preferredTime: true,
        scheduledTime: true,
        scheduledDate: true,
        startDate: true,
        teacher: {
          select: { fullName: true, professionalName: true },
        },
        transactions: {
          where: { type: "CLIENT_PAYMENT" },
          select: { type: true, status: true, amount: true },
        },
      },
    }),
    db.booking.findMany({
      where: {
        clientId: user.id,
        OR: [
          { status: "PENDING_PAYMENT", paymentStatus: "FAILED", isQuoteOnly: false },
          { status: { in: ["PENDING_PAYMENT", "PENDING_ADMIN_VALIDATION"] as any }, isQuoteOnly: true },
        ],
      },
      orderBy: [{ createdAt: "desc" }],
      take: 6,
      select: {
        id: true,
        reference: true,
        subjectName: true,
        levelName: true,
        courseFormat: true,
        preferredTime: true,
        scheduledTime: true,
        startDate: true,
        scheduledDate: true,
        totalClientPays: true,
        totalPrice: true,
        isQuoteOnly: true,
        teacher: {
          select: { fullName: true, professionalName: true, photoUrl: true, badgeVerified: true },
        },
      },
    }),
  ]);
  const bookings = rawBookings.filter((booking) => hasVerifiedPayDunyaClientPayment(booking));
  const overviewBookings = rawOverviewBookings.filter((booking) => hasVerifiedPayDunyaClientPayment(booking));

  const tabCounts = Object.fromEntries(
    TABS.map((item) => [item.id, overviewBookings.filter((booking) => item.statuses.includes(booking.status)).length]),
  ) as Record<string, number>;
  const nextCourse = overviewBookings.find((booking) => ["CONFIRMED", "ASSIGNED", "IN_PROGRESS", "PENDING_ADMIN_VALIDATION"].includes(booking.status));
  const confirmationCount = overviewBookings.filter((booking) => booking.status === "PENDING_CLIENT_VALIDATION").length;
  const protectedAmount = overviewBookings
    .reduce((sum, booking) => sum + (booking.totalClientPays || booking.totalPrice), 0);
  const activeCourseCount = overviewBookings.length;
  const nextCourseStep = nextCourse ? getCourseStep(nextCourse.status, nextCourse.paymentStatus) : null;
  const nextCourseAction = nextCourse
    ? {
        id: nextCourse.id,
        reference: nextCourse.reference,
        subjectName: nextCourse.subjectName,
        levelName: nextCourse.levelName,
        teacherName: nextCourse.teacher.professionalName || nextCourse.teacher.fullName,
        dateLabel: nextCourse.scheduledDate
          ? formatDate(nextCourse.scheduledDate)
          : nextCourse.startDate
            ? `${formatDate(nextCourse.startDate)} demandée`
            : "Date à confirmer",
        timeLabel: nextCourse.scheduledTime || nextCourse.preferredTime || "Créneau à confirmer",
        formatLabel: nextCourse.courseFormat === "HOME" ? "À domicile" : "En ligne",
        stepLabel: nextCourseStep?.label ?? "Cours suivi",
        stepHint: nextCourseStep?.hint ?? "Le cours est suivi par Compétence.",
        needsConfirmation: nextCourse.status === "PENDING_CLIENT_VALIDATION",
        isCurrent: nextCourse.status === "IN_PROGRESS",
      }
    : null;
  const fallbackCourseHref = pendingCourseBookings[0]
    ? `/client/reservations/${pendingCourseBookings[0].id}?payment=pending`
    : "/client/rechercher";
  const courseItems: ClientCourseListItem[] = bookings.map((b) => {
    const name = b.teacher.professionalName || b.teacher.fullName;
    const step = getCourseStep(b.status, b.paymentStatus);
    const courseDate = b.scheduledDate ? formatDate(b.scheduledDate) : b.startDate ? `${formatDate(b.startDate)} demandée` : "À planifier";
    const courseTime = b.scheduledTime || b.preferredTime || "Créneau à confirmer";
    const formatLabel = b.courseFormat === "HOME" ? "À domicile" : "En ligne";
    const amountLabel = formatFCFA(b.totalClientPays || b.totalPrice);
    const actionKind = getCourseActionKind(b.status, b.paymentStatus);
    const dateLabelName = b.scheduledDate ? "Date" : "Date souhaitée";
    const searchText = normalizeCourseSearch([
      b.reference,
      b.subjectName,
      b.levelName,
      name,
      b.teacher.jobTitle || "Professeur",
      courseDate,
      courseTime,
      formatLabel,
      amountLabel,
      step.label,
      step.hint,
      "PayDunya confirmé",
    ].join(" "));

    return {
      id: b.id,
      subjectName: b.subjectName,
      levelName: b.levelName,
      teacherName: name,
      teacherPhotoUrl: b.teacher.photoUrl,
      teacherJobTitle: b.teacher.jobTitle,
      teacherBadgeVerified: b.teacher.badgeVerified,
      amountLabel,
      dateLabel: courseDate,
      dateLabelName,
      timeLabel: courseTime,
      formatLabel,
      stepLabel: step.label,
      stepHint: step.hint,
      actionKind,
      searchText,
    };
  });

  return (
    <div className="space-y-6">
      <ClientPageHeader
        eyebrow="Cours"
        title="Cours"
        description="Suivez uniquement les cours activés après validation serveur PayDunya. Les demandes non payées restent séparées."
      />

      <CourseMobilePriorityCard
        nextCourse={nextCourseAction}
        activeCourseCount={activeCourseCount}
        confirmationCount={confirmationCount}
        pendingCount={pendingCourseBookings.length}
        protectedAmount={protectedAmount}
        fallbackCourseHref={fallbackCourseHref}
      />

      <ClientMetricStrip
        className="max-md:hidden"
        metrics={[
          { icon: BookOpen, label: "Actifs", value: activeCourseCount },
          { icon: Calendar, label: "À venir", value: tabCounts.avenir ?? 0 },
          { icon: MessageSquare, label: "À confirmer", value: confirmationCount, attention: confirmationCount > 0 },
          { icon: WalletCards, label: "À finaliser", value: pendingCourseBookings.length, attention: pendingCourseBookings.length > 0 },
        ]}
      />

      <div className="max-md:hidden">
        <CourseCommandCenter
          nextCourse={nextCourseAction}
          activeCourseCount={activeCourseCount}
          upcomingCount={tabCounts.avenir ?? 0}
          currentCount={tabCounts.encours ?? 0}
          confirmationCount={confirmationCount}
          pendingCount={pendingCourseBookings.length}
          protectedAmount={protectedAmount}
        />
      </div>

      {pendingCourseBookings.length > 0 && (
        <PendingCoursesPanel bookings={pendingCourseBookings} />
      )}

      <ClientTabBar
        activeId={tabId}
        items={TABS.map((t) => ({
          id: t.id,
          label: t.label,
          count: tabCounts[t.id] ?? 0,
          href: `/client/cours?tab=${t.id}`,
        }))}
      />

      <CourseListClient courses={courseItems} fallbackHref={fallbackCourseHref} />
    </div>
  );
}

type CourseCommandCenterProps = {
  nextCourse: {
    id: string;
    reference: string;
    subjectName: string;
    levelName: string;
    teacherName: string;
    dateLabel: string;
    timeLabel: string;
    formatLabel: string;
    stepLabel: string;
    stepHint: string;
    needsConfirmation: boolean;
    isCurrent: boolean;
  } | null;
  activeCourseCount: number;
  upcomingCount: number;
  currentCount: number;
  confirmationCount: number;
  pendingCount: number;
  protectedAmount: number;
};

function CourseMobilePriorityCard({
  nextCourse,
  activeCourseCount,
  confirmationCount,
  pendingCount,
  protectedAmount,
  fallbackCourseHref,
}: {
  nextCourse: CourseCommandCenterProps["nextCourse"];
  activeCourseCount: number;
  confirmationCount: number;
  pendingCount: number;
  protectedAmount: number;
  fallbackCourseHref: string;
}) {
  const actionHref = nextCourse
    ? `/client/reservations/${nextCourse.id}${nextCourse.needsConfirmation ? "?action=confirm" : ""}`
    : pendingCount > 0
      ? fallbackCourseHref
      : "/client/rechercher";
  const actionLabel = nextCourse
    ? nextCourse.needsConfirmation ? "Confirmer" : "Ouvrir"
    : pendingCount > 0 ? "Finaliser" : "Réserver";
  const title = nextCourse
    ? `${nextCourse.subjectName} · ${nextCourse.levelName}`
    : pendingCount > 0
      ? `${pendingCount} demande${pendingCount > 1 ? "s" : ""} à finaliser`
      : "Aucun cours actif";
  const description = nextCourse
    ? `${nextCourse.teacherName} · ${nextCourse.dateLabel} · ${nextCourse.timeLabel}`
    : pendingCount > 0
      ? "Aucun professeur n'est notifié avant paiement PayDunya vérifié."
      : "Choisissez un professeur et un créneau pour démarrer.";

  return (
    <ClientSurface compact className="space-y-3 rounded-lg border border-[#D8DEE9] p-3 md:hidden" data-client-course-mobile-priority>
      <div className="flex min-w-0 items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#111B4D] text-white">
          {confirmationCount > 0 ? <MessageSquare className="h-4 w-4" /> : nextCourse ? <BookOpen className="h-4 w-4" /> : <Calendar className="h-4 w-4" />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-[#111B4D]">Priorité cours</p>
          <h2 className="mt-0.5 break-words text-base font-semibold leading-5 text-[#111827]">{title}</h2>
          <p className="mt-1 line-clamp-2 text-xs font-medium leading-5 text-[#52627A]">{description}</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-1.5">
        <ClientInfoPill label="Actifs" value={activeCourseCount} strong={activeCourseCount > 0} />
        <ClientInfoPill label="À confirmer" value={confirmationCount} strong={confirmationCount > 0} />
        <ClientInfoPill label="Protégé" value={<Money amount={protectedAmount} />} strong={protectedAmount > 0} />
      </div>

      <div className="flex min-w-0 items-center justify-between gap-2 rounded-lg border border-[#D8DEE9] bg-white px-3 py-2.5">
        <p className="min-w-0 text-xs font-semibold leading-5 text-[#52627A]">
          {nextCourse?.stepLabel || (pendingCount > 0 ? "Paiement requis" : "Nouveau cours")}
        </p>
        <Button asChild size="sm" className="min-h-10 shrink-0 rounded-lg bg-[#111B4D] px-3 text-white hover:bg-[#1E2A78]">
          <Link href={actionHref}>
            {actionLabel}
            <ArrowRight className="ml-1 h-3.5 w-3.5" />
          </Link>
        </Button>
      </div>
    </ClientSurface>
  );
}

function CourseCommandCenter({
  nextCourse,
  activeCourseCount,
  upcomingCount,
  currentCount,
  confirmationCount,
  pendingCount,
  protectedAmount,
}: CourseCommandCenterProps) {
  const hasAction = confirmationCount > 0 || pendingCount > 0;
  const actionHref = nextCourse
    ? `/client/reservations/${nextCourse.id}${nextCourse.needsConfirmation ? "?action=confirm" : ""}`
    : pendingCount > 0
      ? "/client/cours?tab=avenir"
      : "/client/rechercher";
  const actionLabel = nextCourse
    ? nextCourse.needsConfirmation ? "Confirmer le cours" : "Ouvrir le dossier"
    : pendingCount > 0 ? "Finaliser une demande" : "Trouver un professeur";

  return (
    <ClientSurface compact className="overflow-hidden rounded-lg border border-[#DDE3EE] p-0" data-client-course-command-center>
      <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,24rem)]">
        <div className="min-w-0 space-y-4 p-4 min-[640px]:p-5">
          <div className="flex min-w-0 gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-[#111B4D] text-white">
              {confirmationCount > 0 ? <MessageSquare className="h-5 w-5" /> : currentCount > 0 ? <Clock className="h-5 w-5" /> : <BookOpen className="h-5 w-5" />}
            </span>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[#111B4D]">Pilotage des cours</p>
              <h2 className="mt-1 text-xl font-semibold leading-tight text-[#111827]">
                {confirmationCount > 0
                  ? "Un cours terminé attend votre confirmation."
                  : currentCount > 0
                    ? "Un cours est en suivi actif."
                    : activeCourseCount > 0
                      ? "Vos cours vérifiés sont organisés."
                      : pendingCount > 0
                        ? "Des demandes attendent encore l'activation."
                        : "Réservez un cours pour démarrer."}
              </h2>
              <p className="mt-1 max-w-2xl text-sm font-medium leading-6 text-[#52627A]">
                Les cours listés ici existent uniquement après paiement PayDunya vérifié côté serveur. Les demandes non payées ne préviennent ni le professeur ni le service client.
              </p>
            </div>
          </div>

          <div className="grid gap-2 min-[520px]:grid-cols-2 xl:grid-cols-4">
            <ClientInfoPill label="Cours actifs" value={activeCourseCount} strong={activeCourseCount > 0} />
            <ClientInfoPill label="À venir" value={upcomingCount} strong={upcomingCount > 0} />
            <ClientInfoPill label="À confirmer" value={confirmationCount} strong={confirmationCount > 0} />
            <ClientInfoPill label="Protégé" value={<Money amount={protectedAmount} />} strong={protectedAmount > 0} />
          </div>

          <ClientProcessTracker
            steps={[
              {
                label: "Paiement serveur",
                hint: pendingCount > 0 ? `${pendingCount} demande(s) restent hors cours actif.` : "Tous les cours visibles sont vérifiés.",
                state: pendingCount > 0 ? "current" : activeCourseCount > 0 ? "done" : "pending",
              },
              {
                label: "Cours avec professeur",
                hint: nextCourse ? `${nextCourse.teacherName} · ${nextCourse.dateLabel}` : "Aucun cours actif à afficher.",
                state: nextCourse ? nextCourse.isCurrent ? "current" : "done" : "pending",
              },
              {
                label: "Validation client",
                hint: confirmationCount > 0 ? `${confirmationCount} cours à valider.` : "La validation apparaîtra après le cours.",
                state: confirmationCount > 0 ? "current" : activeCourseCount > 0 ? "done" : "pending",
              },
            ]}
          />
        </div>

        <aside className="border-t border-[#DDE3EE] bg-white p-4 min-[640px]:p-5 lg:border-l lg:border-t-0">
          <div className="flex h-full flex-col justify-between gap-4">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#111B4D] text-white">
                  {hasAction ? <MessageSquare className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-[#111827]">Action prioritaire</p>
                  <p className="text-xs font-medium leading-5 text-[#64748B]">
                    {nextCourse ? nextCourse.stepLabel : pendingCount > 0 ? "Paiement à finaliser" : "Choisir un professeur"}
                  </p>
                </div>
              </div>

              <div className="rounded-lg border border-[#D8DEE9] bg-white p-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-[#64748B]">
                  {nextCourse ? "Prochaine séance" : pendingCount > 0 ? "Demande non active" : "Nouveau cours"}
                </p>
                <p className="mt-1 text-base font-semibold leading-6 text-[#111827]">
                  {nextCourse?.subjectName || (pendingCount > 0 ? `${pendingCount} demande(s) à finaliser` : "Aucun cours actif")}
                </p>
                <p className="mt-1 text-xs font-medium leading-5 text-[#64748B]">
                  {nextCourse
                    ? `${nextCourse.reference} · ${nextCourse.teacherName} · ${nextCourse.levelName} · ${nextCourse.dateLabel} · ${nextCourse.timeLabel} · ${nextCourse.formatLabel}`
                    : pendingCount > 0
                      ? "Finalisez le paiement PayDunya pour créer un vrai cours."
                      : "Choisissez un professeur, une date et une séance de 2h."}
                </p>
              </div>

              {nextCourse && (
                <div className="rounded-lg border border-[#E3E8F2] bg-white p-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-[#64748B]">Suivi</p>
                  <p className="mt-1 text-sm font-semibold leading-5 text-[#111827]">{nextCourse.stepHint}</p>
                  <p className="mt-2 inline-flex min-h-7 items-center rounded-lg border border-[#D8DEE9] bg-white px-2 text-xs font-semibold text-[#111B4D]">
                    PayDunya confirmé
                  </p>
                </div>
              )}
            </div>

            <Button asChild className="min-h-11 w-full rounded-lg bg-[#111B4D] text-white hover:bg-[#1E2A78]">
              <Link href={actionHref}>
                {actionLabel}
                <ArrowRight className="ml-1.5 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </aside>
      </div>
    </ClientSurface>
  );
}

function getCourseActionKind(status: BookingStatus, paymentStatus: PaymentStatus): ClientCourseListItem["actionKind"] {
  if (status === "PENDING_CLIENT_VALIDATION") return "action";
  if (status === "IN_PROGRESS") return "current";
  if (["COURSE_DONE", "VALIDATED_BY_CLIENT", "PAYMENT_TO_RELEASE", "TEACHER_PAID"].includes(status) || paymentStatus === "TEACHER_PAID") return "closed";
  if (["CONFIRMED", "ASSIGNED", "PENDING_ADMIN_VALIDATION"].includes(status)) return "upcoming";
  return "all";
}

function normalizeCourseSearch(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

type PendingCourseBooking = {
  id: string;
  reference: string;
  subjectName: string;
  levelName: string;
  courseFormat: string;
  preferredTime: string | null;
  scheduledTime: string | null;
  startDate: Date | null;
  scheduledDate: Date | null;
  totalClientPays: number;
  totalPrice: number;
  isQuoteOnly: boolean;
  teacher: {
    fullName: string;
    professionalName: string | null;
    photoUrl: string | null;
    badgeVerified: boolean;
  };
};

function PendingCoursesPanel({ bookings }: { bookings: PendingCourseBooking[] }) {
  return (
    <ClientSurface compact className="space-y-3 p-4">
      <div className="flex min-w-0 flex-col gap-2 min-[560px]:flex-row min-[560px]:items-end min-[560px]:justify-between">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[#111B4D]">Demandes non actives</p>
          <h2 className="text-lg font-semibold leading-6 text-[#111827]">À finaliser avant réservation</h2>
          <p className="mt-1 max-w-2xl text-sm font-medium leading-6 text-[#52627A]">
            Ces demandes ne bloquent aucun créneau professeur tant que le paiement PayDunya n'est pas confirmé.
          </p>
        </div>
        <span className="inline-flex min-h-9 items-center rounded-lg border border-[#D8DEE9] bg-white px-3 text-xs font-semibold text-[#111B4D]">
          {bookings.length} demande(s)
        </span>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        {bookings.map((booking) => {
          const teacherName = booking.teacher.professionalName || booking.teacher.fullName;
          const requestedDate = booking.scheduledDate
            ? formatDate(booking.scheduledDate)
            : booking.startDate
              ? `${formatDate(booking.startDate)} demandée`
              : "Date à confirmer";
          const courseTime = booking.scheduledTime || booking.preferredTime || "Créneau à confirmer";
          const state = getPendingCourseState(booking);
          const amount = getPendingCourseAmount(booking);

          return (
            <article key={booking.id} className="rounded-lg border border-[#DDE3EE] bg-white p-3.5">
              <div className="flex min-w-0 items-start gap-3">
                <ProfessorImage
                  photoUrl={booking.teacher.photoUrl}
                  name={teacherName}
                  size={52}
                  shape="circle"
                  verified={booking.teacher.badgeVerified}
                />
                <div className="min-w-0 flex-1">
                  <p className="font-mono text-[11px] font-semibold uppercase tracking-wide text-[#64748B]">{booking.reference}</p>
                  <h3 className="mt-0.5 break-words text-base font-semibold leading-6 text-[#111827]">
                    {booking.subjectName} · {booking.levelName}
                  </h3>
                  <p className="mt-0.5 break-words text-xs font-semibold leading-5 text-[#64748B]">{teacherName}</p>
                </div>
              </div>

              <ClientCompactFacts
                className="mt-3"
                items={[
                  { label: "Date", value: requestedDate },
                  { label: "Créneau", value: courseTime },
                  { label: "Montant", value: amount > 0 ? <Money amount={amount} /> : "Prix à finaliser", strong: amount > 0 },
                  { label: "État", value: state.label, strong: true },
                ]}
              />

              <ClientRecordStatusLine
                className="mt-3"
                label={state.label}
                hint={state.hint}
                aside={booking.isQuoteOnly ? "Dossier" : "PayDunya"}
              />

              <div className="mt-3 grid gap-2 min-[520px]:grid-cols-2">
                <Button asChild variant="outline" className="min-h-11 rounded-lg border-[#CAD7F2] bg-white text-[#111B4D] hover:border-[#111B4D] hover:bg-white">
                  <Link href={`/client/reservations/${booking.id}`}>
                    Dossier
                    <ExternalLink className="ml-1.5 h-4 w-4" />
                  </Link>
                </Button>
                <Button asChild className="min-h-11 rounded-lg bg-[#111B4D] text-white hover:bg-[#1E2A78]">
                  <Link href={booking.isQuoteOnly ? `/client/reservations/${booking.id}` : `/client/reservations/${booking.id}?payment=pending`}>
                    {booking.isQuoteOnly ? "Suivre le dossier" : "Payer via PayDunya"}
                  </Link>
                </Button>
              </div>
            </article>
          );
        })}
      </div>
    </ClientSurface>
  );
}

function getPendingCourseAmount(booking: Pick<PendingCourseBooking, "totalClientPays" | "totalPrice">) {
  return Math.max(0, booking.totalClientPays || booking.totalPrice || 0);
}

function getPendingCourseState(booking: Pick<PendingCourseBooking, "isQuoteOnly">) {
  if (booking.isQuoteOnly) {
    return {
      label: "Prix en préparation",
      hint: "Le service client doit finaliser le tarif avant paiement. Le cours n'est pas encore réservé.",
    };
  }

  return {
    label: "Brouillon non réservé",
    hint: "Payez via PayDunya pour activer le dossier. Aucune notification professeur n'est envoyée avant validation serveur.",
  };
}

function getCourseStep(status: BookingStatus, paymentStatus: PaymentStatus) {
  if (status === "PENDING_ADMIN_VALIDATION" && paymentStatus === "FAILED") {
    return {
      label: "Prix en préparation",
      hint: "Le service client prépare le montant final avant paiement.",
      icon: Clock,
      className: "border-[#E3E8F2] bg-white text-[#111B4D]",
    };
  }
  if (status === "PENDING_CLIENT_VALIDATION") {
    return {
      label: "Confirmation attendue",
      hint: "Le cours est terminé. Confirmez-le depuis le détail si tout s'est bien passé.",
      icon: MessageSquare,
      className: "border-[#E3E8F2] bg-white text-[#111B4D]",
    };
  }
  if (["VALIDATED_BY_CLIENT", "PAYMENT_TO_RELEASE", "TEACHER_PAID"].includes(status)) {
    return {
      label: "Cours validé",
      hint: paymentStatus === "TEACHER_PAID"
        ? "Le dossier est clôturé côté paiement sécurisé."
        : "Votre confirmation est prise en compte. Le service client finalise le dossier.",
      icon: CheckCircle2,
      className: "border-[#E3E8F2] bg-white text-[#111B4D]",
    };
  }
  if (status === "IN_PROGRESS") {
    return {
      label: "En cours",
      hint: "Gardez le contact avec le professeur et revenez confirmer après le cours.",
      icon: Clock,
      className: "border-[#DDE6F7] bg-white text-[#111B4D]",
    };
  }
  return {
    label: "À venir",
    hint: "Le professeur et le service client disposent des informations nécessaires au suivi du cours.",
    icon: Calendar,
    className: "border-[#E3E8F2] bg-white text-[#111B4D]",
  };
}

function formatCount(count: number, singular: string, plural = singular.endsWith("s") ? singular : `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}
