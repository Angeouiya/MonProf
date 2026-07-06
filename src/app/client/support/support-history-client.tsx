"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, CheckCircle2, FilterX, Search } from "lucide-react";
import {
  ClientEmptyState,
  ClientRecordCard,
  ClientSectionTitle,
  ClientSurface,
} from "@/components/shared/client-page-primitives";
import { ProfessorImage } from "@/components/shared/professor-image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export type ClientSupportDisputeItem = {
  id: string;
  status: string;
  statusLabel: string;
  statusKind: "open" | "closed" | "refunded" | "rejected";
  reason: string;
  description: string;
  resolution: string | null;
  createdAtLabel: string;
  booking: {
    id: string;
    reference: string;
    subjectName: string;
    levelName: string;
    teacherName: string;
    teacherPhotoUrl: string | null;
    teacherBadgeVerified: boolean;
  };
  searchText: string;
};

const FILTERS: Array<{ id: ClientSupportDisputeItem["statusKind"] | "all"; label: string; emptyTitle: string }> = [
  { id: "all", label: "Tous", emptyTitle: "Aucun dossier trouvé" },
  { id: "open", label: "En cours", emptyTitle: "Aucun dossier en cours" },
  { id: "closed", label: "Clos", emptyTitle: "Aucun dossier clos" },
  { id: "refunded", label: "Remboursés", emptyTitle: "Aucun remboursement dans cette vue" },
  { id: "rejected", label: "Rejetés", emptyTitle: "Aucun dossier rejeté" },
];

export function SupportHistoryClient({ disputes }: { disputes: ClientSupportDisputeItem[] }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["id"]>("all");

  const normalizedQuery = normalize(query);
  const counts = useMemo(() => {
    return FILTERS.reduce<Record<string, number>>((acc, item) => {
      acc[item.id] = item.id === "all"
        ? disputes.length
        : disputes.filter((dispute) => dispute.statusKind === item.id).length;
      return acc;
    }, {});
  }, [disputes]);

  const filteredDisputes = useMemo(() => {
    return disputes.filter((dispute) => {
      const matchesFilter = filter === "all" || dispute.statusKind === filter;
      const matchesQuery = !normalizedQuery || dispute.searchText.includes(normalizedQuery);
      return matchesFilter && matchesQuery;
    });
  }, [disputes, filter, normalizedQuery]);

  const activeFilter = FILTERS.find((item) => item.id === filter) ?? FILTERS[0];
  const hasSearch = query.trim().length > 0 || filter !== "all";

  return (
    <ClientSurface data-client-support-history className="space-y-4">
      <ClientSectionTitle
        title={`Historique (${disputes.length})`}
        description="Dossiers ouverts et décisions du service client."
        action={<span className="text-sm font-semibold text-[#111B4D]">{filteredDisputes.length} affiché(s)</span>}
      />

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
        <label className="relative block min-w-0">
          <span className="sr-only">Rechercher un dossier de support</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#64748B]" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Référence, professeur, motif, décision..."
            className="h-11 rounded-lg border-[#D8DEE9] bg-white pl-9 text-sm font-medium text-[#111827] placeholder:text-[#64748B]"
            data-client-support-search
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

      {filteredDisputes.length === 0 ? (
        <ClientEmptyState
          icon={CheckCircle2}
          title={hasSearch ? activeFilter.emptyTitle : "Aucun dossier"}
          description={hasSearch ? "Essayez une autre référence, un motif ou le nom du professeur." : "Les signalements apparaîtront ici avec leur statut."}
          compact
        />
      ) : (
        <div className="grid gap-3" data-client-support-results>
          {filteredDisputes.map((dispute) => (
            <SupportCaseCard key={dispute.id} dispute={dispute} />
          ))}
        </div>
      )}
    </ClientSurface>
  );
}

function SupportCaseCard({ dispute }: { dispute: ClientSupportDisputeItem }) {
  return (
    <ClientRecordCard data-client-support-dispute-card className="p-4">
      <div className="flex flex-col gap-3 min-[640px]:flex-row min-[640px]:items-start min-[640px]:justify-between">
        <div className="min-w-0">
          <div className="flex flex-col gap-1 min-[460px]:flex-row min-[460px]:items-center min-[460px]:gap-3">
            <p className="text-sm font-semibold text-[#111827]">{dispute.booking.reference}</p>
            <p className="inline-flex w-fit rounded-lg border border-[#E3E8F2] bg-white px-2.5 py-1 text-xs font-semibold text-[#111B4D]">{dispute.statusLabel}</p>
          </div>
          <p className="mt-1 text-sm font-semibold text-[#111827]">{dispute.booking.subjectName} · {dispute.booking.levelName}</p>
          <div className="mt-2 flex items-center gap-2 text-xs text-[#64748B]">
            <ProfessorImage
              photoUrl={dispute.booking.teacherPhotoUrl}
              name={dispute.booking.teacherName}
              size={32}
              shape="circle"
              verified={dispute.booking.teacherBadgeVerified}
            />
            <span className="min-w-0 break-words">{dispute.booking.teacherName} · {dispute.createdAtLabel}</span>
          </div>
        </div>
        <Button asChild variant="outline" size="sm" className="w-full rounded-lg border-[#CAD7F2] bg-white text-[#111B4D] hover:border-[#111B4D] hover:bg-white min-[640px]:w-auto">
          <Link href={`/client/reservations/${dispute.booking.id}`}>
            Ouvrir <ArrowRight className="ml-1 h-3.5 w-3.5" />
          </Link>
        </Button>
      </div>
      <div className="mt-3 rounded-lg border border-[#E3E8F2] bg-white p-3 text-xs leading-5">
        <p><span className="font-semibold text-[#111827]">Motif :</span> <span className="text-[#64748B]">{dispute.reason}</span></p>
        <p className="mt-1"><span className="font-semibold text-[#111827]">Message :</span> <span className="text-[#64748B]">{dispute.description}</span></p>
        {dispute.resolution && (
          <p className="mt-1"><span className="font-semibold text-[#111827]">Décision :</span> <span className="text-[#64748B]">{dispute.resolution}</span></p>
        )}
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
