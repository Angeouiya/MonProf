import Link from "next/link";
import { BadgeCheck, Home, MapPin, Video } from "lucide-react";
import { Teacher } from "@prisma/client";
import { ProfessorImage } from "@/components/shared/professor-image";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { formatFCFA } from "@/lib/format";

type TeacherCardData = Pick<Teacher,
  "id" | "fullName" | "professionalName" | "photoUrl" |
  "jobTitle" | "rating" | "ratingCount" | "experienceYears" |
  "pricePerSession" | "offersHome" | "offersOnline" | "commune" |
  "badgeVerified"
> & { _count?: { reviews: number }; primarySubject?: string | null };

export function TeacherCard({ teacher, href }: { teacher: TeacherCardData; href?: string }) {
  const profileHref = `/professeurs/${teacher.id}`;
  const bookingHref = href ?? `/client/reserver?teacherId=${teacher.id}`;
  const displayName = teacher.professionalName || teacher.fullName;
  const hasValidIndicativePrice = teacher.pricePerSession > 0;

  return (
    <article
      className="group flex h-full min-w-0 flex-col rounded-[1.35rem] border border-[#E3E8F2] bg-white p-3 shadow-sm transition-colors duration-200 hover:border-[#111B4D] sm:p-4"
    >
      <div className="flex min-w-0 items-start gap-3">
        <ProfessorImage
          photoUrl={teacher.photoUrl}
          name={displayName}
          size={72}
          shape="circle"
          verified={teacher.badgeVerified}
        />
        <div className="min-w-0 flex-1">
          <h3 className="line-clamp-2 text-base font-bold leading-snug text-[#111827]">
            {displayName}
          </h3>
          <p className="mt-0.5 line-clamp-1 text-sm text-[#6B7280]">{teacher.jobTitle}</p>
          <p className="mt-2 text-sm font-semibold text-[#111827]">
            {teacher.primarySubject ?? "Matière à confirmer"}
          </p>
          <div className="mt-2 space-y-1 text-[13px] leading-relaxed text-[#6B7280]">
            <p className="flex min-w-0 items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5 shrink-0 text-[#111B4D]" />
              <span className="min-w-0 truncate">{teacher.commune ?? "Abidjan"}</span>
            </p>
            <p className="font-semibold text-[#111827]">
              Note {teacher.rating.toFixed(1)}/5
              <span className="font-normal text-[#6B7280]"> · {teacher.experienceYears} ans d'exp.</span>
            </p>
            {teacher.badgeVerified && (
              <p className="flex items-center gap-1.5 font-semibold text-[#111B4D]">
                <BadgeCheck className="h-3.5 w-3.5 shrink-0" />
                Certifié MonProf CI
              </p>
            )}
          </div>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-[#E3E8F2] pt-3 text-[13px] font-medium text-[#4B5563]">
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
      <div className="mt-auto flex flex-col gap-3 pt-3">
        <div className="rounded-2xl border border-[#E3E8F2] bg-white px-3 py-2.5">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#6B7280]">Prix indicatif</p>
          <p className="mt-0.5 text-base font-bold leading-tight text-[#111827]">
            {hasValidIndicativePrice ? formatFCFA(teacher.pricePerSession) : "À définir"}
            <span className="ml-1 text-xs font-medium text-[#6B7280]">/ séance 2h</span>
          </p>
        </div>
        <div className="grid grid-cols-1 gap-2 min-[360px]:grid-cols-2">
          <Button asChild variant="outline" className="min-h-11 rounded-2xl border-[#C8D2E3] bg-white px-3 text-sm text-[#111B4D] focus-visible:ring-4 focus-visible:ring-[#9AAAD0]">
            <Link href={profileHref}>Voir profil</Link>
          </Button>
          <Button asChild className="min-h-11 rounded-2xl px-3 text-sm focus-visible:ring-4 focus-visible:ring-[#9AAAD0]">
            <Link href={bookingHref}>Réserver</Link>
          </Button>
        </div>
      </div>
    </article>
  );
}

export function TeacherCardSkeleton() {
  return (
    <div className="rounded-[1.35rem] border border-[#E3E8F2] bg-white p-5 shadow-lg">
      <div className="flex gap-4">
        <Skeleton className="h-20 w-20 shrink-0 rounded-full" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-1/2 rounded-full" />
          <Skeleton className="h-3 w-1/3 rounded-full" />
          <Skeleton className="h-3 w-2/3 rounded-full" />
        </div>
      </div>
      <Skeleton className="mt-4 h-8 rounded-2xl" />
    </div>
  );
}
