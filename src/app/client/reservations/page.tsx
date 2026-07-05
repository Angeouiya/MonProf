import Link from "next/link";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/session";
import { EmptyState } from "@/components/shared/page-header";
import {
  ClientCompactFacts,
  ClientFocusPanel,
  ClientAppRail,
  ClientMetricStrip,
  ClientPageHeader,
  ClientRecordAmount,
  ClientRecordCard,
  ClientRecordStatusLine,
  ClientTabBar,
} from "@/components/shared/client-page-primitives";
import { ProfessorImage } from "@/components/shared/professor-image";
import { Button } from "@/components/ui/button";
import { formatFCFA, formatDate } from "@/lib/format";
import { CalendarCheck, ArrowRight, Lock, MessageSquare, Wallet, Search, WalletCards } from "lucide-react";
import { BookingStatus, PaymentStatus } from "@prisma/client";
import { hasVerifiedPayDunyaClientPayment } from "@/lib/payment-security";
import { cn } from "@/lib/utils";

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

  const where: any = { clientId: user.id };
  if (tab.statuses) where.status = { in: tab.statuses };

  const bookingInclude = {
    teacher: {
      select: { id: true, fullName: true, professionalName: true, photoUrl: true, jobTitle: true, commune: true, badgeVerified: true },
    },
    transactions: { where: { type: "CLIENT_PAYMENT" as const }, select: { type: true, status: true, amount: true } },
  };
  const [bookings, allBookings] = await db.$transaction([
    db.booking.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: bookingInclude,
    }),
    db.booking.findMany({
      where: { clientId: user.id },
      orderBy: [{ scheduledDate: "asc" }, { startDate: "asc" }, { createdAt: "desc" }],
      include: bookingInclude,
    }),
  ]);
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
    ?? allBookings.find((booking) => ["PAID", "PENDING_ADMIN_VALIDATION", "CONFIRMED", "ASSIGNED", "IN_PROGRESS"].includes(booking.status))
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

  return (
    <div className="space-y-5">
      <ClientPageHeader
        eyebrow="Réservations"
        title="Réservations"
        description="Dates, professeurs, paiements et confirmations dans un suivi clair."
      />

      <ClientMetricStrip
        metrics={[
          { icon: Lock, label: "Sécurisés", value: formatFCFA(securedAmount) },
          { icon: WalletCards, label: "Non réservés", value: draftBookings.length, attention: draftBookings.length > 0 },
          { icon: Wallet, label: "Bloqués", value: blockedBookings.length, attention: blockedBookings.length > 0 },
          { icon: MessageSquare, label: "À confirmer", value: toConfirmBookings.length, attention: toConfirmBookings.length > 0 },
        ]}
      />

      <ClientAppRail
        items={[
          { href: "/client/rechercher", icon: Search, label: "Réserver", value: "Choisir un professeur" },
          { href: "/client/reservations", icon: CalendarCheck, label: "Dossiers", value: `${allBookings.length} réservation(s)`, active: true },
          { href: "/client/reservations?tab=brouillons", icon: WalletCards, label: "Non réservés", value: `${draftBookings.length} paiement(s)` },
          { href: "/client/reservations?tab=aconfirmer", icon: MessageSquare, label: "À confirmer", value: `${toConfirmBookings.length} action(s)` },
          { href: "/client/paiements", icon: WalletCards, label: "Paiements", value: formatFCFA(securedAmount) },
        ]}
      />

      <ClientFocusPanel
        icon={CalendarCheck}
        eyebrow="Prochaine action"
        title={priorityBooking ? priorityStep?.label : "Aucune action"}
        description={priorityBooking
          ? `${priorityBooking.reference} · ${priorityTeacherName} · ${priorityDate}`
          : "Réservez un cours pour afficher votre prochain dossier."}
        action={
          <Button asChild className="min-h-11 w-full rounded-lg" size="sm">
            <Link href={priorityBooking ? `/client/reservations/${priorityBooking.id}` : "/client/rechercher"}>
              {priorityBooking ? "Ouvrir le dossier" : "Trouver un professeur"}
              <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
            </Link>
          </Button>
        }
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

      {visibleBookings.length === 0 ? (
        <EmptyState
          icon={CalendarCheck}
          title="Aucune réservation"
          description="Vous n'avez pas encore réservé de cours."
          action={
            <Button asChild size="sm">
              <Link href="/client/rechercher">Réserver un cours</Link>
            </Button>
          }
        />
      ) : (
        <div className="grid gap-3">
          {visibleBookings.map((b) => {
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
            const amountLabel = b.isQuoteOnly ? "Sur devis" : formatFCFA(b.totalClientPays || b.totalPrice);
            return (
              <ClientRecordCard key={b.id} data-client-reservation-card>
                <div className="p-3.5 sm:p-4">
                  <div className="grid gap-3 min-[560px]:grid-cols-[minmax(0,1fr)_auto] min-[560px]:items-start">
                    <div className="flex min-w-0 items-start gap-3">
                      <ProfessorImage photoUrl={b.teacher.photoUrl} name={name} size={58} shape="circle" verified={b.teacher.badgeVerified} />
                      <div className="min-w-0 flex-1">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-[#64748B]">{b.reference}</p>
                        <h2 className="mt-0.5 break-words text-base font-semibold leading-6 text-[#111827]">
                          {b.subjectName} · {b.levelName}
                        </h2>
                        <p className="mt-0.5 break-words text-xs font-semibold leading-5 text-[#64748B]">
                          {name} · {b.teacher.jobTitle || "Professeur"}
                        </p>
                      </div>
                    </div>
                    <ClientRecordAmount value={amountLabel} className="min-[560px]:min-w-36 min-[560px]:text-right" />
                  </div>

                  <ClientCompactFacts
                    className="mt-3"
                    items={[
                      { label: "Date", value: bookingDate },
                      { label: "Créneau", value: bookingTime },
                      { label: "Format", value: formatLabel },
                    ]}
                  />

                  <div className="mt-3 grid gap-3 min-[620px]:grid-cols-[minmax(0,1fr)_auto] min-[620px]:items-center">
                    <ClientRecordStatusLine
                      className={cn(nextStep.className)}
                      label={nextStep.label}
                      hint={nextStep.hint}
                      aside={paymentLabel}
                    />
                    <Button asChild size="sm" className="min-h-11 rounded-lg min-[620px]:min-w-28">
                      <Link href={`/client/reservations/${b.id}`}>
                        Détails <ArrowRight className="ml-1 h-3.5 w-3.5" />
                      </Link>
                    </Button>
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

function getClientPaymentLabel(status: PaymentStatus, quoteOnly: boolean) {
  if (quoteOnly) return "Devis en cours";
  const labels: Record<PaymentStatus, string> = {
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
  return labels[status] ?? "Suivi paiement";
}

function getClientReservationStep(status: BookingStatus, paymentStatus: PaymentStatus, paymentVerified: boolean) {
  if (status === "PENDING_PAYMENT" && !paymentVerified) {
    return {
      label: "Brouillon non réservé",
      hint: "Ce dossier n'est pas une réservation active : aucun professeur ni admin opérationnel n'est notifié tant que PayDunya n'a pas confirmé le paiement.",
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
      label: "Devis en préparation",
      hint: "L'administration prépare le montant final avant paiement.",
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
      hint: "Votre confirmation est prise en compte, l'administration finalise le dossier.",
      className: "border-[#E3E8F2] bg-white text-[#111B4D]",
    };
  }
  if (["CANCELLED", "REFUNDED", "DISPUTED"].includes(status)) {
    return {
      label: "Suivi support",
      hint: "Le support garde l'historique et traite la situation selon le dossier.",
      className: "border-[#E3E8F2] bg-white text-[#111B4D]",
    };
  }
  return {
    label: "Dossier en cours",
    hint: "Compétence suit la réservation et vous alerte dès qu'une action est nécessaire.",
    className: "border-[#E3E8F2] bg-white text-[#111B4D]",
  };
}
