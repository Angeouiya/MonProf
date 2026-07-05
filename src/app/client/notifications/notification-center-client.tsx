"use client";

import Link from "next/link";
import type { PaymentStatus } from "@prisma/client";
import { useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  Bell,
  CheckCircle2,
  ExternalLink,
  Filter,
  Search,
  ShieldCheck,
  X,
} from "lucide-react";
import { EmptyState } from "@/components/shared/page-header";
import { ClientRecordCard, ClientSurface } from "@/components/shared/client-page-primitives";
import { ProfessorImage } from "@/components/shared/professor-image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatDate, formatDateTime, timeAgo } from "@/lib/format";
import { notificationChannelLabel, notificationTypeLabel, priorityLabel } from "@/lib/platform-labels";
import { ClientNotificationActions } from "./actions-client";

type ClientNotification = {
  id: string;
  title: string;
  message: string;
  type: string;
  channel: string;
  status: string;
  priority: string;
  read: boolean;
  link: string | null;
  actionLabel: string | null;
  bookingId: string | null;
  createdAt: string;
  sentAt: string | null;
  readAt: string | null;
  confirmedAt: string | null;
};

type NotificationBooking = {
  id: string;
  reference: string;
  subjectName: string;
  levelName: string;
  startDate: string | null;
  scheduledDate: string | null;
  scheduledTime: string | null;
  preferredTime: string | null;
  paymentStatus: PaymentStatus;
  teacher: {
    id: string;
    fullName: string;
    professionalName: string | null;
    photoUrl: string | null;
    badgeVerified: boolean;
  };
};

type FilterKey = "all" | "unread" | "urgent" | "booking" | "payment" | "teacher" | "dispute";

const filterOptions: { key: FilterKey; label: string }[] = [
  { key: "all", label: "Toutes" },
  { key: "unread", label: "Non lues" },
  { key: "urgent", label: "Urgentes" },
  { key: "booking", label: "Réservations" },
  { key: "payment", label: "Paiements" },
  { key: "teacher", label: "Professeur" },
  { key: "dispute", label: "Litiges" },
];

const statusLabel: Record<string, string> = {
  CREATED: "Créée",
  SENT: "Envoyée",
  FAILED: "Échouée",
  SEEN: "Vue",
  CONFIRMED: "Confirmée",
  EXPIRED: "Expirée",
  RELAUNCHED: "Relancée",
};

const clientPaymentStatusLabel: Record<string, string> = {
  FAILED: "Paiement à finaliser",
  RECEIVED: "Paiement reçu",
  BLOCKED: "Paiement sécurisé",
  VALIDATED: "Cours validé",
  TO_PAY_TEACHER: "Traitement administratif",
  TEACHER_PAID: "Cours clôturé",
  DISPUTED: "Litige en cours",
  REFUND_PENDING: "Remboursement en traitement",
  PARTIAL_REFUND_PENDING: "Remboursement partiel en traitement",
  REFUNDED: "Remboursé",
  PARTIALLY_REFUNDED: "Remboursement partiel",
  RETAINED: "Frais appliqués",
};

const paymentTypes = new Set(["PAYMENT_PENDING", "PAYMENT_RECEIVED", "BLOCKED_FUNDS", "FUNDS_BLOCKED", "PAYMENT_TO_RELEASE", "REFUND"]);
const teacherTypes = new Set(["TEACHER_ASSIGNED", "TEACHER_REPLACED", "REPLACEMENT"]);
const bookingTypes = new Set(["NEW_BOOKING", "BOOKING_CONFIRMED", "REMINDER", "COURSE_CONFIRMATION"]);
const disputeTypes = new Set(["DISPUTE", "DISPUTE_OPENED"]);

export function ClientNotificationCenter({
  notifications,
  bookings,
}: {
  notifications: ClientNotification[];
  bookings: NotificationBooking[];
}) {
  const [filter, setFilter] = useState<FilterKey>("all");
  const [query, setQuery] = useState("");
  const bookingsById = useMemo(() => new Map(bookings.map((booking) => [booking.id, booking])), [bookings]);
  const counts = useMemo(() => {
    const unread = notifications.filter((notification) => !notification.read).length;
    const urgent = notifications.filter((notification) => ["URGENT", "CRITICAL"].includes(notification.priority) && !notification.read).length;
    const payments = notifications.filter((notification) => paymentTypes.has(notification.type)).length;
    const teachers = notifications.filter((notification) => teacherTypes.has(notification.type)).length;
    const booking = notifications.filter((notification) => Boolean(notification.bookingId) || bookingTypes.has(notification.type)).length;
    const dispute = notifications.filter((notification) => disputeTypes.has(notification.type)).length;
    return { unread, urgent, payments, teachers, booking, dispute };
  }, [notifications]);
  const filterCounts: Record<FilterKey, number> = {
    all: notifications.length,
    unread: counts.unread,
    urgent: counts.urgent,
    booking: counts.booking,
    payment: counts.payments,
    teacher: counts.teachers,
    dispute: counts.dispute,
  };
  const priorityNotification = useMemo(() => {
    return (
      notifications.find((notification) => !notification.read && ["CRITICAL", "URGENT"].includes(notification.priority)) ??
      notifications.find((notification) => !notification.read) ??
      notifications[0] ??
      null
    );
  }, [notifications]);
  const filteredNotifications = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return notifications.filter((notification) => {
      const booking = notification.bookingId ? bookingsById.get(notification.bookingId) ?? null : null;
      const teacherName = booking?.teacher.professionalName || booking?.teacher.fullName || "";
      const searchable = [
        notification.title,
        notification.message,
        notification.type,
        notification.priority,
        notification.status,
        booking?.reference,
        booking?.subjectName,
        booking?.levelName,
        teacherName,
      ].filter(Boolean).join(" ").toLowerCase();

      const matchesQuery = !normalizedQuery || searchable.includes(normalizedQuery);
      const matchesFilter =
        filter === "all" ||
        (filter === "unread" && !notification.read) ||
        (filter === "urgent" && ["URGENT", "CRITICAL"].includes(notification.priority)) ||
        (filter === "booking" && (Boolean(notification.bookingId) || bookingTypes.has(notification.type))) ||
        (filter === "payment" && paymentTypes.has(notification.type)) ||
        (filter === "teacher" && teacherTypes.has(notification.type)) ||
        (filter === "dispute" && disputeTypes.has(notification.type));

      return matchesQuery && matchesFilter;
    });
  }, [bookingsById, filter, notifications, query]);
  const activeFilterLabel = filterOptions.find((option) => option.key === filter)?.label ?? "Toutes";
  const hasQuery = query.trim().length > 0;

  return (
    <div className="space-y-4">
      <PriorityNotificationCard
        notification={priorityNotification}
        booking={priorityNotification?.bookingId ? bookingsById.get(priorityNotification.bookingId) ?? null : null}
      />

      <ClientSurface compact className="space-y-3">
          <div className="grid gap-3 lg:grid-cols-[minmax(220px,1fr)_auto] lg:items-center">
            <label className="relative block">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#64748B]" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Rechercher une réservation, un professeur, un paiement..."
                className="h-11 rounded-2xl border-[#E3E8F2] pl-9 pr-10 focus:border-[#9AAAD0] focus:ring-[#DDE6F7]"
              />
              {hasQuery && (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-xl text-[#64748B] transition hover:bg-white hover:text-[#111B4D] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9AAAD0]"
                  aria-label="Effacer la recherche"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </label>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-[#64748B]">
              <Filter className="h-4 w-4" />
              {activeFilterLabel} · {formatCount(filteredNotifications.length, "résultat")}
            </div>
          </div>
          <div className="grid grid-cols-1 gap-2 min-[360px]:grid-cols-2 min-[520px]:grid-cols-3 lg:flex lg:flex-wrap">
            {filterOptions.map((option) => (
              <Button
                key={option.key}
                type="button"
                size="sm"
                variant={filter === option.key ? "default" : "outline"}
                onClick={() => setFilter(option.key)}
                aria-pressed={filter === option.key}
                className="min-h-10 w-full justify-center rounded-xl px-2 text-xs min-[420px]:px-3 sm:min-h-11 sm:text-sm lg:w-auto"
              >
                <span className="min-w-0 truncate">{option.label}</span>
                <span className={filter === option.key ? "shrink-0 rounded-md bg-white px-1.5 py-0.5 text-xs text-[#111B4D]" : "shrink-0 rounded-md border border-[#E3E8F2] bg-white px-1.5 py-0.5 text-xs text-[#64748B]"}>
                  {filterCounts[option.key]}
                </span>
              </Button>
            ))}
          </div>
      </ClientSurface>

      {notifications.length === 0 ? (
        <EmptyState
          icon={Bell}
          title="Aucune notification"
          description="Votre centre est calme. Les validations, paiements, confirmations de cours et messages du support apparaîtront ici."
          action={
            <Button asChild size="sm" className="min-h-11 rounded-2xl">
              <Link href="/client/rechercher">Trouver un professeur <ArrowRight className="h-4 w-4" /></Link>
            </Button>
          }
        />
      ) : filteredNotifications.length === 0 ? (
        <EmptyState icon={Search} title="Aucun résultat" description="Essayez un autre filtre ou une autre recherche." />
      ) : (
        <div className="space-y-2.5">
          {filteredNotifications.map((notification) => {
            const booking = notification.bookingId ? bookingsById.get(notification.bookingId) ?? null : null;
            const teacherName = booking?.teacher.professionalName || booking?.teacher.fullName || "Professeur Compétence";
            const href = notification.link || (booking ? `/client/reservations/${booking.id}` : null);
            const actionLabel = notification.actionLabel || (booking ? "Voir réservation" : "Ouvrir");
            const showPriorityLabel = ["URGENT", "CRITICAL", "IMPORTANT"].includes(notification.priority);
            return (
              <ClientRecordCard
                key={notification.id}
                data-client-notification-card
                className={`overflow-hidden rounded-xl ${
                  notification.read
                    ? "border-[#E3E8F2] bg-white"
                    : "border-[#111B4D] bg-white"
                }`}
              >
                <div className="relative flex flex-col gap-3 p-3 sm:flex-row sm:items-start sm:justify-between sm:p-4">
                  {!notification.read && <span className="absolute inset-y-3 left-0 w-1 rounded-r-full bg-[#111B4D] sm:inset-y-4" />}
                  <div className="flex min-w-0 gap-3">
                    {booking ? (
                      <ProfessorImage
                        photoUrl={booking.teacher.photoUrl}
                        name={teacherName}
                        size={44}
                        shape="circle"
                        verified={booking.teacher.badgeVerified}
                      />
                    ) : (
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[#DDE6F7] bg-white text-[#111B4D]">
                        <Bell className="h-5 w-5" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        {!notification.read && <span className="h-2.5 w-2.5 rounded-full bg-[#111B4D]" aria-label="Notification non lue" />}
                        <h2 className="min-w-0 text-sm font-semibold leading-5 text-[#111827]">{notification.title}</h2>
                        {!notification.read && <span className="text-xs font-semibold text-[#111B4D]">Nouveau</span>}
                        {showPriorityLabel && <span className="text-xs font-semibold text-[#111B4D]">{priorityLabel(notification.priority)}</span>}
                      </div>
                      <p className="mt-1 text-xs font-semibold leading-5 text-[#64748B]">
                        {notificationTypeLabel(notification.type)} · {notificationChannelLabel(notification.channel)} · {statusLabel[notification.status] ?? notification.status}
                      </p>
                      <p className="mt-2 line-clamp-2 whitespace-pre-line text-sm leading-5 text-[#475569] sm:line-clamp-4 sm:leading-6">{notification.message}</p>
                      {booking && <BookingNotificationPreview booking={booking} teacherName={teacherName} />}
                      <p className="mt-2 line-clamp-1 text-xs font-medium text-[#64748B]">
                        {formatDateTime(notification.createdAt)} · {timeAgo(notification.createdAt)}
                        {notification.readAt ? ` · lu le ${formatDateTime(notification.readAt)}` : ""}
                        {notification.confirmedAt ? ` · confirmé le ${formatDateTime(notification.confirmedAt)}` : ""}
                      </p>
                    </div>
                  </div>

                  <div className="grid shrink-0 grid-cols-1 gap-2 min-[430px]:grid-cols-2 sm:flex sm:min-w-44 sm:flex-col">
                    {href && (
                      <Button asChild variant={notification.read ? "outline" : "default"} size="sm" className="min-h-10 w-full rounded-xl sm:min-h-11 sm:rounded-2xl">
                        <Link href={href}>{actionLabel} <ExternalLink className="ml-1.5 h-3.5 w-3.5" /></Link>
                      </Button>
                    )}
                    <ClientNotificationActions mode="row" id={notification.id} read={notification.read} status={notification.status} />
                  </div>
                </div>
              </ClientRecordCard>
            );
          })}
        </div>
      )}
    </div>
  );
}

function PriorityNotificationCard({
  notification,
  booking,
}: {
  notification: ClientNotification | null;
  booking: NotificationBooking | null;
}) {
  if (!notification) {
    return (
      <div className="rounded-xl border border-[#E3E8F2] bg-white p-4">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white text-[#111B4D] ring-1 ring-[#DDE6F7]">
            <CheckCircle2 className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-semibold text-[#111827]">Tout est à jour</p>
            <p className="mt-1 text-sm leading-6 text-[#64748B]">
              Vous n'avez aucune notification active. Les confirmations, paiements et messages importants apparaîtront ici.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const urgent = ["URGENT", "CRITICAL"].includes(notification.priority);
  const teacherName = booking?.teacher.professionalName || booking?.teacher.fullName || "Professeur Compétence";
  const href = notification.link || (booking ? `/client/reservations/${booking.id}` : null);

  return (
    <div className={`overflow-hidden rounded-xl border p-3 sm:p-4 ${
      urgent ? "border-[#111B4D] bg-white" : "border-[#DDE6F7] bg-white"
    }`}>
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
        <div className="flex min-w-0 gap-3">
          <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${
            urgent ? "bg-[#111B4D] text-white" : "bg-[#111B4D] text-white"
          }`}>
            {urgent ? <AlertTriangle className="h-5 w-5" /> : <Bell className="h-5 w-5" />}
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-[#64748B]">
              {urgent ? "À traiter en priorité" : notification.read ? "Dernière information" : "Nouvelle information"}
            </p>
            <h2 className="mt-1 line-clamp-2 text-base font-semibold tracking-tight text-[#111827] sm:text-lg">{notification.title}</h2>
            <p className="mt-1 line-clamp-2 text-sm leading-5 text-[#64748B] sm:leading-6">{notification.message}</p>
            <div className="mt-2 flex flex-col gap-1 text-xs font-semibold text-[#111B4D] min-[520px]:flex-row min-[520px]:items-center min-[520px]:gap-3">
              <span>Priorité : {priorityLabel(notification.priority)}</span>
              <span>Type : {notificationTypeLabel(notification.type)}</span>
              {booking && <span>Réservation : {booking.reference} - {teacherName}</span>}
            </div>
          </div>
        </div>
        <div className="flex flex-col gap-2 lg:min-w-56">
          {href && (
            <Button asChild size="sm" className="h-11 rounded-2xl">
              <Link href={href}>
                {notification.actionLabel || "Ouvrir le dossier"}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          )}
          <p className="line-clamp-1 text-xs font-semibold leading-5 text-[#64748B] lg:text-right">
            {formatDateTime(notification.createdAt)} · {timeAgo(notification.createdAt)}
          </p>
        </div>
      </div>
    </div>
  );
}

function BookingNotificationPreview({ booking, teacherName }: { booking: NotificationBooking; teacherName: string }) {
  const dateLabel = booking.scheduledDate
    ? formatDate(booking.scheduledDate)
    : booking.startDate
      ? `${formatDate(booking.startDate)} (souhaitée)`
      : null;
  const timeLabel = booking.scheduledTime || booking.preferredTime || "Créneau à confirmer";

  return (
    <div className="mt-2 rounded-xl border border-[#E3E8F2] bg-white p-2.5 sm:mt-3 sm:p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#64748B]">{booking.reference}</p>
          <p className="mt-1 text-sm font-semibold text-[#111827]">{booking.subjectName} · {booking.levelName}</p>
        </div>
        <p className="shrink-0 text-xs font-semibold text-[#111B4D]">{formatClientPaymentStatus(booking.paymentStatus)}</p>
      </div>
      <div className="mt-2 grid gap-2 text-xs font-semibold text-[#475569] min-[420px]:grid-cols-2">
        <p className="line-clamp-1 rounded-xl border border-[#E3E8F2] bg-white px-3 py-1.5">{teacherName}</p>
        <p className="line-clamp-1 rounded-xl border border-[#E3E8F2] bg-white px-3 py-1.5">{dateLabel ? `${dateLabel} · ${timeLabel}` : timeLabel}</p>
      </div>
      {booking.teacher.badgeVerified && (
        <p className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-[#111B4D]">
          <ShieldCheck className="h-3.5 w-3.5" />
          Professeur vérifié
        </p>
      )}
    </div>
  );
}

function formatCount(count: number, singular: string, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}

function formatClientPaymentStatus(status: string) {
  return clientPaymentStatusLabel[status] ?? "Suivi paiement";
}
