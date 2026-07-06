"use client";

import { useMemo, type ReactNode } from "react";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SearchableCatalogSelect } from "@/components/shared/searchable-catalog-select";
import { groupByCatalogCategory, type CatalogCategory } from "@/lib/catalog-taxonomy";

type Option = { slug: string; name: string; category?: CatalogCategory };

export function HomeSearchBar({
  subjects,
  levels,
  communes,
}: {
  subjects: Option[];
  levels: Option[];
  communes: Option[];
}) {
  const subjectGroups = useMemo(() => groupByCatalogCategory(
    subjects.filter((option) => option.category),
    (option) => option.category as CatalogCategory,
  ), [subjects]);
  const levelGroups = useMemo(() => groupByCatalogCategory(
    levels.filter((option) => option.category),
    (option) => option.category as CatalogCategory,
  ), [levels]);

  return (
    <form
      data-home-search-form
      method="GET"
      action="/professeurs"
      className="mx-auto w-full max-w-5xl rounded-lg border border-[#DDE6F7] bg-white p-2.5 sm:p-4"
    >
      <div className="grid grid-cols-1 gap-2.5 min-[360px]:grid-cols-2 sm:gap-3 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,0.9fr)_auto]">
        <label className="min-w-0 min-[360px]:col-span-2 lg:col-auto">
          <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-[#64748B]">
            Recherche
          </span>
          <input
            name="q"
            type="search"
            placeholder="Matière, concours, adulte, métier..."
            className="min-h-12 w-full rounded-lg border border-[#DDE6F7] bg-white px-3 text-sm font-semibold text-[#111827] outline-none transition placeholder:font-medium placeholder:text-[#64748B] focus:border-[#111B4D] focus:ring-4 focus:ring-[#DDE6F7]"
          />
        </label>
        <SearchFieldLabel label="Matière">
          <SearchableCatalogSelect
            name="subject"
            placeholder="Matières"
            searchPlaceholder="Saisir une matière, concours, métier..."
            emptyLabel="Aucune matière trouvée"
            allLabel="Toutes"
            groups={subjectGroups.map((group) => ({
              label: group.category.label,
              options: group.items.map((item) => ({
                value: item.slug,
                label: item.name,
                keywords: group.category.label,
              })),
            }))}
            triggerClassName="min-h-12 rounded-lg border-[#DDE6F7] text-sm font-semibold focus:border-[#111B4D] focus:ring-4 focus:ring-[#DDE6F7]"
          />
        </SearchFieldLabel>
        <SearchFieldLabel label="Niveau">
          <SearchableCatalogSelect
            name="level"
            placeholder="Niveaux"
            searchPlaceholder="Saisir un niveau : BAC, adulte, BTS..."
            emptyLabel="Aucun niveau trouvé"
            allLabel="Tous"
            groups={levelGroups.map((group) => ({
              label: group.category.label,
              options: group.items.map((item) => ({
                value: item.slug,
                label: item.name,
                keywords: group.category.label,
              })),
            }))}
            triggerClassName="min-h-12 rounded-lg border-[#DDE6F7] text-sm font-semibold focus:border-[#111B4D] focus:ring-4 focus:ring-[#DDE6F7]"
          />
        </SearchFieldLabel>
        <label className="min-w-0">
          <span className="mb-1.5 block px-1 text-[11px] font-semibold uppercase tracking-wide text-[#64748B]">
            Commune
          </span>
          <select
            name="commune"
            className="min-h-12 w-full rounded-lg border border-[#DDE6F7] bg-white px-3 text-sm font-semibold text-[#111827] outline-none transition focus:border-[#111B4D] focus:ring-4 focus:ring-[#DDE6F7]"
          >
            <option value="">Toutes</option>
            {communes.map((commune) => (
              <option key={commune.slug} value={commune.name}>{commune.name}</option>
            ))}
          </select>
        </label>
        <Button
          type="submit"
          size="lg"
          className="min-h-12 w-full rounded-lg bg-[#111B4D] px-3 text-sm font-semibold text-white hover:bg-[#1E2A78] lg:mt-[1.45rem] lg:w-auto lg:px-5"
        >
          <Search className="h-4 w-4" />
          Rechercher
        </Button>
      </div>
      <div className="mt-3 hidden flex-col gap-1.5 border-t border-[#EEF2F7] pt-3 text-xs font-semibold text-[#64748B] min-[560px]:flex min-[560px]:flex-row min-[560px]:items-center min-[560px]:justify-between">
        <span>Cours à domicile ou en ligne</span>
        <span>Séances de 2h, réservation au moins 24h avant</span>
        <span>Paiement PayDunya protégé</span>
      </div>
    </form>
  );
}

function SearchFieldLabel({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="min-w-0">
      <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-[#64748B]">
        {label}
      </span>
      {children}
    </div>
  );
}
