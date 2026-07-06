import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { Money } from "@/components/shared/money";
import { BookingStatusBadge, PaymentStatusBadge } from "@/components/shared/status-badge";
import { ProfessorImage } from "@/components/shared/professor-image";
import { RevenueAreaChart } from "@/components/admin/charts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Users, GraduationCap, CalendarRange, CheckCircle2, Lock, Banknote,
  ShieldAlert, TrendingUp, CalendarDays, Bell, ArrowRight, Wallet,
  ExternalLink, UserCog,
} from "lucide-react";
import Link from "next/link";
import { formatFCFA, formatDateTime, timeAgo } from "@/lib/format";
import { getTeacherRemainingAmount, isTeacherPayableStatus } from "@/lib/teacher-payments";
import { disputeStatusLabel } from "@/lib/platform-labels";
import { verifiedPayDunyaBookingWhere } from "@/lib/payment-security";

export const dynamic = "force-dynamic";

type NotificationTeacherLite = {
  id: string;
  fullName: string;
  professionalName: string | null;
  photoUrl: string | null;
  badgeVerified: boolean;
};

type NotificationBookingLite = {
  id: string;
  reference: string;
  subjectName: string;
  teacher: NotificationTeacherLite;
};

export default async function AdminDashboard() {
  const user = await requireAdmin();

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const start7d = new Date(startOfToday.getTime() - 6 * 24 * 60 * 60 * 1000);
  const start30d = new Date(startOfToday.getTime() - 29 * 24 * 60 * 60 * 1000);
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const totalClients = await db.user.count({ where: { role: "CLIENT" } });
  const totalTeachers = await db.teacher.count();
  const activeTeachers = await db.teacher.count({ where: { status: "ACTIVE" } });
  const newBookings7d = await db.booking.count({ where: { createdAt: { gte: start7d } } });
  const paidBookings = await db.booking.count({
    where: verifiedPayDunyaBookingWhere({ status: { in: ["PAID","PENDING_ADMIN_VALIDATION","CONFIRMED","ASSIGNED","IN_PROGRESS","COURSE_DONE","PENDING_CLIENT_VALIDATION","VALIDATED_BY_CLIENT","PAYMENT_TO_RELEASE","TEACHER_PAID","DISPUTED"] } }),
  });
  const todayBookings = await db.booking.count({ where: { scheduledDate: { gte: startOfToday, lt: new Date(startOfToday.getTime() + 24*60*60*1000) } } });
  const blockedFundsAgg = await db.booking.aggregate({ where: verifiedPayDunyaBookingWhere({ paymentStatus: "BLOCKED" }), _sum: { totalClientPays: true } });
  const toReleaseAgg = await db.booking.findMany({
    where: verifiedPayDunyaBookingWhere({
      OR: [
        { paymentStatus: "TO_PAY_TEACHER" },
        {
          status: { in: ["CANCELLED", "REFUNDED"] },
          paymentStatus: { in: ["PARTIALLY_REFUNDED", "RETAINED"] },
          cancellationPenaltyTeacherAmount: { gt: 0 },
        },
      ],
    }),
    select: {
      id: true,
      status: true,
      teacherId: true,
      teacherNetAmount: true,
      teacherPaidAmount: true,
      cancellationPenaltyTeacherAmount: true,
      paymentStatus: true,
      teacherPaymentAdjustments: { select: { amount: true, status: true, bookingId: true } },
    },
  });
  const openDisputes = await db.dispute.count({ where: { status: { in: ["OPEN","INVESTIGATING"] } } });
  const allTimeCommissionAgg = await db.booking.aggregate({
    where: verifiedPayDunyaBookingWhere({ paymentStatus: { in: ["BLOCKED","VALIDATED","TO_PAY_TEACHER","TEACHER_PAID"] } }),
    _sum: { commissionAmount: true },
  });
  const monthCommissionAgg = await db.booking.aggregate({
    where: verifiedPayDunyaBookingWhere({ paymentStatus: { in: ["BLOCKED","VALIDATED","TO_PAY_TEACHER","TEACHER_PAID"] }, createdAt: { gte: startOfMonth } }),
    _sum: { commissionAmount: true },
  });
  const totalPaidToTeachersAgg = await db.teacherPayoutRecord.aggregate({ where: { status: "PAID" }, _sum: { amount: true } });
  const recentPaidBookings = await db.booking.findMany({
    where: verifiedPayDunyaBookingWhere({ paymentStatus: { in: ["BLOCKED","VALIDATED","TO_PAY_TEACHER","TEACHER_PAID"] } }),
    include: { client: { select: { name: true } }, teacher: { select: { id: true, professionalName: true, fullName: true, photoUrl: true, badgeVerified: true } } },
    orderBy: { createdAt: "desc" }, take: 5,
  });
  const pendingReleaseBookings = await db.booking.findMany({
    where: verifiedPayDunyaBookingWhere({
      OR: [
        { paymentStatus: "TO_PAY_TEACHER" },
        {
          status: { in: ["CANCELLED", "REFUNDED"] },
          paymentStatus: { in: ["PARTIALLY_REFUNDED", "RETAINED"] },
          cancellationPenaltyTeacherAmount: { gt: 0 },
        },
      ],
    }),
    include: {
      client: { select: { name: true } },
      teacher: { select: { id: true, professionalName: true, fullName: true, photoUrl: true, badgeVerified: true } },
      teacherPaymentAdjustments: { select: { amount: true, status: true, bookingId: true } },
    },
    orderBy: { clientValidatedAt: "desc" }, take: 5,
  });
  const openDisputeList = await db.dispute.findMany({
    where: { status: { in: ["OPEN","INVESTIGATING"] } },
    include: { booking: { select: { reference: true } }, openedBy: { select: { name: true } } },
    orderBy: { createdAt: "desc" }, take: 5,
  });
  const adminNotifications = await db.notification.findMany({ where: { userId: null, read: false }, orderBy: { createdAt: "desc" }, take: 5 });
  const draftPayDunyaBookings = await db.booking.count({
    where: {
      status: "PENDING_PAYMENT",
      OR: [
        { paydunyaVerifiedAt: null },
        { paydunyaStatus: { notIn: ["COMPLETED", "CONFIRMED", "SUCCESS"] } },
      ],
    },
  });
  const paidBookingsAwaitingAdmin = await db.booking.count({
    where: verifiedPayDunyaBookingWhere({
      status: { in: ["PAID", "PENDING_ADMIN_VALIDATION", "CONFIRMED"] },
    }),
  });
  const pendingTeacherConfirmations = await db.teacherMissionLink.count({
    where: {
      status: { in: ["PENDING_CONFIRMATION", "RELAUNCHED"] },
      expiresAt: { gte: now },
      booking: { is: verifiedPayDunyaBookingWhere() },
    },
  });
  const pendingScheduleProposals = await db.bookingScheduleProposal.count({
    where: {
      status: "PENDING",
      booking: { is: verifiedPayDunyaBookingWhere() },
    },
  });
  const teacherMessagesWaitingAdmin = await db.teacherAdminMessage.count({
    where: {
      sender: "TEACHER",
      status: { in: ["OPEN", "WAITING_ADMIN"] },
    },
  });
  const pendingPayoutRequests = await db.teacherPayoutRequest.count({ where: { status: "PENDING" } });
  const pendingRefundRequests = await db.clientRefundRequest.count({ where: { status: { in: ["PENDING", "APPROVED"] } } });

  const notificationTeacherIds = Array.from(new Set(adminNotifications.map((notification) => notification.teacherId).filter((id): id is string => Boolean(id))));
  const notificationBookingIds = Array.from(new Set(adminNotifications.map((notification) => notification.bookingId).filter((id): id is string => Boolean(id))));
  const notificationTeachers = notificationTeacherIds.length
    ? await db.teacher.findMany({
        where: { id: { in: notificationTeacherIds } },
        select: { id: true, fullName: true, professionalName: true, photoUrl: true, badgeVerified: true },
      })
    : [];
  const notificationBookings = notificationBookingIds.length
    ? await db.booking.findMany({
        where: { id: { in: notificationBookingIds } },
        select: {
          id: true,
          reference: true,
          subjectName: true,
          teacherId: true,
          client: { select: { name: true } },
          teacher: { select: { id: true, fullName: true, professionalName: true, photoUrl: true, badgeVerified: true } },
        },
      })
    : [];
  const notificationTeachersById = new Map<string, NotificationTeacherLite>(
    notificationTeachers.map((teacher) => [teacher.id, teacher] as const),
  );
  const notificationBookingsById = new Map<string, NotificationBookingLite>(
    notificationBookings.map((booking) => [booking.id, booking] as const),
  );

  // Daily series (based on bookings)
  const dailyMap: Record<string, number> = {};
  for (let i = 29; i >= 0; i--) {
    const d = new Date(startOfToday.getTime() - i * 24*60*60*1000);
    dailyMap[d.toISOString().slice(0,10)] = 0;
  }
  const commissionBookings = await db.booking.findMany({
    where: verifiedPayDunyaBookingWhere({ createdAt: { gte: start30d }, paymentStatus: { in: ["BLOCKED","VALIDATED","TO_PAY_TEACHER","TEACHER_PAID"] } }),
    select: { commissionAmount: true, createdAt: true },
  });
  for (const b of commissionBookings) {
    const k = b.createdAt.toISOString().slice(0,10);
    if (dailyMap[k] !== undefined) dailyMap[k] += b.commissionAmount;
  }
  const series = Object.entries(dailyMap).map(([date, value]) => ({ date, value }));

  const blockedFunds = blockedFundsAgg._sum.totalClientPays ?? 0;
  const toRelease = toReleaseAgg.reduce((sum, booking) => sum + getTeacherRemainingAmount(booking, booking.teacherPaymentAdjustments), 0);
  const teachersToPay = new Set(
    toReleaseAgg.filter((booking) => isTeacherPayableStatus(booking) && getTeacherRemainingAmount(booking, booking.teacherPaymentAdjustments) > 0).map((booking) => booking.teacherId)
  ).size;
  const totalCommission = allTimeCommissionAgg._sum.commissionAmount ?? 0;
  const monthCommission = monthCommissionAgg._sum.commissionAmount ?? 0;
  const totalPaidToTeachers = totalPaidToTeachersAgg._sum.amount ?? 0;
  const pendingReleaseRows = pendingReleaseBookings
    .map((booking) => ({ booking, remaining: getTeacherRemainingAmount(booking, booking.teacherPaymentAdjustments) }))
    .filter((row) => isTeacherPayableStatus(row.booking) && row.remaining > 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Bonjour, ${user.name.split(" ")[0]}`}
        description="Vue d'ensemble de la plateforme Compétence"
      >
        <Button asChild>
          <Link href="/admin/professeurs/nouveau">
            <GraduationCap className="mr-2 h-4 w-4" /> Ajouter professeur
          </Link>
        </Button>
      </PageHeader>

      <Card className="border-[#E3E8F2] bg-white">
        <CardHeader className="space-y-1">
          <CardTitle className="text-base">Synchronisation des trois espaces</CardTitle>
          <p className="text-sm text-muted-foreground">
            Contrôle rapide client, professeur et administration : les réservations non payées restent en brouillon, et seules les preuves PayDunya vérifiées déclenchent le suivi opérationnel.
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 lg:grid-cols-3">
            <ControlSpaceCard
              title="Espace client"
              description="Paiements, remboursements et réponses client."
              icon={Users}
              href="/admin/clients"
              actionLabel="Voir clients"
              items={[
                { label: "Brouillons PayDunya", value: draftPayDunyaBookings, href: "/admin/reservations?status=PENDING_PAYMENT", attention: draftPayDunyaBookings > 0 },
                { label: "Créneaux à répondre", value: pendingScheduleProposals, href: "/admin/reservations", attention: pendingScheduleProposals > 0 },
                { label: "Remboursements", value: pendingRefundRequests, href: "/admin/reservations?refunds=pending", attention: pendingRefundRequests > 0 },
              ]}
            />
            <ControlSpaceCard
              title="Espace professeur"
              description="Missions, messages et paiements professeur."
              icon={GraduationCap}
              href="/admin/suivi-professeurs"
              actionLabel="Suivi professeurs"
              items={[
                { label: "Confirmations mission", value: pendingTeacherConfirmations, href: "/admin/notifications", attention: pendingTeacherConfirmations > 0 },
                { label: "Messages à traiter", value: teacherMessagesWaitingAdmin, href: "/admin/messages", attention: teacherMessagesWaitingAdmin > 0 },
                { label: "Demandes paiement", value: pendingPayoutRequests, href: "/admin/professeurs-a-payer", attention: pendingPayoutRequests > 0 },
              ]}
            />
            <ControlSpaceCard
              title="Espace admin"
              description="Validation, libération de fonds et incidents."
              icon={ShieldAlert}
              href="/admin/centre-operationnel"
              actionLabel="Centre opérationnel"
              items={[
                { label: "Résa. payées à valider", value: paidBookingsAwaitingAdmin, href: "/admin/reservations?status=paid", attention: paidBookingsAwaitingAdmin > 0 },
                { label: "Paiements à libérer", value: teachersToPay, href: "/admin/paiements-a-liberer", attention: teachersToPay > 0 },
                { label: "Litiges ouverts", value: openDisputes, href: "/admin/litiges", attention: openDisputes > 0 },
              ]}
            />
          </div>
        </CardContent>
      </Card>

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
        <StatCard label="Profs à payer" value={teachersToPay} icon={Banknote} tone="warning" />
        <StatCard label="Litiges ouverts" value={openDisputes} icon={ShieldAlert} tone={openDisputes > 0 ? "danger" : "default"} />
        <StatCard label="CA commission (total)" value={formatFCFA(totalCommission)} icon={TrendingUp} tone="success" />
        <StatCard label="Commission (mois)" value={formatFCFA(monthCommission)} icon={TrendingUp} tone="primary" />
        <StatCard label="Versé aux professeurs" value={formatFCFA(totalPaidToTeachers)} icon={Wallet} tone="success" />
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
                  <div className="flex min-w-0 items-center gap-3">
                    <ProfessorImage
                      photoUrl={b.teacher.photoUrl}
                      name={b.teacher.professionalName || b.teacher.fullName}
                      size="sm"
                      shape="circle"
                      verified={b.teacher.badgeVerified}
                    />
                    <div className="min-w-0">
                      <Link href={`/admin/reservations/${b.id}`} className="text-sm font-medium text-foreground hover:text-primary truncate block">
                        {b.reference}
                      </Link>
                      <p className="text-xs text-muted-foreground truncate">
                        {b.client.name} • {b.teacher.professionalName || b.teacher.fullName}
                      </p>
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        <PaymentStatusBadge status={b.paymentStatus} />
                        {b.teacher.badgeVerified && <Badge className="bg-[#1E2A78] text-white">Certifié</Badge>}
                      </div>
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-2">
                    <Money amount={b.totalPrice} className="text-sm font-semibold" />
                    <BookingStatusBadge status={b.status} />
                    <div className="flex gap-1.5">
                      <Button asChild size="sm" variant="outline" className="h-8 px-2">
                        <Link href={`/admin/reservations/${b.id}`}>
                          <ExternalLink className="h-3.5 w-3.5" />
                        </Link>
                      </Button>
                      <Button asChild size="sm" variant="outline" className="h-8 px-2">
                        <Link href={`/admin/professeurs/${b.teacher.id}?tab=cours&bookingId=${b.id}`}>
                          <GraduationCap className="h-3.5 w-3.5" />
                        </Link>
                      </Button>
                    </div>
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
              {pendingReleaseRows.length === 0 && (
                <li className="px-4 py-6 text-sm text-muted-foreground">Aucun paiement en attente de libération.</li>
              )}
              {pendingReleaseRows.map(({ booking: b, remaining }) => (
                <li key={b.id} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <ProfessorImage
                      photoUrl={b.teacher.photoUrl}
                      name={b.teacher.professionalName || b.teacher.fullName}
                      size="sm"
                      shape="circle"
                      verified={b.teacher.badgeVerified}
                    />
                    <div className="min-w-0">
                      <Link href={`/admin/reservations/${b.id}`} className="text-sm font-medium text-foreground hover:text-primary truncate block">
                        {b.reference}
                      </Link>
                      <p className="text-xs text-muted-foreground truncate">
                        {b.teacher.professionalName || b.teacher.fullName} • validé {b.clientValidatedAt ? timeAgo(b.clientValidatedAt) : "—"}
                      </p>
                      <p className="mt-1 truncate text-xs font-medium text-foreground">{b.client.name} • {b.subjectName}</p>
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
                    <Button asChild size="sm">
                      <Link href={`/admin/reservations/${b.id}?action=pay`}>
                        Payer <Money amount={remaining} className="ml-1" />
                      </Link>
                    </Button>
                    <Button asChild size="sm" variant="outline">
                      <Link href={`/admin/professeurs/${b.teacher.id}?tab=paiements&bookingId=${b.id}`}>
                        Comptabilité
                      </Link>
                    </Button>
                  </div>
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
                  <Badge variant="outline" className="border-red-200 bg-red-50 text-red-700">{disputeStatusLabel(d.status)}</Badge>
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
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-start gap-2">
                      {getNotificationTeacher(n.teacherId, n.bookingId, notificationTeachersById, notificationBookingsById) ? (
                        <ProfessorImage
                          photoUrl={getNotificationTeacher(n.teacherId, n.bookingId, notificationTeachersById, notificationBookingsById)?.photoUrl ?? null}
                          name={getNotificationTeacherName(n.teacherId, n.bookingId, notificationTeachersById, notificationBookingsById)}
                          size="sm"
                          shape="circle"
                          verified={!!getNotificationTeacher(n.teacherId, n.bookingId, notificationTeachersById, notificationBookingsById)?.badgeVerified}
                        />
                      ) : (
                        <Bell className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                      )}
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <p className="text-sm font-medium text-foreground">{n.title}</p>
                          <Badge variant="outline" className={getPriorityClass(n.priority)}>{n.priority.toLowerCase()}</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground line-clamp-2">{n.message}</p>
                        {n.bookingId && notificationBookingsById.get(n.bookingId) && (
                          <p className="mt-1 text-[11px] font-medium text-foreground">
                            {notificationBookingsById.get(n.bookingId)?.reference} • {notificationBookingsById.get(n.bookingId)?.subjectName}
                          </p>
                        )}
                        <p className="mt-0.5 text-[10px] text-muted-foreground">{timeAgo(n.createdAt)}</p>
                      </div>
                    </div>
                    <div className="flex shrink-0 gap-1.5">
                      <Button asChild size="sm" variant="outline" className="h-8 px-2">
                        <Link href={getNotificationHref(n.link, n.bookingId, n.teacherId)}>
                          <ExternalLink className="h-3.5 w-3.5" />
                        </Link>
                      </Button>
                      {n.bookingId && (
                        <Button asChild size="sm" variant="outline" className="h-8 px-2">
                          <Link href={`/admin/reservations/${n.bookingId}?action=replace`}>
                            <UserCog className="h-3.5 w-3.5" />
                          </Link>
                        </Button>
                      )}
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

function getPriorityClass(priority: string) {
  if (priority === "CRITICAL") return "border-red-200 bg-red-50 text-red-700";
  if (priority === "URGENT") return "border-amber-200 bg-amber-50 text-amber-700";
  if (priority === "IMPORTANT") return "border-violet-200 bg-violet-50 text-violet-700";
  return "border-blue-200 bg-blue-50 text-blue-700";
}

function ControlSpaceCard({
  title,
  description,
  icon: Icon,
  href,
  actionLabel,
  items,
}: {
  title: string;
  description: string;
  icon: typeof Users;
  href: string;
  actionLabel: string;
  items: Array<{ label: string; value: number; href: string; attention?: boolean }>;
}) {
  const attentionCount = items.reduce((sum, item) => sum + (item.attention ? item.value : 0), 0);

  return (
    <section className="rounded-lg border border-[#E3E8F2] bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#111B4D] text-white">
              <Icon className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <h2 className="truncate text-sm font-semibold text-[#111827]">{title}</h2>
              <p className="mt-0.5 line-clamp-2 text-xs font-medium leading-5 text-[#64748B]">{description}</p>
            </div>
          </div>
        </div>
        <Badge
          variant="outline"
          className={attentionCount > 0 ? "shrink-0 border-red-200 bg-white text-red-700" : "shrink-0 border-[#DDE6F7] bg-white text-[#111B4D]"}
        >
          {attentionCount > 0 ? `${attentionCount} à traiter` : "À jour"}
        </Badge>
      </div>

      <div className="mt-4 grid gap-2">
        {items.map((item) => (
          <Link
            key={item.label}
            href={item.href}
            className="flex min-h-11 items-center justify-between gap-3 rounded-lg border border-[#E6EAF3] bg-white px-3 py-2 text-sm transition hover:border-[#111B4D]"
          >
            <span className="min-w-0 truncate font-medium text-[#475569]">{item.label}</span>
            <span className={item.attention ? "rounded-lg bg-[#111B4D] px-2 py-1 text-xs font-semibold text-white" : "rounded-lg border border-[#E3E8F2] bg-white px-2 py-1 text-xs font-semibold text-[#111B4D]"}>
              {item.value}
            </span>
          </Link>
        ))}
      </div>

      <Button asChild variant="outline" className="mt-4 min-h-11 w-full rounded-lg border-[#CAD7F2] bg-white text-[#111B4D]">
        <Link href={href}>
          {actionLabel}
          <ArrowRight className="h-4 w-4" />
        </Link>
      </Button>
    </section>
  );
}

function getNotificationHref(link: string | null, bookingId: string | null, teacherId: string | null) {
  if (link) return link;
  if (bookingId) return `/admin/reservations/${bookingId}`;
  if (teacherId) return `/admin/professeurs/${teacherId}?tab=operationnel`;
  return "/admin/notifications";
}

function getNotificationTeacher(
  teacherId: string | null,
  bookingId: string | null,
  teachers: Map<string, NotificationTeacherLite>,
  bookings: Map<string, NotificationBookingLite>,
) {
  if (teacherId && teachers.has(teacherId)) return teachers.get(teacherId);
  if (bookingId && bookings.has(bookingId)) return bookings.get(bookingId)?.teacher;
  return null;
}

function getNotificationTeacherName(
  teacherId: string | null,
  bookingId: string | null,
  teachers: Map<string, NotificationTeacherLite>,
  bookings: Map<string, NotificationBookingLite>,
) {
  const teacher = getNotificationTeacher(teacherId, bookingId, teachers, bookings);
  return teacher?.professionalName || teacher?.fullName || "Notification admin";
}
