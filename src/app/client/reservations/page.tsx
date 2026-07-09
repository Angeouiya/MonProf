import Link from "next/link";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/session";
import {
  CLIENT_COMMAND_CENTERS_ENABLED,
  ClientInfoPill,
  ClientMetricStrip,
  ClientPageHeader,
  ClientProcessTracker,
  ClientSurface,
  ClientTabBar,
} from "@/components/shared/client-page-primitives";
import { Button } from "@/components/ui/button";
import { formatFCFA, formatDate } from "@/lib/format";
import { AlertTriangle, CalendarCheck, ArrowRight, CheckCircle2, Clock3, Lock, MessageSquare, ShieldCheck, Wallet, Search, WalletCards } from "lucide-react";
import { BookingStatus, PaymentStatus } from "@prisma/client";
import { hasVerifiedPayDunyaClientPayment } from "@/lib/payment-security";
import { ReservationListClient, type ClientReservationListItem } from "./reservation-list-client";

export const dynamic = "force-dynamic";

const TABS: { id: string; label: string; statuses?: BookingStatus[] }[] = [
  { id: "toutes", label: "Toutes" },
  { id: "brouillons", label: "Brouillons", statuses: ["PENDING_PAYMENT"] },
  { id: "encours", label: "En cours", statuses: ["PAID", "PENDING_ADMIN_VALIDATION", "CONFIRMED", "ASSIGNED", "IN_PROGRESS", "PENDING_CLIENT_VALIDATION", "PAYMENT_TO_RELEASE"] },
  { id: "aconfirmer", label: "À confirmer", statuses: ["PENDING_CLIENT_VALIDATION"] },
  { id: "terminees", label: "Terminées", statuses: ["VALIDATED_BY_CLIENT", "TEACHER_PAID"] },
  { id: "annulees", label: "Annulées", statuses: ["CANCELLED", "REFUNDED", "DISPUTED"] },
];

const SECURED_PAYMENT_STATUSES: PaymentStatus[] = ["RECEIVED", "BLOCKED", "VALIDATED", "TO_PAY_TEACHER", "TEACHER_PAID", "REFUND_PENDING", "PARTIAL_REFUND_PENDING", "PARTIALLY_REFUNDED", "REFUNDED", "RETAINED"];

export default async function ReservationsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const user = await getSessionUser();
  if (!user) return null;
  const sp = await searchParams;
  const tabId = sp.tab ?? "toutes";
  const tab = TABS.find((t) => t.id === tabId) ?? TABS[0];

  const bookingInclude = {
    teacher: {
      select: { id: true, fullName: true, professionalName: true, photoUrl: true, jobTitle: true, commune: true, badgeVerified: true },
    },
    transactions: { where: { type: "CLIENT_PAYMENT" as const }, select: { type: true, status: true, amount: true } },
  };
  const allBookings = await db.booking.findMany({
    where: { clientId: user.id },
    orderBy: { createdAt: "desc" },
    include: bookingInclude,
  });
  const bookings = tab.statuses
    ? allBookings.filter((booking) => tab.statuses?.includes(booking.status))
    : allBookings;
  const securedBookings = allBookings.filter(hasVerifiedPayDunyaClientPayment);
  const draftBookings = allBookings.filter((booking) => booking.status === "PENDING_PAYMENT" && !hasVerifiedPayDunyaClientPayment(booking));
  const blockedBookings = allBookings.filter((booking) => booking.paymentStatus === "BLOCKED" && hasVerifiedPayDunyaClientPayment(booking));
  const toConfirmBookings = allBookings.filter((booking) => booking.status === "PENDING_CLIENT_VALIDATION" && hasVerifiedPayDunyaClientPayment(booking));
  const isActiveTab = Boolean(tab.statuses?.some((status) => !["CANCELLED", "REFUNDED", "DISPUTED"].includes(status)));
  const visibleBookings = tab.id === "brouillons"
    ? bookings.filter((booking) => booking.status === "PENDING_PAYMENT" && !hasVerifiedPayDunyaClientPayment(booking))
    : isActiveTab
    ? bookings.filter((booking) => booking.isQuoteOnly || hasVerifiedPayDunyaClientPayment(booking))
    : bookings;
  const securedAmount = securedBookings.reduce((sum, booking) => sum + (booking.totalClientPays || booking.totalPrice), 0);
  const tabCounts = Object.fromEntries(
    TABS.map((item) => [
      item.id,
      item.statuses
        ? allBookings.filter((booking) => (
            item.statuses?.includes(booking.status)
            && (
              booking.isQuoteOnly
              || ["CANCELLED", "REFUNDED", "DISPUTED"].includes(booking.status)
              || hasVerifiedPayDunyaClientPayment(booking)
            )
          )).length
        : allBookings.length,
    ]),
  ) as Record<string, number>;
  const priorityBooking = toConfirmBookings[0]
    ?? allBookings
      .filter((booking) => ["PAID", "PENDING_ADMIN_VALIDATION", "CONFIRMED", "ASSIGNED", "IN_PROGRESS"].includes(booking.status))
      .sort((a, b) => compareDateAsc(a.scheduledDate ?? a.startDate ?? a.createdAt, b.scheduledDate ?? b.startDate ?? b.createdAt))[0]
    ?? allBookings[0]
    ?? null;
  const priorityStep = priorityBooking ? getClientReservationStep(priorityBooking.status, priorityBooking.paymentStatus, hasVerifiedPayDunyaClientPayment(priorityBooking)) : null;
  const priorityTeacherName = priorityBooking ? priorityBooking.teacher.professionalName || priorityBooking.teacher.fullName : "";
  const priorityDate = priorityBooking
    ? priorityBooking.scheduledDate
      ? formatDate(priorityBooking.scheduledDate)
      : priorityBooking.startDate
        ? `${formatDate(priorityBooking.startDate)} demandée`
        : "Date à confirmer"
    : "";
  const priorityAction = priorityBooking
    ? {
        id: priorityBooking.id,
        reference: priorityBooking.reference,
        teacherName: priorityTeacherName,
        subjectName: priorityBooking.subjectName,
        levelName: priorityBooking.levelName,
        dateLabel: priorityDate,
        timeLabel: priorityBooking.scheduledTime || priorityBooking.preferredTime || "Créneau à confirmer",
        stepLabel: priorityStep?.label ?? "Dossier en cours",
        stepHint: priorityStep?.hint ?? "Compétence suit la réservation.",
        verified: hasVerifiedPayDunyaClientPayment(priorityBooking),
      }
    : null;
  const activeSecuredCount = securedBookings.filter((booking) => !["CANCELLED", "REFUNDED", "DISPUTED", "TEACHER_PAID"].includes(booking.status)).length;
  const completedCount = allBookings.filter((booking) => ["VALIDATED_BY_CLIENT", "TEACHER_PAID"].includes(booking.status)).length;
  const reservationItems: ClientReservationListItem[] = visibleBookings.map((b) => {
    const name = b.teacher.professionalName || b.teacher.fullName;
    const paymentVerified = hasVerifiedPayDunyaClientPayment(b);
    const nextStep = getClientReservationStep(b.status, b.paymentStatus, paymentVerified);
    const paymentLabel = getClientPaymentLabel(b.paymentStatus, b.isQuoteOnly);
    const bookingDate = b.scheduledDate
      ? formatDate(b.scheduledDate)
      : b.startDate
        ? `${formatDate(b.startDate)} demandée`
        : "Date à confirmer";
    const bookingTime = b.scheduledTime || b.preferredTime || "Créneau à confirmer";
    const formatLabel = b.courseFormat === "HOME" ? "À domicile" : "En ligne";
    const amountLabel = b.isQuoteOnly ? "Prix à finaliser" : formatFCFA(b.totalClientPays || b.totalPrice);
    const actionKind = getReservationActionKind(b.status, b.paymentStatus, paymentVerified);
    const searchText = normalizeReservationSearch([
      b.reference,
      b.subjectName,
      b.levelName,
      name,
      b.teacher.jobTitle || "Professeur",
      bookingDate,
      bookingTime,
      formatLabel,
      amountLabel,
      nextStep.label,
      nextStep.hint,
      paymentLabel,
    ].join(" "));

    return {
      id: b.id,
      reference: b.reference,
      subjectName: b.subjectName,
      levelName: b.levelName,
      teacher: {
        fullName: b.teacher.fullName,
        professionalName: b.teacher.professionalName,
        photoUrl: b.teacher.photoUrl,
        jobTitle: b.teacher.jobTitle,
        badgeVerified: b.teacher.badgeVerified,
      },
      amountLabel,
      dateLabel: bookingDate,
      timeLabel: bookingTime,
      formatLabel,
      stepLabel: nextStep.label,
      stepHint: nextStep.hint,
      stepClassName: nextStep.className,
      paymentLabel,
      actionKind,
      searchText,
    };
  });

  return (
    <div className="space-y-5">
      <ClientPageHeader
        eyebrow="Réservations"
        title="Réservations"
        description="Dates, professeurs, paiements et confirmations dans un suivi clair."
      />

      <ClientMetricStrip
        className="max-md:hidden"
        metrics={[
          { icon: Lock, label: "Sécurisés", value: formatFCFA(securedAmount) },
          { icon: WalletCards, label: "Non réservés", value: draftBookings.length, attention: draftBookings.length > 0 },
          { icon: Wallet, label: "Bloqués", value: blockedBookings.length, attention: blockedBookings.length > 0 },
          { icon: MessageSquare, label: "À confirmer", value: toConfirmBookings.length, attention: toConfirmBookings.length > 0 },
        ]}
      />

      {CLIENT_COMMAND_CENTERS_ENABLED && (
        <ReservationCommandCenter
          priority={priorityAction}
          totalCount={allBookings.length}
          draftCount={draftBookings.length}
          securedCount={activeSecuredCount}
          blockedCount={blockedBookings.length}
          toConfirmCount={toConfirmBookings.length}
          completedCount={completedCount}
          securedAmount={securedAmount}
        />
      )}

      <ReservationMobilePriorityCard
        priority={priorityAction}
        draftCount={draftBookings.length}
        toConfirmCount={toConfirmBookings.length}
        securedAmount={securedAmount}
      />

      <ClientTabBar
        activeId={tabId}
        items={TABS.map((t) => ({
          id: t.id,
          label: t.label,
          count: tabCounts[t.id] ?? 0,
          href: `/client/reservations?tab=${t.id}`,
        }))}
      />

      <ReservationListClient reservations={reservationItems} />
    </div>
  );
}

function ReservationMobilePriorityCard({
  priority,
  draftCount,
  toConfirmCount,
  securedAmount,
}: {
  priority: ReservationCommandCenterProps["priority"];
  draftCount: number;
  toConfirmCount: number;
  securedAmount: number;
}) {
  const actionHref = priority
    ? `/client/reservations/${priority.id}`
    : draftCount > 0
      ? "/client/reservations?tab=brouillons"
      : "/client/rechercher";
  const actionLabel = priority
    ? toConfirmCount > 0 ? "Confirmer" : "Ouvrir"
    : draftCount > 0 ? "Brouillons" : "Réserver";
  const title = priority
    ? `${priority.subjectName} · ${priority.levelName}`
    : draftCount > 0
      ? `${draftCount} paiement(s) à finaliser`
      : "Nouveau cours";
  const hint = priority
    ? `${priority.reference} · ${priority.dateLabel} · ${priority.timeLabel}`
    : draftCount > 0
      ? "Aucun professeur n'est notifié avant paiement PayDunya vérifié."
      : "Choisissez un professeur et une séance de 2h.";

  return (
    <ClientSurface compact className="rounded-lg border border-[#DDE3EE] p-3 md:hidden" data-client-reservation-mobile-priority>
      <div className="flex min-w-0 items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-[#111B4D] text-white">
          {toConfirmCount > 0 ? <MessageSquare className="h-5 w-5" /> : draftCount > 0 ? <AlertTriangle className="h-5 w-5" /> : <CalendarCheck className="h-5 w-5" />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-[#64748B]">Action prioritaire</p>
          <h2 className="mt-0.5 line-clamp-2 text-sm font-semibold leading-5 text-[#111827]">{title}</h2>
          <p className="mt-0.5 line-clamp-2 text-xs font-medium leading-5 text-[#64748B]">{hint}</p>
        </div>
        <Button asChild size="sm" className="min-h-10 shrink-0 rounded-lg bg-[#111B4D] px-3 text-white hover:bg-[#1E2A78]">
          <Link href={actionHref}>{actionLabel}</Link>
        </Button>
      </div>
      <div className="mt-3 grid grid-cols-1 gap-2 min-[520px]:grid-cols-3">
        <ClientInfoPill label="Brouillons" value={draftCount} strong={draftCount > 0} />
        <ClientInfoPill label="À confirmer" value={toConfirmCount} strong={toConfirmCount > 0} />
        <ClientInfoPill label="Fonds" value={formatFCFA(securedAmount)} strong={securedAmount > 0} />
      </div>
    </ClientSurface>
  );
}

type ReservationCommandCenterProps = {
  priority: {
    id: string;
    reference: string;
    teacherName: string;
    subjectName: string;
    levelName: string;
    dateLabel: string;
    timeLabel: string;
    stepLabel: string;
    stepHint: string;
    verified: boolean;
  } | null;
  totalCount: number;
  draftCount: number;
  securedCount: number;
  blockedCount: number;
  toConfirmCount: number;
  completedCount: number;
  securedAmount: number;
};

function ReservationCommandCenter({
  priority,
  totalCount,
  draftCount,
  securedCount,
  blockedCount,
  toConfirmCount,
  completedCount,
  securedAmount,
}: ReservationCommandCenterProps) {
  const hasDrafts = draftCount > 0;
  const hasConfirmation = toConfirmCount > 0;
  const hasSecured = securedCount > 0 || blockedCount > 0;
  const actionHref = priority
    ? `/client/reservations/${priority.id}`
    : hasDrafts
      ? "/client/reservations?tab=brouillons"
      : "/client/rechercher";
  const actionLabel = priority
    ? hasConfirmation ? "Confirmer le cours" : "Ouvrir le dossier"
    : hasDrafts ? "Voir les brouillons" : "Trouver un professeur";

  return (
    <ClientSurface compact className="hidden overflow-hidden rounded-lg border border-[#DDE3EE] p-0 md:block" data-client-reservation-command-center>
      <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,24rem)]">
        <div className="min-w-0 space-y-4 p-4 min-[640px]:p-5">
          <div className="flex min-w-0 gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-[#111B4D] text-white">
              {hasConfirmation ? <MessageSquare className="h-5 w-5" /> : hasDrafts ? <AlertTriangle className="h-5 w-5" /> : hasSecured ? <ShieldCheck className="h-5 w-5" /> : <CalendarCheck className="h-5 w-5" />}
            </span>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[#111B4D]">Pilotage réservation</p>
              <h2 className="mt-1 text-xl font-semibold leading-tight text-[#111827]">
                {hasConfirmation
                  ? "Un cours attend votre validation."
                  : hasDrafts
                    ? "Des brouillons ne sont pas encore réservés."
                    : hasSecured
                      ? "Vos réservations sécurisées sont suivies."
                      : "Prêt à réserver un nouveau cours."}
              </h2>
              <p className="mt-1 max-w-2xl text-sm font-medium leading-6 text-[#52627A]">
                {hasDrafts
                  ? "Une réservation devient active uniquement après confirmation serveur PayDunya. Aucun professeur n'est notifié avant paiement vérifié."
                  : "Les dossiers affichés ici relient professeur, date, paiement, validation client et suivi service client."}
              </p>
            </div>
          </div>

          <div className="grid gap-2 min-[520px]:grid-cols-2 xl:grid-cols-4">
            <ClientInfoPill label="Dossiers" value={totalCount} strong={totalCount > 0} />
            <ClientInfoPill label="Non réservés" value={draftCount} strong={draftCount > 0} />
            <ClientInfoPill label="À confirmer" value={toConfirmCount} strong={toConfirmCount > 0} />
            <ClientInfoPill label="Montant sécurisé" value={formatFCFA(securedAmount)} strong={securedAmount > 0} />
          </div>

          <ClientProcessTracker
            steps={[
              {
                label: "PayDunya vérifié",
                hint: hasDrafts ? `${draftCount} brouillon(s) à finaliser.` : "Aucun brouillon bloquant.",
                state: hasDrafts ? "current" : totalCount > 0 ? "done" : "pending",
              },
              {
                label: "Cours suivi",
                hint: securedCount > 0 ? `${securedCount} dossier(s) actif(s).` : "Réservez pour démarrer le suivi.",
                state: securedCount > 0 ? "current" : totalCount > 0 ? "done" : "pending",
              },
              {
                label: "Validation client",
                hint: hasConfirmation ? `${toConfirmCount} cours à valider.` : `${completedCount} dossier(s) clôturé(s).`,
                state: hasConfirmation ? "current" : completedCount > 0 ? "done" : "pending",
              },
            ]}
          />
        </div>

        <aside className="border-t border-[#DDE3EE] bg-white p-4 min-[640px]:p-5 lg:border-l lg:border-t-0">
          <div className="flex h-full flex-col justify-between gap-4">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#111B4D] text-white">
                  <Clock3 className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-[#111827]">Action prioritaire</p>
                  <p className="text-xs font-medium leading-5 text-[#64748B]">
                    {priority ? priority.stepLabel : hasDrafts ? "Finaliser un paiement" : "Choisir un professeur"}
                  </p>
                </div>
              </div>

              <div className="rounded-lg border border-[#D8DEE9] bg-white p-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-[#64748B]">
                  {priority ? "Dossier lié" : hasDrafts ? "Brouillon à vérifier" : "Nouveau cours"}
                </p>
                <p className="mt-1 text-base font-semibold leading-6 text-[#111827]">
                  {priority?.reference || (hasDrafts ? `${draftCount} paiement(s) non finalisé(s)` : "Aucun dossier actif")}
                </p>
                <p className="mt-1 text-xs font-medium leading-5 text-[#64748B]">
                  {priority
                    ? `${priority.teacherName} · ${priority.subjectName} · ${priority.levelName} · ${priority.dateLabel} · ${priority.timeLabel}`
                    : hasDrafts
                      ? "Ouvrez les brouillons pour reprendre le paiement PayDunya."
                      : "Lancez une recherche pour réserver une séance de 2h."}
                </p>
              </div>

              {priority && (
                <div className="rounded-lg border border-[#E3E8F2] bg-white p-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-[#64748B]">Statut</p>
                  <p className="mt-1 text-sm font-semibold leading-5 text-[#111827]">{priority.stepHint}</p>
                  <p className="mt-2 inline-flex min-h-7 items-center rounded-lg border border-[#D8DEE9] bg-white px-2 text-xs font-semibold text-[#111B4D]">
                    {priority.verified ? "Paiement serveur vérifié" : "Paiement non activé"}
                  </p>
                </div>
              )}
            </div>

            <Button asChild className="min-h-11 w-full rounded-lg bg-[#111B4D] text-white hover:bg-[#1E2A78]">
              <Link href={actionHref}>
                {actionLabel}
                <ArrowRight className="ml-1.5 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </aside>
      </div>
    </ClientSurface>
  );
}

function getReservationActionKind(status: BookingStatus, paymentStatus: PaymentStatus, paymentVerified: boolean): ClientReservationListItem["actionKind"] {
  if (status === "PENDING_PAYMENT" && !paymentVerified) return "action";
  if (status === "PENDING_CLIENT_VALIDATION") return "action";
  if (paymentStatus === "FAILED") return "action";
  if (["CANCELLED", "REFUNDED", "DISPUTED"].includes(status) || ["DISPUTED", "REFUND_PENDING", "PARTIAL_REFUND_PENDING", "RETAINED"].includes(paymentStatus)) return "issue";
  if (["VALIDATED_BY_CLIENT", "TEACHER_PAID"].includes(status) || paymentStatus === "TEACHER_PAID") return "closed";
  if (paymentVerified || ["RECEIVED", "BLOCKED", "VALIDATED", "TO_PAY_TEACHER"].includes(paymentStatus)) return "secured";
  return "all";
}

function normalizeReservationSearch(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function compareDateAsc(a: Date | null | undefined, b: Date | null | undefined) {
  const left = a?.getTime() ?? Number.POSITIVE_INFINITY;
  const right = b?.getTime() ?? Number.POSITIVE_INFINITY;
  return left - right;
}

function getClientPaymentLabel(status: PaymentStatus, quoteOnly: boolean) {
  if (quoteOnly) return "Prix à finaliser";
  const labels: Record<PaymentStatus, string> = {
    FAILED: "Paiement à finaliser",
    RECEIVED: "Paiement reçu",
    BLOCKED: "Paiement sécurisé",
    VALIDATED: "Cours validé",
    TO_PAY_TEACHER: "Traitement service client",
    TEACHER_PAID: "Cours clôturé",
    DISPUTED: "Litige en cours",
    REFUND_PENDING: "Remboursement en traitement",
    PARTIAL_REFUND_PENDING: "Remboursement partiel en traitement",
    REFUNDED: "Remboursé",
    PARTIALLY_REFUNDED: "Remboursement partiel",
    RETAINED: "Frais appliqués",
  };
  return labels[status] ?? "Suivi paiement";
}

function getClientReservationStep(status: BookingStatus, paymentStatus: PaymentStatus, paymentVerified: boolean) {
  if (status === "PENDING_PAYMENT" && !paymentVerified) {
    return {
      label: "Brouillon non réservé",
      hint: "Ce dossier n'est pas une réservation active : aucun professeur ni service client opérationnel n'est notifié tant que PayDunya n'a pas confirmé le paiement.",
      className: "border-[#E3E8F2] bg-white text-[#111B4D]",
    };
  }
  if (!paymentVerified && SECURED_PAYMENT_STATUSES.includes(paymentStatus)) {
    return {
      label: "Paiement en vérification",
      hint: "Compétence attend la confirmation serveur PayDunya avant d'activer le suivi financier.",
      className: "border-[#DDE6F7] bg-white text-[#111B4D]",
    };
  }
  if (status === "PENDING_ADMIN_VALIDATION" && paymentStatus === "FAILED") {
    return {
      label: "Prix en préparation",
      hint: "Le service client prépare le montant final avant paiement.",
      className: "border-[#E3E8F2] bg-white text-[#111B4D]",
    };
  }
  if (status === "PENDING_CLIENT_VALIDATION") {
    return {
      label: "Votre confirmation attendue",
      hint: "Confirmez le cours si tout s'est bien passé, ou ouvrez un litige si nécessaire.",
      className: "border-[#E3E8F2] bg-white text-[#111B4D]",
    };
  }
  if (paymentStatus === "BLOCKED") {
    return {
      label: "Paiement sécurisé",
      hint: "Votre argent reste bloqué jusqu'à la validation du cours.",
      className: "border-[#DDE6F7] bg-white text-[#111B4D]",
    };
  }
  if (paymentStatus === "TO_PAY_TEACHER") {
    return {
      label: "Paiement en traitement",
      hint: "Votre confirmation est prise en compte, le service client finalise le dossier.",
      className: "border-[#E3E8F2] bg-white text-[#111B4D]",
    };
  }
  if (["CANCELLED", "REFUNDED", "DISPUTED"].includes(status)) {
    return {
      label: "Suivi service client",
      hint: "Le service client garde l'historique et traite la situation selon le dossier.",
      className: "border-[#E3E8F2] bg-white text-[#111B4D]",
    };
  }
  return {
    label: "Dossier en cours",
    hint: "Compétence suit la réservation et vous alerte dès qu'une action est nécessaire.",
    className: "border-[#E3E8F2] bg-white text-[#111B4D]",
  };
}
