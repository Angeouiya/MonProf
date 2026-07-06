"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  CalendarCheck,
  CheckCircle2,
  Clock3,
  FilterX,
  Search,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";
import {
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
  const visibleActionCount = filteredReservations.filter((reservation) => reservation.actionKind === "action").length;
  const visibleIssueCount = filteredReservations.filter((reservation) => reservation.actionKind === "issue").length;
  const visibleSecuredCount = filteredReservations.filter((reservation) => reservation.actionKind === "secured").length;
  const priorityReservation = filteredReservations.find((reservation) => reservation.actionKind === "action")
    ?? filteredReservations.find((reservation) => reservation.actionKind === "issue")
    ?? filteredReservations[0];

  return (
    <ClientSurface data-client-reservations-list className="space-y-4">
      <ClientSectionTitle
        eyebrow="Dossiers"
        title="Recherche rapide"
        description="Référence, professeur, matière, date ou statut."
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

        <div
          data-client-reservation-filter-rail
          className="flex snap-x gap-2 overflow-x-auto pb-1 min-[760px]:flex-wrap min-[760px]:justify-end min-[760px]:overflow-visible min-[760px]:pb-0"
        >
          {FILTERS.map((item) => {
            const active = item.id === filter;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setFilter(item.id)}
                className={cn(
                  "min-h-10 min-w-[7.6rem] snap-start rounded-lg border px-3 text-xs font-semibold transition-colors min-[760px]:min-w-0",
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

      <div
        data-client-reservation-summary
        className="hidden gap-2 rounded-lg border border-[#D8DEE9] bg-white p-2.5 md:grid lg:grid-cols-[minmax(0,1fr)_minmax(15rem,auto)] lg:items-stretch"
      >
        <div className="grid grid-cols-1 gap-2 min-[390px]:grid-cols-3">
          <ReservationSummaryTile label="Affichées" value={filteredReservations.length} />
          <ReservationSummaryTile label="À traiter" value={visibleActionCount} attention={visibleActionCount > 0} />
          <ReservationSummaryTile
            label={visibleIssueCount > 0 ? "En suivi" : "Sécurisées"}
            value={visibleIssueCount > 0 ? visibleIssueCount : visibleSecuredCount}
            attention={visibleIssueCount > 0}
          />
        </div>
        {priorityReservation ? (
          <Link
            href={`/client/reservations/${priorityReservation.id}`}
            className="group flex min-h-16 min-w-0 items-center justify-between gap-3 rounded-lg border border-[#E3E8F2] bg-white px-3 py-2.5 text-left transition-colors hover:border-[#111B4D]"
          >
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-[#64748B]">Accès rapide</p>
              <p className="mt-0.5 truncate text-sm font-semibold text-[#111827]">{priorityReservation.reference}</p>
              <p className="mt-0.5 truncate text-xs font-medium text-[#64748B]">{priorityReservation.stepLabel}</p>
            </div>
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#111B4D] text-white transition-colors group-hover:bg-[#1E2A78]">
              <ArrowRight className="h-4 w-4" />
            </span>
          </Link>
        ) : (
          <div className="flex min-h-16 items-center rounded-lg border border-dashed border-[#D8DEE9] bg-white px-3 py-2.5 text-sm font-semibold text-[#64748B]">
            Aucun dossier dans cette vue.
          </div>
        )}
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
  const actionMeta = getActionMeta(reservation.actionKind);
  const ActionIcon = actionMeta.icon;

  return (
    <ClientRecordCard data-client-reservation-card data-action-kind={reservation.actionKind}>
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
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-[#64748B]">{reservation.reference}</p>
                <span
                  className={cn(
                    "inline-flex min-h-7 items-center gap-1 rounded-lg border bg-white px-2 text-[11px] font-semibold",
                    actionMeta.className,
                  )}
                >
                  <ActionIcon className="h-3.5 w-3.5" />
                  {actionMeta.label}
                </span>
              </div>
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

        <dl
          data-client-reservation-card-facts
          className="mt-3 grid grid-cols-3 overflow-hidden rounded-lg border border-[#D8DEE9] bg-white"
        >
          <ReservationFact label="Date" value={reservation.dateLabel} />
          <ReservationFact label="Créneau" value={reservation.timeLabel} />
          <ReservationFact label="Format" value={reservation.formatLabel} />
        </dl>

        <div className="mt-3 grid gap-3 min-[620px]:grid-cols-[minmax(0,1fr)_auto] min-[620px]:items-center">
          <ClientRecordStatusLine
            className={reservation.stepClassName}
            label={reservation.stepLabel}
            hint={reservation.stepHint}
            aside={reservation.paymentLabel}
          />
          <Button asChild size="sm" className="min-h-11 rounded-lg bg-[#111B4D] text-white hover:bg-[#1E2A78] min-[620px]:min-w-32">
            <Link href={`/client/reservations/${reservation.id}`}>
              {actionMeta.ctaLabel} <ArrowRight className="ml-1 h-3.5 w-3.5" />
            </Link>
          </Button>
        </div>
      </div>
    </ClientRecordCard>
  );
}

function ReservationFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 border-r border-[#E6EAF3] bg-white px-2.5 py-2 last:border-r-0 min-[420px]:px-3">
      <dt className="truncate text-[9.5px] font-semibold uppercase leading-3 tracking-wide text-[#64748B] min-[420px]:text-[10px]">{label}</dt>
      <dd className="mt-1 line-clamp-2 min-h-8 break-words text-[11.5px] font-semibold leading-4 text-[#111827] min-[420px]:text-xs">{value}</dd>
    </div>
  );
}

function ReservationSummaryTile({
  label,
  value,
  attention,
}: {
  label: string;
  value: number;
  attention?: boolean;
}) {
  return (
    <div className="min-w-0 rounded-lg border border-[#E3E8F2] bg-white px-3 py-2.5">
      <p className="truncate text-[10px] font-semibold uppercase leading-3 tracking-wide text-[#64748B]">{label}</p>
      <p className={cn("mt-1 text-lg font-semibold leading-6", attention ? "text-[#111B4D]" : "text-[#111827]")}>{value}</p>
    </div>
  );
}

function getActionMeta(actionKind: ClientReservationListItem["actionKind"]): {
  label: string;
  ctaLabel: string;
  icon: LucideIcon;
  className: string;
} {
  if (actionKind === "action") {
    return {
      label: "Action requise",
      ctaLabel: "Agir",
      icon: AlertTriangle,
      className: "border-[#111B4D] text-[#111B4D]",
    };
  }
  if (actionKind === "secured") {
    return {
      label: "Sécurisé",
      ctaLabel: "Suivre",
      icon: ShieldCheck,
      className: "border-[#D8DEE9] text-[#111B4D]",
    };
  }
  if (actionKind === "closed") {
    return {
      label: "Clos",
      ctaLabel: "Consulter",
      icon: CheckCircle2,
      className: "border-[#D8DEE9] text-[#111B4D]",
    };
  }
  if (actionKind === "issue") {
    return {
      label: "Suivi service client",
      ctaLabel: "Suivre",
      icon: Clock3,
      className: "border-[#111B4D] text-[#111B4D]",
    };
  }
  return {
    label: "Dossier",
    ctaLabel: "Détails",
    icon: CalendarCheck,
    className: "border-[#D8DEE9] text-[#111B4D]",
  };
}

function normalize(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
