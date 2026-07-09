import Link from "next/link";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/session";
import {
  CLIENT_COMMAND_CENTERS_ENABLED,
  ClientEmptyState,
  ClientInfoPill,
  ClientMetricStrip,
  ClientPageHeader,
  ClientProcessTracker,
  ClientRecordCard,
  ClientSectionTitle,
  ClientSurface,
} from "@/components/shared/client-page-primitives";
import { ProfessorImage } from "@/components/shared/professor-image";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/format";
import {
  ArrowRight, CalendarCheck, ClipboardCheck, LifeBuoy, MessageSquare, Search, ShieldCheck,
} from "lucide-react";
import { ReviewDialog } from "./review-dialog";
import { REVIEWABLE_BOOKING_STATUSES } from "@/lib/review-policy";
import { ReviewHistoryClient, type ClientReviewHistoryItem } from "./review-history-client";

export const dynamic = "force-dynamic";

export default async function AvisPage() {
  const user = await getSessionUser();
  if (!user) return null;

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
  const reviewHistory: ClientReviewHistoryItem[] = myReviews.map((review) => ({
    id: review.id,
    rating: review.rating,
    comment: review.comment,
    createdAt: review.createdAt.toISOString(),
    teacher: {
      id: review.teacher.id,
      fullName: review.teacher.fullName,
      professionalName: review.teacher.professionalName,
      photoUrl: review.teacher.photoUrl,
      jobTitle: review.teacher.jobTitle,
      badgeVerified: review.teacher.badgeVerified,
    },
    booking: {
      id: review.booking.id,
      reference: review.booking.reference,
      subjectName: review.booking.subjectName,
      levelName: review.booking.levelName,
    },
  }));
  const averageRating = myReviews.length
    ? myReviews.reduce((sum, review) => sum + review.rating, 0) / myReviews.length
    : 0;
  const lowRatingCount = myReviews.filter((review) => review.rating <= 3).length;
  const latestReview = myReviews[0] ?? null;
  const latestReviewTeacherName = latestReview
    ? latestReview.teacher.professionalName || latestReview.teacher.fullName
    : "";

  return (
    <div className="space-y-6">
      <ClientPageHeader
        eyebrow="Qualité"
        title="Avis"
        description="Évaluez vos cours terminés et gardez un historique clair de vos retours qualité."
      />

      <ClientMetricStrip
        className="max-md:hidden"
        metrics={[
          { icon: ClipboardCheck, label: "À donner", value: bookingsToReview.length, attention: bookingsToReview.length > 0 },
          { icon: MessageSquare, label: "Envoyés", value: myReviews.length },
          { icon: ShieldCheck, label: "Qualité", value: "Suivi service client" },
        ]}
      />

      <ReviewMobilePriorityCard
        pendingCount={bookingsToReview.length}
        publishedCount={myReviews.length}
        averageRating={averageRating}
        lowRatingCount={lowRatingCount}
        primaryReviewBooking={primaryReviewBooking}
        primaryReviewTeacherName={primaryReviewTeacherName}
        latestReview={latestReview ? {
          teacherName: latestReviewTeacherName,
          subjectName: latestReview.booking.subjectName,
          levelName: latestReview.booking.levelName,
          rating: latestReview.rating,
          bookingId: latestReview.booking.id,
        } : null}
      />

      {CLIENT_COMMAND_CENTERS_ENABLED && (
      <div className="max-md:hidden">
        <ReviewCommandCenter
          pendingCount={bookingsToReview.length}
          publishedCount={myReviews.length}
          averageRating={averageRating}
          lowRatingCount={lowRatingCount}
          primaryReviewBooking={primaryReviewBooking}
          primaryReviewTeacherName={primaryReviewTeacherName}
          latestReview={latestReview ? {
            teacherName: latestReviewTeacherName,
            subjectName: latestReview.booking.subjectName,
            levelName: latestReview.booking.levelName,
            rating: latestReview.rating,
            bookingId: latestReview.booking.id,
          } : null}
        />
      </div>
      )}

      <section id="avis-a-evaluer" className="scroll-mt-24 space-y-3">
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
        <ReviewHistoryClient reviews={reviewHistory} />
      </section>
    </div>
  );
}

type ReviewCommandCenterProps = {
  pendingCount: number;
  publishedCount: number;
  averageRating: number;
  lowRatingCount: number;
  primaryReviewBooking: ReviewCommandCenterBooking | null;
  primaryReviewTeacherName: string;
  latestReview: {
    teacherName: string;
    subjectName: string;
    levelName: string;
    rating: number;
    bookingId: string;
  } | null;
};

type ReviewCommandCenterBooking = {
  id: string;
  reference: string;
  subjectName: string;
  levelName: string;
};

function ReviewMobilePriorityCard({
  pendingCount,
  publishedCount,
  averageRating,
  lowRatingCount,
  primaryReviewBooking,
  primaryReviewTeacherName,
  latestReview,
}: ReviewCommandCenterProps) {
  const hasPending = Boolean(primaryReviewBooking);
  const averageLabel = averageRating > 0 ? `${averageRating.toFixed(1)}/5` : "Aucune";
  const actionHref = primaryReviewBooking
    ? "#avis-a-evaluer"
    : latestReview
      ? `/client/reservations/${latestReview.bookingId}`
      : "/client/rechercher";
  const actionLabel = primaryReviewBooking ? "Noter" : latestReview ? "Dossier" : "Réserver";
  const title = primaryReviewBooking
    ? primaryReviewTeacherName
    : latestReview
      ? latestReview.teacherName
      : "Aucun avis en attente";
  const hint = primaryReviewBooking
    ? `${primaryReviewBooking.subjectName} · ${primaryReviewBooking.levelName} · ${primaryReviewBooking.reference}`
    : latestReview
      ? `Dernière note ${latestReview.rating}/5 · ${latestReview.subjectName}`
      : "Vos prochains cours terminés apparaîtront ici.";

  return (
    <ClientSurface compact className="space-y-3 rounded-lg border border-[#D8DEE9] p-3 md:hidden" data-client-review-mobile-priority>
      <div className="flex min-w-0 items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#111B4D] text-white">
          {hasPending ? <ClipboardCheck className="h-4 w-4" /> : <ShieldCheck className="h-4 w-4" />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-[#111B4D]">Priorité qualité</p>
          <h2 className="mt-0.5 break-words text-base font-semibold leading-5 text-[#111827]">{title}</h2>
          <p className="mt-1 line-clamp-2 text-xs font-medium leading-5 text-[#52627A]">{hint}</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-1.5">
        <ClientInfoPill label="À donner" value={pendingCount} strong={pendingCount > 0} />
        <ClientInfoPill label="Envoyés" value={publishedCount} strong={publishedCount > 0} />
        <ClientInfoPill label="Moyenne" value={averageLabel} strong={averageRating > 0} />
      </div>

      <div className="flex min-w-0 items-center justify-between gap-2 rounded-lg border border-[#D8DEE9] bg-white px-3 py-2.5">
        <p className="min-w-0 text-xs font-semibold leading-5 text-[#52627A]">
          {lowRatingCount > 0 ? `${lowRatingCount} retour(s) à suivre` : hasPending ? "Avis attendu" : "Qualité à jour"}
        </p>
        <Button asChild size="sm" className="min-h-10 shrink-0 rounded-lg bg-[#111B4D] px-3 text-white hover:bg-[#1E2A78]">
          <Link href={actionHref}>
            {actionLabel}
            <ArrowRight className="ml-1 h-3.5 w-3.5" />
          </Link>
        </Button>
      </div>
    </ClientSurface>
  );
}

function ReviewCommandCenter({
  pendingCount,
  publishedCount,
  averageRating,
  lowRatingCount,
  primaryReviewBooking,
  primaryReviewTeacherName,
  latestReview,
}: ReviewCommandCenterProps) {
  const hasPending = Boolean(primaryReviewBooking);
  const averageLabel = averageRating > 0 ? `${averageRating.toFixed(1)}/5` : "Aucun avis";
  const qualityLabel = lowRatingCount > 0 ? `${lowRatingCount} à suivre` : "Qualité stable";

  return (
    <ClientSurface compact className="overflow-hidden rounded-lg border border-[#DDE3EE] p-0" data-client-review-command-center>
      <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,24rem)]">
        <div className="min-w-0 space-y-4 p-4 min-[640px]:p-5">
          <div className="flex min-w-0 gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-[#111B4D] text-white">
              {hasPending ? <ClipboardCheck className="h-5 w-5" /> : <ShieldCheck className="h-5 w-5" />}
            </span>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[#111B4D]">Suivi qualité</p>
              <h2 className="mt-1 text-xl font-semibold leading-tight text-[#111827]">
                {hasPending ? "Un retour qualité est attendu." : "Vos avis sont à jour."}
              </h2>
              <p className="mt-1 max-w-2xl text-sm font-medium leading-6 text-[#52627A]">
                {hasPending
                  ? "Notez le cours terminé pour aider les autres clients et permettre au service client de suivre la qualité du professeur."
                  : "Votre historique qualité reste relié aux professeurs et aux réservations concernées."}
              </p>
            </div>
          </div>

          <div className="grid gap-2 min-[520px]:grid-cols-2 xl:grid-cols-4">
            <ClientInfoPill label="À donner" value={pendingCount} strong={pendingCount > 0} />
            <ClientInfoPill label="Envoyés" value={publishedCount} strong={publishedCount > 0} />
            <ClientInfoPill label="Moyenne" value={averageLabel} strong={averageRating > 0} />
            <ClientInfoPill label="Signal qualité" value={qualityLabel} strong={lowRatingCount > 0} />
          </div>

          <ClientProcessTracker
            steps={[
              { label: "Cours terminé", hint: "Le dossier devient évaluable après validation.", state: hasPending || publishedCount > 0 ? "done" : "pending" },
              { label: "Avis client", hint: "Note, commentaire et contexte du cours.", state: hasPending ? "current" : publishedCount > 0 ? "done" : "pending" },
              { label: "Suivi qualité", hint: "Le service client garde la traçabilité.", state: publishedCount > 0 ? "done" : hasPending ? "pending" : "current" },
            ]}
          />
        </div>

        <aside className="border-t border-[#DDE3EE] bg-white p-4 min-[640px]:p-5 lg:border-l lg:border-t-0">
          <div className="flex h-full flex-col justify-between gap-4">
            <div className="space-y-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[#64748B]">Action prioritaire</p>
              {primaryReviewBooking ? (
                <div className="rounded-lg border border-[#D8DEE9] bg-white p-3">
                  <p className="text-base font-semibold leading-6 text-[#111827]">{primaryReviewTeacherName}</p>
                  <p className="mt-1 text-xs font-medium leading-5 text-[#64748B]">
                    {primaryReviewBooking.subjectName} · {primaryReviewBooking.levelName}
                  </p>
                  <p className="mt-1 font-mono text-[11px] font-semibold uppercase tracking-wide text-[#64748B]">
                    {primaryReviewBooking.reference}
                  </p>
                </div>
              ) : latestReview ? (
                <div className="rounded-lg border border-[#D8DEE9] bg-white p-3">
                  <p className="text-base font-semibold leading-6 text-[#111827]">{latestReview.teacherName}</p>
                  <p className="mt-1 text-xs font-medium leading-5 text-[#64748B]">
                    {latestReview.subjectName} · {latestReview.levelName}
                  </p>
                  <p className="mt-1 text-xs font-semibold text-[#111B4D]">Dernière note : {latestReview.rating}/5</p>
                </div>
              ) : (
                <div className="rounded-lg border border-[#D8DEE9] bg-white p-3">
                  <p className="text-base font-semibold leading-6 text-[#111827]">Aucun cours à noter</p>
                  <p className="mt-1 text-xs font-medium leading-5 text-[#64748B]">Réservez un cours pour construire votre historique qualité.</p>
                </div>
              )}
            </div>

            {primaryReviewBooking ? (
              <ReviewDialog bookingId={primaryReviewBooking.id} teacherName={primaryReviewTeacherName} triggerClassName="mt-0" />
            ) : latestReview ? (
              <Button asChild className="min-h-11 w-full rounded-lg bg-[#111B4D] text-white hover:bg-[#1E2A78]">
                <Link href={`/client/reservations/${latestReview.bookingId}`}>
                  Ouvrir le dernier dossier
                  <ArrowRight className="ml-1.5 h-4 w-4" />
                </Link>
              </Button>
            ) : (
              <Button asChild className="min-h-11 w-full rounded-lg bg-[#111B4D] text-white hover:bg-[#1E2A78]">
                <Link href="/client/rechercher">
                  Trouver un professeur
                  <ArrowRight className="ml-1.5 h-4 w-4" />
                </Link>
              </Button>
            )}
          </div>
        </aside>
      </div>
    </ClientSurface>
  );
}
