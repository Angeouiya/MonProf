import { Award, BadgeCheck, ShieldCheck, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";

type ProfessorTrustBadgesProps = {
  verified?: boolean;
  recommended?: boolean;
  premium?: boolean;
  popular?: boolean;
  isNew?: boolean;
  size?: "sm" | "md" | "lg";
  maxSecondary?: number;
  className?: string;
};

const sizeClasses = {
  sm: {
    container: "gap-1.5",
    primary: "min-h-7 px-2.5 py-1 text-[10px]",
    secondary: "min-h-7 px-2.5 py-1 text-[10px]",
    iconPrimary: "h-3 w-3",
    iconSecondary: "h-3 w-3",
  },
  md: {
    container: "gap-2",
    primary: "min-h-9 px-3.5 py-2 text-xs",
    secondary: "min-h-8 px-3 py-1.5 text-xs",
    iconPrimary: "h-4 w-4",
    iconSecondary: "h-3.5 w-3.5",
  },
  lg: {
    container: "gap-2.5",
    primary: "min-h-11 px-4 py-2.5 text-sm",
    secondary: "min-h-9 px-3.5 py-2 text-xs",
    iconPrimary: "h-[18px] w-[18px]",
    iconSecondary: "h-4 w-4",
  },
} as const;

export function ProfessorTrustBadges({
  verified,
  recommended,
  premium,
  popular,
  isNew,
  size = "md",
  maxSecondary,
  className,
}: ProfessorTrustBadgesProps) {
  const styles = sizeClasses[size];
  const secondaryBadges = [
    premium && {
      key: "premium",
      label: "Premium",
      icon: Award,
      className: "border-[#1E2A78] bg-[#1E2A78] text-white shadow-sm",
    },
    recommended && {
      key: "recommended",
      label: "Recommandé",
      icon: BadgeCheck,
      className: "border-[#D7DEE9] bg-white text-[#111B4D]",
    },
    popular && {
      key: "popular",
      label: "Très demandé",
      icon: TrendingUp,
      className: "border-[#D7DEE9] bg-white text-[#111B4D]",
    },
    isNew && {
      key: "new",
      label: "Nouveau",
      icon: null,
      className: "border-[#D7DEE9] bg-white text-[#111B4D]",
    },
  ].filter(Boolean) as {
    key: string;
    label: string;
    icon: typeof Award | typeof BadgeCheck | typeof TrendingUp | null;
    className: string;
  }[];
  const visibleSecondary = typeof maxSecondary === "number" ? secondaryBadges.slice(0, maxSecondary) : secondaryBadges;

  if (!verified && visibleSecondary.length === 0) return null;

  return (
    <div
      className={cn("flex min-w-0 flex-wrap items-center", styles.container, className)}
      aria-label="Badges de confiance du professeur"
    >
      {verified && (
        <span
          className={cn(
            "inline-flex max-w-full min-w-0 items-center rounded-full border border-[#1E2A78] bg-[#1E2A78] font-extrabold uppercase tracking-wide text-white shadow-sm ring-1 ring-[#E3E8F2] ring-offset-1 ring-offset-white max-[360px]:px-2",
            styles.primary,
          )}
          title="Professeur certifié par MonProf CI"
        >
          <span className="mr-1.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-white ring-1 ring-[#E3E8F2]">
            <ShieldCheck className={cn("shrink-0", styles.iconPrimary)} />
          </span>
          <span className="min-w-0 truncate max-[360px]:hidden">Certifié MonProf CI</span>
          <span className="hidden min-w-0 truncate max-[360px]:inline">Certifié</span>
        </span>
      )}
      {visibleSecondary.map((badge) => {
        const Icon = badge.icon;
        return (
          <span
            key={badge.key}
            className={cn(
              "inline-flex shrink-0 items-center rounded-full border font-extrabold uppercase tracking-wide shadow-sm",
              styles.secondary,
              badge.className,
            )}
            title={badge.label}
          >
            {Icon && <Icon className={cn("mr-1.5 shrink-0", styles.iconSecondary)} />}
            {badge.label}
          </span>
        );
      })}
    </div>
  );
}
