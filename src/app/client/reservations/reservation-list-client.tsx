"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, CalendarCheck, FilterX, Search } from "lucide-react";
import {
  ClientCompactFacts,
  ClientEmptyState,
  ClientRecordAmount,
  ClientRecordCard,
  ClientRecordStatusLine,
  ClientSectionTitle,
  ClientSurface,
} from "@/components/shared/client-page-primitives";
import { ProfessorImage } from "@/components/shared/professor-image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export type ClientReservationListItem = {
  id: string;
  reference: string;
  subjectName: string;
  levelName: string;
  teacher: {
    fullName: string;
    professionalName: string | null;
    photoUrl: string | null;
    jobTitle: string | null;
    badgeVerified: boolean;
  };
  amountLabel: string;
  dateLabel: string;
  timeLabel: string;
  formatLabel: string;
  stepLabel: string;
  stepHint: string;
  stepClassName: string;
  paymentLabel: string;
  actionKind: "all" | "action" | "secured" | "closed" | "issue";
  searchText: string;
};

const FILTERS: Array<{ id: ClientReservationListItem["actionKind"] | "all"; label: string; emptyTitle: string }> = [
  { id: "all", label: "Tous", emptyTitle: "Aucun dossier trouvé" },
  { id: "action", label: "Actions", emptyTitle: "Aucune action immédiate" },
  { id: "secured", label: "Sécurisés", emptyTitle: "Aucun paiement sécurisé dans cette vue" },
  { id: "closed", label: "Clos", emptyTitle: "Aucun dossier clôturé dans cette vue" },
  { id: "issue", label: "Suivi", emptyTitle: "Aucun dossier en suivi service client" },
];

export function ReservationListClient({ reservations }: { reservations: ClientReservationListItem[] }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["id"]>("all");

  const normalizedQuery = normalize(query);
  const counts = useMemo(() => {
    return FILTERS.reduce<Record<string, number>>((acc, item) => {
      acc[item.id] = item.id === "all"
        ? reservations.length
        : reservations.filter((reservation) => reservation.actionKind === item.id).length;
      return acc;
    }, {});
  }, [reservations]);

  const filteredReservations = useMemo(() => {
    return reservations.filter((reservation) => {
      const matchesFilter = filter === "all" || reservation.actionKind === filter;
      const matchesQuery = !normalizedQuery || reservation.searchText.includes(normalizedQuery);
      return matchesFilter && matchesQuery;
    });
  }, [filter, normalizedQuery, reservations]);

  const activeFilter = FILTERS.find((item) => item.id === filter) ?? FILTERS[0];
  const hasSearch = query.trim().length > 0 || filter !== "all";

  return (
    <ClientSurface data-client-reservations-list className="space-y-4">
      <ClientSectionTitle
        eyebrow="Dossiers"
        title="Recherche rapide"
        description="Retrouvez une réservation par référence, professeur, matière, date ou statut."
        action={<span className="text-sm font-semibold text-[#111B4D]">{filteredReservations.length} affiché(s)</span>}
      />

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
        <label className="relative block min-w-0">
          <span className="sr-only">Rechercher une réservation</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#64748B]" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Référence, professeur, matière, date..."
            className="h-11 rounded-lg border-[#D8DEE9] bg-white pl-9 text-sm font-medium text-[#111827] placeholder:text-[#64748B]"
            data-client-reservation-search
          />
        </label>

        <div className="grid grid-cols-2 gap-1.5 min-[460px]:grid-cols-3 min-[760px]:flex min-[760px]:flex-wrap min-[760px]:justify-end">
          {FILTERS.map((item) => {
            const active = item.id === filter;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setFilter(item.id)}
                className={cn(
                  "min-h-10 rounded-lg border px-3 text-xs font-semibold transition-colors",
                  active
                    ? "border-[#111B4D] bg-[#111B4D] text-white"
                    : "border-[#D8DEE9] bg-white text-[#111827] hover:border-[#111B4D]",
                )}
                aria-pressed={active}
              >
                {item.label}
                <span className={cn("ml-1.5", active ? "text-white" : "text-[#64748B]")}>{counts[item.id] ?? 0}</span>
              </button>
            );
          })}
        </div>
      </div>

      {hasSearch && (
        <div className="flex flex-col gap-2 rounded-lg border border-[#D8DEE9] bg-white p-3 min-[560px]:flex-row min-[560px]:items-center min-[560px]:justify-between">
          <p className="text-sm font-medium leading-5 text-[#52627A]">
            Filtre actif : <span className="font-semibold text-[#111827]">{activeFilter.label}</span>
            {query.trim() ? <> · recherche “{query.trim()}”</> : null}
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              setQuery("");
              setFilter("all");
            }}
            className="min-h-10 rounded-lg border-[#CAD7F2] bg-white text-[#111B4D] hover:border-[#111B4D] hover:bg-white"
          >
            <FilterX className="h-4 w-4" />
            Réinitialiser
          </Button>
        </div>
      )}

      {filteredReservations.length === 0 ? (
        <ClientEmptyState
          icon={CalendarCheck}
          title={hasSearch ? activeFilter.emptyTitle : "Aucune réservation"}
          description={hasSearch ? "Essayez une autre référence, matière, date ou nom de professeur." : "Vous n'avez pas encore réservé de cours."}
          action={
            <Button asChild size="sm" className="min-h-11 rounded-lg bg-[#111B4D] text-white hover:bg-[#1E2A78]">
              <Link href="/client/rechercher">Réserver un cours</Link>
            </Button>
          }
        />
      ) : (
        <div className="grid gap-3" data-client-reservation-results>
          {filteredReservations.map((reservation) => (
            <ReservationCard key={reservation.id} reservation={reservation} />
          ))}
        </div>
      )}
    </ClientSurface>
  );
}

function ReservationCard({ reservation }: { reservation: ClientReservationListItem }) {
  const teacherName = reservation.teacher.professionalName || reservation.teacher.fullName;

  return (
    <ClientRecordCard data-client-reservation-card>
      <div className="p-3.5 sm:p-4">
        <div className="grid gap-3 min-[560px]:grid-cols-[minmax(0,1fr)_auto] min-[560px]:items-start">
          <div className="flex min-w-0 items-start gap-3">
            <ProfessorImage
              photoUrl={reservation.teacher.photoUrl}
              name={teacherName}
              size={58}
              shape="circle"
              verified={reservation.teacher.badgeVerified}
            />
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[#64748B]">{reservation.reference}</p>
              <h2 className="mt-0.5 break-words text-base font-semibold leading-6 text-[#111827]">
                {reservation.subjectName} · {reservation.levelName}
              </h2>
              <p className="mt-0.5 break-words text-xs font-semibold leading-5 text-[#64748B]">
                {teacherName} · {reservation.teacher.jobTitle || "Professeur"}
              </p>
            </div>
          </div>
          <ClientRecordAmount value={reservation.amountLabel} className="min-[560px]:min-w-36 min-[560px]:text-right" />
        </div>

        <ClientCompactFacts
          className="mt-3"
          items={[
            { label: "Date", value: reservation.dateLabel },
            { label: "Créneau", value: reservation.timeLabel },
            { label: "Format", value: reservation.formatLabel },
          ]}
        />

        <div className="mt-3 grid gap-3 min-[620px]:grid-cols-[minmax(0,1fr)_auto] min-[620px]:items-center">
          <ClientRecordStatusLine
            className={reservation.stepClassName}
            label={reservation.stepLabel}
            hint={reservation.stepHint}
            aside={reservation.paymentLabel}
          />
          <Button asChild size="sm" className="min-h-11 rounded-lg bg-[#111B4D] text-white hover:bg-[#1E2A78] min-[620px]:min-w-28">
            <Link href={`/client/reservations/${reservation.id}`}>
              Détails <ArrowRight className="ml-1 h-3.5 w-3.5" />
            </Link>
          </Button>
        </div>
      </div>
    </ClientRecordCard>
  );
}

function normalize(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
