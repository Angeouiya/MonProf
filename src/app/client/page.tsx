import Link from "next/link";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/session";
import { EmptyState } from "@/components/shared/page-header";
import { ClientMetricStrip, ClientPageHeader } from "@/components/shared/client-page-primitives";
import { BookingStatusBadge } from "@/components/shared/status-badge";
import { Money } from "@/components/shared/money";
import { ProfessorImage } from "@/components/shared/professor-image";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate } from "@/lib/format";
import { hasVerifiedPayDunyaClientPayment, verifiedPayDunyaBookingWhere } from "@/lib/payment-security";
import {
  CalendarCheck, CheckCircle2, ArrowRight, AlertTriangle,
  Search, ShieldCheck, BookOpen, Bell,
} from "lucide-react";
import { BookingStatus } from "@prisma/client";

export const dynamic = "force-dynamic";

export default async function ClientDashboardPage() {
  const user = await getSessionUser();
  if (!user) return null;

  const now = new Date();

  const [
    totalBookings,
    upcomingBookings,
    blockedFundTransactions,
    completedBookings,
    pendingValidation,
    nextCourse,
    recommended,
  ] = await Promise.all([
    db.booking.count({ where: { clientId: user.id } }),
    db.booking.count({
      where: {
        clientId: user.id,
        status: { in: ["CONFIRMED", "ASSIGNED", "IN_PROGRESS", "PAYMENT_TO_RELEASE"] },
      },
    }),
    db.transaction.findMany({
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
    }),
    db.booking.count({
      where: { clientId: user.id, status: { in: ["TEACHER_PAID", "VALIDATED_BY_CLIENT"] } },
    }),
    db.booking.findMany({
      where: { clientId: user.id, status: "PENDING_CLIENT_VALIDATION" },
      orderBy: { courseDoneAt: "desc" },
      take: 5,
      include: {
        teacher: { select: { id: true, fullName: true, professionalName: true, photoUrl: true, jobTitle: true, badgeVerified: true } },
      },
    }),
    db.booking.findFirst({
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
    }),
    db.teacher.findMany({
      where: { status: "ACTIVE", featured: true, AND: [{ photoUrl: { not: null } }, { photoUrl: { not: "" } }] },
      take: 3,
      orderBy: { rating: "desc" },
      include: {
        subjects: { include: { subject: true } },
        _count: { select: { reviews: true } },
      },
    }),
  ]);
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

  return (
    <div className="space-y-5">
      <ClientPageHeader
        showBack={false}
        eyebrow="Tableau de bord client"
        title={nextCourse ? "Prochain cours à suivre" : "Votre espace cours est prêt"}
        description={nextCourse
          ? `${nextCourse.subjectName} avec ${nextCourse.teacher.professionalName || nextCourse.teacher.fullName} · ${nextCourseDate} · ${nextCourse.scheduledTime || nextCourse.preferredTime || "Créneau à confirmer"}`
          : "Trouvez un professeur, réservez et suivez vos paiements dans un parcours clair, simple et sécurisé."}
      >
        <Button asChild className="min-h-11 rounded-2xl">
          <Link href={nextCourse ? `/client/reservations/${nextCourse.id}` : "/client/rechercher"}>
            {nextCourse ? "Ouvrir le dossier" : "Trouver un professeur"}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
        <Button asChild variant="outline" className="min-h-11 rounded-2xl">
          <Link href="/client/reservations">Mes réservations</Link>
        </Button>
      </ClientPageHeader>

      <ClientMetricStrip
        metrics={[
          { icon: ShieldCheck, label: "Sécurisés", value: <Money amount={blockedFundsAmount} /> },
          { icon: BookOpen, label: "Cours", value: `${upcomingBookings} à venir` },
          { icon: Bell, label: "Action", value: pendingValidation.length ? formatCount(pendingValidation.length, "attente") : "À jour", attention: pendingValidation.length > 0 },
          { icon: CalendarCheck, label: "Demandes", value: totalBookings },
          { icon: CheckCircle2, label: "Terminés", value: completedBookings },
        ]}
      />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_22rem]">
        {/* Prochain cours */}
        <Card className="overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-base font-black tracking-tight text-[#111827]">Prochain cours</CardTitle>
            <Button asChild variant="ghost" size="sm">
              <Link href="/client/cours">Tous mes cours <ArrowRight className="ml-1 h-3.5 w-3.5" /></Link>
            </Button>
          </CardHeader>
          <CardContent>
            {nextCourse ? (
              <div className="space-y-4">
                <div className="flex items-start gap-4 rounded-[1.35rem] border border-[#E3E8F2] bg-white p-3">
                  <ProfessorImage
                    photoUrl={nextCourse.teacher.photoUrl}
                    name={nextCourse.teacher.professionalName || nextCourse.teacher.fullName}
                    size="md"
                    shape="circle"
                    verified={nextCourse.teacher.badgeVerified}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="font-black text-[#111827]">
                      {nextCourse.teacher.professionalName || nextCourse.teacher.fullName}
                    </p>
                    <p className="text-sm text-[#64748B]">{nextCourse.teacher.jobTitle}</p>
                    <p className="mt-1 text-sm font-bold text-[#111827]">
                      {nextCourse.subjectName} • {nextCourse.levelName}
                    </p>
                  </div>
                </div>
                <div className="grid gap-3 rounded-[1.35rem] border border-[#E3E8F2] bg-white p-3 text-sm sm:grid-cols-2 sm:p-4">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wide text-[#64748B]">{nextCourse.scheduledDate ? "Date prévue" : "Date souhaitée"}</p>
                    <p className="mt-1 font-bold text-[#111827]">
                      {nextCourse.scheduledDate ? formatDate(nextCourse.scheduledDate) : nextCourse.startDate ? formatDate(nextCourse.startDate) : "À planifier"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wide text-[#64748B]">Créneau</p>
                    <p className="mt-1 font-bold text-[#111827]">{nextCourse.scheduledTime || nextCourse.preferredTime || "—"}</p>
                  </div>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wide text-[#64748B]">Format</p>
                    <p className="mt-1 font-bold text-[#111827]">
                      {nextCourse.courseFormat === "HOME" ? "À domicile" : "En ligne"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wide text-[#64748B]">Montant</p>
                    <p className="mt-1 font-bold text-[#111827]"><Money amount={nextCourse.totalPrice} /></p>
                  </div>
                </div>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <BookingStatusBadge status={nextCourse.status as BookingStatus} audience="client" />
                  <Button asChild variant="outline" size="sm" className="w-full sm:w-auto">
                    <Link href={`/client/reservations/${nextCourse.id}`}>Voir détails</Link>
                  </Button>
                </div>
              </div>
            ) : (
              <EmptyState
                icon={CalendarCheck}
                title="Aucun cours planifié"
                description="Réservez votre premier cours avec un professeur vérifié."
                action={
                  <Button asChild size="sm">
                    <Link href="/client/rechercher">Rechercher un professeur</Link>
                  </Button>
                }
              />
            )}
          </CardContent>
        </Card>

        {/* Actions requises */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base font-black tracking-tight text-[#111827]">
              <AlertTriangle className="h-4 w-4 text-[#111B4D]" />
              Actions requises
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {pendingValidation.length === 0 ? (
              <p className="text-sm text-[#64748B]">Aucune action requise pour le moment.</p>
            ) : (
              pendingValidation.map((b) => (
                <div key={b.id} className="rounded-[1.1rem] border border-[#E3E8F2] bg-white p-3 shadow-sm">
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
                        <p className="truncate text-sm font-black text-[#111827]">{b.subjectName} • {b.levelName}</p>
                        <p className="truncate text-xs text-[#64748B]">
                          {b.teacher.professionalName || b.teacher.fullName}
                        </p>
                      </div>
                    </div>
                    <span className="shrink-0 rounded-full bg-white px-2 py-1 text-xs font-semibold text-[#111B4D]">
                      À confirmer
                    </span>
                  </div>
                  <div className="mt-3 grid grid-cols-1 gap-2 min-[360px]:grid-cols-2">
                    <Button asChild size="sm" className="min-h-11 rounded-2xl text-xs">
                      <Link href={`/client/reservations/${b.id}?action=confirm`}>Confirmer</Link>
                    </Button>
                    <Button asChild size="sm" variant="outline" className="min-h-11 rounded-2xl text-xs">
                      <Link href={`/client/reservations/${b.id}?action=report`}>Signaler</Link>
                    </Button>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recommandés */}
      <Card>
        <CardHeader className="flex flex-col items-start gap-3 space-y-0 pb-3 min-[520px]:flex-row min-[520px]:items-center min-[520px]:justify-between">
          <CardTitle className="text-base font-black tracking-tight text-[#111827]">Recommandés pour vous</CardTitle>
          <Button asChild variant="ghost" size="sm" className="min-h-11 w-full justify-center rounded-2xl min-[520px]:w-auto">
            <Link href="/client/rechercher">Plus de professeurs <ArrowRight className="ml-1 h-3.5 w-3.5" /></Link>
          </Button>
        </CardHeader>
        <CardContent>
          {recommended.length === 0 ? (
            <EmptyState icon={Search} title="Aucun professeur recommandé" />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {recommended.map((t, index) => {
                const displayName = t.professionalName || t.fullName;
                const primarySubject = t.subjects.find((s) => s.isPrimary)?.subject.name ?? t.subjects[0]?.subject.name;
                return (
                  <Link
                    key={`${t.id}-${index}`}
                    href={`/client/reserver?teacherId=${t.id}`}
                    className="group flex min-w-0 items-center gap-3 rounded-[1.2rem] border border-[#E3E8F2] bg-white p-3 shadow-sm transition-all hover:border-[#111B4D]"
                  >
                    <ProfessorImage photoUrl={t.photoUrl} name={displayName} size={48} shape="circle" verified={t.badgeVerified} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-black text-[#111827]">{displayName}</p>
                      <p className="truncate text-xs text-[#64748B]">{primarySubject} • {t.commune}</p>
                      <p className="mt-0.5 text-xs font-bold text-[#111B4D]">
                        Tarif calculé à la réservation
                      </p>
                    </div>
                    <ArrowRight className="h-4 w-4 shrink-0 text-[#64748B] transition group-hover:text-[#111B4D]" />
                  </Link>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function formatCount(count: number, singular: string, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}
