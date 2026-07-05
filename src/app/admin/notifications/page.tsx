import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { PageHeader, EmptyState } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import { ArrowRight, Bell, ClipboardList, ShieldAlert, UserCog, Wallet } from "lucide-react";
import { NotificationsClient } from "./client";
import { AdminUrgentAlertCard, NotificationHistoryTable, NotificationItem } from "@/components/admin/notification-components";
import { NotificationQuickActionsClient } from "./quick-actions-client";
import { RunNotificationRemindersClient } from "./run-reminders-client";

export const dynamic = "force-dynamic";

export default async function AdminNotificationsPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  await requireAdmin();
  const sp = await searchParams;
  const filter = sp.filter;
  const where: any = { userId: null };
  if (filter === "unread") where.read = false;
  if (filter === "urgent") where.priority = { in: ["URGENT", "CRITICAL"] };
  if (filter === "teacher") where.OR = [{ recipientType: "TEACHER" }, { teacherId: { not: null } }];
  if (filter === "client") where.recipientType = "CLIENT";
  if (filter === "admin") where.recipientType = "ADMIN";
  if (filter === "failed") where.status = "FAILED";
  if (filter === "replacement") where.type = { contains: "REPLAC" };
  if (filter === "litige") where.type = { contains: "DISPUTE" };

  const notifications = await db.notification.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  const teacherIds = Array.from(new Set(notifications.map((n) => n.teacherId).filter((id): id is string => Boolean(id))));
  const bookingIds = Array.from(new Set(notifications.map((n) => n.bookingId).filter((id): id is string => Boolean(id))));
  const bookings = bookingIds.length
    ? await db.booking.findMany({
        where: { id: { in: bookingIds } },
        select: {
          id: true,
          reference: true,
          subjectName: true,
          levelName: true,
          courseFormat: true,
          startDate: true,
          scheduledDate: true,
          scheduledTime: true,
          preferredTime: true,
          status: true,
          paymentStatus: true,
          client: { select: { id: true, name: true, phone: true } },
          teacher: { select: { id: true, fullName: true, professionalName: true, photoUrl: true, phone: true, badgeVerified: true } },
        },
      })
    : [];
  const teachers = teacherIds.length
    ? await db.teacher.findMany({
        where: { id: { in: teacherIds } },
        select: { id: true, fullName: true, professionalName: true, photoUrl: true, phone: true, badgeVerified: true },
      })
    : [];
  const teachersById = new Map(teachers.map((teacher) => [teacher.id, teacher]));
  const bookingsById = new Map(bookings.map((booking) => [booking.id, booking]));
  const notificationsWithTeachers = notifications.map((notification) => ({
    ...notification,
    teacher: notification.teacherId ? teachersById.get(notification.teacherId) ?? null : null,
    booking: notification.bookingId ? bookingsById.get(notification.bookingId) ?? null : null,
  }));
  const unreadCount = notifications.filter((n) => !n.read).length;
  const urgentCount = notifications.filter((n) => ["URGENT", "CRITICAL"].includes(n.priority) && !n.read).length;
  const failedCount = notifications.filter((n) => n.status === "FAILED").length;
  const teacherPendingCount = notificationsWithTeachers.filter((n) => (n.teacherId || n.booking?.teacher.id) && ["CREATED", "SENT", "RELAUNCHED"].includes(n.status)).length;
  const criticalUnreadCount = notifications.filter((n) => n.priority === "CRITICAL" && !n.read).length;
  const actionRequiredCount = notifications.filter((n) => !n.read || ["CREATED", "FAILED", "EXPIRED", "RELAUNCHED"].includes(n.status)).length;
  const replacementCount = notifications.filter((n) => n.type.includes("REPLAC") || n.type.includes("TEACHER_NOT_CONFIRMED") || n.type.includes("STATUS_RESTRICTED")).length;
  const paymentActionCount = notificationsWithTeachers.filter((n) => n.booking?.paymentStatus === "TO_PAY_TEACHER" || n.type.includes("PAY")).length;
  const disputeCount = notifications.filter((n) => n.type.includes("DISPUTE") || n.type.includes("LITIGE")).length;
  const radarDecision = getNotificationRadarDecision({
    criticalUnreadCount,
    failedCount,
    teacherPendingCount,
    replacementCount,
    paymentActionCount,
    disputeCount,
    actionRequiredCount,
  });

  return (
    <div className="space-y-5">
      <PageHeader title="Notifications" description={`${notifications.length} notification(s) • ${unreadCount} non lue(s)`}>
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
          <RunNotificationRemindersClient />
          <NotificationsClient mode="markAll" />
        </div>
      </PageHeader>

      <div className="grid gap-3 md:grid-cols-3">
        <AdminUrgentAlertCard title="Alertes urgentes" description="Critiques ou urgentes non lues." count={urgentCount} />
        <AdminUrgentAlertCard title="Échecs d'envoi" description="Notifications à réessayer ou traiter manuellement." count={failedCount} />
        <AdminUrgentAlertCard title="Professeurs à suivre" description="Notifications professeur en attente de confirmation." count={teacherPendingCount} />
      </div>

      <Card className="overflow-hidden border-[#E3E8F2] bg-white">
        <CardHeader className="border-b border-[#E3E8F2] bg-white">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-base text-[#111827]">
                <ShieldAlert className="h-4 w-4 text-[#111B4D]" />
                Radar opérationnel des notifications
              </CardTitle>
              <p className="mt-1 max-w-3xl text-sm font-medium leading-6 text-[#64748B]">
                Lecture rapide pour décider quoi traiter en premier : urgences, professeurs à relancer, remplacements, litiges et paiements.
                Le bouton de relance vérifie aussi les missions expirées, les confirmations en retard et les cours dans moins de 2h.
              </p>
            </div>
            <Badge variant="outline" className="w-fit border-[#CAD7F2] bg-white text-[#111B4D]">
              {actionRequiredCount} action(s) à suivre
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 p-4 sm:p-5">
          <div className={radarDecision.tone === "red" ? "rounded-lg border border-red-200 bg-white p-4" : radarDecision.tone === "amber" ? "rounded-lg border border-amber-200 bg-white p-4" : "rounded-lg border border-[#CAD7F2] bg-white p-4"}>
            <div className="grid gap-3 lg:grid-cols-[1fr_auto] lg:items-center">
              <div>
                <p className={radarDecision.tone === "red" ? "text-xs font-bold uppercase tracking-wide text-red-900/65" : radarDecision.tone === "amber" ? "text-xs font-bold uppercase tracking-wide text-amber-900/65" : "text-xs font-bold uppercase tracking-wide text-blue-900/65"}>
                  Décision recommandée
                </p>
                <p className={radarDecision.tone === "red" ? "mt-1 text-sm font-black text-red-950" : radarDecision.tone === "amber" ? "mt-1 text-sm font-black text-amber-950" : "mt-1 text-sm font-black text-blue-950"}>
                  {radarDecision.title}
                </p>
                <p className={radarDecision.tone === "red" ? "mt-1 text-sm text-red-950/72" : radarDecision.tone === "amber" ? "mt-1 text-sm text-amber-950/72" : "mt-1 text-sm text-blue-950/72"}>
                  {radarDecision.description}
                </p>
              </div>
              <Button asChild variant="outline" className="rounded-lg bg-white">
                <Link href={radarDecision.href}>
                  {radarDecision.actionLabel}
                  <ArrowRight className="ml-1.5 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <RadarMetric icon={ShieldAlert} label="Critiques non lues" value={criticalUnreadCount} href="/admin/notifications?filter=urgent" danger={criticalUnreadCount > 0} />
            <RadarMetric icon={UserCog} label="Professeurs" value={teacherPendingCount} href="/admin/notifications?filter=teacher" danger={teacherPendingCount > 0} />
            <RadarMetric icon={ClipboardList} label="Remplacements" value={replacementCount} href="/admin/notifications?filter=replacement" danger={replacementCount > 0} />
            <RadarMetric icon={ShieldAlert} label="Litiges" value={disputeCount} href="/admin/notifications?filter=litige" danger={disputeCount > 0} />
            <RadarMetric icon={Wallet} label="Paiements" value={paymentActionCount} href="/admin/paiements-a-liberer" danger={paymentActionCount > 0} />
          </div>
        </CardContent>
      </Card>

      <NotificationsClient mode="filter" filter={filter ?? ""} />

      {notifications.length === 0 ? (
        <EmptyState icon={Bell} title="Aucune notification" description="Vous êtes à jour." />
      ) : (
        <Card className="overflow-hidden">
          <CardContent className="p-0">
            <ul className="max-h-[650px] divide-y divide-violet-100/80 overflow-x-hidden overflow-y-auto">
              {notificationsWithTeachers.map((n) => (
                <NotificationItem
                  key={n.id}
                  notification={n}
                  action={(
                    <>
                      <NotificationQuickActionsClient
                        notification={{
                          id: n.id,
                          status: n.status,
                          recipientType: n.recipientType,
                          teacherId: n.teacherId ?? n.booking?.teacher.id ?? null,
                          bookingId: n.bookingId ?? n.booking?.id ?? null,
                          type: n.type,
                          message: n.message,
                        }}
                        teacherName={(n.teacher ?? n.booking?.teacher)?.professionalName || (n.teacher ?? n.booking?.teacher)?.fullName || n.recipientName}
                        teacherPhone={(n.teacher ?? n.booking?.teacher)?.phone ?? null}
                        hasPrimaryLink={Boolean(n.link)}
                        booking={n.booking ? {
                          id: n.booking.id,
                          reference: n.booking.reference,
                          subjectName: n.booking.subjectName,
                          levelName: n.booking.levelName,
                          courseFormat: n.booking.courseFormat,
                          scheduledDate: n.booking.scheduledDate?.toISOString() ?? null,
                          scheduledTime: n.booking.scheduledTime,
                          preferredTime: n.booking.preferredTime,
                          clientName: n.booking.client.name,
                          paymentStatus: n.booking.paymentStatus,
                          bookingStatus: n.booking.status,
                        } : null}
                      />
                      <NotificationsClient
                        mode="row"
                        notification={{
                          id: n.id,
                          read: n.read,
                          status: n.status,
                          recipientType: n.recipientType,
                          bookingId: n.bookingId,
                          teacherId: n.teacherId ?? n.booking?.teacher.id ?? null,
                          clientId: n.clientId ?? n.booking?.client.id ?? null,
                        }}
                      />
                    </>
                  )}
                />
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <NotificationHistoryTable notifications={notificationsWithTeachers} />
    </div>
  );
}

function getNotificationRadarDecision({
  criticalUnreadCount,
  failedCount,
  teacherPendingCount,
  replacementCount,
  paymentActionCount,
  disputeCount,
  actionRequiredCount,
}: {
  criticalUnreadCount: number;
  failedCount: number;
  teacherPendingCount: number;
  replacementCount: number;
  paymentActionCount: number;
  disputeCount: number;
  actionRequiredCount: number;
}) {
  if (criticalUnreadCount > 0 || disputeCount > 0) {
    return {
      tone: "red" as const,
      title: "Traiter les alertes critiques avant le reste",
      description: "Des notifications critiques ou litiges sont ouverts. Vérifiez les réservations concernées, sécurisez le client et historisez la décision admin.",
      href: "/admin/notifications?filter=urgent",
      actionLabel: "Voir urgences",
    };
  }
  if (replacementCount > 0) {
    return {
      tone: "red" as const,
      title: "Préparer les remplacements professeur",
      description: "Un professeur peut être indisponible, non confirmé ou soumis à un statut bloquant. Ouvrez la réservation et lancez le workflow de remplacement.",
      href: "/admin/notifications?filter=replacement",
      actionLabel: "Voir remplacements",
    };
  }
  if (teacherPendingCount > 0 || failedCount > 0) {
    return {
      tone: "amber" as const,
      title: "Relancer les professeurs et corriger les échecs",
      description: "Des confirmations ou notifications professeur nécessitent une relance WhatsApp, un appel manuel ou un lien mission sécurisé.",
      href: "/admin/notifications?filter=teacher",
      actionLabel: "Suivre professeurs",
    };
  }
  if (paymentActionCount > 0) {
    return {
      tone: "amber" as const,
      title: "Contrôler les paiements à libérer",
      description: "Des notifications concernent des fonds validés ou prêts à payer. Vérifiez la comptabilité professeur avant tout versement.",
      href: "/admin/paiements-a-liberer",
      actionLabel: "Voir paiements",
    };
  }
  if (actionRequiredCount > 0) {
    return {
      tone: "blue" as const,
      title: "Nettoyer les notifications ouvertes",
      description: "Aucune urgence critique, mais certaines notifications doivent être marquées comme traitées après vérification.",
      href: "/admin/notifications?filter=unread",
      actionLabel: "Voir non lues",
    };
  }
  return {
    tone: "blue" as const,
    title: "Centre de notifications sous contrôle",
    description: "Aucune action immédiate détectée. Continuez le suivi opérationnel depuis le centre opérationnel.",
    href: "/admin/centre-operationnel",
    actionLabel: "Centre opérationnel",
  };
}

function RadarMetric({
  icon: Icon,
  label,
  value,
  href,
  danger = false,
}: {
  icon: typeof ShieldAlert;
  label: string;
  value: number;
  href: string;
  danger?: boolean;
}) {
  return (
    <Link
      href={href}
      className={danger ? "rounded-lg border border-amber-200 bg-white p-4 transition hover:border-amber-300" : "rounded-lg border border-[#E3E8F2] bg-white p-4 transition hover:border-[#111B4D]"}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className={danger ? "text-xs font-bold uppercase tracking-wide text-amber-950/60" : "text-xs font-bold uppercase tracking-wide text-violet-950/55"}>{label}</p>
          <p className={danger ? "mt-1 text-2xl font-black text-amber-950" : "mt-1 text-2xl font-black text-violet-950"}>{value}</p>
        </div>
        <Icon className={danger ? "h-5 w-5 text-amber-700" : "h-5 w-5 text-violet-700"} />
      </div>
    </Link>
  );
}
