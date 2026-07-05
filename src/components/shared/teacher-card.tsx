import Link from "next/link";
import { ArrowRight, BadgeCheck, Home, MapPin, Video } from "lucide-react";
import { Teacher } from "@prisma/client";
import { ProfessorImage } from "@/components/shared/professor-image";
import { TeacherMiniCv } from "@/components/shared/teacher-mini-cv";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { formatFCFA } from "@/lib/format";

type TeacherCardData = Pick<Teacher,
  "id" | "fullName" | "professionalName" | "photoUrl" |
  "jobTitle" | "rating" | "ratingCount" | "experienceYears" |
  "adminRating" | "adminRatingPublic" |
  "pricePerSession" | "offersHome" | "offersOnline" | "commune" |
  "badgeVerified" | "careerSummary" | "skills" | "workHistory" |
  "certifications" | "teachingAchievements" | "learnersCoached"
> & { _count?: { reviews: number }; primarySubject?: string | null };

export function TeacherCard({ teacher, href }: { teacher: TeacherCardData; href?: string }) {
  const profileHref = `/professeurs/${teacher.id}`;
  const bookingHref = href ?? `/client/reserver?teacherId=${teacher.id}`;
  const displayName = teacher.professionalName || teacher.fullName;
  const hasValidIndicativePrice = teacher.pricePerSession > 0;
  const priceLabel = hasValidIndicativePrice ? formatFCFA(teacher.pricePerSession) : "Prix à confirmer";
  const displayRating = teacher.ratingCount > 0
    ? teacher.rating
    : teacher.adminRatingPublic && teacher.adminRating > 0
      ? teacher.adminRating
      : teacher.rating;

  return (
    <article
      data-client-teacher-card
      className="group flex h-full min-w-0 flex-col rounded-lg border border-[#DDE3EE] bg-white p-3 transition-colors duration-200 hover:border-[#111B4D] sm:p-4"
    >
      <div className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] gap-3.5">
        <ProfessorImage
          photoUrl={teacher.photoUrl}
          name={displayName}
          size={72}
          shape="circle"
          verified={teacher.badgeVerified}
        />
        <div className="min-w-0 flex-1">
          <h3 className="line-clamp-1 text-[1rem] font-semibold leading-snug text-[#111827]">
            {displayName}
          </h3>
          <p className="mt-0.5 line-clamp-1 text-[13px] font-medium leading-5 text-[#64748B]">{teacher.jobTitle}</p>
          <div className="mt-2 grid gap-1 text-[13px] leading-relaxed text-[#64748B]">
            <p className="line-clamp-1 font-semibold text-[#111827]">
              {teacher.primarySubject ?? "Matière à confirmer"}
            </p>
            <p className="flex min-w-0 items-center gap-1.5 font-medium">
              <MapPin className="h-3.5 w-3.5 shrink-0 text-[#111B4D]" />
              <span className="min-w-0 truncate">{teacher.commune ?? "Abidjan"}</span>
              <span className="text-[#CBD5E1]">·</span>
              <span className="font-semibold text-[#111827]">Note {displayRating.toFixed(1)}/5</span>
              <span> · {teacher.experienceYears} ans</span>
            </p>
            {teacher.badgeVerified && (
              <p className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#111B4D]">
                <BadgeCheck className="h-3.5 w-3.5" />
                Certifié
              </p>
            )}
          </div>
        </div>
      </div>
      <div className="mt-3 border-t border-[#E3E8F2] pt-2.5">
        <TeacherMiniCv
          compact
          careerSummary={teacher.careerSummary}
          skills={teacher.skills}
          workHistory={teacher.workHistory}
          certifications={teacher.certifications}
          teachingAchievements={teacher.teachingAchievements}
          learnersCoached={teacher.learnersCoached}
          className="mb-2"
        />
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
      <div className="mt-auto pt-3">
        <div className="mb-3 flex items-center justify-between gap-3 border-y border-[#E3E8F2] py-2">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[#64748B]">Prix indicatif</p>
            <p className="mt-0.5 text-[1.05rem] font-semibold leading-tight text-[#111827]">
              {priceLabel}
              <span className="ml-1 text-xs font-medium text-[#64748B]">/ 2h</span>
            </p>
          </div>
          <ArrowRight className="hidden h-4 w-4 shrink-0 text-[#111B4D] transition group-hover:translate-x-0.5 min-[380px]:block" />
        </div>
        <div className="grid grid-cols-1 gap-2 min-[360px]:grid-cols-2">
          <Button asChild variant="outline" className="min-h-11 rounded-lg border-[#C8D2E3] bg-white px-3 text-sm text-[#111B4D] focus-visible:ring-4 focus-visible:ring-[#9AAAD0]">
            <Link href={profileHref}>Voir profil</Link>
          </Button>
          <Button asChild className="min-h-11 rounded-lg bg-[#111B4D] px-3 text-sm text-white hover:bg-[#1E2A78] focus-visible:ring-4 focus-visible:ring-[#9AAAD0]">
            <Link href={bookingHref}>Réserver</Link>
          </Button>
        </div>
      </div>
    </article>
  );
}

export function TeacherCardSkeleton() {
  return (
    <div className="rounded-xl border border-[#E3E8F2] bg-white p-5">
      <div className="flex gap-4">
        <Skeleton className="h-20 w-20 shrink-0 rounded-full" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-1/2 rounded-full" />
          <Skeleton className="h-3 w-1/3 rounded-full" />
          <Skeleton className="h-3 w-2/3 rounded-full" />
        </div>
      </div>
      <Skeleton className="mt-4 h-8 rounded-lg" />
    </div>
  );
}
