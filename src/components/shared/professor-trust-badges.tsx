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
    primary: "min-h-6 px-2 py-0.5 text-[9.5px]",
    secondary: "min-h-6 px-2 py-0.5 text-[9.5px]",
    iconPrimary: "h-2.5 w-2.5",
    iconSecondary: "h-3 w-3",
  },
  md: {
    container: "gap-2",
    primary: "min-h-8 px-3 py-1.5 text-xs",
    secondary: "min-h-8 px-3 py-1.5 text-xs",
    iconPrimary: "h-3.5 w-3.5",
    iconSecondary: "h-3.5 w-3.5",
  },
  lg: {
    container: "gap-2.5",
    primary: "min-h-10 px-3.5 py-2 text-sm",
    secondary: "min-h-9 px-3.5 py-2 text-xs",
    iconPrimary: "h-4 w-4",
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
      className: "border-[#1E2A78] bg-[#1E2A78] text-white",
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
            "inline-flex max-w-full min-w-0 items-center rounded-lg border border-[#111B4D] bg-[#111B4D] font-semibold uppercase tracking-wide text-white max-[360px]:px-2",
            styles.primary,
          )}
          title="Professeur certifié"
        >
          <span className="mr-1.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-white text-[#111B4D]">
            <ShieldCheck className={cn("shrink-0", styles.iconPrimary)} />
          </span>
          <span className="min-w-0 truncate">Certifié</span>
        </span>
      )}
      {visibleSecondary.map((badge) => {
        const Icon = badge.icon;
        return (
          <span
            key={badge.key}
            className={cn(
              "inline-flex shrink-0 items-center rounded-lg border font-semibold uppercase tracking-wide",
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
