import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { PageHeader, EmptyState } from "@/components/shared/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Bell, CheckCheck } from "lucide-react";
import { formatDateTime, timeAgo } from "@/lib/format";
import { NotificationsClient } from "./client";

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

  const notifications = await db.notification.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <div className="space-y-5">
      <PageHeader title="Notifications" description={`${notifications.length} notification(s) • ${unreadCount} non lue(s)`}>
        <NotificationsClient mode="markAll" />
      </PageHeader>

      <NotificationsClient mode="filter" filter={filter ?? ""} />

      {notifications.length === 0 ? (
        <EmptyState icon={Bell} title="Aucune notification" description="Vous êtes à jour." />
      ) : (
        <Card>
          <CardContent className="p-0">
            <ul className="divide-y divide-border max-h-[600px] overflow-y-auto">
              {notifications.map((n) => (
                <li key={n.id} className={`flex items-start justify-between gap-3 px-4 py-3 ${n.read ? "" : "bg-primary/5"}`}>
                  <div className="flex items-start gap-3 min-w-0">
                    <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${n.read ? "bg-muted text-muted-foreground" : "bg-primary/10 text-primary"}`}>
                      <Bell className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <p className={`text-sm ${n.read ? "font-medium text-foreground" : "font-semibold text-foreground"}`}>{n.title}</p>
                      <p className="text-sm text-muted-foreground line-clamp-2">{n.message}</p>
                      <p className="mt-0.5 text-[10px] text-muted-foreground" title={formatDateTime(n.createdAt)}>{formatDateTime(n.createdAt)} • {timeAgo(n.createdAt)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {!n.read && <Badge variant="outline" className="border-primary/30 bg-primary/5 text-primary">Non lue</Badge>}
                    <NotificationsClient mode="row" notification={{ id: n.id, read: n.read }} />
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
