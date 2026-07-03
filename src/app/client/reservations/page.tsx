import Link from "next/link";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/session";
import { EmptyState } from "@/components/shared/page-header";
import { ClientFocusPanel, ClientMetricStrip, ClientPageHeader } from "@/components/shared/client-page-primitives";
import { BookingStatusBadge, PaymentStatusBadge } from "@/components/shared/status-badge";
import { ProfessorImage } from "@/components/shared/professor-image";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatFCFA, formatDate } from "@/lib/format";
import { CalendarCheck, ArrowRight, Lock, MessageSquare, Wallet } from "lucide-react";
import { BookingStatus, PaymentStatus } from "@prisma/client";
import { hasVerifiedPayDunyaClientPayment } from "@/lib/payment-security";

export const dynamic = "force-dynamic";

const TABS: { id: string; label: string; statuses?: BookingStatus[] }[] = [
  { id: "toutes", label: "Toutes" },
  { id: "encours", label: "En cours", statuses: ["PAID", "PENDING_ADMIN_VALIDATION", "CONFIRMED", "ASSIGNED", "IN_PROGRESS", "PENDING_CLIENT_VALIDATION", "PAYMENT_TO_RELEASE"] },
  { id: "aconfirmer", label: "À confirmer", statuses: ["PENDING_CLIENT_VALIDATION"] },
  { id: "terminees", label: "Terminées", statuses: ["VALIDATED_BY_CLIENT", "TEACHER_PAID"] },
  { id: "annulees", label: "Annulées", statuses: ["CANCELLED", "REFUNDED", "DISPUTED"] },
];

const SECURED_PAYMENT_STATUSES: PaymentStatus[] = ["RECEIVED", "BLOCKED", "VALIDATED", "TO_PAY_TEACHER", "TEACHER_PAID"];

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
  const [bookings, allBookings] = await Promise.all([
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
  const blockedBookings = allBookings.filter((booking) => booking.paymentStatus === "BLOCKED" && hasVerifiedPayDunyaClientPayment(booking));
  const toConfirmBookings = allBookings.filter((booking) => booking.status === "PENDING_CLIENT_VALIDATION" && hasVerifiedPayDunyaClientPayment(booking));
  const securedAmount = securedBookings.reduce((sum, booking) => sum + (booking.totalClientPays || booking.totalPrice), 0);
  const tabCounts = Object.fromEntries(
    TABS.map((item) => [
      item.id,
      item.statuses
        ? allBookings.filter((booking) => item.statuses?.includes(booking.status)).length
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
        title="Mes réservations"
        description="Suivez chaque demande, la date souhaitée, le professeur choisi, le paiement sécurisé et les actions attendues."
      />

      <ClientMetricStrip
        metrics={[
          { icon: Lock, label: "Sécurisés", value: formatFCFA(securedAmount) },
          { icon: Wallet, label: "Bloqués", value: blockedBookings.length, attention: blockedBookings.length > 0 },
          { icon: MessageSquare, label: "À confirmer", value: toConfirmBookings.length, attention: toConfirmBookings.length > 0 },
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
          <Button asChild className="min-h-11 w-full rounded-2xl" size="sm">
            <Link href={priorityBooking ? `/client/reservations/${priorityBooking.id}` : "/client/rechercher"}>
              {priorityBooking ? "Ouvrir le dossier" : "Trouver un professeur"}
              <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
            </Link>
          </Button>
        }
      />

      {/* Tabs */}
      <div className="grid grid-cols-2 gap-2 rounded-[1.25rem] border border-[#E3E8F2] bg-white p-1.5 shadow-sm min-[520px]:grid-cols-3 lg:flex lg:flex-wrap">
        {TABS.map((t) => (
          <Link
            key={t.id}
            href={`/client/reservations?tab=${t.id}`}
            className={`flex min-h-11 min-w-0 items-center justify-center rounded-full px-3 py-2 text-center text-sm font-semibold transition lg:w-auto lg:justify-start ${
              tabId === t.id
                ? "bg-[#111B4D] text-white shadow-md"
                : "border border-[#E3E8F2] bg-white text-[#475569] hover:bg-white hover:text-[#111B4D] hover:shadow-sm"
            }`}
          >
            {t.label}
            <span className={`ml-2 rounded-full px-2 py-0.5 text-xs ${tabId === t.id ? "bg-white text-[#111B4D]" : "bg-white text-[#111B4D]"}`}>
              {tabCounts[t.id] ?? 0}
            </span>
          </Link>
        ))}
      </div>

      {bookings.length === 0 ? (
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
        <div className="space-y-3">
          {bookings.map((b) => {
            const name = b.teacher.professionalName || b.teacher.fullName;
            const paymentVerified = hasVerifiedPayDunyaClientPayment(b);
            const nextStep = getClientReservationStep(b.status, b.paymentStatus, paymentVerified);
            const bookingDate = b.scheduledDate
              ? formatDate(b.scheduledDate)
              : b.startDate
                ? `${formatDate(b.startDate)} demandée`
                : "Date à confirmer";
            const bookingTime = b.scheduledTime || b.preferredTime || "Créneau à confirmer";
            const formatLabel = b.courseFormat === "HOME" ? "À domicile" : "En ligne";
            return (
              <Card key={b.id} className="overflow-hidden rounded-[1.5rem] border-[#E3E8F2] bg-white shadow-sm">
                <CardContent className="p-4 sm:p-5">
                  <div className="flex min-w-0 items-start gap-3">
                    <ProfessorImage photoUrl={b.teacher.photoUrl} name={name} size={52} shape="circle" verified={b.teacher.badgeVerified} />
                    <div className="min-w-0 flex-1">
                      <div className="flex min-w-0 flex-wrap items-center gap-2">
                        <p className="break-words text-sm font-black text-[#111827]">{b.reference}</p>
                        <BookingStatusBadge status={b.status} audience="client" />
                      </div>
                      <p className="mt-1 break-words text-base font-black leading-6 text-[#111827]">
                        {b.subjectName} • {b.levelName}
                      </p>
                      <p className="mt-0.5 break-words text-xs font-semibold leading-5 text-[#64748B]">
                        {name} • {b.teacher.jobTitle || "Professeur"}
                      </p>
                    </div>
                  </div>
                  {b.schoolProgram && (
                    <p className="mt-2 line-clamp-2 rounded-2xl border border-[#E3E8F2] bg-white px-3 py-2 text-xs font-semibold leading-5 text-[#1F3A8A]">
                      {b.schoolProgram}
                    </p>
                  )}
                  <div className="mt-3 flex flex-wrap gap-2">
                    <PaymentStatusBadge status={b.paymentStatus} audience="client" quoteOnly={b.isQuoteOnly} />
                    <Badge variant="outline" className={nextStep.className}>{nextStep.label}</Badge>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 lg:grid-cols-4">
                    <ReservationInfoPill label="Date" value={bookingDate} />
                    <ReservationInfoPill label="Créneau" value={bookingTime} />
                    <ReservationInfoPill label="Format" value={formatLabel} />
                    <ReservationInfoPill label="Montant" value={b.isQuoteOnly ? "Sur devis" : formatFCFA(b.totalPrice)} strong />
                  </div>
                  <div className="mt-3 grid gap-2 min-[520px]:grid-cols-[minmax(0,1fr)_auto] min-[520px]:items-center">
                    <p className="text-xs font-semibold leading-5 text-[#64748B]">{nextStep.hint}</p>
                    <Button asChild size="sm" className="min-h-11 rounded-2xl">
                      <Link href={`/client/reservations/${b.id}`}>
                        Détails <ArrowRight className="ml-1 h-3.5 w-3.5" />
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ReservationInfoPill({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="min-w-0 rounded-2xl border border-[#E3E8F2] bg-white px-3 py-2">
      <p className="text-[11px] font-black uppercase tracking-wide text-[#64748B]">{label}</p>
      <p className={`mt-0.5 break-words text-sm leading-5 ${strong ? "font-black text-[#111B4D]" : "font-bold text-[#111827]"}`}>
        {value}
      </p>
    </div>
  );
}

function getClientReservationStep(status: BookingStatus, paymentStatus: PaymentStatus, paymentVerified: boolean) {
  if (!paymentVerified && SECURED_PAYMENT_STATUSES.includes(paymentStatus)) {
    return {
      label: "Paiement en vérification",
      hint: "MonProf CI attend la confirmation serveur PayDunya avant d'activer le suivi financier.",
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
    label: "Suivi normal",
    hint: "Votre réservation suit son parcours normal.",
    className: "border-[#E3E8F2] bg-white text-[#111B4D]",
  };
}
