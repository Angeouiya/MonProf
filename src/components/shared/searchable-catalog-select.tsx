"use client";

import { useMemo, useState } from "react";
import { Check, ChevronsUpDown, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

type SearchableCatalogOption = {
  value: string;
  label: string;
  keywords?: string;
};

type SearchableCatalogGroup = {
  label: string;
  options: SearchableCatalogOption[];
};

function normalizeSearch(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/gi, " ")
    .trim()
    .toLowerCase();
}

type SearchableCatalogSelectProps = {
  id?: string;
  name: string;
  value?: string | null;
  placeholder: string;
  searchPlaceholder: string;
  emptyLabel: string;
  allLabel: string;
  groups: SearchableCatalogGroup[];
  onValueChange?: (value: string) => void;
  className?: string;
  triggerClassName?: string;
};

export function SearchableCatalogSelect({
  id,
  name,
  value,
  placeholder,
  searchPlaceholder,
  emptyLabel,
  allLabel,
  groups,
  onValueChange,
  className,
  triggerClassName,
}: SearchableCatalogSelectProps) {
  const [open, setOpen] = useState(false);
  const [selectedValue, setSelectedValue] = useState(value ?? "");
  const [query, setQuery] = useState("");
  const isControlled = typeof onValueChange === "function";
  const currentValue = isControlled ? value ?? "" : selectedValue;

  const selectedOption = useMemo(() => {
    if (!currentValue) return null;
    for (const group of groups) {
      const match = group.options.find((option) => option.value === currentValue);
      if (match) return match;
    }
    return null;
  }, [currentValue, groups]);

  const normalizedQuery = normalizeSearch(query);
  const allOptionMatches = !normalizedQuery || normalizeSearch(`${allLabel} tous toutes aucun`).includes(normalizedQuery);
  const visibleGroups = useMemo(() => {
    if (!normalizedQuery) return groups;

    return groups
      .map((group) => ({
        ...group,
        options: group.options.filter((option) => (
          normalizeSearch(`${option.label} ${option.keywords ?? ""}`).includes(normalizedQuery)
        )),
      }))
      .filter((group) => group.options.length > 0);
  }, [groups, normalizedQuery]);

  function choose(nextValue: string) {
    if (!isControlled) setSelectedValue(nextValue);
    onValueChange?.(nextValue);
    setQuery("");
    setOpen(false);
  }

  return (
    <div className={cn("min-w-0", className)}>
      <input type="hidden" name={name} value={currentValue} />
      <Popover
        open={open}
        onOpenChange={(nextOpen) => {
          setOpen(nextOpen);
          if (!nextOpen) setQuery("");
        }}
      >
        <PopoverTrigger asChild>
          <Button
            id={id}
            type="button"
            variant="outline"
            aria-expanded={open}
            className={cn(
              "min-h-11 w-full justify-between rounded-lg border-[#DDE6F7] bg-white px-3 text-left text-sm font-medium text-[#111827] hover:border-[#111B4D] hover:bg-white",
              triggerClassName,
            )}
          >
            <span className="flex min-w-0 items-center gap-2">
              <Search className="h-4 w-4 shrink-0 text-[#64748B]" />
              <span className={cn("min-w-0 truncate", !selectedOption && !selectedValue && "text-[#6B7280]")}>
                {selectedOption?.label ?? placeholder}
              </span>
            </span>
            <ChevronsUpDown className="h-4 w-4 shrink-0 text-[#6B7280]" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          className="w-[min(var(--radix-popover-trigger-width),calc(100vw-2rem))] p-0"
        >
          <Command shouldFilter={false}>
            <CommandInput placeholder={searchPlaceholder} value={query} onValueChange={setQuery} />
            <CommandList className="max-h-[340px]">
              {allOptionMatches && (
                <CommandGroup heading="Recherche rapide">
                  <CommandItem
                    value={`${allLabel} tous toutes`}
                    onSelect={() => choose("")}
                    className="min-h-11"
                  >
                    <Search className="h-4 w-4" />
                    <span className="flex-1">{allLabel}</span>
                    {!currentValue && <Check className="h-4 w-4 text-[#111B4D]" />}
                  </CommandItem>
                </CommandGroup>
              )}
              {visibleGroups.map((group) => (
                <CommandGroup key={group.label} heading={group.label}>
                  {group.options.map((option) => (
                    <CommandItem
                      key={option.value}
                      value={`${option.label} ${option.value} ${option.keywords ?? ""}`}
                      onSelect={() => choose(option.value)}
                      className="min-h-11"
                    >
                      <span className="min-w-0 flex-1 truncate">{option.label}</span>
                      {currentValue === option.value && <Check className="h-4 w-4 text-[#111B4D]" />}
                    </CommandItem>
                  ))}
                </CommandGroup>
              ))}
              {!allOptionMatches && visibleGroups.length === 0 && (
                <div className="px-4 py-8 text-center text-sm font-medium text-[#64748B]">
                  {emptyLabel}
                </div>
              )}
            </CommandList>
          </Command>
          {currentValue && (
            <button
              type="button"
              onClick={() => choose("")}
              className="flex min-h-11 w-full items-center justify-center gap-2 border-t border-[#E3E8F2] bg-white px-3 text-sm font-semibold text-[#111B4D] hover:bg-white"
            >
              <X className="h-4 w-4" />
              Effacer la sélection
            </button>
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
}
