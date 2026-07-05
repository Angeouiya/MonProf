import Link from "next/link";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/session";
import {
  ClientAppRail,
  ClientEmptyState,
  ClientInfoPill,
  ClientMetricStrip,
  ClientPageHeader,
  ClientRecordCard,
  ClientSectionTitle,
  ClientSurface,
} from "@/components/shared/client-page-primitives";
import { ProfessorImage } from "@/components/shared/professor-image";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/format";
import {
  ArrowRight, BookOpen, CalendarCheck, CalendarDays, ClipboardCheck, LifeBuoy, MessageSquare, Search, ShieldCheck,
} from "lucide-react";
import { ReviewDialog } from "./review-dialog";
import { REVIEWABLE_BOOKING_STATUSES } from "@/lib/review-policy";

export const dynamic = "force-dynamic";

export default async function AvisPage() {
  const user = await getSessionUser();
  if (!user) return null;

  // Réservations validées par le client, sans avis
  const bookingsToReview = await db.booking.findMany({
    where: {
      clientId: user.id,
      status: { in: [...REVIEWABLE_BOOKING_STATUSES] },
      reviews: { none: { clientId: user.id } },
    },
    orderBy: [{ clientValidatedAt: "desc" }, { teacherPaidAt: "desc" }, { updatedAt: "desc" }],
    include: {
      teacher: {
        select: {
          id: true,
          fullName: true,
          professionalName: true,
          photoUrl: true,
          jobTitle: true,
          badgeVerified: true,
        },
      },
    },
  });

  // Avis déjà laissés
  const myReviews = await db.review.findMany({
    where: { clientId: user.id },
    orderBy: { createdAt: "desc" },
    include: {
      teacher: {
        select: {
          id: true,
          fullName: true,
          professionalName: true,
          photoUrl: true,
          jobTitle: true,
          badgeVerified: true,
        },
      },
      booking: { select: { id: true, reference: true, subjectName: true, levelName: true } },
    },
  });
  const primaryReviewBooking = bookingsToReview[0] ?? null;
  const secondaryReviewBookings = bookingsToReview.slice(1);
  const primaryReviewTeacherName = primaryReviewBooking
    ? primaryReviewBooking.teacher.professionalName || primaryReviewBooking.teacher.fullName
    : "";

  return (
    <div className="space-y-6">
      <ClientPageHeader
        eyebrow="Qualité"
        title="Avis"
        description="Évaluez vos cours terminés et gardez un historique clair de vos retours qualité."
      />

      <ClientMetricStrip
        metrics={[
          { icon: ClipboardCheck, label: "À donner", value: bookingsToReview.length, attention: bookingsToReview.length > 0 },
          { icon: MessageSquare, label: "Envoyés", value: myReviews.length },
          { icon: ShieldCheck, label: "Qualité", value: "Suivi admin" },
        ]}
      />

      <ClientAppRail
        items={[
          { href: "/client/avis", icon: MessageSquare, label: "Avis", value: `${myReviews.length} publié(s)`, active: true },
          { href: "/client/reservations", icon: CalendarCheck, label: "Dossiers", value: "Cours terminés" },
          { href: "/client/rechercher", icon: Search, label: "Réserver", value: "Nouveau professeur" },
          { href: "/client/support", icon: LifeBuoy, label: "Support", value: "Qualité et litige" },
        ]}
      />

      <section className="space-y-3">
        <ClientSectionTitle
          title="À évaluer"
          description={bookingsToReview.length > 0 ? `${bookingsToReview.length} retour${bookingsToReview.length > 1 ? "s" : ""} qualité attendu${bookingsToReview.length > 1 ? "s" : ""}` : "Tout est à jour"}
        />
        {!primaryReviewBooking ? (
          <ClientEmptyState
            icon={MessageSquare}
            title="Aucun avis en attente"
            description="Les cours terminés à évaluer apparaîtront ici automatiquement."
          />
        ) : (
          <>
            <ClientSurface className="p-4 sm:p-5">
              <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-center">
                <div className="flex min-w-0 gap-4">
                  <ProfessorImage
                    photoUrl={primaryReviewBooking.teacher.photoUrl}
                    name={primaryReviewTeacherName}
                    size={76}
                    shape="circle"
                    verified={primaryReviewBooking.teacher.badgeVerified}
                  />
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-[#64748B]">Prochain avis</p>
                    <h2 className="mt-1 break-words text-xl font-semibold leading-tight text-[#111827]">{primaryReviewTeacherName}</h2>
                    <p className="mt-1 break-words text-sm font-medium leading-5 text-[#64748B]">
                      {primaryReviewBooking.teacher.jobTitle || "Professeur Compétence"}
                    </p>
                    <div className="mt-3 grid gap-2 min-[460px]:grid-cols-3">
                      <ClientInfoPill label="Cours" value={primaryReviewBooking.subjectName} />
                      <ClientInfoPill label="Niveau" value={primaryReviewBooking.levelName} />
                      <ClientInfoPill label="Dossier" value={primaryReviewBooking.reference} />
                    </div>
                  </div>
                </div>
                <div className="grid gap-2">
                  <ReviewDialog bookingId={primaryReviewBooking.id} teacherName={primaryReviewTeacherName} triggerClassName="mt-0" />
                  <Button asChild variant="outline" className="min-h-11 rounded-lg">
                    <Link href={`/client/reservations/${primaryReviewBooking.id}`}>
                      Voir le dossier
                      <ArrowRight className="ml-1.5 h-4 w-4" />
                    </Link>
                  </Button>
                </div>
              </div>
            </ClientSurface>

            {secondaryReviewBookings.length > 0 && (
              <div className="grid gap-3 xl:grid-cols-2">
                {secondaryReviewBookings.map((b) => {
                  const name = b.teacher.professionalName || b.teacher.fullName;
                  return (
                    <ClientRecordCard key={b.id} data-client-review-pending-card>
                      <div className="grid gap-3 p-3.5 min-[520px]:grid-cols-[minmax(0,1fr)_auto] min-[520px]:items-center sm:p-4">
                        <div className="flex min-w-0 items-start gap-3">
                          <ProfessorImage photoUrl={b.teacher.photoUrl} name={name} size={52} shape="circle" verified={b.teacher.badgeVerified} />
                          <div className="min-w-0">
                            <p className="break-words text-sm font-semibold leading-5 text-[#111827]">{name}</p>
                            <p className="break-words text-xs font-medium leading-5 text-[#64748B]">
                              {b.subjectName} · {b.levelName}
                            </p>
                            <p className="mt-0.5 font-mono text-[11px] font-semibold uppercase tracking-wide text-[#64748B]">{b.reference}</p>
                          </div>
                        </div>
                        <div className="grid gap-2 min-[420px]:grid-cols-2 min-[520px]:w-52 min-[520px]:grid-cols-1">
                          <ReviewDialog bookingId={b.id} teacherName={name} triggerClassName="mt-0" />
                          <Button asChild size="sm" variant="outline" className="min-h-11 rounded-lg">
                            <Link href={`/client/reservations/${b.id}`}>Dossier</Link>
                          </Button>
                        </div>
                      </div>
                    </ClientRecordCard>
                  );
                })}
              </div>
            )}
          </>
        )}
      </section>

      {/* Mes avis */}
      <section className="space-y-3">
        <ClientSectionTitle title="Historique" description={`${myReviews.length} avis publié${myReviews.length > 1 ? "s" : ""}`} />
        {myReviews.length === 0 ? (
          <ClientEmptyState
            icon={BookOpen}
            title="Aucun avis publié"
            description="Vos avis apparaîtront ici une fois publiés."
          />
        ) : (
          <div className="grid gap-3 xl:grid-cols-2">
            {myReviews.map((r) => {
              const name = r.teacher.professionalName || r.teacher.fullName;
              return (
                <ClientRecordCard key={r.id} data-client-review-card>
                  <div className="p-3.5 sm:p-4">
                    <div className="flex items-start gap-3">
                      <ProfessorImage photoUrl={r.teacher.photoUrl} name={name} size={56} shape="circle" verified={r.teacher.badgeVerified} />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-col gap-1 min-[520px]:flex-row min-[520px]:items-start min-[520px]:justify-between">
                          <div className="min-w-0">
                            <p className="break-words text-[15px] font-semibold leading-5 text-[#111827]">{name}</p>
                            <p className="break-words text-xs font-medium text-[#64748B]">{r.teacher.jobTitle || "Professeur Compétence"}</p>
                          </div>
                          <span className="flex w-fit items-center gap-1.5 text-xs font-semibold text-[#64748B]">
                            <CalendarDays className="h-3.5 w-3.5" />
                            {formatDate(r.createdAt)}
                          </span>
                        </div>
                        <div className="mt-3 flex flex-col gap-2 text-xs font-medium text-[#475569] min-[520px]:flex-row min-[520px]:items-center min-[520px]:justify-between">
                          <span className="flex min-w-0 items-center gap-2">
                            <BookOpen className="h-4 w-4 shrink-0 text-[#111B4D]" />
                            <span className="min-w-0 truncate">{r.booking.subjectName} · {r.booking.levelName}</span>
                          </span>
                          <span className="inline-flex min-h-8 w-fit items-center rounded-lg bg-[#111B4D] px-3 text-xs font-semibold text-white">
                            {r.rating}/5
                          </span>
                        </div>
                        {r.comment && (
                          <p className="mt-3 line-clamp-3 rounded-lg border border-[#E3E8F2] bg-white px-3 py-2 text-sm leading-6 text-[#111827]">{r.comment}</p>
                        )}
                        <Button asChild size="sm" variant="outline" className="mt-3 min-h-11 w-full rounded-lg min-[460px]:w-auto">
                          <Link href={`/client/reservations/${r.booking.id}`}>Voir le dossier</Link>
                        </Button>
                      </div>
                    </div>
                  </div>
                </ClientRecordCard>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
