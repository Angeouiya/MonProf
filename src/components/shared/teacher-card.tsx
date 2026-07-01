import Link from "next/link";
import Image from "next/image";
import { Star, MapPin, BadgeCheck, Home, Video, Sparkles, TrendingUp } from "lucide-react";
import { Teacher } from "@prisma/client";
import { formatFCFA, avatarFromName } from "@/lib/format";
import { cn } from "@/lib/utils";

type TeacherCardData = Pick<Teacher,
  "id" | "fullName" | "professionalName" | "photoUrl" |
  "jobTitle" | "rating" | "ratingCount" | "experienceYears" |
  "pricePerSession" | "offersHome" | "offersOnline" | "commune" |
  "badgeVerified" | "badgeRecommended" | "badgeNew" | "badgePopular" | "badgePremium"
> & { _count?: { reviews: number }; primarySubject?: string | null };

export function TeacherCard({ teacher, href }: { teacher: TeacherCardData; href?: string }) {
  const link = href ?? `/professeurs/${teacher.id}`;
  const displayName = teacher.professionalName || teacher.fullName;
  return (
    <Link
      href={link}
      className="group block rounded-2xl border border-border bg-card p-4 sm:p-5 transition-all hover:border-primary/40 hover:shadow-sm"
    >
      <div className="flex gap-4">
        <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-full bg-muted sm:h-20 sm:w-20">
          {teacher.photoUrl ? (
            <Image src={teacher.photoUrl} alt={displayName} fill className="object-cover" />
          ) : (
            <img src={avatarFromName(displayName)} alt={displayName} className="h-full w-full object-cover" />
          )}
          {teacher.badgeVerified && (
            <span className="absolute -bottom-0.5 -right-0.5 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-white ring-2 ring-white">
              <BadgeCheck className="h-4 w-4" />
            </span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="truncate text-base font-semibold text-foreground">{displayName}</h3>
              <p className="truncate text-sm text-muted-foreground">{teacher.jobTitle}</p>
            </div>
            <div className="flex shrink-0 items-center gap-1 rounded-md bg-amber-50 px-1.5 py-0.5 text-xs font-medium text-amber-700">
              <Star className="h-3 w-3 fill-current" />
              {teacher.rating.toFixed(1)}
            </div>
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            {teacher.primarySubject && (
              <span className="font-medium text-foreground/80">{teacher.primarySubject}</span>
            )}
            <span>{teacher.experienceYears} ans d'exp.</span>
            <span className="flex items-center gap-0.5">
              <MapPin className="h-3 w-3" /> {teacher.commune ?? "—"}
            </span>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            {teacher.offersHome && (
              <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-[11px] font-medium text-foreground/70">
                <Home className="h-3 w-3" /> Domicile
              </span>
            )}
            {teacher.offersOnline && (
              <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-[11px] font-medium text-foreground/70">
                <Video className="h-3 w-3" /> En ligne
              </span>
            )}
            {teacher.badgeRecommended && (
              <span className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                <Sparkles className="h-3 w-3" /> Recommandé
              </span>
            )}
            {teacher.badgePopular && (
              <span className="inline-flex items-center gap-1 rounded-md bg-orange-50 px-2 py-0.5 text-[11px] font-medium text-orange-700">
                <TrendingUp className="h-3 w-3" /> Très demandé
              </span>
            )}
            {teacher.badgeNew && (
              <span className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-700">
                Nouveau
              </span>
            )}
          </div>
        </div>
      </div>
      <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
        <div>
          <p className="text-[11px] text-muted-foreground">À partir de</p>
          <p className="text-base font-semibold text-foreground">{formatFCFA(teacher.pricePerSession)}<span className="text-xs font-normal text-muted-foreground"> /séance</span></p>
        </div>
        <span className="inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition group-hover:bg-primary/90">
          Réserver
        </span>
      </div>
    </Link>
  );
}

export function TeacherCardSkeleton() {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex gap-4">
        <div className="h-20 w-20 shrink-0 animate-pulse rounded-full bg-muted" />
        <div className="flex-1 space-y-2">
          <div className="h-4 w-1/2 animate-pulse rounded bg-muted" />
          <div className="h-3 w-1/3 animate-pulse rounded bg-muted" />
          <div className="h-3 w-2/3 animate-pulse rounded bg-muted" />
        </div>
      </div>
      <div className="mt-4 h-8 animate-pulse rounded bg-muted" />
    </div>
  );
}
