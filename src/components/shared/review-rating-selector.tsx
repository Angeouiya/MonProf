"use client";

import { cn } from "@/lib/utils";

const RATING_OPTIONS = [
  { value: 1, label: "1", title: "Très insuffisant", detail: "Cours non acceptable", tone: "Suivi qualité urgent" },
  { value: 2, label: "2", title: "Insuffisant", detail: "Problèmes importants", tone: "Analyse admin requise" },
  { value: 3, label: "3", title: "Moyen", detail: "À améliorer", tone: "Retour utile au professeur" },
  { value: 4, label: "4", title: "Bien", detail: "Expérience positive", tone: "Cours satisfaisant" },
  { value: 5, label: "5", title: "Excellent", detail: "Très satisfait", tone: "Professeur recommandé" },
] as const;

export function ReviewRatingSelector({
  value,
  onChange,
}: {
  value: number;
  onChange: (rating: number) => void;
}) {
  const selected = RATING_OPTIONS.find((option) => option.value === value) ?? RATING_OPTIONS[4];

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-2 min-[420px]:grid-cols-5">
        {RATING_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={cn(
              "min-h-14 rounded-lg border px-3 py-2 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9AAAD0] focus-visible:ring-offset-2 min-[420px]:text-center",
              option.value === value
                ? "border-[#111B4D] bg-[#111B4D] text-white"
                : "border-[#E3E8F2] bg-white text-[#111827] hover:border-[#111B4D] hover:bg-white",
            )}
            aria-pressed={option.value === value}
            aria-label={`Évaluation ${option.value} sur 5 : ${option.title}`}
          >
            <span className="flex items-center justify-between gap-2 min-[420px]:block">
              <span className="text-base font-semibold tabular-nums">{option.label}/5</span>
              <span className={cn("text-xs font-semibold leading-tight min-[420px]:mt-1 min-[420px]:block", option.value === value ? "text-white" : "text-[#64748B]")}>{option.title}</span>
            </span>
          </button>
        ))}
      </div>
      <div className="rounded-lg border border-[#DDE6F7] bg-white p-3">
        <div className="flex flex-col gap-1 min-[460px]:flex-row min-[460px]:items-center min-[460px]:justify-between">
          <p className="text-sm font-semibold text-[#111B4D]">{selected.title}</p>
          <span className="w-fit rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-[#111B4D] ring-1 ring-[#DDE6F7]">
            {selected.tone}
          </span>
        </div>
        <p className="mt-0.5 text-xs text-[#64748B]">{selected.detail}. Les notes faibles déclenchent un suivi qualité par l'administration.</p>
      </div>
    </div>
  );
}
