"use client";

import { useMemo, useState } from "react";
import { Check, ChevronsUpDown, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
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

type SearchableCatalogSelectProps = {
  name: string;
  value?: string | null;
  placeholder: string;
  searchPlaceholder: string;
  emptyLabel: string;
  allLabel: string;
  groups: SearchableCatalogGroup[];
  className?: string;
  triggerClassName?: string;
};

export function SearchableCatalogSelect({
  name,
  value,
  placeholder,
  searchPlaceholder,
  emptyLabel,
  allLabel,
  groups,
  className,
  triggerClassName,
}: SearchableCatalogSelectProps) {
  const [open, setOpen] = useState(false);
  const [selectedValue, setSelectedValue] = useState(value ?? "");

  const selectedOption = useMemo(() => {
    if (!selectedValue) return null;
    for (const group of groups) {
      const match = group.options.find((option) => option.value === selectedValue);
      if (match) return match;
    }
    return null;
  }, [groups, selectedValue]);

  function choose(nextValue: string) {
    setSelectedValue(nextValue);
    setOpen(false);
  }

  return (
    <div className={cn("min-w-0", className)}>
      <input type="hidden" name={name} value={selectedValue} />
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            aria-expanded={open}
            className={cn(
              "min-h-11 w-full justify-between rounded-xl border-border bg-white px-3 text-left text-sm font-medium text-[#111827] shadow-none hover:bg-white",
              triggerClassName,
            )}
          >
            <span className={cn("min-w-0 truncate", !selectedOption && !selectedValue && "text-[#6B7280]")}>
              {selectedOption?.label ?? placeholder}
            </span>
            <ChevronsUpDown className="h-4 w-4 shrink-0 text-[#6B7280]" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          className="w-[min(var(--radix-popover-trigger-width),calc(100vw-2rem))] p-0"
        >
          <Command>
            <CommandInput placeholder={searchPlaceholder} />
            <CommandList className="max-h-[340px]">
              <CommandEmpty>{emptyLabel}</CommandEmpty>
              <CommandGroup heading="Recherche rapide">
                <CommandItem
                  value={`${allLabel} tous toutes`}
                  onSelect={() => choose("")}
                  className="min-h-11"
                >
                  <Search className="h-4 w-4" />
                  <span className="flex-1">{allLabel}</span>
                  {!selectedValue && <Check className="h-4 w-4 text-[#111B4D]" />}
                </CommandItem>
              </CommandGroup>
              {groups.map((group) => (
                <CommandGroup key={group.label} heading={group.label}>
                  {group.options.map((option) => (
                    <CommandItem
                      key={option.value}
                      value={`${option.label} ${option.value} ${option.keywords ?? ""}`}
                      onSelect={() => choose(option.value)}
                      className="min-h-11"
                    >
                      <span className="min-w-0 flex-1 truncate">{option.label}</span>
                      {selectedValue === option.value && <Check className="h-4 w-4 text-[#111B4D]" />}
                    </CommandItem>
                  ))}
                </CommandGroup>
              ))}
            </CommandList>
          </Command>
          {selectedValue && (
            <button
              type="button"
              onClick={() => choose("")}
              className="flex min-h-11 w-full items-center justify-center gap-2 border-t border-[#E3E8F2] bg-white px-3 text-sm font-semibold text-[#111B4D] hover:bg-white hover:shadow-sm"
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
