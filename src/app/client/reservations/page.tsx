import Link from "next/link";
import { BookingStatus, PaymentStatus } from "@prisma/client";
import { ArrowRight, CheckCircle2, Search } from "lucide-react";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/session";
import { formatDate, formatFCFA } from "@/lib/format";
import { hasVerifiedPayDunyaClientPayment } from "@/lib/payment-security";
import {
  CLIENT_RESERVATION_PAGE_SIZE,
  getClientReservationIndex,
  type ClientReservationTab,
} from "@/lib/client-reservation-index";
import { ClientPageHeader, ClientSurface, ClientTabBar } from "@/components/shared/client-page-primitives";
import { Button } from "@/components/ui/button";
import { ReservationListClient, type ClientReservationListItem } from "./reservation-list-client";

export const dynamic = "force-dynamic";

const TABS: Array<{ id: ClientReservationTab; label: string }> = [
  { id: "all", label: "Toutes" },
  { id: "actions", label: "À faire" },
  { id: "history", label: "Historique" },
];

function reservationTab(value?: string): ClientReservationTab {
  if (value === "actions" || value === "brouillons" || value === "aconfirmer") return "actions";
  if (value === "history" || value === "terminees" || value === "annulees") return "history";
  return "all";
}

function reservationHref(tab: ClientReservationTab, page: number, search: string) {
  const params = new URLSearchParams({ tab });
  if (page > 1) params.set("page", String(page));
  if (search) params.set("q", search);
  return `/client/reservations?${params.toString()}#dossiers`;
}

export default async function ReservationsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; page?: string; q?: string; draftDeleted?: string }>;
}) {
  const user = await getSessionUser();
  if (!user) return null;
  const sp = await searchParams;
  const tab = reservationTab(sp.tab);
  const requestedPage = Number(sp.page ?? 1);
  const index = await getClientReservationIndex({
    clientId: user.id,
    tab,
    page: Number.isFinite(requestedPage) ? requestedPage : 1,
    search: sp.q ?? "",
  });
  const ids = [...new Set([...index.ids, index.priorityId].filter((id): id is string => Boolean(id)))];
  const bookingRows = ids.length ? await db.booking.findMany({
    where: { id: { in: ids }, clientId: user.id },
    include: {
      teacher: {
        select: {
          fullName: true, professionalName: true, photoUrl: true,
          badgeVerified: true,
        },
      },
      transactions: {
        where: { type: "CLIENT_PAYMENT" },
        select: { type: true, status: true, amount: true },
      },
    },
  }) : [];
  const byId = new Map(bookingRows.map((booking) => [booking.id, booking]));
  const bookings = index.ids.flatMap((id) => {
    const booking = byId.get(id);
    return booking ? [booking] : [];
  });
  const priorityBooking = index.priorityId ? byId.get(index.priorityId) : null;
  const priorityIsPaid = priorityBooking ? hasVerifiedPayDunyaClientPayment(priorityBooking) : false;
  const priorityIsAction = Boolean(priorityBooking && (
    (priorityBooking.status === "PENDING_PAYMENT" && !priorityIsPaid)
    || (priorityBooking.status === "PENDING_CLIENT_VALIDATION" && priorityIsPaid)
    || (priorityBooking.paymentStatus === "FAILED" && !["CANCELLED", "REFUNDED", "DISPUTED"].includes(priorityBooking.status))
  ));

  const reservationItems: ClientReservationListItem[] = bookings.map((booking) => {
    const paid = hasVerifiedPayDunyaClientPayment(booking);
    return {
      id: booking.id,
      reference: booking.reference,
      subjectName: booking.subjectName,
      levelName: booking.levelName,
      teacher: booking.teacher,
      amountLabel: booking.isQuoteOnly
        ? "Montant à recalculer"
        : formatFCFA(booking.totalClientPays || booking.totalPrice),
      dateLabel: booking.scheduledDate
        ? formatDate(booking.scheduledDate)
        : booking.startDate ? `${formatDate(booking.startDate)} demandée` : "Date à confirmer",
      timeLabel: booking.scheduledTime || booking.preferredTime || "Créneau à confirmer",
      stepLabel: getClientReservationStep(booking.status, booking.paymentStatus, paid),
      actionKind: getReservationActionKind(booking.status, booking.paymentStatus, paid),
    };
  });

  const totalPages = Math.max(1, Math.ceil(index.filteredCount / CLIENT_RESERVATION_PAGE_SIZE));
  return (
    <div className="space-y-5">
      <ClientPageHeader
        eyebrow="Vos cours"
        title="Réservations"
        description="Retrouvez vos cours et les actions à faire."
        showBack={false}
      />

      {sp.draftDeleted === "1" && (
        <ClientSurface compact className="border border-emerald-200 bg-emerald-50 p-3 text-emerald-950" data-client-draft-deleted-state>
          <div className="flex items-start gap-2" role="status" aria-live="polite">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
            <p className="text-sm font-medium">Brouillon supprimé. Aucun cours n'a été réservé et aucun professeur n'a été notifié.</p>
          </div>
        </ClientSurface>
      )}

      {priorityIsAction && priorityBooking && (
        <ClientSurface compact className="flex flex-wrap items-center justify-between gap-3 border border-[#DDE3EE] p-4" data-client-reservation-priority>
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-wide text-[#52627A]">À faire maintenant</p>
            <p className="mt-1 text-base font-semibold text-[#111827]">
              {priorityBooking.status === "PENDING_CLIENT_VALIDATION" ? "Confirmer votre cours" : "Reprendre votre dossier"}
            </p>
            <p className="mt-1 text-xs font-medium text-[#64748B]">{priorityBooking.subjectName} · {priorityBooking.reference}</p>
          </div>
          <Button asChild className="min-h-11 rounded-lg bg-[#111B4D] text-white hover:bg-[#1E2A78]">
            <Link href={`/client/reservations/${priorityBooking.id}`}>
              Ouvrir <ArrowRight className="ml-1 h-4 w-4" aria-hidden />
            </Link>
          </Button>
        </ClientSurface>
      )}

      <ClientTabBar
        activeId={tab}
        items={TABS.map((item) => ({
          id: item.id,
          label: item.label,
          count: item.id === "actions" ? index.actionCount : item.id === "history" ? index.historyCount : index.allCount,
          href: reservationHref(item.id, 1, index.search),
        }))}
      />

      <details className="rounded-lg border border-[#DDE3EE] bg-white p-3" open={Boolean(index.search)} data-client-reservation-search-panel>
        <summary className="flex min-h-9 cursor-pointer items-center gap-2 text-sm font-semibold text-[#111B4D]">
          <Search className="h-4 w-4" aria-hidden /> Rechercher un dossier
        </summary>
        <form action="/client/reservations" method="get" className="mt-3 flex flex-wrap gap-2">
          <input type="hidden" name="tab" value={tab} />
          <input
            name="q"
            type="search"
            maxLength={100}
            defaultValue={index.search}
            placeholder="Référence, matière, professeur"
            aria-label="Rechercher dans toutes vos réservations"
            className="min-h-11 min-w-[14rem] flex-1 rounded-lg border border-[#D8DEE9] bg-white px-3 text-sm text-[#111827]"
          />
          <Button type="submit" className="min-h-11 rounded-lg bg-[#111B4D] text-white hover:bg-[#1E2A78]">Rechercher</Button>
          {index.search && <Button asChild variant="outline" className="min-h-11"><Link href={reservationHref(tab, 1, "")}>Effacer</Link></Button>}
        </form>
      </details>

      <section id="dossiers" aria-label="Liste des réservations" className="space-y-3">
        <p className="text-sm font-semibold text-[#52627A]">
          {index.filteredCount} dossier{index.filteredCount > 1 ? "s" : ""}
          {index.search ? ` trouvé${index.filteredCount > 1 ? "s" : ""}` : ""}
        </p>
        <ReservationListClient reservations={reservationItems} hasSearch={Boolean(index.search)} />
      </section>

      {index.filteredCount > CLIENT_RESERVATION_PAGE_SIZE && (
        <nav aria-label="Pages des réservations" className="flex items-center justify-between gap-3 text-sm font-semibold">
          {index.page > 1
            ? <Link href={reservationHref(tab, index.page - 1, index.search)} className="rounded-lg border border-[#D8DEE9] bg-white px-4 py-3 text-[#111B4D]">Précédent</Link>
            : <span />}
          <span className="text-[#52627A]">{index.page} / {totalPages}</span>
          {index.page < totalPages
            ? <Link href={reservationHref(tab, index.page + 1, index.search)} className="rounded-lg border border-[#D8DEE9] bg-white px-4 py-3 text-[#111B4D]">Suivant</Link>
            : <span />}
        </nav>
      )}
    </div>
  );
}

function getReservationActionKind(
  status: BookingStatus,
  paymentStatus: PaymentStatus,
  paymentVerified: boolean,
): ClientReservationListItem["actionKind"] {
  if (status === "PENDING_PAYMENT" && !paymentVerified) return "action";
  if (status === "PENDING_CLIENT_VALIDATION" && paymentVerified) return "action";
  if (["CANCELLED", "REFUNDED", "DISPUTED"].includes(status)) return "issue";
  if (paymentStatus === "FAILED") return "action";
  if (["VALIDATED_BY_CLIENT", "TEACHER_PAID"].includes(status)) return "closed";
  return paymentVerified ? "secured" : "all";
}

function getClientReservationStep(status: BookingStatus, paymentStatus: PaymentStatus, verified: boolean) {
  if (status === "PENDING_PAYMENT" && !verified) return "Brouillon non réservé";
  if (["CANCELLED", "REFUNDED", "DISPUTED"].includes(status)) return "Suivi service client";
  if (paymentStatus === "FAILED") return "Paiement à reprendre";
  if (!verified) return "Paiement en vérification";
  if (status === "PENDING_CLIENT_VALIDATION") return "Votre confirmation attendue";
  if (["VALIDATED_BY_CLIENT", "TEACHER_PAID"].includes(status)) return "Cours terminé";
  if (paymentStatus === "BLOCKED") return "Paiement sécurisé";
  return "Cours en suivi";
}
