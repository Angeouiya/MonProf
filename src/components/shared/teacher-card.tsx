import Image from "next/image";
import Link from "next/link";
import { Home, MapPin, Video } from "lucide-react";
import { Teacher } from "@prisma/client";
import { ProfessorImage } from "@/components/shared/professor-image";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { resolveTeacherCover } from "@/lib/teacher-cover";

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
}: {
  teacher: TeacherCardData;
  href?: string;
  profileHref?: string;
}) {
  const directBookingHref = `/client/reserver?teacherId=${teacher.id}`;
  const bookingHref = href ?? `/connexion?from=${encodeURIComponent(directBookingHref)}`;
  const displayName = teacher.professionalName || teacher.fullName;
  const publicRating = teacher.ratingCount > 0 && teacher.rating > 0
    ? teacher.rating
    : teacher.adminRatingPublic && teacher.adminRating > 0
      ? teacher.adminRating
      : null;
  const ratingLabel = publicRating ? `Note ${publicRating.toFixed(1)}/5` : null;
  const primarySubject = teacher.primarySubject ?? "Matière à confirmer";
  const commune = teacher.commune ?? "Abidjan";
  const cover = resolveTeacherCover({ teacherId: teacher.id, coverUrl: teacher.coverUrl });

  return (
    <article
      data-client-teacher-card
      aria-label={`Professeur ${displayName}`}
      className="group flex h-full min-w-0 flex-col overflow-hidden rounded-lg border border-[#DDE3EE] bg-white transition-colors duration-200 hover:border-[#111B4D]"
    >
      <Link
        href={profileHref}
        aria-label={`Voir le profil de ${displayName}`}
        className="block min-w-0 outline-none focus-visible:ring-4 focus-visible:ring-inset focus-visible:ring-[#9AAAD0]"
      >
        <div className="relative aspect-[3/1] w-full overflow-hidden bg-[#111B4D]" data-client-teacher-cover>
          <Image
            src={cover.url}
            alt=""
            fill
            sizes="(max-width: 679px) 100vw, (max-width: 1179px) 50vw, 33vw"
            className="object-contain"
          />
        </div>

        <div className="grid min-w-0 grid-cols-[80px_minmax(0,1fr)] items-start gap-3 px-3 pb-2 min-[640px]:px-4">
          <div
            className="relative z-10 w-fit rounded-full bg-white p-1 shadow-[0_8px_22px_rgba(17,27,77,0.18)]"
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
            <h3 className="line-clamp-2 text-[1.03rem] font-semibold leading-snug text-[#111827]">
              {displayName}
            </h3>
            <p className="mt-0.5 line-clamp-2 text-[13px] font-medium leading-5 text-[#64748B]">{teacher.jobTitle || "Professeur Compétence"}</p>
          </div>
        </div>

        <div className="grid gap-1 px-3 pb-3 text-[12.5px] font-medium leading-5 text-[#475569] min-[640px]:px-4">
          <p className="line-clamp-1 font-semibold text-[#111827]">{primarySubject}</p>
          <p className="flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-0.5">
            <span className="inline-flex min-w-0 items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5 shrink-0 text-[#111B4D]" />
              <span className="truncate">{commune}</span>
            </span>
            {ratingLabel && <span className="font-semibold text-[#111827]">{ratingLabel}</span>}
            <span>{teacher.experienceYears} ans exp.</span>
          </p>
        </div>
      </Link>

      <div className="mx-3 border-t border-[#E3E8F2] pt-3 min-[640px]:mx-4">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] font-semibold text-[#475569]">
          {teacher.offersHome && (
            <span className="inline-flex items-center gap-1.5">
              <Home className="h-3.5 w-3.5 text-[#111B4D]" />
              Domicile
            </span>
          )}
          {teacher.offersOnline && (
            <span className="inline-flex items-center gap-1.5">
              <Video className="h-3.5 w-3.5 text-[#111B4D]" />
              En ligne
            </span>
          )}
        </div>
      </div>
      <div className="mx-3 mt-auto pb-3 pt-3 min-[640px]:mx-4 min-[640px]:pb-4">
        <div className="mb-3 flex items-center justify-between gap-3 border-y border-[#E3E8F2] py-2.5 text-xs font-semibold">
          <span className="text-[#111827]">Tarif officiel selon le parcours</span>
          <span className="shrink-0 text-[#64748B]">avant paiement</span>
        </div>
        <Button asChild className="min-h-11 w-full rounded-lg bg-[#111B4D] px-3 text-sm text-white hover:bg-[#1E2A78] focus-visible:ring-4 focus-visible:ring-[#9AAAD0]">
          <Link href={bookingHref}>Réserver</Link>
        </Button>
      </div>
    </article>
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
