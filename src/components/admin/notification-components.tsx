import Link from "next/link";
import { Bell, CheckCheck, Clock, ExternalLink, Radio, Send, ShieldAlert, XCircle } from "lucide-react";
import type { Notification, PaymentStatus } from "@prisma/client";
import { cn } from "@/lib/utils";
import { formatDate, formatDateTime, timeAgo } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ProfessorImage } from "@/components/shared/professor-image";
import { PaymentStatusBadge } from "@/components/shared/status-badge";
import {
  courseFormatLabel,
  notificationChannelLabel,
  notificationRecipientLabel,
  notificationTypeLabel,
} from "@/lib/platform-labels";

type NotificationTeacher = {
  id: string;
  fullName: string;
  professionalName: string | null;
  photoUrl: string | null;
  phone: string | null;
  badgeVerified: boolean;
};

type NotificationBooking = {
  id: string;
  reference: string;
  subjectName: string;
  levelName: string;
  courseFormat: string;
  startDate: Date | null;
  scheduledDate: Date | null;
  scheduledTime: string | null;
  preferredTime: string;
  status: string;
  paymentStatus: string;
  client: { id: string; name: string; phone: string | null };
  teacher: NotificationTeacher;
};

type NotificationWithTeacher = Notification & {
  teacher?: NotificationTeacher | null;
  booking?: NotificationBooking | null;
};

function notificationAction(notification: NotificationWithTeacher) {
  if (notification.link) {
    return { href: notification.link, label: notification.actionLabel || "Ouvrir" };
  }
  if (notification.booking) {
    return { href: `/admin/reservations/${notification.booking.id}`, label: "Réservation" };
  }
  const teacher = notification.teacher;
  if (teacher) {
    return { href: `/admin/professeurs/${teacher.id}?tab=operationnel`, label: "Espace prof" };
  }
  return null;
}

export function NotificationStatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; className: string; icon: any }> = {
    CREATED: { label: "Créée", className: "border-slate-200 bg-slate-50 text-slate-700", icon: Clock },
    SENT: { label: "Envoyée", className: "border-blue-200 bg-blue-50 text-blue-700", icon: Send },
    FAILED: { label: "Échouée", className: "border-red-200 bg-red-50 text-red-700", icon: XCircle },
    SEEN: { label: "Vue", className: "border-violet-200 bg-violet-50 text-violet-700", icon: CheckCheck },
    CONFIRMED: { label: "Confirmée", className: "border-blue-200 bg-blue-50 text-blue-800", icon: CheckCheck },
    EXPIRED: { label: "Expirée", className: "border-slate-200 bg-slate-100 text-slate-600", icon: Clock },
    RELAUNCHED: { label: "Relancée", className: "border-amber-200 bg-amber-50 text-amber-800", icon: Radio },
  };
  const cfg = map[status] ?? map.CREATED;
  const Icon = cfg.icon;
  return <Badge variant="outline" className={cn("gap-1", cfg.className)}><Icon className="h-3 w-3" />{cfg.label}</Badge>;
}

export function NotificationPriorityBadge({ priority }: { priority: string }) {
  const map: Record<string, string> = {
    NORMAL: "border-blue-200 bg-blue-50 text-blue-700",
    IMPORTANT: "border-violet-200 bg-violet-50 text-violet-700",
    URGENT: "border-amber-200 bg-amber-50 text-amber-800",
    CRITICAL: "border-red-200 bg-red-50 text-red-700",
  };
  const label: Record<string, string> = {
    NORMAL: "Normale",
    IMPORTANT: "Importante",
    URGENT: "Urgente",
    CRITICAL: "Critique",
  };
  return <Badge variant="outline" className={map[priority] ?? map.NORMAL}>{label[priority] ?? priority}</Badge>;
}

export function NotificationBadge({ count }: { count: number }) {
  if (!count) return null;
  return (
    <span className="inline-flex min-w-6 items-center justify-center rounded-full bg-red-50 px-2 py-0.5 text-xs font-bold text-red-700 ring-1 ring-red-100">
      {count > 99 ? "99+" : count}
    </span>
  );
}

export function NotificationItem({ notification, action }: { notification: NotificationWithTeacher; action?: React.ReactNode }) {
  const linkedTeacher = notification.teacher ?? notification.booking?.teacher ?? null;
  const teacherName = linkedTeacher?.professionalName || linkedTeacher?.fullName || notification.recipientName || "Professeur";
  const booking = notification.booking;
  const bookingDateLabel = booking?.scheduledDate
    ? formatDate(booking.scheduledDate)
    : booking?.startDate
      ? `${formatDate(booking.startDate)} (souhaitée)`
      : null;
  const bookingTimeLabel = booking?.scheduledTime || booking?.preferredTime || "À confirmer";
  const teacherSpaceHref = linkedTeacher
    ? booking
      ? `/admin/professeurs/${linkedTeacher.id}?tab=cours&bookingId=${booking.id}`
      : `/admin/professeurs/${linkedTeacher.id}?tab=operationnel`
    : "";
  return (
    <li className={cn("grid min-w-0 gap-4 border-l-4 px-4 py-4 transition hover:bg-white", notification.read ? "border-transparent bg-white" : "border-[#111B4D] bg-white")}>
      <div className="flex min-w-0 items-start gap-3">
        {linkedTeacher ? (
          <ProfessorImage photoUrl={linkedTeacher.photoUrl} name={teacherName} size="sm" shape="circle" verified={linkedTeacher.badgeVerified} />
        ) : (
          <div className={cn("mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border", notification.priority === "CRITICAL" ? "border-red-200 bg-red-50 text-red-700" : notification.read ? "border-slate-200 bg-white text-muted-foreground" : "border-violet-200 bg-violet-100 text-violet-700")}>
            {notification.priority === "CRITICAL" ? <ShieldAlert className="h-4 w-4" /> : <Bell className="h-4 w-4" />}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className={cn("min-w-0 break-words text-sm", notification.read ? "font-medium text-foreground" : "font-semibold text-foreground")}>{notification.title}</p>
            <Badge variant="outline">{notificationRecipientLabel(notification.recipientType)}</Badge>
            <NotificationPriorityBadge priority={notification.priority} />
            <NotificationStatusBadge status={notification.status} />
          </div>
          <p className="mt-1 line-clamp-3 break-words text-sm text-muted-foreground">{notification.message}</p>
          {booking && (
            <div className="mt-3 min-w-0 rounded-2xl border border-[#E3E8F2] bg-white p-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="border-violet-200 bg-violet-50 text-violet-800">{booking.reference}</Badge>
                <Badge variant="outline">{courseFormatLabel(booking.courseFormat)}</Badge>
                <PaymentStatusBadge status={booking.paymentStatus as PaymentStatus} />
              </div>
              <p className="mt-2 break-words text-sm font-semibold text-foreground">
                {booking.subjectName} - {booking.levelName}
              </p>
              <div className="mt-2 grid gap-1 text-xs text-muted-foreground sm:grid-cols-2 xl:grid-cols-3">
                <p className="min-w-0 break-words">
                  <span className="font-semibold text-foreground/75">Client: </span>
                  {booking.client.name}{booking.client.phone ? ` (${booking.client.phone})` : ""}
                </p>
                <p className="min-w-0 break-words">
                  <span className="font-semibold text-foreground/75">Professeur: </span>
                  {booking.teacher.professionalName || booking.teacher.fullName}
                </p>
                <p className="min-w-0 break-words sm:col-span-2 xl:col-span-1">
                  <span className="font-semibold text-foreground/75">Créneau: </span>
                  {bookingDateLabel ? `${bookingDateLabel} · ${bookingTimeLabel}` : bookingTimeLabel}
                </p>
              </div>
            </div>
          )}
          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-muted-foreground">
            <span>Type: {notificationTypeLabel(notification.type)}</span>
            <span>Canal: {notificationChannelLabel(notification.channel)}</span>
            {notification.recipientName && <span>Destinataire: {notification.recipientName}</span>}
            {linkedTeacher && <span>Professeur: {teacherName}</span>}
            <span title={formatDateTime(notification.createdAt)}>{formatDateTime(notification.createdAt)} - {timeAgo(notification.createdAt)}</span>
            {notification.sentAt && <span>Envoyée: {formatDateTime(notification.sentAt)}</span>}
            {notification.readAt && <span>Lue: {formatDateTime(notification.readAt)}</span>}
          </div>
        </div>
      </div>
      <div className="notification-action-grid">
        {notification.link && (
          <Button asChild variant="outline" size="sm" className="w-full justify-center 2xl:w-auto">
            <Link href={notification.link}>{notification.actionLabel || "Ouvrir"} <ExternalLink className="ml-1.5 h-3.5 w-3.5" /></Link>
          </Button>
        )}
        {booking && (
          <Button asChild variant="outline" size="sm" className="w-full justify-center 2xl:w-auto">
            <Link href={`/admin/reservations/${booking.id}`}>Réservation <ExternalLink className="ml-1.5 h-3.5 w-3.5" /></Link>
          </Button>
        )}
        {linkedTeacher && (
          <Button asChild variant="outline" size="sm" className="w-full justify-center 2xl:w-auto">
            <Link href={teacherSpaceHref}>Espace prof <ExternalLink className="ml-1.5 h-3.5 w-3.5" /></Link>
          </Button>
        )}
        {booking && (
          <Button asChild variant="outline" size="sm" className="w-full justify-center 2xl:w-auto">
            <Link href={`/admin/clients/${booking.client.id}`}>Client <ExternalLink className="ml-1.5 h-3.5 w-3.5" /></Link>
          </Button>
        )}
        {action}
      </div>
    </li>
  );
}

export function NotificationHistoryTable({ notifications }: { notifications: NotificationWithTeacher[] }) {
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Historique des notifications</CardTitle></CardHeader>
      <CardContent className="space-y-3 p-4 md:hidden">
        {notifications.map((notification) => (
          <div key={notification.id} className="rounded-3xl border border-violet-100 bg-white p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-start gap-3">
                {(notification.teacher || notification.booking?.teacher) && (
                  <ProfessorImage
                    photoUrl={(notification.teacher ?? notification.booking?.teacher)?.photoUrl ?? null}
                    name={(notification.teacher ?? notification.booking?.teacher)?.professionalName || (notification.teacher ?? notification.booking?.teacher)?.fullName || notification.recipientName || "Professeur"}
                    size="sm"
                    shape="circle"
                    verified={Boolean((notification.teacher ?? notification.booking?.teacher)?.badgeVerified)}
                  />
                )}
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-foreground">{notification.title}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{(notification.teacher ?? notification.booking?.teacher) ? ((notification.teacher ?? notification.booking?.teacher)?.professionalName || (notification.teacher ?? notification.booking?.teacher)?.fullName) : (notification.recipientName || notificationRecipientLabel(notification.recipientType))} · {notificationChannelLabel(notification.channel)}</p>
                  {notification.booking && (
                    <p className="mt-1 text-xs font-semibold text-violet-800">{notification.booking.reference} · {notification.booking.subjectName}</p>
                  )}
                </div>
              </div>
              <NotificationPriorityBadge priority={notification.priority} />
            </div>
            <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{notification.message}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <NotificationStatusBadge status={notification.status} />
              <Badge variant="outline">{notificationTypeLabel(notification.type)}</Badge>
            </div>
            <div className="mt-3 grid gap-2 text-xs text-muted-foreground">
              <span>Créée: {formatDateTime(notification.createdAt)}</span>
              <span>Envoyée: {notification.sentAt ? formatDateTime(notification.sentAt) : "—"}</span>
              <span>Lue: {notification.readAt ? formatDateTime(notification.readAt) : "—"}</span>
            </div>
            {notificationAction(notification) && (
              <Button asChild size="sm" variant="outline" className="mt-3 w-full rounded-2xl">
                <Link href={notificationAction(notification)!.href}>
                  {notificationAction(notification)!.label}
                  <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
                </Link>
              </Button>
            )}
          </div>
        ))}
      </CardContent>
      <CardContent className="hidden p-0 overflow-x-auto md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Titre</TableHead>
              <TableHead>Destinataire</TableHead>
              <TableHead>Canal</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead>Priorité</TableHead>
              <TableHead>Créée</TableHead>
              <TableHead>Envoyée</TableHead>
              <TableHead>Lue</TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {notifications.map((notification) => (
              <TableRow key={notification.id}>
                <TableCell className="max-w-xs truncate font-medium">{notification.title}</TableCell>
                <TableCell>
                  {(notification.teacher || notification.booking?.teacher) ? (
                    <div className="flex min-w-0 items-center gap-2">
                      <ProfessorImage
                        photoUrl={(notification.teacher ?? notification.booking?.teacher)?.photoUrl ?? null}
                        name={(notification.teacher ?? notification.booking?.teacher)?.professionalName || (notification.teacher ?? notification.booking?.teacher)?.fullName || notification.recipientName || "Professeur"}
                        size="sm"
                        shape="circle"
                        verified={Boolean((notification.teacher ?? notification.booking?.teacher)?.badgeVerified)}
                      />
                      <span className="truncate">{(notification.teacher ?? notification.booking?.teacher)?.professionalName || (notification.teacher ?? notification.booking?.teacher)?.fullName}</span>
                    </div>
                  ) : (
                    notification.recipientName || notificationRecipientLabel(notification.recipientType)
                  )}
                  {notification.booking && (
                    <p className="mt-1 text-[11px] text-muted-foreground">{notification.booking.reference} · {notification.booking.subjectName}</p>
                  )}
                </TableCell>
                <TableCell>{notificationChannelLabel(notification.channel)}</TableCell>
                <TableCell><NotificationStatusBadge status={notification.status} /></TableCell>
                <TableCell><NotificationPriorityBadge priority={notification.priority} /></TableCell>
                <TableCell className="text-sm text-muted-foreground">{formatDateTime(notification.createdAt)}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{notification.sentAt ? formatDateTime(notification.sentAt) : "—"}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{notification.readAt ? formatDateTime(notification.readAt) : "—"}</TableCell>
                <TableCell className="text-right">
                  {notificationAction(notification) ? (
                    <Button asChild size="sm" variant="outline">
                      <Link href={notificationAction(notification)!.href}>
                        {notificationAction(notification)!.label}
                        <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
                      </Link>
                    </Button>
                  ) : (
                    <span className="text-sm text-muted-foreground">—</span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

export function AdminUrgentAlertCard({ title, description, count }: { title: string; description: string; count: number }) {
  return (
    <div className={cn("rounded-3xl border p-4", count ? "border-red-100 bg-red-50/80 text-red-800" : "border-violet-100 bg-white text-foreground")}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold">{title}</p>
          <p className="mt-1 text-sm opacity-80">{description}</p>
        </div>
        <NotificationBadge count={count} />
      </div>
    </div>
  );
}
