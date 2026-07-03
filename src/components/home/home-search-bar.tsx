"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Search } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
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
  const router = useRouter();
  const [subject, setSubject] = useState<string>("all");
  const [level, setLevel] = useState<string>("all");
  const [commune, setCommune] = useState<string>("all");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams();
    if (subject && subject !== "all") params.set("subject", subject);
    if (level && level !== "all") params.set("level", level);
    if (commune && commune !== "all") params.set("commune", commune);
    router.push(`/professeurs?${params.toString()}`);
  }

  return (
    <form
      onSubmit={submit}
      className="mx-auto flex w-full max-w-4xl flex-col gap-3 rounded-3xl border border-[#E3E8F2] bg-white p-3 shadow-sm"
    >
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <SelectField
          value={subject}
          onChange={setSubject}
          placeholder="Matière"
          allLabel="Toutes les matières"
          options={subjects}
        />
        <SelectField
          value={level}
          onChange={setLevel}
          placeholder="Niveau"
          allLabel="Tous les niveaux"
          options={levels}
        />
        <SelectField
          value={commune}
          onChange={setCommune}
          placeholder="Commune"
          allLabel="Toutes les communes"
          options={communes}
          className="sm:col-span-2"
        />
      </div>
      <Button
        type="submit"
        size="lg"
        className="w-full"
      >
        <Search className="mr-1.5 h-4 w-4" />
        Rechercher
      </Button>
    </form>
  );
}

function SelectField({
  value,
  onChange,
  placeholder,
  allLabel,
  options,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  allLabel: string;
  options: Option[];
  className?: string;
}) {
  const selectedLabel =
    value === "all" ? allLabel : options.find((o) => o.slug === value)?.name;
  const groupedOptions = groupByCatalogCategory(
    options.filter((option) => option.category),
    (option) => option.category as CatalogCategory,
  );
  const ungroupedOptions = options.filter((option) => !option.category);

  return (
    <Select value={value} onValueChange={onChange}>
      <div className={className}>
      <SelectTrigger className="min-h-12 w-full rounded-2xl border-[#D6DEED] bg-white text-sm font-semibold text-[#111827]">
        <SelectValue placeholder={placeholder}>{selectedLabel}</SelectValue>
      </SelectTrigger>
      </div>
      <SelectContent>
        <SelectItem value="all">{allLabel}</SelectItem>
        {groupedOptions.length > 0 && <SelectSeparator />}
        {groupedOptions.map((group) => (
          <SelectGroup key={group.category.slug}>
            <SelectLabel>{group.category.label}</SelectLabel>
            {group.items.map((o) => (
              <SelectItem key={o.slug} value={o.slug}>
                {o.name}
              </SelectItem>
            ))}
          </SelectGroup>
        ))}
        {ungroupedOptions.length > 0 && groupedOptions.length > 0 && <SelectSeparator />}
        {ungroupedOptions.map((o) => (
          <SelectItem key={o.slug} value={o.slug}>
            {o.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
