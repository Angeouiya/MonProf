import Link from "next/link";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/session";
import { EmptyState } from "@/components/shared/page-header";
import {
  ClientAppRail,
  ClientFocusPanel,
  ClientInfoPill,
  ClientMetricStrip,
  ClientPageHeader,
  ClientRecordCard,
  ClientTabBar,
} from "@/components/shared/client-page-primitives";
import { ProfessorImage } from "@/components/shared/professor-image";
import { Money } from "@/components/shared/money";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/format";
import { hasVerifiedPayDunyaClientPayment } from "@/lib/payment-security";
import { BookOpen, ArrowRight, Clock, Calendar, CheckCircle2, MessageSquare, WalletCards, Search, LifeBuoy } from "lucide-react";
import { BookingStatus, PaymentStatus } from "@prisma/client";

export const dynamic = "force-dynamic";

const TABS = [
  { id: "avenir", label: "À venir", statuses: ["CONFIRMED", "ASSIGNED", "IN_PROGRESS", "PENDING_ADMIN_VALIDATION", "PAYMENT_TO_RELEASE"] },
  { id: "encours", label: "En cours", statuses: ["IN_PROGRESS"] },
  { id: "termines", label: "Terminés", statuses: ["COURSE_DONE", "PENDING_CLIENT_VALIDATION", "VALIDATED_BY_CLIENT", "TEACHER_PAID"] },
];
const COURSE_STATUSES = Array.from(new Set(TABS.flatMap((tab) => tab.statuses)));

export default async function CoursPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const user = await getSessionUser();
  if (!user) return null;
  const sp = await searchParams;
  const tabId = sp.tab ?? "avenir";
  const tab = TABS.find((t) => t.id === tabId) ?? TABS[0];

  const [bookings, overviewBookings] = await db.$transaction([
    db.booking.findMany({
      where: { clientId: user.id, status: { in: tab.statuses as any } },
      orderBy: [{ scheduledDate: "asc" }, { startDate: "asc" }, { createdAt: "desc" }],
      include: {
        teacher: {
          select: { id: true, fullName: true, professionalName: true, photoUrl: true, jobTitle: true, commune: true, badgeVerified: true },
        },
      },
    }),
    db.booking.findMany({
      where: { clientId: user.id, status: { in: COURSE_STATUSES as any } },
      orderBy: [{ scheduledDate: "asc" }, { startDate: "asc" }, { createdAt: "desc" }],
      select: {
        id: true,
        status: true,
        paymentStatus: true,
        totalPrice: true,
        totalClientPays: true,
        paydunyaStatus: true,
        paydunyaVerifiedAt: true,
        isQuoteOnly: true,
        subjectName: true,
        levelName: true,
        scheduledDate: true,
        startDate: true,
        teacher: {
          select: { fullName: true, professionalName: true },
        },
        transactions: {
          where: { type: "CLIENT_PAYMENT" },
          select: { type: true, status: true, amount: true },
        },
      },
    }),
  ]);

  const tabCounts = Object.fromEntries(
    TABS.map((item) => [item.id, overviewBookings.filter((booking) => item.statuses.includes(booking.status)).length]),
  ) as Record<string, number>;
  const nextCourse = overviewBookings.find((booking) => ["CONFIRMED", "ASSIGNED", "IN_PROGRESS", "PENDING_ADMIN_VALIDATION"].includes(booking.status));
  const confirmationCount = overviewBookings.filter((booking) => booking.status === "PENDING_CLIENT_VALIDATION").length;
  const protectedAmount = overviewBookings
    .filter((booking) => !booking.isQuoteOnly && hasVerifiedPayDunyaClientPayment(booking))
    .reduce((sum, booking) => sum + (booking.totalClientPays || booking.totalPrice), 0);

  return (
    <div className="space-y-6">
      <ClientPageHeader
        eyebrow="Cours"
        title="Cours"
        description="Retrouvez les cours à venir, les séances en cours et les validations à effectuer après chaque cours."
      />

      <ClientMetricStrip
        metrics={[
          { icon: Calendar, label: "À venir", value: tabCounts.avenir ?? 0 },
          { icon: MessageSquare, label: "À confirmer", value: confirmationCount, attention: confirmationCount > 0 },
          { icon: WalletCards, label: "Protégé", value: `${protectedAmount.toLocaleString("fr-FR")} FCFA` },
        ]}
      />

      <ClientAppRail
        items={[
          { href: "/client/cours", icon: BookOpen, label: "Cours", value: "Suivi actif", active: true },
          { href: "/client/rechercher", icon: Search, label: "Réserver", value: "Nouveau cours" },
          { href: "/client/reservations", icon: Calendar, label: "Dossiers", value: "Réservations" },
          { href: "/client/notifications", icon: MessageSquare, label: "Alertes", value: formatCount(confirmationCount, "confirmation") },
        ]}
      />

      <ClientFocusPanel
        eyebrow="Prochaine étape"
        icon={BookOpen}
        title={nextCourse ? nextCourse.subjectName : "Aucun cours actif"}
        description={
          nextCourse
            ? `${nextCourse.teacher.professionalName || nextCourse.teacher.fullName} · ${nextCourse.scheduledDate ? formatDate(nextCourse.scheduledDate) : nextCourse.startDate ? `${formatDate(nextCourse.startDate)} demandée` : "date à confirmer"}`
            : "Réservez un cours pour afficher ici la prochaine séance à suivre."
        }
        action={
          <Button asChild className="min-h-11 rounded-2xl sm:min-w-52">
            <Link href={nextCourse ? `/client/reservations/${nextCourse.id}` : "/client/rechercher"}>
              {nextCourse ? "Voir le dossier" : "Trouver un professeur"}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        }
      />

      <ClientTabBar
        activeId={tabId}
        className="min-[420px]:grid-cols-3"
        items={TABS.map((t) => ({
          id: t.id,
          label: t.label,
          count: tabCounts[t.id] ?? 0,
          href: `/client/cours?tab=${t.id}`,
        }))}
      />

      {bookings.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title="Aucun cours dans cette catégorie"
          description="Réservez un cours pour le voir apparaître ici."
          action={
            <Button asChild size="sm" className="min-h-11 rounded-2xl">
              <Link href="/client/rechercher">Réserver un cours</Link>
            </Button>
          }
        />
      ) : (
        <div className="grid gap-3 xl:grid-cols-2">
          {bookings.map((b) => {
            const name = b.teacher.professionalName || b.teacher.fullName;
            const step = getCourseStep(b.status, b.paymentStatus);
            const courseDate = b.scheduledDate ? formatDate(b.scheduledDate) : b.startDate ? `${formatDate(b.startDate)} demandée` : "À planifier";
            const courseTime = b.scheduledTime || b.preferredTime || "Créneau à confirmer";
            const formatLabel = b.courseFormat === "HOME" ? "À domicile" : "En ligne";
            const amountLabel = b.isQuoteOnly ? "Sur devis" : <Money amount={b.totalClientPays || b.totalPrice} />;
            return (
              <ClientRecordCard key={b.id} data-client-course-card>
                <div className="p-3.5 sm:p-5">
                  <div className="grid gap-3 min-[520px]:grid-cols-[minmax(0,1fr)_auto] min-[520px]:items-start">
                    <div className="flex min-w-0 items-start gap-3">
                      <ProfessorImage photoUrl={b.teacher.photoUrl} name={name} size={58} shape="circle" verified={b.teacher.badgeVerified} />
                      <div className="min-w-0 flex-1">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-[#64748B]">{step.label}</p>
                        <h2 className="mt-0.5 break-words text-base font-semibold leading-6 text-[#111827]">
                          {b.subjectName} · {b.levelName}
                        </h2>
                        <p className="mt-0.5 break-words text-xs font-semibold leading-5 text-[#64748B]">
                          {name} · {b.teacher.jobTitle || "Professeur"}
                        </p>
                      </div>
                    </div>
                    <ClientInfoPill label="Montant" value={amountLabel} strong className="min-[520px]:min-w-32 min-[520px]:text-right" />
                  </div>

                  <div className="mt-3 grid grid-cols-1 gap-2 min-[420px]:grid-cols-2 lg:grid-cols-3">
                    <ClientInfoPill label={b.scheduledDate ? "Date" : "Date souhaitée"} value={courseDate} />
                    <ClientInfoPill label="Créneau" value={courseTime} />
                    <ClientInfoPill label="Format" value={formatLabel} className="min-[420px]:col-span-2 lg:col-span-1" />
                  </div>

                  <div className="mt-3 rounded-2xl border border-[#E3E8F2] bg-white px-3 py-2.5">
                    <p className="text-sm font-semibold leading-5 text-[#111827]">{step.label}</p>
                    <p className="mt-0.5 text-xs font-medium leading-5 text-[#64748B]">{step.hint}</p>
                  </div>

                  <div className="mt-3 grid gap-2 min-[520px]:grid-cols-[minmax(0,1fr)_auto] min-[520px]:items-center">
                    <p className="text-xs font-medium leading-5 text-[#64748B]">
                      Cours rattaché à {name}. Le lien en ligne et les actions sont disponibles dans le dossier.
                    </p>
                    <Button asChild size="sm" className="min-h-11 w-full rounded-2xl">
                      <Link href={`/client/reservations/${b.id}`}>
                        Voir le dossier <ArrowRight className="ml-1 h-3.5 w-3.5" />
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

function getCourseStep(status: BookingStatus, paymentStatus: PaymentStatus) {
  if (status === "PENDING_ADMIN_VALIDATION" && paymentStatus === "FAILED") {
    return {
      label: "Devis en préparation",
      hint: "L'administration prépare le montant final avant paiement.",
      icon: Clock,
      className: "border-[#E3E8F2] bg-white text-[#111B4D]",
    };
  }
  if (status === "PENDING_CLIENT_VALIDATION") {
    return {
      label: "Confirmation attendue",
      hint: "Le cours est terminé. Confirmez-le depuis le détail si tout s'est bien passé.",
      icon: MessageSquare,
      className: "border-[#E3E8F2] bg-white text-[#111B4D]",
    };
  }
  if (["VALIDATED_BY_CLIENT", "PAYMENT_TO_RELEASE", "TEACHER_PAID"].includes(status)) {
    return {
      label: "Cours validé",
      hint: paymentStatus === "TEACHER_PAID"
        ? "Le dossier est clôturé côté paiement sécurisé."
        : "Votre confirmation est prise en compte. L'administration finalise le dossier.",
      icon: CheckCircle2,
      className: "border-[#E3E8F2] bg-white text-[#111B4D]",
    };
  }
  if (status === "IN_PROGRESS") {
    return {
      label: "En cours",
      hint: "Gardez le contact avec le professeur et revenez confirmer après le cours.",
      icon: Clock,
      className: "border-[#DDE6F7] bg-white text-[#111B4D]",
    };
  }
  return {
    label: "À venir",
    hint: "Le professeur et l'administration disposent des informations nécessaires au suivi du cours.",
    icon: Calendar,
    className: "border-[#E3E8F2] bg-white text-[#111B4D]",
  };
}

function formatCount(count: number, singular: string, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}
