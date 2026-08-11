import { Home, Sparkles, Video } from "lucide-react";
import { cn } from "@/lib/utils";

export const DEFAULT_COURSE_FORMAT_OPTIONS = [
  { value: "", label: "Tout", shortLabel: "Tout", icon: Sparkles },
  { value: "HOME", label: "À domicile", shortLabel: "Domicile", icon: Home },
  { value: "ONLINE", label: "En ligne", shortLabel: "En ligne", icon: Video },
] as const;

export type CourseFormatValue = (typeof DEFAULT_COURSE_FORMAT_OPTIONS)[number]["value"];

export function normalizeCourseFormat(value?: string | null): CourseFormatValue {
  return value === "HOME" || value === "ONLINE" ? value : "";
}

export function CourseFormatSegmentedControl({
  idPrefix,
  name = "format",
  value,
  className,
  compact = false,
  ariaLabel = "Format du cours",
}: {
  idPrefix: string;
  name?: string;
  value?: string | null;
  className?: string;
  compact?: boolean;
  ariaLabel?: string;
}) {
  const currentValue = normalizeCourseFormat(value);

  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      data-course-format-control
      className={cn("grid grid-cols-3 gap-1.5", className)}
    >
      {DEFAULT_COURSE_FORMAT_OPTIONS.map((item) => {
        const Icon = item.icon;
        const inputId = `${idPrefix}-${item.value || "all"}`;
        const checked = currentValue === item.value;

        return (
          <label key={item.value || "all"} htmlFor={inputId} className="min-w-0 cursor-pointer">
            <input
              id={inputId}
              type="radio"
              name={name}
              value={item.value}
              defaultChecked={checked}
              className="peer sr-only"
              data-course-format-radio
            />
            <span
              className={cn(
                "flex min-w-0 items-center justify-center gap-1.5 rounded-lg border border-[#CAD7F2] bg-white px-2 text-xs font-semibold text-[#111B4D] transition",
                "peer-checked:border-[#111B4D] peer-checked:bg-[#111B4D] peer-checked:text-white",
                "peer-focus-visible:ring-4 peer-focus-visible:ring-[#DDE6F7]",
                compact ? "h-10" : "h-11",
              )}
            >
              <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span className="min-w-0 truncate">{compact ? item.shortLabel : item.label}</span>
            </span>
          </label>
        );
      })}
    </div>
  );
}
