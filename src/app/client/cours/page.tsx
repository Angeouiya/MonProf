import Link from "next/link";
import { ArrowRight, Search } from "lucide-react";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/session";
import { formatDate, formatFCFA } from "@/lib/format";
import { hasVerifiedClientPayment } from "@/lib/payment-security";
import { CLIENT_COURSE_PAGE_SIZE, getClientCourseIndex, type ClientCourseTab } from "@/lib/client-course-index";
import { ClientPageHeader, ClientSurface } from "@/components/shared/client-page-primitives";
import { ProfessorImage } from "@/components/shared/professor-image";

export const dynamic = "force-dynamic";

const TABS: Array<{ id: ClientCourseTab; label: string }> = [
  { id: "avenir", label: "À venir" },
  { id: "aconfirmer", label: "À confirmer" },
  { id: "termines", label: "Terminés" },
];

function courseTab(value?: string): ClientCourseTab {
  if (value === "aconfirmer") return "aconfirmer";
  if (value === "termines") return "termines";
  return "avenir"; // Ancien lien ?tab=encours : le cours en cours reste dans À venir.
}

function courseHref(tab: ClientCourseTab, page: number, search: string) {
  const params = new URLSearchParams({ tab });
  if (page > 1) params.set("page", String(page));
  if (search) params.set("q", search);
  return `/client/cours?${params.toString()}`;
}

export default async function CoursPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; page?: string; q?: string }>;
}) {
  const user = await getSessionUser();
  if (!user) return null;
  const sp = await searchParams;
  const tab = courseTab(sp.tab);
  const requestedPage = Number(sp.page ?? 1);
  const index = await getClientCourseIndex({
    clientId: user.id, tab,
    page: Number.isFinite(requestedPage) ? requestedPage : 1,
    search: sp.q ?? "",
  });

  const ids = [...new Set([...index.ids, index.priorityId].filter((id): id is string => Boolean(id)))];
  const rows = ids.length ? await db.booking.findMany({
    where: { clientId: user.id, id: { in: ids } },
    select: {
      id: true, reference: true, subjectName: true, levelName: true,
      status: true, paymentStatus: true, paymentProvider: true,
      paydunyaStatus: true, paydunyaVerifiedAt: true,
      providerPaymentStatus: true, paymentVerifiedAt: true,
      totalClientPays: true, totalPrice: true, isQuoteOnly: true,
      scheduledDate: true, startDate: true, scheduledTime: true,
      preferredTime: true, courseFormat: true,
      teacher: {
        select: { fullName: true, professionalName: true, photoUrl: true, badgeVerified: true },
      },
      transactions: {
        where: { type: "CLIENT_PAYMENT" },
        select: { type: true, status: true, amount: true },
      },
    },
  }) : [];
  const byId = new Map(rows.map((row) => [row.id, row]));
  // Le SQL limite la lecture ; cette seconde vérification garde la preuve métier canonique.
  const bookings = index.ids.flatMap((id) => {
    const booking = byId.get(id);
    return booking && hasVerifiedClientPayment(booking) ? [booking] : [];
  });
  const priority = index.priorityId ? byId.get(index.priorityId) : null;
  const showPriority = priority?.status === "PENDING_CLIENT_VALIDATION" && hasVerifiedClientPayment(priority);
  const counts: Record<ClientCourseTab, number> = {
    avenir: index.upcomingCount,
    aconfirmer: index.confirmationCount,
    termines: index.completedCount,
  };
  const totalPages = Math.max(1, Math.ceil(index.filteredCount / CLIENT_COURSE_PAGE_SIZE));

  return (
    <div className="space-y-5">
      <ClientPageHeader eyebrow="Vos cours" title="Cours" description="Vos cours apparaissent après confirmation du paiement." showBack={false} />

      {showPriority && priority && (
        <ClientSurface compact className="flex flex-wrap items-center justify-between gap-3 border border-[#DDE3EE] p-4" data-client-course-priority>
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-wide text-[#52627A]">À faire maintenant</p>
            <p className="mt-1 text-base font-semibold text-[#111827]">Confirmer votre cours</p>
            <p className="mt-1 text-xs text-[#52627A]">{priority.subjectName} · {priority.reference}</p>
          </div>
          <Link prefetch={false} href={`/client/reservations/${priority.id}?action=confirm`} className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-[#111B4D] px-4 text-sm font-semibold text-white">
            Ouvrir <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </ClientSurface>
      )}

      <nav aria-label="Catégories de cours" className="grid grid-cols-3 gap-1 rounded-xl border border-[#DDE3EE] bg-white p-1">
        {TABS.map((item) => (
          <Link key={item.id} prefetch={false} href={courseHref(item.id, 1, index.search)}
            aria-current={tab === item.id ? "page" : undefined}
            className={`flex min-h-11 items-center justify-center gap-1 rounded-lg px-1 text-center text-xs font-semibold sm:text-sm ${tab === item.id ? "bg-[#111B4D] text-white" : "text-[#111B4D] hover:bg-[#F2F5FA]"}`}>
            {item.label} <span className="opacity-80">{counts[item.id]}</span>
          </Link>
        ))}
      </nav>

      <details className="rounded-lg border border-[#DDE3EE] bg-white p-3" open={Boolean(index.search)} data-client-course-search-panel>
        <summary className="flex min-h-9 cursor-pointer items-center gap-2 text-sm font-semibold text-[#111B4D]">
          <Search className="h-4 w-4" aria-hidden /> Rechercher un cours
        </summary>
        <form action="/client/cours" method="get" className="mt-3 flex flex-wrap gap-2">
          <input type="hidden" name="tab" value={tab} />
          <input name="q" type="search" maxLength={100} defaultValue={index.search}
            placeholder="Référence, matière, professeur" aria-label="Rechercher dans tous vos cours"
            className="min-h-11 min-w-[14rem] flex-1 rounded-lg border border-[#D8DEE9] bg-white px-3 text-sm text-[#111827]" />
          <button type="submit" className="min-h-11 rounded-lg bg-[#111B4D] px-4 text-sm font-semibold text-white">Rechercher</button>
          {index.search && <Link prefetch={false} href={courseHref(tab, 1, "")} className="inline-flex min-h-11 items-center rounded-lg border border-[#D8DEE9] px-4 text-sm font-semibold text-[#111B4D]">Effacer</Link>}
        </form>
      </details>

      <section id="liste-cours" aria-label="Liste des cours" className="space-y-3" data-client-course-list>
        <p className="text-sm font-semibold text-[#52627A]">
          {index.filteredCount} cours{index.search ? ` trouvé${index.filteredCount > 1 ? "s" : ""}` : ""}
        </p>
        {bookings.length === 0 ? (
          <ClientSurface compact className="space-y-3 p-5">
            <p className="font-semibold text-[#111827]">{index.search ? "Aucun cours trouvé" : "Aucun cours dans cette catégorie"}</p>
            <p className="text-sm text-[#52627A]">{index.search ? "Essayez une autre recherche." : "Un cours payé apparaîtra ici dès sa confirmation."}</p>
            <Link prefetch={false} href="/client/reservations" className="inline-flex min-h-10 items-center text-sm font-semibold text-[#111B4D]">Voir mes réservations <ArrowRight className="ml-1 h-4 w-4" aria-hidden /></Link>
          </ClientSurface>
        ) : (
          <div className="grid gap-3 lg:grid-cols-2" data-client-course-results>
            {bookings.map((booking) => {
              const teacherName = booking.teacher.professionalName || booking.teacher.fullName;
              const statusLabel = booking.status === "PENDING_CLIENT_VALIDATION" ? "Votre confirmation attendue"
                : booking.status === "COURSE_DONE" ? "Cours terminé"
                  : booking.status === "IN_PROGRESS" ? "En cours"
                    : tab === "termines" ? "Cours validé" : "À venir";
              const dateLabel = booking.scheduledDate ? formatDate(booking.scheduledDate)
                : booking.startDate ? formatDate(booking.startDate) : "Date à confirmer";
              const timeLabel = booking.scheduledTime || booking.preferredTime || "Créneau à confirmer";
              return (
                <article key={booking.id} className="rounded-xl border border-[#DDE3EE] bg-white p-4" data-client-course-card>
                  <div className="flex min-w-0 items-start gap-3">
                    <ProfessorImage photoUrl={booking.teacher.photoUrl} name={teacherName} size={48} shape="circle" verified={booking.teacher.badgeVerified} />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-[#52627A]">{statusLabel}</p>
                      <h2 className="mt-1 break-words text-base font-semibold text-[#111827]">{booking.subjectName} · {booking.levelName}</h2>
                      <p className="mt-1 text-sm text-[#52627A]">{teacherName}</p>
                    </div>
                  </div>
                  <p className="mt-3 text-sm text-[#52627A]">{dateLabel} · {timeLabel} · {booking.courseFormat === "HOME" ? "À domicile" : "En ligne"}</p>
                  <div className="mt-3 flex items-center justify-between gap-3 border-t border-[#E3E8F2] pt-3">
                    <span className="text-sm font-semibold text-[#111827]">{formatFCFA(booking.totalClientPays || booking.totalPrice)}</span>
                    <Link prefetch={false} href={`/client/reservations/${booking.id}${booking.status === "PENDING_CLIENT_VALIDATION" ? "?action=confirm" : ""}`} className="inline-flex min-h-10 items-center gap-1 rounded-lg bg-[#111B4D] px-4 text-sm font-semibold text-white">
                      {booking.status === "PENDING_CLIENT_VALIDATION" ? "Confirmer" : "Voir le cours"} <ArrowRight className="h-4 w-4" aria-hidden />
                    </Link>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {index.filteredCount > CLIENT_COURSE_PAGE_SIZE && (
        <nav aria-label="Pages des cours" className="flex items-center justify-between gap-3 text-sm font-semibold">
          {index.page > 1 ? <Link prefetch={false} href={courseHref(tab, index.page - 1, index.search)} className="rounded-lg border border-[#D8DEE9] bg-white px-4 py-3 text-[#111B4D]">Précédent</Link> : <span />}
          <span className="text-[#52627A]">{index.page} / {totalPages}</span>
          {index.page < totalPages ? <Link prefetch={false} href={courseHref(tab, index.page + 1, index.search)} className="rounded-lg border border-[#D8DEE9] bg-white px-4 py-3 text-[#111B4D]">Suivant</Link> : <span />}
        </nav>
      )}
    </div>
  );
}
