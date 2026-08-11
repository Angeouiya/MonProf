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
  showMeta?: boolean;
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
  showMeta = false,
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
    <div
      className={cn("journey-switcher", className)}
      data-journey-switcher
      data-mini-app-tabs
      data-mini-app-system-switcher
      data-active-journey={selectedJourney}
      data-journey-count={journeys.length}
      data-size={size}
    >
      {showLabel && <p className="journey-switcher__label">{label}</p>}
      <div
        className="journey-switcher__rail"
        style={style}
        role="tablist"
        aria-label={label}
        data-mini-app-tablist
        data-mini-app-rail
      >
        <span className="journey-switcher__indicator" aria-hidden="true" data-mini-app-active-pill />
        {journeys.map((journey) => {
          const config = TEACHER_JOURNEY_CONFIG[journey];
          const href = hrefs[journey];
          const active = selectedJourney === journey;
          const tabMeta = journey === "professionnel" ? "40 000 F" : config.priceLabel;

          if (!href) return null;

          return (
            <Link
              key={journey}
              href={href}
              prefetch
              aria-label={showMeta ? `${config.label} · ${tabMeta}` : config.label}
              aria-current={active ? "page" : undefined}
              aria-selected={active}
              role="tab"
              data-journey-tab={journey}
              data-active={active ? "true" : "false"}
              data-state={active ? "active" : "inactive"}
              className="journey-switcher__link"
              onClick={() => setPendingSelection({ source: resolvedActive, target: journey })}
            >
              <span className="journey-switcher__text">
                <span className="journey-switcher__title">{config.shortLabel}</span>
                {showMeta && (
                  <span className="journey-switcher__meta" data-journey-tab-meta>
                    {tabMeta}
                  </span>
                )}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
