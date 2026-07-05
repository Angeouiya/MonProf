import Link from "next/link";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/session";
import {
  ClientCompactFacts,
  ClientAppRail,
  ClientEmptyState,
  ClientFocusPanel,
  ClientInfoPill,
  ClientMetricStrip,
  ClientPageHeader,
  ClientRecordAmount,
  ClientRecordCard,
  ClientRecordStatusLine,
  ClientSurface,
  ClientTabBar,
} from "@/components/shared/client-page-primitives";
import { ProfessorImage } from "@/components/shared/professor-image";
import { Money } from "@/components/shared/money";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/format";
import { hasVerifiedPayDunyaClientPayment, verifiedPayDunyaBookingWhere } from "@/lib/payment-security";
import { BookOpen, ArrowRight, Clock, Calendar, CheckCircle2, MessageSquare, WalletCards, Search, LockKeyhole, ExternalLink } from "lucide-react";
import { BookingStatus, PaymentStatus } from "@prisma/client";

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

  const rawBookings = await db.booking.findMany({
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
  });
  const bookings = rawBookings.filter((booking) => hasVerifiedPayDunyaClientPayment(booking));

  const rawOverviewBookings = await db.booking.findMany({
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
      subjectName: true,
      levelName: true,
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
  });
  const overviewBookings = rawOverviewBookings.filter((booking) => hasVerifiedPayDunyaClientPayment(booking));

  const pendingCourseBookings = await db.booking.findMany({
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
  });

  const tabCounts = Object.fromEntries(
    TABS.map((item) => [item.id, overviewBookings.filter((booking) => item.statuses.includes(booking.status)).length]),
  ) as Record<string, number>;
  const nextCourse = overviewBookings.find((booking) => ["CONFIRMED", "ASSIGNED", "IN_PROGRESS", "PENDING_ADMIN_VALIDATION"].includes(booking.status));
  const confirmationCount = overviewBookings.filter((booking) => booking.status === "PENDING_CLIENT_VALIDATION").length;
  const protectedAmount = overviewBookings
    .reduce((sum, booking) => sum + (booking.totalClientPays || booking.totalPrice), 0);
  const activeCourseCount = overviewBookings.length;

  return (
    <div className="space-y-6">
      <ClientPageHeader
        eyebrow="Cours"
        title="Cours"
        description="Suivez uniquement les cours activés après validation serveur PayDunya. Les demandes non payées restent séparées."
      />

      <ClientMetricStrip
        metrics={[
          { icon: BookOpen, label: "Actifs", value: activeCourseCount },
          { icon: Calendar, label: "À venir", value: tabCounts.avenir ?? 0 },
          { icon: MessageSquare, label: "À confirmer", value: confirmationCount, attention: confirmationCount > 0 },
          { icon: WalletCards, label: "À finaliser", value: pendingCourseBookings.length, attention: pendingCourseBookings.length > 0 },
        ]}
      />

      <ClientAppRail
        items={[
          { href: "/client/cours", icon: BookOpen, label: "Cours", value: formatCount(activeCourseCount, "cours"), active: true },
          { href: "/client/rechercher", icon: Search, label: "Réserver", value: "Nouveau cours" },
          { href: "/client/reservations", icon: Calendar, label: "Dossiers", value: "Réservations" },
          { href: "/client/notifications", icon: MessageSquare, label: "Alertes", value: formatCount(confirmationCount, "confirmation") },
        ]}
      />

      <CourseTrustPanel protectedAmount={protectedAmount} activeCourseCount={activeCourseCount} />

      {pendingCourseBookings.length > 0 && (
        <PendingCoursesPanel bookings={pendingCourseBookings} />
      )}

      <ClientFocusPanel
        eyebrow="Prochaine séance vérifiée"
        icon={BookOpen}
        title={nextCourse ? nextCourse.subjectName : "Aucun cours actif"}
        description={
          nextCourse
            ? `${nextCourse.teacher.professionalName || nextCourse.teacher.fullName} · ${nextCourse.scheduledDate ? formatDate(nextCourse.scheduledDate) : nextCourse.startDate ? `${formatDate(nextCourse.startDate)} demandée` : "date à confirmer"}`
            : pendingCourseBookings.length > 0
              ? "Finalisez le paiement PayDunya d'une demande pour l'activer dans vos cours."
              : "Réservez un cours pour afficher ici la prochaine séance à suivre."
        }
        action={
          <Button asChild className="min-h-11 rounded-lg sm:min-w-52">
            <Link href={nextCourse ? `/client/reservations/${nextCourse.id}` : pendingCourseBookings[0] ? `/client/reservations/${pendingCourseBookings[0].id}?payment=pending` : "/client/rechercher"}>
              {nextCourse ? "Voir le dossier" : pendingCourseBookings[0] ? "Finaliser le paiement" : "Trouver un professeur"}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        }
      />

      <ClientTabBar
        activeId={tabId}
        items={TABS.map((t) => ({
          id: t.id,
          label: t.label,
          count: tabCounts[t.id] ?? 0,
          href: `/client/cours?tab=${t.id}`,
        }))}
      />

      {bookings.length === 0 ? (
        <ClientEmptyState
          icon={BookOpen}
          title="Aucun cours vérifié dans cette catégorie"
          description="Un cours apparaît ici seulement après paiement PayDunya confirmé côté serveur."
          action={
            <Button asChild size="sm" className="min-h-11 rounded-lg">
              <Link href={pendingCourseBookings[0] ? `/client/reservations/${pendingCourseBookings[0].id}?payment=pending` : "/client/rechercher"}>
                {pendingCourseBookings[0] ? "Finaliser une demande" : "Réserver un cours"}
              </Link>
            </Button>
          }
        />
      ) : (
        <div className="grid gap-3 xl:grid-cols-2">
          {bookings.map((b) => {
            const name = b.teacher.professionalName || b.teacher.fullName;
            const step = getCourseStep(b.status, b.paymentStatus);
            const courseDate = b.scheduledDate ? formatDate(b.scheduledDate) : b.startDate ? `${formatDate(b.startDate)} demandée` : "À planifier";
            const courseTime = b.scheduledTime || b.preferredTime || "Créneau à confirmer";
            const formatLabel = b.courseFormat === "HOME" ? "À domicile" : "En ligne";
            const amountLabel = <Money amount={b.totalClientPays || b.totalPrice} />;
            return (
              <ClientRecordCard key={b.id} data-client-course-card>
                <div className="p-3.5 sm:p-5">
                  <div className="grid gap-3 min-[520px]:grid-cols-[minmax(0,1fr)_auto] min-[520px]:items-start">
                    <div className="flex min-w-0 items-start gap-3">
                      <ProfessorImage photoUrl={b.teacher.photoUrl} name={name} size={58} shape="circle" verified={b.teacher.badgeVerified} />
                      <div className="min-w-0 flex-1">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-[#64748B]">{step.label}</p>
                        <h2 className="mt-0.5 break-words text-base font-semibold leading-6 text-[#111827]">
                          {b.subjectName} · {b.levelName}
                        </h2>
                        <p className="mt-0.5 break-words text-xs font-semibold leading-5 text-[#64748B]">
                          {name} · {b.teacher.jobTitle || "Professeur"}
                        </p>
                      </div>
                    </div>
                    <ClientRecordAmount label="Protégé" value={amountLabel} className="min-[520px]:min-w-36 min-[520px]:text-right" />
                  </div>

                  <ClientCompactFacts
                    className="mt-3"
                    items={[
                      { label: b.scheduledDate ? "Date" : "Date souhaitée", value: courseDate },
                      { label: "Créneau", value: courseTime },
                      { label: "Format", value: formatLabel },
                      { label: "Paiement", value: "Vérifié serveur", strong: true },
                    ]}
                  />

                  <ClientRecordStatusLine className="mt-3" label={step.label} hint={step.hint} aside="PayDunya confirmé" />

                  <div className="mt-3 grid gap-2 min-[520px]:grid-cols-[minmax(0,1fr)_auto] min-[520px]:items-center">
                    <p className="text-xs font-medium leading-5 text-[#64748B]">
                      Cours rattaché à {name}. Le lien en ligne et les actions sont disponibles dans le dossier.
                    </p>
                    <Button asChild size="sm" className="min-h-11 w-full rounded-lg">
                      <Link href={`/client/reservations/${b.id}`}>
                        Voir le dossier <ArrowRight className="ml-1 h-3.5 w-3.5" />
                      </Link>
                    </Button>
                  </div>
                </div>
              </ClientRecordCard>
            );
          })}
        </div>
      )}
    </div>
  );
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

function CourseTrustPanel({
  protectedAmount,
  activeCourseCount,
}: {
  protectedAmount: number;
  activeCourseCount: number;
}) {
  return (
    <ClientSurface compact className="p-4">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,24rem)] lg:items-center">
        <div className="flex min-w-0 gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-[#111B4D] text-white">
            <LockKeyhole className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[#111B4D]">Cours activés</p>
            <h2 className="mt-1 text-lg font-semibold leading-6 text-[#111827]">PayDunya doit confirmer le paiement côté serveur.</h2>
            <p className="mt-1 max-w-2xl text-sm font-medium leading-6 text-[#52627A]">
              Un dossier non payé reste une demande. Dès que la confirmation serveur est reçue, le cours apparaît ici avec le professeur choisi.
            </p>
          </div>
        </div>
        <div className="grid gap-2 min-[420px]:grid-cols-3 lg:grid-cols-1">
          <ClientInfoPill label="Cours actifs" value={formatCount(activeCourseCount, "cours")} strong />
          <ClientInfoPill label="Montant protégé" value={<Money amount={protectedAmount} />} strong />
          <ClientInfoPill label="Contrôle" value="Serveur PayDunya" />
        </div>
      </div>
    </ClientSurface>
  );
}

function PendingCoursesPanel({ bookings }: { bookings: PendingCourseBooking[] }) {
  return (
    <ClientSurface compact className="space-y-3 p-4">
      <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[#111B4D]">Demandes non actives</p>
          <h2 className="text-lg font-semibold leading-6 text-[#111827]">À finaliser avant réservation</h2>
          <p className="mt-1 max-w-2xl text-sm font-medium leading-6 text-[#52627A]">
            Ces demandes ne bloquent aucun créneau professeur tant que le paiement ou le devis final n'est pas confirmé.
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
                  { label: "Montant", value: amount > 0 ? <Money amount={amount} /> : "Sur devis", strong: amount > 0 },
                  { label: "État", value: state.label, strong: true },
                ]}
              />

              <ClientRecordStatusLine
                className="mt-3"
                label={state.label}
                hint={state.hint}
                aside={booking.isQuoteOnly ? "Devis" : "PayDunya"}
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
                    {booking.isQuoteOnly ? "Suivre le devis" : "Payer via PayDunya"}
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
      label: "Devis en préparation",
      hint: "L'administration doit finaliser le tarif avant paiement. Le cours n'est pas encore réservé.",
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
      label: "Devis en préparation",
      hint: "L'administration prépare le montant final avant paiement.",
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
        : "Votre confirmation est prise en compte. L'administration finalise le dossier.",
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
    hint: "Le professeur et l'administration disposent des informations nécessaires au suivi du cours.",
    icon: Calendar,
    className: "border-[#E3E8F2] bg-white text-[#111B4D]",
  };
}

function formatCount(count: number, singular: string, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}
