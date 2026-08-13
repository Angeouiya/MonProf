import Image from "next/image";
import Link from "next/link";
import { Home, MapPin, Star, Video } from "lucide-react";
import { Teacher } from "@prisma/client";
import { ProfessorImage } from "@/components/shared/professor-image";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { resolveTeacherCover } from "@/lib/teacher-cover";
import { getTeacherDisplayRating } from "@/lib/teacher-display-rating";

type TeacherCardData = Pick<Teacher,
  "id" | "fullName" | "professionalName" | "photoUrl" | "coverUrl" |
  "jobTitle" | "rating" | "ratingCount" | "experienceYears" |
  "adminRating" | "adminRatingPublic" |
  "offersHome" | "offersOnline" | "commune" |
  "badgeVerified"
> & { _count?: { reviews: number }; primarySubject?: string | null };

export function TeacherCard({
  teacher,
  href,
  profileHref = `/professeurs/${teacher.id}`,
  priceLabel = "Tarif officiel selon le parcours",
  journeyLabel,
}: {
  teacher: TeacherCardData;
  href?: string;
  profileHref?: string;
  priceLabel?: string;
  journeyLabel?: string;
}) {
  const directBookingHref = `/client/reserver?teacherId=${teacher.id}`;
  const bookingHref = href ?? `/connexion?from=${encodeURIComponent(directBookingHref)}`;
  const displayName = teacher.professionalName || teacher.fullName;
  const displayRating = getTeacherDisplayRating(teacher);
  const primarySubject = teacher.primarySubject ?? "Matière à confirmer";
  const commune = teacher.commune ?? "Abidjan";
  const cover = resolveTeacherCover({ teacherId: teacher.id, coverUrl: teacher.coverUrl });
  const formatLabel = teacher.offersHome && teacher.offersOnline
    ? "Domicile · En ligne"
    : teacher.offersHome
      ? "Domicile"
      : teacher.offersOnline
        ? "En ligne"
        : "Format à confirmer";

  return (
    <article
      data-client-teacher-card
      aria-label={`Professeur ${displayName}`}
      className="group flex h-full min-w-0 flex-col overflow-hidden rounded-[1.6rem] border border-[#DDE3EE] bg-white shadow-[0_12px_34px_rgba(17,24,39,0.055)] transition duration-300 hover:-translate-y-1 hover:border-[#C9D1DD] hover:shadow-[0_22px_54px_rgba(17,24,39,0.11)]"
    >
      <Link
        href={profileHref}
        aria-label={`Voir le profil de ${displayName}`}
        className="block min-w-0 outline-none focus-visible:ring-4 focus-visible:ring-inset focus-visible:ring-[#9AAAD0]"
      >
        <div className="relative aspect-[3/1] w-full overflow-hidden bg-gradient-to-br from-[#F8FAFF] via-white to-[#EEF3FF]" data-client-teacher-cover>
          <Image
            src={cover.url}
            alt=""
            fill
            sizes="(max-width: 679px) 100vw, (max-width: 1179px) 50vw, 33vw"
            className="object-contain"
          />
          {journeyLabel && (
            <span
              className="absolute right-3 top-3 inline-flex min-h-8 items-center rounded-full border border-white/80 bg-white/95 px-3 text-[11px] font-black uppercase tracking-[0.12em] text-[#111B4D] shadow-[0_10px_28px_rgba(17,24,39,0.12)] backdrop-blur"
              data-client-teacher-journey-chip
            >
              {journeyLabel}
            </span>
          )}
        </div>

        <div className="grid min-w-0 grid-cols-[80px_minmax(0,1fr)] items-start gap-3 px-4 pb-2">
          <div
            className="relative z-10 w-fit rounded-full bg-white p-[3px] shadow-[0_9px_24px_rgba(17,24,39,0.14)] ring-1 ring-white"
            style={{ marginTop: "-40px" }}
          >
            <ProfessorImage
              photoUrl={teacher.photoUrl}
              name={displayName}
              size={72}
              shape="circle"
              verified={teacher.badgeVerified}
            />
          </div>
          <div className="min-w-0 pt-2">
            <h3 className="line-clamp-2 text-[1.05rem] font-semibold leading-snug tracking-[-0.018em] text-[#111827]">
              {displayName}
            </h3>
            <p className="mt-0.5 line-clamp-1 text-[12.5px] font-medium leading-5 text-[#64748B] sm:line-clamp-2 sm:text-[13px]">{teacher.jobTitle || "Professeur Compétence"}</p>
            <TeacherCardRating rating={displayRating} />
          </div>
        </div>

        <div data-client-teacher-card-essentials className="px-4 pb-3">
          <div className="flex min-w-0 flex-wrap items-center gap-1.5 text-[12.5px] font-semibold leading-5 text-[#475569]">
            <span className="line-clamp-1 max-w-full rounded-full border border-[#E3E8F2] bg-white px-2.5 py-1 text-[#111827]">{primarySubject}</span>
            <span className="inline-flex min-w-0 items-center gap-1.5 rounded-full bg-[#F8FAFF] px-2.5 py-1">
              <MapPin className="h-3.5 w-3.5 shrink-0 text-[#111B4D]" />
              <span className="truncate">{commune}</span>
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#F8FAFF] px-2.5 py-1">
              {teacher.offersOnline && !teacher.offersHome ? <Video className="h-3.5 w-3.5 text-[#111B4D]" /> : <Home className="h-3.5 w-3.5 text-[#111B4D]" />}
              {formatLabel}
            </span>
            <span className="hidden rounded-full bg-[#F8FAFF] px-2.5 py-1 sm:inline-flex">{teacher.experienceYears} ans exp.</span>
          </div>
        </div>
      </Link>

      <div className="mx-4 mt-auto grid grid-cols-[minmax(0,1fr)_112px] items-stretch gap-2 border-t border-[#E3E8F2] pb-4 pt-3" data-client-teacher-card-action-row>
        <div className="min-w-0 rounded-2xl border border-[#E3E8F2] bg-[#F8FAFF] px-3 py-2.5" data-client-teacher-price>
          <span className="block text-[10px] font-bold uppercase tracking-wide text-[#64748B]">
            Prix officiel{journeyLabel ? ` · ${journeyLabel}` : ""}
          </span>
          <span className="mt-0.5 block text-sm font-bold leading-5 text-[#111B4D]">{priceLabel}</span>
        </div>
        <Button asChild className="h-full min-h-12 w-full rounded-xl bg-[#111B4D] px-3 text-sm text-white hover:bg-[#1E2A78] focus-visible:ring-4 focus-visible:ring-[#9AAAD0]">
          <Link href={bookingHref}>Choisir</Link>
        </Button>
      </div>
    </article>
  );
}

function TeacherCardRating({
  rating,
}: {
  rating: ReturnType<typeof getTeacherDisplayRating>;
}) {
  if (!rating.hasRating) {
    return (
      <div
        className="mt-1.5 inline-flex min-h-7 max-w-full items-center rounded-full border border-[#E3E8F2] bg-white px-2.5 text-[11px] font-black text-[#64748B]"
        data-client-teacher-card-rating="empty"
      >
        Nouveau · aucun avis
      </div>
    );
  }

  return (
    <div
      className="mt-1.5 flex min-w-0 flex-wrap items-center gap-1.5 text-[11px] font-black text-[#111827]"
      data-client-teacher-card-rating="scored"
    >
      <RatingStars value={rating.average} />
      <span className="tabular-nums text-[#111B4D]">{rating.average.toFixed(1).replace(".", ",")}/5</span>
      <span className="min-w-0 truncate text-[#64748B]">{rating.sourceLabel}</span>
    </div>
  );
}

function RatingStars({ value }: { value: number }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-hidden="true" data-client-teacher-card-stars>
      {[1, 2, 3, 4, 5].map((star) => {
        const fillPercent = Math.max(0, Math.min(100, (value - star + 1) * 100));

        return (
          <span key={star} className="relative inline-flex h-3.5 w-3.5 shrink-0">
            <Star className="absolute inset-0 h-3.5 w-3.5 text-[#CBD5E1]" strokeWidth={2.4} />
            <span className="absolute inset-0 overflow-hidden" style={{ width: `${fillPercent}%` }}>
              <Star className="h-3.5 w-3.5 fill-[#F59E0B] text-[#F59E0B]" strokeWidth={2.4} />
            </span>
          </span>
        );
      })}
    </span>
  );
}

export function TeacherCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-lg border border-[#E3E8F2] bg-white">
      <Skeleton className="aspect-[3/1] w-full rounded-none" />
      <div className="grid grid-cols-[80px_minmax(0,1fr)] gap-3 px-4 pb-3">
        <Skeleton className="-mt-10 h-20 w-20 shrink-0 rounded-full border-4 border-white" />
        <div className="space-y-2 pt-3">
          <Skeleton className="h-4 w-1/2 rounded-full" />
          <Skeleton className="h-3 w-1/3 rounded-full" />
        </div>
      </div>
      <div className="space-y-3 px-4 pb-4">
        <Skeleton className="h-3 w-2/3 rounded-full" />
        <Skeleton className="h-11 rounded-lg" />
      </div>
    </div>
  );
}
