import Link from "next/link";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/session";
import {
  ClientAppRail,
  ClientEmptyState,
  ClientInfoPill,
  ClientMetricStrip,
  ClientPageHeader,
  ClientRecordCard,
  ClientSectionTitle,
  ClientSurface,
} from "@/components/shared/client-page-primitives";
import { Money } from "@/components/shared/money";
import { ProfessorImage } from "@/components/shared/professor-image";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/format";
import { hasVerifiedPayDunyaClientPayment, verifiedPayDunyaBookingWhere } from "@/lib/payment-security";
import {
  CalendarCheck, CheckCircle2, ArrowRight, AlertTriangle, Search,
  ShieldCheck, BookOpen, Bell, WalletCards, LifeBuoy, LayoutDashboard,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export const dynamic = "force-dynamic";

const CLIENT_BOOKING_STATUS_LABELS: Record<string, string> = {
  PENDING_PAYMENT: "Brouillon non réservé",
  PAID: "Paiement reçu",
  PENDING_ADMIN_VALIDATION: "Validation service client",
  CONFIRMED: "Confirmé",
  ASSIGNED: "Professeur attribué",
  IN_PROGRESS: "En cours",
  COURSE_DONE: "Cours terminé",
  PENDING_CLIENT_VALIDATION: "À confirmer",
  PAYMENT_TO_RELEASE: "Paiement à libérer",
  VALIDATED_BY_CLIENT: "Validé",
  TEACHER_PAID: "Clôturé",
  CANCELLED: "Annulé",
};

export default async function ClientDashboardPage() {
  const user = await getSessionUser();
  if (!user) return null;

  const now = new Date();

  const totalBookings = await db.booking.count({ where: { clientId: user.id } });
  const upcomingBookings = await db.booking.count({
    where: {
      clientId: user.id,
      status: { in: ["CONFIRMED", "ASSIGNED", "IN_PROGRESS", "PAYMENT_TO_RELEASE"] },
    },
  });
  const blockedFundTransactions = await db.transaction.findMany({
    where: {
      booking: { is: verifiedPayDunyaBookingWhere({ clientId: user.id }) },
      status: "BLOCKED",
      type: "CLIENT_PAYMENT",
    },
    select: {
      amount: true,
      booking: {
        select: {
          paymentStatus: true,
          totalClientPays: true,
          totalPrice: true,
          paydunyaStatus: true,
          paydunyaVerifiedAt: true,
          transactions: {
            where: { type: "CLIENT_PAYMENT" },
            select: { type: true, status: true, amount: true },
          },
        },
      },
    },
  });
  const completedBookings = await db.booking.count({
    where: { clientId: user.id, status: { in: ["TEACHER_PAID", "VALIDATED_BY_CLIENT"] } },
  });
  const pendingValidation = await db.booking.findMany({
    where: { clientId: user.id, status: "PENDING_CLIENT_VALIDATION" },
    orderBy: { courseDoneAt: "desc" },
    take: 5,
    include: {
      teacher: { select: { id: true, fullName: true, professionalName: true, photoUrl: true, jobTitle: true, badgeVerified: true } },
    },
  });
  const nextCourse = await db.booking.findFirst({
    where: {
      clientId: user.id,
      status: { in: ["PENDING_ADMIN_VALIDATION", "PAID", "CONFIRMED", "ASSIGNED", "IN_PROGRESS"] },
      OR: [
        { scheduledDate: { gte: now } },
        { scheduledDate: null, startDate: { gte: now } },
      ],
    },
    orderBy: [{ scheduledDate: "asc" }, { startDate: "asc" }],
    include: {
      teacher: { select: { id: true, fullName: true, professionalName: true, photoUrl: true, jobTitle: true, commune: true, badgeVerified: true } },
    },
  });
  const recentBookings = await db.booking.findMany({
    where: { clientId: user.id },
    orderBy: { createdAt: "desc" },
    take: 3,
    include: {
      teacher: { select: { id: true, fullName: true, professionalName: true, photoUrl: true, badgeVerified: true } },
    },
  });
  const recommended = await db.teacher.findMany({
    where: { status: "ACTIVE", featured: true, AND: [{ photoUrl: { not: null } }, { photoUrl: { not: "" } }] },
    take: 3,
    orderBy: { rating: "desc" },
    include: {
      subjects: { include: { subject: true } },
      _count: { select: { reviews: true } },
    },
  });
  const nextCourseDate = nextCourse
    ? nextCourse.scheduledDate
      ? formatDate(nextCourse.scheduledDate)
      : nextCourse.startDate
        ? formatDate(nextCourse.startDate)
        : "Date à confirmer"
    : null;
  const blockedFundsAmount = blockedFundTransactions
    .filter((transaction) => hasVerifiedPayDunyaClientPayment(transaction.booking))
    .reduce((sum, transaction) => sum + transaction.amount, 0);
  const clientFirstName = getFirstName(user.name ?? "Client");
  const nextCourseTeacherName = nextCourse ? nextCourse.teacher.professionalName || nextCourse.teacher.fullName : "";
  const heroTitle = nextCourse ? "Votre prochain cours est prêt" : `Bonjour ${clientFirstName}`;

  return (
    <div className="space-y-5">
      <ClientPageHeader
        eyebrow="Espace client"
        title={heroTitle}
        showBack={false}
        description={
          nextCourse
            ? `${nextCourse.subjectName} avec ${nextCourseTeacherName} · ${nextCourseDate} · ${nextCourse.scheduledTime || nextCourse.preferredTime || "Créneau à confirmer"}`
            : "Réservez, payez via PayDunya et suivez chaque cours depuis un espace clair."
        }
      >
        <Button asChild className="min-h-11 rounded-lg">
          <Link href={nextCourse ? `/client/reservations/${nextCourse.id}` : "/client/rechercher"}>
            {nextCourse ? "Ouvrir le dossier" : "Trouver un professeur"}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
        <Button asChild variant="outline" className="min-h-11 rounded-lg">
          <Link href="/client/reservations">Réservations</Link>
        </Button>
      </ClientPageHeader>

      <ClientMetricStrip
        metrics={[
          { icon: ShieldCheck, label: "Sécurisés", value: <Money amount={blockedFundsAmount} /> },
          { icon: BookOpen, label: "Cours", value: `${upcomingBookings} à venir` },
          { icon: Bell, label: "Action", value: pendingValidation.length ? formatCount(pendingValidation.length, "attente") : "À jour", attention: pendingValidation.length > 0 },
          { icon: CheckCircle2, label: "Terminés", value: completedBookings },
        ]}
      />

      <ClientAppRail
        items={[
          { href: "/client", icon: LayoutDashboard, label: "Accueil", value: "Vue générale", active: true },
          { href: "/client/rechercher", icon: Search, label: "Réserver", value: "Choisir un professeur" },
          { href: "/client/cours", icon: BookOpen, label: "Cours", value: `${upcomingBookings} actif${upcomingBookings > 1 ? "s" : ""}` },
          { href: "/client/paiements", icon: WalletCards, label: "Paiements", value: formatFCFACompact(blockedFundsAmount) },
          { href: "/client/service-client", icon: LifeBuoy, label: "Service client", value: "Aide et litige" },
        ]}
      />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <ClientSurface>
          <ClientSectionTitle
            title={nextCourse ? "Dossier prioritaire" : "Démarrer"}
            description={nextCourse ? "Le cours le plus proche à suivre." : `${totalBookings} demande${totalBookings > 1 ? "s" : ""} dans votre historique.`}
            action={(
            <Button asChild variant="ghost" size="sm">
              <Link href="/client/cours">Tous mes cours <ArrowRight className="ml-1 h-3.5 w-3.5" /></Link>
            </Button>
            )}
          />
          <div className="mt-4">
            {nextCourse ? (
              <div className="space-y-4">
                <div className="flex items-start gap-4 rounded-lg border border-[#E3E8F2] bg-white p-3">
                  <ProfessorImage
                    photoUrl={nextCourse.teacher.photoUrl}
                    name={nextCourse.teacher.professionalName || nextCourse.teacher.fullName}
                    size={60}
                    shape="circle"
                    verified={nextCourse.teacher.badgeVerified}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-[#111827]">{nextCourseTeacherName}</p>
                    <p className="text-sm text-[#64748B]">{nextCourse.teacher.jobTitle || "Professeur Compétence"}</p>
                    <p className="mt-1 text-sm font-semibold text-[#111827]">
                      {nextCourse.subjectName} · {nextCourse.levelName}
                    </p>
                  </div>
                </div>
                <div className="grid gap-2 text-sm min-[560px]:grid-cols-2">
                  <ClientInfoPill
                    label={nextCourse.scheduledDate ? "Date prévue" : "Date souhaitée"}
                    value={nextCourse.scheduledDate ? formatDate(nextCourse.scheduledDate) : nextCourse.startDate ? formatDate(nextCourse.startDate) : "À planifier"}
                  />
                  <ClientInfoPill label="Créneau" value={nextCourse.scheduledTime || nextCourse.preferredTime || "—"} />
                  <ClientInfoPill label="Format" value={nextCourse.courseFormat === "HOME" ? "À domicile" : "En ligne"} />
                  <ClientInfoPill label="Montant" value={<Money amount={nextCourse.totalClientPays || nextCourse.totalPrice} />} strong />
                </div>
                <div className="flex flex-col gap-3 min-[560px]:flex-row min-[560px]:items-center min-[560px]:justify-between">
                  <p className="text-sm font-semibold text-[#111B4D]">Statut : {formatClientBookingStatus(nextCourse.status)}</p>
                  <Button asChild variant="outline" size="sm" className="min-h-11 w-full rounded-lg min-[640px]:w-auto">
                    <Link href={`/client/reservations/${nextCourse.id}`}>Voir détails</Link>
                  </Button>
                </div>
              </div>
            ) : (
              <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_16rem] lg:items-center">
                <div className="rounded-lg border border-[#E3E8F2] bg-white p-4">
                  <div className="flex items-start gap-3">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-[#111B4D] text-white">
                      <CalendarCheck className="h-5 w-5" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-base font-semibold leading-6 text-[#111827]">Aucun cours planifié</p>
                      <p className="mt-1 text-sm font-medium leading-6 text-[#64748B]">Choisissez un professeur, une date et un créneau. Le paiement reste sécurisé par PayDunya.</p>
                    </div>
                  </div>
                  {recentBookings.length > 0 && (
                    <div className="mt-4 space-y-2">
                      {recentBookings.slice(0, 2).map((booking) => (
                        <RecentBookingLine key={booking.id} booking={booking} />
                      ))}
                    </div>
                  )}
                </div>
                <Button asChild className="min-h-11 rounded-lg">
                  <Link href="/client/rechercher">
                    Rechercher un professeur
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              </div>
            )}
          </div>
        </ClientSurface>

        {/* Actions requises */}
        <ClientSurface>
          <ClientSectionTitle
            title={(
              <span className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-[#111B4D]" />
              Actions requises
              </span>
            )}
            description="Ce qui mérite votre attention maintenant."
          />
          <div className="mt-4 space-y-3">
            {pendingValidation.length === 0 ? (
              <div className="rounded-lg border border-[#E3E8F2] bg-white p-4">
                <div className="flex items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#111B4D] text-white">
                    <CheckCircle2 className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-[#111827]">Tout est à jour</p>
                    <p className="mt-1 text-xs font-medium leading-5 text-[#64748B]">Les confirmations après cours apparaîtront ici.</p>
                  </div>
                </div>
              </div>
            ) : (
              pendingValidation.map((b) => (
                <ClientRecordCard key={b.id} className="p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <ProfessorImage
                        photoUrl={b.teacher.photoUrl}
                        name={b.teacher.professionalName || b.teacher.fullName}
                        size="sm"
                        shape="circle"
                        verified={b.teacher.badgeVerified}
                      />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-[#111827]">{b.subjectName} • {b.levelName}</p>
                        <p className="truncate text-xs text-[#64748B]">
                          {b.teacher.professionalName || b.teacher.fullName}
                        </p>
                      </div>
                    </div>
                    <p className="shrink-0 text-xs font-semibold text-[#111B4D]">À confirmer</p>
                  </div>
                  <div className="mt-3 grid grid-cols-1 gap-2 min-[360px]:grid-cols-2">
                    <Button asChild size="sm" className="min-h-11 rounded-lg text-xs">
                      <Link href={`/client/reservations/${b.id}?action=confirm`}>Confirmer</Link>
                    </Button>
                    <Button asChild size="sm" variant="outline" className="min-h-11 rounded-lg text-xs">
                      <Link href={`/client/reservations/${b.id}?action=report`}>Signaler</Link>
                    </Button>
                  </div>
                </ClientRecordCard>
              ))
            )}
          </div>
        </ClientSurface>
      </div>

      {/* Recommandés */}
      <ClientSurface>
        <ClientSectionTitle
          title="Professeurs recommandés"
          description="Profils vérifiés avec photo réelle."
          action={(
          <Button asChild variant="ghost" size="sm" className="min-h-11 w-full justify-center rounded-lg min-[520px]:w-auto">
            <Link href="/client/rechercher">Plus de professeurs <ArrowRight className="ml-1 h-3.5 w-3.5" /></Link>
          </Button>
          )}
        />
        <div className="mt-4">
          {recommended.length === 0 ? (
            <ClientEmptyState icon={Search} title="Aucun professeur recommandé" compact />
          ) : (
            <div className="grid gap-3 min-[560px]:grid-cols-2 xl:grid-cols-3">
              {recommended.map((t, index) => {
                const displayName = t.professionalName || t.fullName;
                const primarySubject = t.subjects.find((s) => s.isPrimary)?.subject.name ?? t.subjects[0]?.subject.name;
                const indicativePrice = t.pricePerSession || t.pricePerHour || 0;
                return (
                  <Link
                    key={`${t.id}-${index}`}
                    href={`/client/reserver?teacherId=${t.id}`}
                    className="group flex min-w-0 items-center gap-3 rounded-lg border border-[#E3E8F2] bg-white p-3 transition-colors hover:border-[#111B4D]"
                  >
                    <ProfessorImage photoUrl={t.photoUrl} name={displayName} size={54} shape="circle" verified={t.badgeVerified} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-[#111827]">{displayName}</p>
                      <p className="truncate text-xs text-[#64748B]">{primarySubject} · {t.commune}</p>
                      <p className="mt-0.5 text-xs font-semibold text-[#111B4D]">
                        {indicativePrice > 0 ? <><Money amount={indicativePrice} /> / séance 2h</> : "Prix à confirmer"}
                      </p>
                    </div>
                    <ArrowRight className="h-4 w-4 shrink-0 text-[#64748B] transition group-hover:text-[#111B4D]" />
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </ClientSurface>
    </div>
  );
}

type DashboardBookingLine = {
  id: string;
  reference: string;
  status: string;
  subjectName: string;
  levelName: string;
  createdAt: Date;
  teacher: {
    fullName: string;
    professionalName: string | null;
    photoUrl: string | null;
    badgeVerified: boolean;
  };
};

function RecentBookingLine({ booking }: { booking: DashboardBookingLine }) {
  const teacherName = booking.teacher.professionalName || booking.teacher.fullName;
  return (
    <Link href={`/client/reservations/${booking.id}`} className="flex items-center gap-3 rounded-lg border border-[#E3E8F2] bg-white px-3 py-2 transition hover:border-[#111B4D]">
      <ProfessorImage photoUrl={booking.teacher.photoUrl} name={teacherName} size="sm" shape="circle" verified={booking.teacher.badgeVerified} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-[#111827]">{booking.subjectName} · {booking.levelName}</span>
        <span className="block truncate text-xs font-medium text-[#64748B]">{formatClientBookingStatus(booking.status)} · {formatDate(booking.createdAt)}</span>
      </span>
      <ArrowRight className="h-4 w-4 shrink-0 text-[#64748B]" />
    </Link>
  );
}

function formatCount(count: number, singular: string, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}

function formatClientBookingStatus(status: string) {
  return CLIENT_BOOKING_STATUS_LABELS[status] ?? "Suivi en cours";
}

function getFirstName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "Client";
  const first = parts[0].toLowerCase().replace(/\./g, "");
  if (["m", "mr", "mme", "mlle", "monsieur", "madame"].includes(first) && parts[1]) {
    return `${parts[0]} ${parts[1]}`;
  }
  return parts[0];
}

function formatFCFACompact(amount: number) {
  return `${amount.toLocaleString("fr-FR")} FCFA`;
}
