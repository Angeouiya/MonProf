"use client";

import { useState, type CSSProperties } from "react";
import Link from "next/link";

import {
  TEACHER_JOURNEY_CONFIG,
  TEACHER_JOURNEYS,
  type TeacherJourney,
} from "@/lib/teacher-journeys";
import { cn } from "@/lib/utils";

type JourneySwitcherProps = {
  activeJourney?: TeacherJourney;
  hrefs: Partial<Record<TeacherJourney, string>>;
  journeys?: readonly TeacherJourney[];
  label?: string;
  showLabel?: boolean;
  size?: "hero" | "regular" | "compact";
  className?: string;
};

type JourneySwitcherStyle = CSSProperties & {
  "--journey-count": number;
  "--journey-index": number;
};

export function JourneySwitcher({
  activeJourney,
  hrefs,
  journeys = TEACHER_JOURNEYS,
  label = "Système",
  showLabel = false,
  size = "regular",
  className,
}: JourneySwitcherProps) {
  const firstJourney = journeys[0] ?? "ivoirien";
  const resolvedActive = activeJourney && journeys.includes(activeJourney)
    ? activeJourney
    : firstJourney;
  const [pendingSelection, setPendingSelection] = useState<{
    source: TeacherJourney;
    target: TeacherJourney;
  } | null>(null);
  const selectedJourney = pendingSelection?.source === resolvedActive
    ? pendingSelection.target
    : resolvedActive;

  const selectedIndex = Math.max(0, journeys.indexOf(selectedJourney));
  const style: JourneySwitcherStyle = {
    "--journey-count": Math.max(1, journeys.length),
    "--journey-index": selectedIndex,
  };

  return (
    <div className={cn("journey-switcher", className)} data-journey-switcher data-size={size}>
      {showLabel && <p className="journey-switcher__label">{label}</p>}
      <div className="journey-switcher__rail" style={style}>
        <span className="journey-switcher__indicator" aria-hidden="true" />
        {journeys.map((journey) => {
          const config = TEACHER_JOURNEY_CONFIG[journey];
          const href = hrefs[journey];
          const active = selectedJourney === journey;

          if (!href) return null;

          return (
            <Link
              key={journey}
              href={href}
              prefetch
              aria-label={config.label}
              aria-current={active ? "page" : undefined}
              data-journey-tab={journey}
              data-active={active ? "true" : "false"}
              className="journey-switcher__link"
              onClick={() => setPendingSelection({ source: resolvedActive, target: journey })}
            >
              {config.shortLabel}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
