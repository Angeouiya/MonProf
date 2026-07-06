"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowRight, BookOpen, CalendarDays, Filter, MessageSquare, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ClientEmptyState,
  ClientRecordCard,
  ClientSurface,
} from "@/components/shared/client-page-primitives";
import { ProfessorImage } from "@/components/shared/professor-image";
import { formatDate } from "@/lib/format";

export type ClientReviewHistoryItem = {
  id: string;
  rating: number;
  comment: string | null;
  createdAt: string;
  teacher: {
    id: string;
    fullName: string;
    professionalName: string | null;
    photoUrl: string | null;
    jobTitle: string | null;
    badgeVerified: boolean;
  };
  booking: {
    id: string;
    reference: string;
    subjectName: string;
    levelName: string;
  };
};

type ReviewFilter = "all" | "excellent" | "good" | "followup";

const filterOptions: Array<{ key: ReviewFilter; label: string }> = [
  { key: "all", label: "Tous" },
  { key: "excellent", label: "5/5" },
  { key: "good", label: "4/5" },
  { key: "followup", label: "À suivre" },
];

export function ReviewHistoryClient({ reviews }: { reviews: ClientReviewHistoryItem[] }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<ReviewFilter>("all");

  const counts = useMemo(() => {
    const next: Record<ReviewFilter, number> = {
      all: reviews.length,
      excellent: 0,
      good: 0,
      followup: 0,
    };
    for (const review of reviews) {
      if (review.rating >= 5) next.excellent += 1;
      else if (review.rating === 4) next.good += 1;
      else next.followup += 1;
    }
    return next;
  }, [reviews]);

  const filteredReviews = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return reviews.filter((review) => {
      const teacherName = review.teacher.professionalName || review.teacher.fullName;
      const matchesFilter =
        filter === "all" ||
        (filter === "excellent" && review.rating >= 5) ||
        (filter === "good" && review.rating === 4) ||
        (filter === "followup" && review.rating <= 3);
      const searchable = [
        teacherName,
        review.teacher.jobTitle,
        review.booking.reference,
        review.booking.subjectName,
        review.booking.levelName,
        review.comment,
        `${review.rating}/5`,
      ].filter(Boolean).join(" ").toLowerCase();

      return matchesFilter && (!normalizedQuery || searchable.includes(normalizedQuery));
    });
  }, [filter, query, reviews]);

  if (reviews.length === 0) {
    return (
      <ClientEmptyState
        icon={BookOpen}
        title="Aucun avis publié"
        description="Vos avis apparaîtront ici une fois publiés."
      />
    );
  }

  const activeFilter = filterOptions.find((option) => option.key === filter)?.label ?? "Tous";
  const hasRefinement = filter !== "all" || query.trim().length > 0;

  return (
    <ClientSurface compact className="overflow-hidden rounded-lg border border-[#DDE3EE] p-0" data-client-review-history>
      <div className="space-y-3 border-b border-[#E3E8F2] bg-white p-3 min-[640px]:p-4">
        <div className="grid gap-3 lg:grid-cols-[minmax(260px,1fr)_auto_auto] lg:items-center">
          <label className="relative block">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#64748B]" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Rechercher professeur, matière, référence..."
              className="h-12 rounded-lg border-[#D8DEE9] bg-white pl-9 pr-10 text-sm font-medium focus:border-[#111B4D] focus:ring-[#111B4D]"
            />
            {query.trim().length > 0 && (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-[#64748B] transition hover:bg-white hover:text-[#111B4D] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#111B4D]"
                aria-label="Effacer la recherche"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </label>

          <div className="flex min-h-11 min-w-0 items-center gap-2 rounded-lg border border-[#E3E8F2] bg-white px-3 text-xs font-semibold uppercase tracking-wide text-[#64748B]">
            <Filter className="h-4 w-4" />
            <span className="min-w-0 truncate">{activeFilter}</span>
            <span className="shrink-0 text-[#111B4D]">{filteredReviews.length}</span>
          </div>

          {hasRefinement && (
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setFilter("all");
                setQuery("");
              }}
              className="min-h-11 w-full rounded-lg text-xs lg:w-auto"
            >
              <X className="mr-1.5 h-3.5 w-3.5" />
              Réinitialiser
            </Button>
          )}
        </div>

        <div
          data-client-review-filter-rail
          className="-mx-1 flex snap-x snap-mandatory gap-1.5 overflow-x-auto px-1 pb-0.5 min-[760px]:mx-0 min-[760px]:grid min-[760px]:grid-cols-4 min-[760px]:overflow-visible min-[760px]:px-0 min-[760px]:pb-0"
          aria-label="Filtres avis"
        >
          {filterOptions.map((option) => (
            <Button
              key={option.key}
              type="button"
              size="sm"
              variant={filter === option.key ? "default" : "outline"}
              onClick={() => setFilter(option.key)}
              aria-pressed={filter === option.key}
              className="min-h-11 min-w-[7rem] shrink-0 snap-start justify-center rounded-lg px-2 text-xs min-[760px]:min-w-0"
            >
              <span className="min-w-0 truncate">{option.label}</span>
              <span className={filter === option.key ? "shrink-0 rounded-md bg-white px-1.5 py-0.5 text-xs text-[#111B4D]" : "shrink-0 rounded-md border border-[#E3E8F2] bg-white px-1.5 py-0.5 text-xs text-[#64748B]"}>
                {counts[option.key]}
              </span>
            </Button>
          ))}
        </div>
      </div>

      {filteredReviews.length === 0 ? (
        <ClientEmptyState icon={Search} title="Aucun avis trouvé" description="Essayez un autre filtre, une matière ou le nom du professeur." compact />
      ) : (
        <div className="grid gap-3 p-3 min-[920px]:grid-cols-2 min-[640px]:p-4" aria-live="polite">
          {filteredReviews.map((review) => (
            <ReviewHistoryCard key={review.id} review={review} />
          ))}
        </div>
      )}
    </ClientSurface>
  );
}

function ReviewHistoryCard({ review }: { review: ClientReviewHistoryItem }) {
  const teacherName = review.teacher.professionalName || review.teacher.fullName;
  return (
    <ClientRecordCard data-client-review-card>
      <div className="p-3.5 sm:p-4">
        <div className="flex min-w-0 items-start gap-3">
          <ProfessorImage
            photoUrl={review.teacher.photoUrl}
            name={teacherName}
            size={56}
            shape="circle"
            verified={review.teacher.badgeVerified}
          />
          <div className="min-w-0 flex-1">
            <div className="grid gap-2 min-[520px]:grid-cols-[minmax(0,1fr)_auto] min-[520px]:items-start">
              <div className="min-w-0">
                <p className="break-words text-[15px] font-semibold leading-5 text-[#111827]">{teacherName}</p>
                <p className="break-words text-xs font-medium text-[#64748B]">{review.teacher.jobTitle || "Professeur Compétence"}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2 min-[520px]:justify-end">
                <span className="inline-flex min-h-8 items-center rounded-lg bg-[#111B4D] px-3 text-xs font-semibold text-white">
                  {review.rating}/5
                </span>
                <span className="inline-flex min-h-8 items-center gap-1.5 rounded-lg border border-[#E3E8F2] bg-white px-2.5 text-xs font-semibold text-[#64748B]">
                  <CalendarDays className="h-3.5 w-3.5" />
                  {formatDate(review.createdAt)}
                </span>
              </div>
            </div>

            <div className="mt-3 grid gap-2 text-xs font-medium text-[#475569] min-[520px]:grid-cols-[minmax(0,1fr)_auto] min-[520px]:items-center">
              <span className="flex min-w-0 items-center gap-2">
                <BookOpen className="h-4 w-4 shrink-0 text-[#111B4D]" />
                <span className="min-w-0 break-words">{review.booking.subjectName} · {review.booking.levelName}</span>
              </span>
              <span className="break-all font-mono text-[11px] font-semibold uppercase tracking-wide text-[#64748B]">
                {review.booking.reference}
              </span>
            </div>

            {review.comment && (
              <p className="mt-3 line-clamp-4 rounded-lg border border-[#E3E8F2] bg-white px-3 py-2 text-sm leading-6 text-[#111827]">{review.comment}</p>
            )}

            <div className="mt-3 grid gap-2 min-[460px]:grid-cols-[minmax(0,1fr)_auto] min-[460px]:items-center">
              <p className="text-xs font-medium leading-5 text-[#64748B]">
                Avis lié au cours, visible dans votre historique qualité.
              </p>
              <Button asChild size="sm" variant="outline" className="min-h-11 w-full rounded-lg min-[460px]:w-auto">
                <Link href={`/client/reservations/${review.booking.id}`}>
                  Dossier
                  <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </ClientRecordCard>
  );
}
