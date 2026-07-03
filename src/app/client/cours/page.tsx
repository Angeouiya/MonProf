import Link from "next/link";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/session";
import { PageHeader, EmptyState } from "@/components/shared/page-header";
import { BookingStatusBadge, PaymentStatusBadge } from "@/components/shared/status-badge";
import { ProfessorImage } from "@/components/shared/professor-image";
import { Money } from "@/components/shared/money";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatDate, formatDateTime } from "@/lib/format";
import { packTypeLabel } from "@/lib/platform-labels";
import { hasVerifiedPayDunyaClientPayment } from "@/lib/payment-security";
import { BookOpen, Home, Video, ArrowRight, Clock, Calendar, CheckCircle2, MessageSquare, WalletCards } from "lucide-react";
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

  const [bookings, overviewBookings] = await Promise.all([
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
    .reduce((sum, booking) => sum + booking.totalPrice, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Mes cours"
        description="Retrouvez les cours à venir, les séances en cours et les validations à effectuer après chaque cours."
      />

      <section className="grid gap-3 md:grid-cols-3">
        <CourseSignalCard icon={Calendar} label="À venir" value={`${tabCounts.avenir ?? 0}`} detail="Cours planifiés ou à valider par l'équipe." />
        <CourseSignalCard icon={MessageSquare} label="À confirmer" value={`${confirmationCount}`} detail="Cours terminés qui attendent votre retour." />
        <CourseSignalCard icon={WalletCards} label="Protégé" value={protectedAmount.toLocaleString("fr-FR")} detail="FCFA suivis dans les dossiers de cours." />
      </section>

      <section className="rounded-[1.3rem] border border-[#DDE6F7] bg-white p-3 shadow-sm sm:p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-black uppercase tracking-wide text-[#64748B]">Prochaine étape</p>
            <p className="mt-1 text-lg font-black leading-tight text-[#111827]">
              {nextCourse ? nextCourse.subjectName : "Aucun cours actif"}
            </p>
            <p className="mt-1 break-words text-sm font-semibold leading-5 text-[#64748B]">
              {nextCourse
                ? `${nextCourse.teacher.professionalName || nextCourse.teacher.fullName} · ${nextCourse.scheduledDate ? formatDate(nextCourse.scheduledDate) : nextCourse.startDate ? `${formatDate(nextCourse.startDate)} demandée` : "date à confirmer"}`
                : "Réservez un cours pour afficher ici la prochaine séance à suivre."}
            </p>
          </div>
          <Button asChild className="min-h-11 rounded-2xl sm:min-w-52">
            <Link href={nextCourse ? `/client/reservations/${nextCourse.id}` : "/client/rechercher"}>
              {nextCourse ? "Voir le dossier" : "Trouver un professeur"}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-2 rounded-[1.25rem] border border-[#E3E8F2] bg-white p-1.5 shadow-sm min-[420px]:grid-cols-3 lg:flex lg:flex-wrap">
        {TABS.map((t) => (
          <Link
            key={t.id}
            href={`/client/cours?tab=${t.id}`}
            className={`flex min-h-11 min-w-0 items-center justify-center rounded-full px-3 py-2 text-center text-sm font-semibold transition lg:w-auto lg:justify-start ${
              tabId === t.id ? "bg-[#111B4D] text-white shadow-sm" : "border border-[#E3E8F2] bg-white text-[#475569] hover:bg-white hover:text-[#111B4D] hover:shadow-sm"
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
            const StepIcon = step.icon;
            return (
              <Card key={b.id} className="overflow-hidden rounded-[1.35rem] border-[#E3E8F2] shadow-sm">
                <CardContent className="p-4 sm:p-5">
                  <div className="flex items-start gap-3">
                    <ProfessorImage photoUrl={b.teacher.photoUrl} name={name} size={56} shape="circle" verified={b.teacher.badgeVerified} />
                    <div className="min-w-0 flex-1">
                      <div className="flex min-w-0 flex-wrap items-center gap-2">
                        <p className="truncate text-sm font-black text-[#111827]">{b.subjectName}</p>
                        <BookingStatusBadge status={b.status} audience="client" />
                      </div>
                      <p className="mt-1 truncate text-xs text-[#64748B]">{name} • {b.levelName}</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <PaymentStatusBadge status={b.paymentStatus} audience="client" quoteOnly={b.isQuoteOnly} />
                        <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-bold ${step.className}`}>
                          <StepIcon className="h-3 w-3" />
                          {step.label}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs min-[460px]:grid-cols-4">
                    <div className="rounded-2xl border border-[#E3E8F2] bg-white px-3 py-2">
                      <p className="flex items-center gap-1.5 text-[#64748B]">
                        <Calendar className="h-3.5 w-3.5" />
                        {b.scheduledDate ? "Date" : "Date souhaitée"}
                      </p>
                      <p className="mt-1 truncate font-bold text-[#111827]">{b.scheduledDate ? formatDate(b.scheduledDate) : b.startDate ? formatDate(b.startDate) : "À planifier"}</p>
                    </div>
                    <div className="rounded-2xl border border-[#E3E8F2] bg-white px-3 py-2">
                      <p className="flex items-center gap-1.5 text-[#64748B]">
                        <Clock className="h-3.5 w-3.5" />
                        Heure
                      </p>
                      <p className="mt-1 truncate font-bold text-[#111827]">{b.scheduledTime || b.preferredTime || "—"}</p>
                    </div>
                    <div className="rounded-2xl border border-[#E3E8F2] bg-white px-3 py-2">
                      <p className="flex items-center gap-1.5 text-[#64748B]">
                        {b.courseFormat === "HOME" ? <Home className="h-3.5 w-3.5" /> : <Video className="h-3.5 w-3.5" />}
                        Format
                      </p>
                      <p className="mt-1 truncate font-bold text-[#111827]">{b.courseFormat === "HOME" ? "À domicile" : "En ligne"}</p>
                    </div>
                    <div className="rounded-2xl border border-[#E3E8F2] bg-white px-3 py-2">
                      <p className="flex items-center gap-1.5 text-[#64748B]">
                        <BookOpen className="h-3.5 w-3.5" />
                        Montant
                      </p>
                      <p className="mt-1 text-xs font-black text-[#111827]">{b.isQuoteOnly ? "Sur devis" : <Money amount={b.totalPrice} />}</p>
                    </div>
                  </div>

                  <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded-2xl border border-[#DDE6F7] bg-white px-3 py-2">
                      <p className="text-[#64748B]">Formule</p>
                      <p className="mt-1 truncate font-bold text-[#111B4D]">{packTypeLabel(b.packType)}</p>
                    </div>
                    <div className="rounded-2xl border border-[#DDE6F7] bg-white px-3 py-2">
                      <p className="text-[#64748B]">Professeur</p>
                      <p className="mt-1 truncate font-bold text-[#111B4D]">{name}</p>
                    </div>
                  </div>

                  {b.courseFormat === "ONLINE" && b.onlineLink && tabId === "avenir" && (
                    <a
                      href={b.onlineLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-[#E3E8F2] bg-white px-3 py-2 text-xs font-bold text-[#111B4D] shadow-sm transition hover:border-[#111B4D] hover:bg-white"
                    >
                      <Video className="h-3.5 w-3.5" />
                      Rejoindre le cours en ligne
                    </a>
                  )}

                  <p className="mt-3 rounded-2xl border border-[#DDE6F7] bg-white px-3 py-2 text-xs font-medium leading-5 text-[#475569]">
                    {step.hint}
                  </p>

                  <div className="mt-3 grid gap-2 min-[460px]:grid-cols-2">
                    <Button asChild variant="outline" size="sm" className="min-h-11 w-full rounded-2xl">
                      <Link href={`/professeurs/${b.teacher.id}`}>
                        Profil professeur
                      </Link>
                    </Button>
                    <Button asChild size="sm" className="min-h-11 w-full rounded-2xl">
                      <Link href={`/client/reservations/${b.id}`}>
                        Voir détails <ArrowRight className="ml-1 h-3.5 w-3.5" />
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

function CourseSignalCard({
  icon: Icon,
  label,
  value,
  detail,
}: {
  icon: typeof Calendar;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-2xl border border-[#E3E8F2] bg-white p-3 shadow-sm">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#111B4D] text-white">
          <Icon className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-wide text-[#64748B]">{label}</p>
          <p className="mt-0.5 break-words text-lg font-black leading-tight text-[#111827]">{value}</p>
          <p className="mt-1 text-xs font-medium leading-5 text-[#64748B]">{detail}</p>
        </div>
      </div>
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
