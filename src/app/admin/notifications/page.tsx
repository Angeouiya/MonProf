import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { PageHeader, EmptyState } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import Link from "next/link";
import { ArrowRight, Bell, ChevronDown, ClipboardList, RadioTower, ShieldAlert, UserCog, Wallet } from "lucide-react";
import { NotificationsClient } from "./client";
import { NotificationHistoryTable, NotificationItem } from "@/components/admin/notification-components";
import { NotificationQuickActionsClient } from "./quick-actions-client";
import { RunNotificationRemindersClient } from "./run-reminders-client";
import { CommunicationCampaignComposer } from "./campaign-composer";
import { formatDateTime } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function AdminNotificationsPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const admin = await requireAdmin("COMMUNICATIONS_VIEW");
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
  const [campaigns, clients, campaignTeachers] = await Promise.all([
    db.communicationCampaign.findMany({
      include: { createdBy: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: 30,
    }),
    admin.adminPermissions?.includes("COMMUNICATIONS_SEND")
      ? db.user.findMany({
          where: { role: "CLIENT" },
          select: { id: true, name: true, email: true, phone: true },
          orderBy: { name: "asc" },
          take: 1000,
        })
      : [],
    admin.adminPermissions?.includes("COMMUNICATIONS_SEND")
      ? db.teacher.findMany({
          select: {
            id: true, fullName: true, professionalName: true, phone: true,
            subjects: { where: { isPrimary: true }, select: { subject: { select: { name: true } } }, take: 1 },
          },
          orderBy: { fullName: "asc" },
          take: 1000,
        })
      : [],
  ]);
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
      <PageHeader title="Notifications" description={`${notifications.length} notification(s) • ${unreadCount} non lue(s)`} rootPage>
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
          <Button asChild variant="outline" className="rounded-xl border-[#D9E1EF] text-[#111B4D]">
            <Link href="/admin/notifications/sante">
              <RadioTower className="h-4 w-4" />
              Santé push
            </Link>
          </Button>
          <RunNotificationRemindersClient />
          <NotificationsClient mode="markAll" />
        </div>
      </PageHeader>

      <section
        data-admin-notification-priority
        className={radarDecision.tone === "red"
          ? "overflow-hidden rounded-[1.35rem] border border-red-200 bg-red-50/70 p-4 shadow-sm"
          : radarDecision.tone === "amber"
            ? "overflow-hidden rounded-[1.35rem] border border-amber-200 bg-amber-50/70 p-4 shadow-sm"
            : "overflow-hidden rounded-[1.35rem] border border-[#DCE5F2] bg-white p-4 shadow-sm"}
      >
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
          <div className="min-w-0">
            <p className={radarDecision.tone === "red" ? "text-xs font-black uppercase tracking-wide text-red-900/65" : radarDecision.tone === "amber" ? "text-xs font-black uppercase tracking-wide text-amber-900/65" : "text-xs font-black uppercase tracking-wide text-[#64748B]"}>
              À traiter maintenant
            </p>
            <h2 className={radarDecision.tone === "red" ? "mt-1 text-xl font-black leading-tight text-red-950" : radarDecision.tone === "amber" ? "mt-1 text-xl font-black leading-tight text-amber-950" : "mt-1 text-xl font-black leading-tight text-[#111B4D]"}>
              {radarDecision.title}
            </h2>
            <p className={radarDecision.tone === "red" ? "mt-2 line-clamp-2 max-w-3xl text-sm font-medium leading-6 text-red-950/75" : radarDecision.tone === "amber" ? "mt-2 line-clamp-2 max-w-3xl text-sm font-medium leading-6 text-amber-950/75" : "mt-2 line-clamp-2 max-w-3xl text-sm font-medium leading-6 text-[#526070]"}>
              {radarDecision.description}
            </p>
          </div>
          <Button asChild className="h-12 rounded-xl bg-[#111B4D] px-5 font-black text-white hover:bg-[#17245F]">
            <Link href={radarDecision.href}>
              {radarDecision.actionLabel}
              <ArrowRight className="ml-1.5 h-4 w-4" />
            </Link>
          </Button>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <AdminNotificationMini label="Urgentes" value={urgentCount} href="/admin/notifications?filter=urgent" danger={urgentCount > 0} />
          <AdminNotificationMini label="Échecs" value={failedCount} href="/admin/notifications?filter=failed" danger={failedCount > 0} />
          <AdminNotificationMini label="Professeurs" value={teacherPendingCount} href="/admin/notifications?filter=teacher" danger={teacherPendingCount > 0} />
          <AdminNotificationMini label="Actions" value={actionRequiredCount} href="/admin/notifications?filter=unread" danger={actionRequiredCount > 0} />
        </div>
      </section>

      {admin.adminPermissions?.includes("COMMUNICATIONS_SEND") && (
        <details data-admin-notification-campaign-composer className="group overflow-hidden rounded-[1.15rem] border border-[#E2E8F0] bg-white shadow-sm">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3">
            <span>
              <span className="block text-sm font-black text-[#111B4D]">Nouvelle diffusion</span>
              <span className="block text-xs font-semibold text-[#64748B]">Ouvrir seulement au moment d’envoyer.</span>
            </span>
            <ChevronDown className="h-4 w-4 shrink-0 text-[#64748B] transition group-open:rotate-180" />
          </summary>
          <div className="border-t border-[#E2E8F0] p-3">
            <CommunicationCampaignComposer
              clients={clients.map((client) => ({
                id: client.id,
                name: client.name,
                detail: client.email || client.phone || "Client",
              }))}
              teachers={campaignTeachers.map((teacher) => ({
                id: teacher.id,
                name: teacher.professionalName || teacher.fullName,
                detail: [teacher.subjects[0]?.subject.name, teacher.phone].filter(Boolean).join(" · ") || "Professeur",
              }))}
            />
          </div>
        </details>
      )}

      {campaigns.length > 0 && (
        <details data-admin-notification-campaigns className="group overflow-hidden rounded-[1.15rem] border border-[#E2E8F0] bg-white shadow-sm">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3">
            <span>
              <span className="block text-sm font-black text-[#111B4D]">Diffusions envoyées</span>
              <span className="block text-xs font-semibold text-[#64748B]">{campaigns.length} campagne(s) historisée(s)</span>
            </span>
            <ChevronDown className="h-4 w-4 shrink-0 text-[#64748B] transition group-open:rotate-180" />
          </summary>
          <div className="divide-y divide-[#E2E8F0] border-t border-[#E2E8F0]">
            {campaigns.map((campaign) => (
              <div key={campaign.id} className="grid gap-3 p-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-[#111827]">{campaign.title}</p>
                    <Badge variant="outline" className="border-[#CBD5E1] bg-white text-[#111B4D]">{campaign.audience}</Badge>
                    <Badge variant="outline" className="border-[#CBD5E1] bg-white text-[#111B4D]">{campaign.priority}</Badge>
                  </div>
                  <p className="mt-1 line-clamp-2 text-sm leading-6 text-[#64748B]">{campaign.message}</p>
                  <p className="mt-1 text-xs text-[#64748B]">{campaign.reference} · {campaign.createdBy?.name || "Compte retiré"} · {formatDateTime(campaign.createdAt)}</p>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="rounded-lg border border-[#E2E8F0] px-3 py-2"><strong className="block text-base text-[#111827]">{campaign.recipientCount}</strong>Ciblés</div>
                  <div className="rounded-lg border border-[#E2E8F0] px-3 py-2"><strong className="block text-base text-[#111827]">{campaign.deliveredCount}</strong>Envoyés</div>
                  <div className="rounded-lg border border-[#E2E8F0] px-3 py-2"><strong className="block text-base text-[#111827]">{campaign.failedCount}</strong>Échecs</div>
                </div>
              </div>
            ))}
          </div>
        </details>
      )}

      <details data-admin-notification-radar-details className="group overflow-hidden rounded-[1.15rem] border border-[#E2E8F0] bg-white shadow-sm">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3">
          <span>
            <span className="block text-sm font-black text-[#111B4D]">Radar complet</span>
            <span className="block text-xs font-semibold text-[#64748B]">Litiges, remplacements et paiements, sans charger l’écran.</span>
          </span>
          <ChevronDown className="h-4 w-4 shrink-0 text-[#64748B] transition group-open:rotate-180" />
        </summary>
        <div className="grid gap-3 border-t border-[#E2E8F0] p-4 sm:grid-cols-2 xl:grid-cols-5">
          <RadarMetric icon={ShieldAlert} label="Critiques non lues" value={criticalUnreadCount} href="/admin/notifications?filter=urgent" danger={criticalUnreadCount > 0} />
          <RadarMetric icon={UserCog} label="Professeurs" value={teacherPendingCount} href="/admin/notifications?filter=teacher" danger={teacherPendingCount > 0} />
          <RadarMetric icon={ClipboardList} label="Remplacements" value={replacementCount} href="/admin/notifications?filter=replacement" danger={replacementCount > 0} />
          <RadarMetric icon={ShieldAlert} label="Litiges" value={disputeCount} href="/admin/notifications?filter=litige" danger={disputeCount > 0} />
          <RadarMetric icon={Wallet} label="Paiements" value={paymentActionCount} href="/admin/paiements-a-liberer" danger={paymentActionCount > 0} />
        </div>
      </details>

      <NotificationsClient mode="filter" filter={filter ?? ""} />

      {notifications.length === 0 ? (
        <EmptyState icon={Bell} title="Aucune notification" description="Vous êtes à jour." />
      ) : (
        <details data-admin-notification-live-list open={Boolean(filter)} className="group overflow-hidden rounded-[1.15rem] border border-[#E2E8F0] bg-white shadow-sm">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3">
            <span>
              <span className="block text-sm font-black text-[#111B4D]">{filter ? "Notifications filtrées" : "Toutes les notifications"}</span>
              <span className="block text-xs font-semibold text-[#64748B]">{notifications.length} élément(s). Ouvrir pour traiter ligne par ligne.</span>
            </span>
            <ChevronDown className="h-4 w-4 shrink-0 text-[#64748B] transition group-open:rotate-180" />
          </summary>
          <Card className="rounded-none border-x-0 border-b-0 border-t border-[#E2E8F0] shadow-none">
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
        </details>
      )}

      <details data-admin-notification-history-table className="group overflow-hidden rounded-[1.15rem] border border-[#E2E8F0] bg-white shadow-sm">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3">
          <span>
            <span className="block text-sm font-black text-[#111B4D]">Historique complet</span>
            <span className="block text-xs font-semibold text-[#64748B]">Tableau d’audit disponible sans occuper l’écran principal.</span>
          </span>
          <ChevronDown className="h-4 w-4 shrink-0 text-[#64748B] transition group-open:rotate-180" />
        </summary>
        <div className="border-t border-[#E2E8F0]">
          <NotificationHistoryTable notifications={notificationsWithTeachers} />
        </div>
      </details>
    </div>
  );
}

function AdminNotificationMini({
  label,
  value,
  href,
  danger = false,
}: {
  label: string;
  value: number;
  href: string;
  danger?: boolean;
}) {
  return (
    <Link
      href={href}
      className={danger
        ? "rounded-xl border border-red-200 bg-white px-3 py-2 transition hover:border-red-300"
        : "rounded-xl border border-[#E2E8F0] bg-white px-3 py-2 transition hover:border-[#111B4D]"}
      data-admin-notification-mini
    >
      <span className={danger ? "block text-[11px] font-black uppercase tracking-wide text-red-900/60" : "block text-[11px] font-black uppercase tracking-wide text-[#64748B]"}>
        {label}
      </span>
      <span className={danger ? "mt-0.5 block text-xl font-black text-red-950" : "mt-0.5 block text-xl font-black text-[#111B4D]"}>
        {value}
      </span>
    </Link>
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
