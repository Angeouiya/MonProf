import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { Money } from "@/components/shared/money";
import { BookingStatusBadge, PaymentStatusBadge } from "@/components/shared/status-badge";
import { RevenueAreaChart } from "@/components/admin/charts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Users, GraduationCap, CalendarRange, CheckCircle2, Lock, Banknote,
  ShieldAlert, TrendingUp, CalendarDays, Star, Bell, ArrowRight,
} from "lucide-react";
import Link from "next/link";
import { formatFCFA, formatDateTime, timeAgo } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function AdminDashboard() {
  const user = await requireAdmin();

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const start7d = new Date(startOfToday.getTime() - 6 * 24 * 60 * 60 * 1000);
  const start30d = new Date(startOfToday.getTime() - 29 * 24 * 60 * 60 * 1000);
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [
    totalClients, totalTeachers, activeTeachers, newBookings7d, paidBookings,
    todayBookings, blockedFundsAgg, toReleaseAgg, teachersToPayAgg,
    openDisputes, allTimeCommissionAgg, monthCommissionAgg,
    recentPaidBookings, pendingReleaseBookings, openDisputeList, adminNotifications,
  ] = await Promise.all([
    db.user.count({ where: { role: "CLIENT" } }),
    db.teacher.count(),
    db.teacher.count({ where: { status: "ACTIVE" } }),
    db.booking.count({ where: { createdAt: { gte: start7d } } }),
    db.booking.count({ where: { status: { in: ["PAID","PENDING_ADMIN_VALIDATION","CONFIRMED","ASSIGNED","IN_PROGRESS","COURSE_DONE","PENDING_CLIENT_VALIDATION","VALIDATED_BY_CLIENT","PAYMENT_TO_RELEASE","TEACHER_PAID","DISPUTED"] } } }),
    db.booking.count({ where: { scheduledDate: { gte: startOfToday, lt: new Date(startOfToday.getTime() + 24*60*60*1000) } } }),
    db.transaction.aggregate({ where: { type: "CLIENT_PAYMENT", status: "BLOCKED" }, _sum: { amount: true } }),
    db.booking.aggregate({ where: { paymentStatus: "TO_PAY_TEACHER" }, _sum: { teacherNetAmount: true } }),
    db.booking.findMany({ where: { paymentStatus: "TO_PAY_TEACHER" }, select: { teacherId: true }, distinct: ["teacherId"] }),
    db.dispute.count({ where: { status: { in: ["OPEN","INVESTIGATING"] } } }),
    db.booking.aggregate({ where: { paymentStatus: { in: ["BLOCKED","VALIDATED","TO_PAY_TEACHER","TEACHER_PAID"] } }, _sum: { commissionAmount: true } }),
    db.booking.aggregate({ where: { paymentStatus: { in: ["BLOCKED","VALIDATED","TO_PAY_TEACHER","TEACHER_PAID"] }, createdAt: { gte: startOfMonth } }, _sum: { commissionAmount: true } }),
    db.booking.findMany({
      where: { paymentStatus: { in: ["BLOCKED","VALIDATED","TO_PAY_TEACHER","TEACHER_PAID"] } },
      include: { client: { select: { name: true } }, teacher: { select: { professionalName: true, fullName: true } } },
      orderBy: { createdAt: "desc" }, take: 5,
    }),
    db.booking.findMany({
      where: { paymentStatus: "TO_PAY_TEACHER" },
      include: { client: { select: { name: true } }, teacher: { select: { professionalName: true, fullName: true } } },
      orderBy: { clientValidatedAt: "desc" }, take: 5,
    }),
    db.dispute.findMany({
      where: { status: { in: ["OPEN","INVESTIGATING"] } },
      include: { booking: { select: { reference: true } }, openedBy: { select: { name: true } } },
      orderBy: { createdAt: "desc" }, take: 5,
    }),
    db.notification.findMany({ where: { userId: null, read: false }, orderBy: { createdAt: "desc" }, take: 5 }),
  ]);

  // Daily series (based on bookings)
  const dailyMap: Record<string, number> = {};
  for (let i = 29; i >= 0; i--) {
    const d = new Date(startOfToday.getTime() - i * 24*60*60*1000);
    dailyMap[d.toISOString().slice(0,10)] = 0;
  }
  const commissionBookings = await db.booking.findMany({
    where: { createdAt: { gte: start30d }, paymentStatus: { in: ["BLOCKED","VALIDATED","TO_PAY_TEACHER","TEACHER_PAID"] } },
    select: { commissionAmount: true, createdAt: true },
  });
  for (const b of commissionBookings) {
    const k = b.createdAt.toISOString().slice(0,10);
    if (dailyMap[k] !== undefined) dailyMap[k] += b.commissionAmount;
  }
  const series = Object.entries(dailyMap).map(([date, value]) => ({ date, value }));

  const blockedFunds = blockedFundsAgg._sum.amount ?? 0;
  const toRelease = toReleaseAgg._sum.teacherNetAmount ?? 0;
  const totalCommission = allTimeCommissionAgg._sum.commissionAmount ?? 0;
  const monthCommission = monthCommissionAgg._sum.commissionAmount ?? 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Bonjour, ${user.name.split(" ")[0]}`}
        description="Vue d'ensemble de la plateforme MonProf CI"
      >
        <Button asChild>
          <Link href="/admin/professeurs/nouveau">
            <GraduationCap className="mr-2 h-4 w-4" /> Ajouter professeur
          </Link>
        </Button>
      </PageHeader>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
        <StatCard label="Clients" value={totalClients} icon={Users} tone="default" />
        <StatCard label="Professeurs" value={totalTeachers} icon={GraduationCap} tone="default" />
        <StatCard label="Professeurs actifs" value={activeTeachers} icon={CheckCircle2} tone="success" />
        <StatCard label="Nouv. résa. (7j)" value={newBookings7d} icon={CalendarRange} tone="default" />
        <StatCard label="Résa. payées" value={paidBookings} icon={CheckCircle2} tone="primary" />
        <StatCard label="Cours du jour" value={todayBookings} icon={CalendarDays} tone="default" />
        <StatCard label="Fonds bloqués" value={formatFCFA(blockedFunds)} icon={Lock} tone="warning" />
        <StatCard label="À libérer (net prof)" value={formatFCFA(toRelease)} icon={Banknote} tone="primary" />
        <StatCard label="Profs à payer" value={teachersToPayAgg.length} icon={Banknote} tone="warning" />
        <StatCard label="Litiges ouverts" value={openDisputes} icon={ShieldAlert} tone={openDisputes > 0 ? "danger" : "default"} />
        <StatCard label="CA commission (total)" value={formatFCFA(totalCommission)} icon={TrendingUp} tone="success" />
        <StatCard label="Commission (mois)" value={formatFCFA(monthCommission)} icon={TrendingUp} tone="primary" />
      </div>

      {/* Chart */}
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle className="text-base">Commissions perçues — 30 derniers jours</CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">Somme des commissions des paiements clients (fonds bloqués, validés, libérés et payés).</p>
          </div>
          <Badge variant="secondary" className="hidden sm:inline-flex">{formatFCFA(monthCommission)} ce mois</Badge>
        </CardHeader>
        <CardContent>
          <RevenueAreaChart data={series} />
        </CardContent>
      </Card>

      {/* Recent lists */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Recent paid bookings */}
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">Dernières réservations payées</CardTitle>
            <Button asChild size="sm" variant="ghost">
              <Link href="/admin/reservations">Tout voir <ArrowRight className="ml-1 h-3.5 w-3.5" /></Link>
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            <ul className="divide-y divide-border">
              {recentPaidBookings.length === 0 && (
                <li className="px-4 py-6 text-sm text-muted-foreground">Aucune réservation payée.</li>
              )}
              {recentPaidBookings.map((b) => (
                <li key={b.id} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <Link href={`/admin/reservations/${b.id}`} className="text-sm font-medium text-foreground hover:text-primary truncate block">
                      {b.reference}
                    </Link>
                    <p className="text-xs text-muted-foreground truncate">
                      {b.client.name} • {b.teacher.professionalName || b.teacher.fullName}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <Money amount={b.totalPrice} className="text-sm font-semibold" />
                    <BookingStatusBadge status={b.status} />
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        {/* Pending release */}
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">Paiements à libérer</CardTitle>
            <Button asChild size="sm" variant="ghost">
              <Link href="/admin/paiements-a-liberer">Tout voir <ArrowRight className="ml-1 h-3.5 w-3.5" /></Link>
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            <ul className="divide-y divide-border">
              {pendingReleaseBookings.length === 0 && (
                <li className="px-4 py-6 text-sm text-muted-foreground">Aucun paiement en attente de libération.</li>
              )}
              {pendingReleaseBookings.map((b) => (
                <li key={b.id} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <Link href={`/admin/reservations/${b.id}`} className="text-sm font-medium text-foreground hover:text-primary truncate block">
                      {b.reference}
                    </Link>
                    <p className="text-xs text-muted-foreground truncate">
                      {b.teacher.professionalName || b.teacher.fullName} • validé {b.clientValidatedAt ? timeAgo(b.clientValidatedAt) : "—"}
                    </p>
                  </div>
                  <Button asChild size="sm" className="shrink-0">
                    <Link href={`/admin/reservations/${b.id}?action=pay`}>
                      Payer <Money amount={b.teacherNetAmount} className="ml-1" />
                    </Link>
                  </Button>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        {/* Disputes */}
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">Litiges ouverts</CardTitle>
            <Button asChild size="sm" variant="ghost">
              <Link href="/admin/litiges">Tout voir <ArrowRight className="ml-1 h-3.5 w-3.5" /></Link>
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            <ul className="divide-y divide-border">
              {openDisputeList.length === 0 && (
                <li className="px-4 py-6 text-sm text-muted-foreground">Aucun litige en cours.</li>
              )}
              {openDisputeList.map((d) => (
                <li key={d.id} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <Link href={`/admin/litiges/${d.id}`} className="text-sm font-medium text-foreground hover:text-primary truncate block">
                      {d.reason}
                    </Link>
                    <p className="text-xs text-muted-foreground truncate">
                      {d.booking.reference} • par {d.openedBy.name} • {timeAgo(d.createdAt)}
                    </p>
                  </div>
                  <Badge variant="outline" className="border-red-200 bg-red-50 text-red-700">{d.status}</Badge>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        {/* Notifications */}
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">Notifications non lues</CardTitle>
            <Button asChild size="sm" variant="ghost">
              <Link href="/admin/notifications">Tout voir <ArrowRight className="ml-1 h-3.5 w-3.5" /></Link>
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            <ul className="divide-y divide-border">
              {adminNotifications.length === 0 && (
                <li className="px-4 py-6 text-sm text-muted-foreground">Aucune notification non lue.</li>
              )}
              {adminNotifications.map((n) => (
                <li key={n.id} className="px-4 py-3">
                  <div className="flex items-start gap-2">
                    <Bell className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground">{n.title}</p>
                      <p className="text-xs text-muted-foreground line-clamp-2">{n.message}</p>
                      <p className="mt-0.5 text-[10px] text-muted-foreground">{timeAgo(n.createdAt)}</p>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
