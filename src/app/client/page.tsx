import Link from "next/link";
import Image from "next/image";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/session";
import { PageHeader, EmptyState } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { BookingStatusBadge, PaymentStatusBadge } from "@/components/shared/status-badge";
import { Money } from "@/components/shared/money";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatFCFA, formatDate, formatDateTime, avatarFromName } from "@/lib/format";
import { CalendarCheck, Clock, Wallet, CheckCircle2, ArrowRight, AlertTriangle, Sparkles, Search } from "lucide-react";
import { BookingStatus } from "@prisma/client";

export const dynamic = "force-dynamic";

export default async function ClientDashboardPage() {
  const user = await getSessionUser();
  if (!user) return null;

  const now = new Date();

  const [
    totalBookings,
    upcomingBookings,
    blockedFundsAgg,
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
    db.transaction.aggregate({
      where: { booking: { clientId: user.id }, status: "BLOCKED", type: "CLIENT_PAYMENT" },
      _sum: { amount: true },
    }),
    db.booking.count({
      where: { clientId: user.id, status: { in: ["TEACHER_PAID", "VALIDATED_BY_CLIENT"] } },
    }),
    db.booking.findMany({
      where: { clientId: user.id, status: "PENDING_CLIENT_VALIDATION" },
      orderBy: { courseDoneAt: "desc" },
      take: 5,
      include: {
        teacher: { select: { id: true, fullName: true, professionalName: true, photoUrl: true, jobTitle: true } },
      },
    }),
    db.booking.findFirst({
      where: {
        clientId: user.id,
        status: { in: ["CONFIRMED", "ASSIGNED", "IN_PROGRESS"] },
        scheduledDate: { gte: now },
      },
      orderBy: { scheduledDate: "asc" },
      include: {
        teacher: { select: { id: true, fullName: true, professionalName: true, photoUrl: true, jobTitle: true, commune: true } },
      },
    }),
    db.teacher.findMany({
      where: { status: "ACTIVE", featured: true },
      take: 3,
      orderBy: { rating: "desc" },
      include: {
        subjects: { include: { subject: true } },
        _count: { select: { reviews: true } },
      },
    }),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Bonjour ${user.name?.split(" ")[0] ?? ""}`}
        description="Bienvenue dans votre espace client MonProf CI."
      >
        <Button asChild>
          <Link href="/client/reserver">
            <Sparkles className="mr-2 h-4 w-4" />
            Réserver un cours
          </Link>
        </Button>
      </PageHeader>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard label="Réservations" value={totalBookings} icon={CalendarCheck} tone="primary" />
        <StatCard label="Cours à venir" value={upcomingBookings} icon={Clock} />
        <StatCard label="Fonds bloqués" value={formatFCFA(blockedFundsAgg._sum.amount ?? 0)} icon={Wallet} tone="warning" />
        <StatCard label="Cours terminés" value={completedBookings} icon={CheckCircle2} tone="success" />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Prochain cours */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-base font-semibold">Prochain cours</CardTitle>
            <Button asChild variant="ghost" size="sm">
              <Link href="/client/cours">Tous mes cours <ArrowRight className="ml-1 h-3.5 w-3.5" /></Link>
            </Button>
          </CardHeader>
          <CardContent>
            {nextCourse ? (
              <div className="space-y-4">
                <div className="flex items-start gap-4">
                  <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-full bg-muted">
                    {nextCourse.teacher.photoUrl ? (
                      <Image src={nextCourse.teacher.photoUrl} alt={nextCourse.teacher.fullName} fill className="object-cover" />
                    ) : (
                      <img src={avatarFromName(nextCourse.teacher.fullName)} alt={nextCourse.teacher.fullName} className="h-full w-full object-cover" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-foreground">
                      {nextCourse.teacher.professionalName || nextCourse.teacher.fullName}
                    </p>
                    <p className="text-sm text-muted-foreground">{nextCourse.teacher.jobTitle}</p>
                    <p className="mt-1 text-sm font-medium text-foreground">
                      {nextCourse.subjectName} • {nextCourse.levelName}
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 rounded-lg bg-muted/50 p-3 text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground">Date prévue</p>
                    <p className="font-medium text-foreground">
                      {nextCourse.scheduledDate ? formatDate(nextCourse.scheduledDate) : "À planifier"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Créneau</p>
                    <p className="font-medium text-foreground">{nextCourse.scheduledTime || nextCourse.preferredTime || "—"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Format</p>
                    <p className="font-medium text-foreground">
                      {nextCourse.courseFormat === "HOME" ? "À domicile" : "En ligne"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Montant</p>
                    <p className="font-medium text-foreground"><Money amount={nextCourse.totalPrice} /></p>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <BookingStatusBadge status={nextCourse.status as BookingStatus} />
                  <Button asChild variant="outline" size="sm">
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
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-accent" />
              Actions requises
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {pendingValidation.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucune action requise pour le moment.</p>
            ) : (
              pendingValidation.map((b) => (
                <div key={b.id} className="rounded-lg border border-border p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">{b.subjectName} • {b.levelName}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {b.teacher.professionalName || b.teacher.fullName}
                      </p>
                    </div>
                    <span className="shrink-0 rounded-md bg-orange-50 px-1.5 py-0.5 text-[10px] font-medium text-orange-700">
                      À confirmer
                    </span>
                  </div>
                  <div className="mt-2 flex gap-1.5">
                    <Button asChild size="sm" className="h-7 flex-1 text-xs">
                      <Link href={`/client/reservations/${b.id}?action=confirm`}>Confirmer</Link>
                    </Button>
                    <Button asChild size="sm" variant="outline" className="h-7 flex-1 text-xs">
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
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
          <CardTitle className="text-base font-semibold">Recommandés pour vous</CardTitle>
          <Button asChild variant="ghost" size="sm">
            <Link href="/client/rechercher">Plus de professeurs <ArrowRight className="ml-1 h-3.5 w-3.5" /></Link>
          </Button>
        </CardHeader>
        <CardContent>
          {recommended.length === 0 ? (
            <EmptyState icon={Search} title="Aucun professeur recommandé" />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {recommended.map((t) => {
                const displayName = t.professionalName || t.fullName;
                const primarySubject = t.subjects.find((s) => s.isPrimary)?.subject.name ?? t.subjects[0]?.subject.name;
                return (
                  <Link
                    key={t.id}
                    href={`/client/reserver?teacherId=${t.id}`}
                    className="group flex items-center gap-3 rounded-xl border border-border bg-card p-3 transition-all hover:border-primary/40 hover:shadow-sm"
                  >
                    <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-full bg-muted">
                      {t.photoUrl ? (
                        <Image src={t.photoUrl} alt={displayName} fill className="object-cover" />
                      ) : (
                        <img src={avatarFromName(displayName)} alt={displayName} className="h-full w-full object-cover" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-foreground">{displayName}</p>
                      <p className="truncate text-xs text-muted-foreground">{primarySubject} • {t.commune}</p>
                      <p className="mt-0.5 text-xs font-medium text-foreground">
                        {formatFCFA(t.pricePerSession)} <span className="text-muted-foreground">/séance</span>
                      </p>
                    </div>
                    <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition group-hover:text-primary" />
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
