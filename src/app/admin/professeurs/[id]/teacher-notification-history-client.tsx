"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Bell, CheckCircle2, ClipboardCopy, ExternalLink, Eye, Loader2, MessageCircle, PhoneCall, Send, XCircle, type LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateTime, timeAgo } from "@/lib/format";
import { buildWhatsAppUrl } from "@/lib/phone";

type TeacherNotificationHistoryItem = {
  id: string;
  bookingId?: string | null;
  title: string;
  message: string;
  channel: string;
  sent: boolean;
  status: string;
  readAt?: string | null;
  createdAt: string;
};

function statusClass(status: string) {
  if (status === "FAILED") return "border-red-200 bg-red-50 text-red-700";
  if (status === "READ" || status === "CONFIRMED") return "border-blue-200 bg-blue-50 text-blue-700";
  if (status === "PENDING" || status === "DRAFT") return "border-amber-200 bg-amber-50 text-amber-800";
  return "border-violet-200 bg-violet-50 text-violet-800";
}

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    DRAFT: "Brouillon",
    PENDING: "En attente",
    SENT: "Envoyée",
    FAILED: "Échec",
    READ: "Lue",
    CONFIRMED: "Confirmée",
  };
  return labels[status] ?? status;
}

function channelClass(channel: string) {
  if (channel === "WHATSAPP") return "border-blue-200 bg-blue-50 text-blue-800";
  if (channel === "SMS") return "border-violet-200 bg-violet-50 text-violet-800";
  if (channel === "EMAIL") return "border-amber-200 bg-amber-50 text-amber-800";
  if (channel === "MANUAL_CALL") return "border-slate-200 bg-slate-50 text-slate-700";
  return "border-violet-100 bg-white text-violet-800";
}

export function TeacherNotificationHistoryClient({
  teacherName,
  teacherPhone,
  notifications,
}: {
  teacherName: string;
  teacherPhone?: string | null;
  notifications: TeacherNotificationHistoryItem[];
}) {
  const router = useRouter();
  const [expandedId, setExpandedId] = useState<string | null>(notifications[0]?.id ?? null);
  const [loadingStatus, setLoadingStatus] = useState<string | null>(null);

  const copyMessage = async (message: string) => {
    await navigator.clipboard.writeText(message);
    toast.success("Message professeur copié.");
  };

  const updateStatus = async (notificationId: string, status: string) => {
    setLoadingStatus(`${notificationId}:${status}`);
    try {
      const res = await fetch("/api/admin/teacher-notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: notificationId, status }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Mise à jour impossible.");
      toast.success(`Notification marquée : ${statusLabel(status)}.`);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Mise à jour impossible.");
    } finally {
      setLoadingStatus(null);
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <CardTitle className="text-base">Notifications envoyées au professeur</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            Historique exploitable pour copier, relancer et retrouver la réservation liée.
          </p>
        </div>
        <Badge variant="outline" className="w-fit border-blue-200 bg-blue-50 text-blue-800">
          <Bell className="mr-1.5 h-3.5 w-3.5" />
          {notifications.length} message(s)
        </Badge>
      </CardHeader>
      <CardContent className="space-y-3">
        {notifications.length === 0 ? (
          <p className="rounded-3xl border border-dashed border-violet-100 p-4 text-sm text-muted-foreground">
            Aucune notification envoyée.
          </p>
        ) : (
          notifications.map((notification) => {
            const expanded = expandedId === notification.id;
            const whatsAppUrl = buildWhatsAppUrl(teacherPhone, notification.message);
            return (
              <div key={notification.id} className="rounded-3xl border border-violet-100 bg-white/92 p-4 shadow-sm">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-bold text-foreground">{notification.title}</p>
                      <Badge variant="outline" className={channelClass(notification.channel)}>{notification.channel}</Badge>
                      <Badge variant="outline" className={statusClass(notification.status)}>{statusLabel(notification.status)}</Badge>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {formatDateTime(notification.createdAt)} • {timeAgo(notification.createdAt)}
                      {notification.readAt ? ` • lu le ${formatDateTime(notification.readAt)}` : ""}
                    </p>
                    <p className={`${expanded ? "whitespace-pre-line" : "line-clamp-2"} mt-3 rounded-2xl border border-violet-100 bg-violet-50/35 p-3 text-sm text-foreground`}>
                      {notification.message}
                    </p>
                  </div>

                  <div className="flex shrink-0 flex-wrap gap-2 lg:justify-end">
                    <Button type="button" size="sm" variant="outline" onClick={() => copyMessage(notification.message)}>
                      <ClipboardCopy className="mr-1.5 h-3.5 w-3.5" />
                      Copier
                    </Button>
                    <Button type="button" size="sm" variant="outline" disabled={!whatsAppUrl} asChild={Boolean(whatsAppUrl)}>
                      {whatsAppUrl ? (
                        <a href={whatsAppUrl} target="_blank" rel="noreferrer">
                          <MessageCircle className="mr-1.5 h-3.5 w-3.5" />
                          WhatsApp
                        </a>
                      ) : (
                        <span className="inline-flex items-center">
                          <PhoneCall className="mr-1.5 h-3.5 w-3.5" />
                          Téléphone absent
                        </span>
                      )}
                    </Button>
                    {notification.bookingId && (
                      <Button asChild size="sm" variant="outline">
                        <Link href={`/admin/reservations/${notification.bookingId}`}>
                          Réservation <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
                        </Link>
                      </Button>
                    )}
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => setExpandedId(expanded ? null : notification.id)}
                    >
                      {expanded ? "Réduire" : "Lire"}
                    </Button>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2 rounded-2xl border border-violet-100 bg-violet-50/35 p-2">
                  <StatusActionButton
                    notificationId={notification.id}
                    status="SENT"
                    label="Envoyée"
                    icon={Send}
                    loadingStatus={loadingStatus}
                    disabled={notification.status === "SENT"}
                    onClick={updateStatus}
                  />
                  <StatusActionButton
                    notificationId={notification.id}
                    status="READ"
                    label="Lue"
                    icon={Eye}
                    loadingStatus={loadingStatus}
                    disabled={notification.status === "READ"}
                    onClick={updateStatus}
                  />
                  <StatusActionButton
                    notificationId={notification.id}
                    status="CONFIRMED"
                    label="Confirmée"
                    icon={CheckCircle2}
                    loadingStatus={loadingStatus}
                    disabled={notification.status === "CONFIRMED"}
                    onClick={updateStatus}
                  />
                  <StatusActionButton
                    notificationId={notification.id}
                    status="FAILED"
                    label="Échec"
                    icon={XCircle}
                    loadingStatus={loadingStatus}
                    disabled={notification.status === "FAILED"}
                    onClick={updateStatus}
                  />
                </div>
              </div>
            );
          })
        )}
        <p className="rounded-2xl border border-violet-100 bg-violet-50/45 p-3 text-xs text-muted-foreground">
          Professeur concerné : {teacherName}. Les canaux externes sont historisés ici et peuvent être raccordés aux intégrations SMS, WhatsApp et email.
        </p>
      </CardContent>
    </Card>
  );
}

function StatusActionButton({
  notificationId,
  status,
  label,
  icon: Icon,
  loadingStatus,
  disabled,
  onClick,
}: {
  notificationId: string;
  status: string;
  label: string;
  icon: LucideIcon;
  loadingStatus: string | null;
  disabled: boolean;
  onClick: (notificationId: string, status: string) => Promise<void>;
}) {
  const loading = loadingStatus === `${notificationId}:${status}`;
  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      disabled={disabled || !!loadingStatus}
      onClick={() => onClick(notificationId, status)}
      className="h-9 rounded-xl bg-white/80"
    >
      {loading ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Icon className="mr-1.5 h-3.5 w-3.5" />}
      {label}
    </Button>
  );
}
