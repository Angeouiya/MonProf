import Link from "next/link";
import { Prisma } from "@prisma/client";
import { ArrowRight } from "lucide-react";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/session";
import { formatDate } from "@/lib/format";
import { REVIEWABLE_BOOKING_STATUSES } from "@/lib/review-policy";
import { ClientPageHeader, ClientSurface } from "@/components/shared/client-page-primitives";
import { ProfessorImage } from "@/components/shared/professor-image";
import { ReviewDialog } from "./review-dialog";

export const dynamic = "force-dynamic";

const PENDING_PAGE_SIZE = 5;
const HISTORY_PAGE_SIZE = 20;

function safePage(raw?: string) {
  const value = Number(raw ?? 1);
  return Number.isFinite(value) ? Math.max(1, Math.min(10_000, Math.trunc(value))) : 1;
}

function reviewHref(pendingPage: number, historyPage: number) {
  const params = new URLSearchParams();
  if (pendingPage > 1) params.set("a", String(pendingPage));
  if (historyPage > 1) params.set("h", String(historyPage));
  return `/client/avis${params.size ? `?${params.toString()}` : ""}`;
}

export default async function AvisPage({
  searchParams,
}: {
  searchParams: Promise<{ a?: string; h?: string }>;
}) {
  const user = await getSessionUser();
  if (!user) return null;
  const sp = await searchParams;
  const pendingPage = safePage(sp.a);
  const historyPage = safePage(sp.h);
  const pendingWhere: Prisma.BookingWhereInput = {
    clientId: user.id,
    status: { in: [...REVIEWABLE_BOOKING_STATUSES] },
    reviews: { none: { clientId: user.id } },
  };
  const historyWhere: Prisma.ReviewWhereInput = { clientId: user.id };

  const [pendingCount, pendingBookings, historyCount, reviews] = await db.$transaction([
    db.booking.count({ where: pendingWhere }),
    db.booking.findMany({
      where: pendingWhere,
      orderBy: [{ clientValidatedAt: "desc" }, { teacherPaidAt: "desc" }, { updatedAt: "desc" }],
      skip: (pendingPage - 1) * PENDING_PAGE_SIZE,
      take: PENDING_PAGE_SIZE,
      select: {
        id: true, reference: true, subjectName: true, levelName: true,
        teacher: { select: { fullName: true, professionalName: true, photoUrl: true, badgeVerified: true } },
      },
    }),
    db.review.count({ where: historyWhere }),
    db.review.findMany({
      where: historyWhere,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: (historyPage - 1) * HISTORY_PAGE_SIZE,
      take: HISTORY_PAGE_SIZE,
      select: {
        id: true, rating: true, comment: true, published: true, createdAt: true,
        teacher: { select: { fullName: true, professionalName: true, photoUrl: true, badgeVerified: true } },
        booking: { select: { id: true, reference: true, subjectName: true, levelName: true } },
      },
    }),
  ]);
  const primaryReviewBooking = pendingBookings[0] ?? null;
  const pendingPages = Math.max(1, Math.ceil(pendingCount / PENDING_PAGE_SIZE));
  const historyPages = Math.max(1, Math.ceil(historyCount / HISTORY_PAGE_SIZE));

  return (
    <div className="space-y-5">
      <ClientPageHeader eyebrow="Vos retours" title="Avis" description="Évaluez un cours terminé et retrouvez vos avis." showBack={false} />

      {primaryReviewBooking && (
        <section id="avis-a-evaluer" className="space-y-3" aria-label="Cours à évaluer">
          <div className="flex items-end justify-between gap-3">
            <h2 className="text-lg font-semibold text-[#111827]">À évaluer</h2>
            <span className="text-sm font-semibold text-[#52627A]">{pendingCount}</span>
          </div>
          <div className="grid gap-3 lg:grid-cols-2">
            {pendingBookings.map((booking) => {
              const teacherName = booking.teacher.professionalName || booking.teacher.fullName;
              return (
                <ClientSurface key={booking.id} compact className="border border-[#DDE3EE] p-4" data-client-review-pending-card>
                  <div className="flex min-w-0 items-start gap-3">
                    <ProfessorImage photoUrl={booking.teacher.photoUrl} name={teacherName} size={48} shape="circle" verified={booking.teacher.badgeVerified} />
                    <div className="min-w-0 flex-1">
                      <p className="break-words font-semibold text-[#111827]">{teacherName}</p>
                      <p className="mt-1 text-sm text-[#52627A]">{booking.subjectName} · {booking.levelName}</p>
                      <p className="mt-1 text-xs text-[#64748B]">{booking.reference}</p>
                    </div>
                  </div>
                  <div className="mt-3 border-t border-[#E3E8F2] pt-3">
                    <ReviewDialog bookingId={booking.id} teacherName={teacherName} triggerClassName="mt-0" />
                  </div>
                </ClientSurface>
              );
            })}
          </div>
          {pendingCount > PENDING_PAGE_SIZE && (
            <nav aria-label="Pages des cours à évaluer" className="flex items-center justify-between gap-3 text-sm font-semibold">
              {pendingPage > 1 ? <Link prefetch={false} href={`${reviewHref(pendingPage - 1, historyPage)}#avis-a-evaluer`} className="text-[#111B4D]">Précédent</Link> : <span />}
              <span className="text-[#52627A]">{pendingPage} / {pendingPages}</span>
              {pendingPage < pendingPages ? <Link prefetch={false} href={`${reviewHref(pendingPage + 1, historyPage)}#avis-a-evaluer`} className="text-[#111B4D]">Suivant</Link> : <span />}
            </nav>
          )}
        </section>
      )}

      <section id="historique-avis" className="space-y-3" aria-label="Historique des avis" data-client-review-history>
        <div className="flex items-end justify-between gap-3">
          <h2 className="text-lg font-semibold text-[#111827]">Mes avis</h2>
          <span className="text-sm font-semibold text-[#52627A]">{historyCount} envoyé{historyCount > 1 ? "s" : ""}</span>
        </div>
        {reviews.length === 0 ? (
          <ClientSurface compact className="p-5">
            <p className="font-semibold text-[#111827]">Aucun avis pour le moment</p>
            <p className="mt-1 text-sm text-[#52627A]">Après un cours confirmé, vous pourrez partager votre retour ici.</p>
          </ClientSurface>
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {reviews.map((review) => {
              const teacherName = review.teacher.professionalName || review.teacher.fullName;
              return (
                <article key={review.id} className="rounded-xl border border-[#DDE3EE] bg-white p-4" data-client-review-card>
                  <div className="flex min-w-0 items-start gap-3">
                    <ProfessorImage photoUrl={review.teacher.photoUrl} name={teacherName} size={44} shape="circle" verified={review.teacher.badgeVerified} />
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-[#111827]">{teacherName}</p>
                      <p className="mt-1 text-sm text-[#52627A]">{review.booking.subjectName} · {review.booking.levelName}</p>
                    </div>
                    <span className="shrink-0 text-sm font-bold text-[#111B4D]" aria-label={`Note ${review.rating} sur 5`}>{review.rating}/5</span>
                  </div>
                  <p className="mt-3 text-xs text-[#52627A]">{formatDate(review.createdAt)} · {review.published ? "Publié" : "En examen"}</p>
                  {review.comment && <p className="mt-2 break-words text-sm leading-6 text-[#111827]">{review.comment}</p>}
                  <Link prefetch={false} href={`/client/reservations/${review.booking.id}`} className="mt-3 inline-flex min-h-10 items-center gap-1 text-sm font-semibold text-[#111B4D]">
                    Voir le cours <ArrowRight className="h-4 w-4" aria-hidden />
                  </Link>
                </article>
              );
            })}
          </div>
        )}
        {historyCount > HISTORY_PAGE_SIZE && (
          <nav aria-label="Pages des avis" className="flex items-center justify-between gap-3 text-sm font-semibold">
            {historyPage > 1 ? <Link prefetch={false} href={`${reviewHref(pendingPage, historyPage - 1)}#historique-avis`} className="text-[#111B4D]">Précédent</Link> : <span />}
            <span className="text-[#52627A]">{historyPage} / {historyPages}</span>
            {historyPage < historyPages ? <Link prefetch={false} href={`${reviewHref(pendingPage, historyPage + 1)}#historique-avis`} className="text-[#111B4D]">Suivant</Link> : <span />}
          </nav>
        )}
      </section>
    </div>
  );
}
