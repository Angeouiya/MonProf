import Image from "next/image";

import { cn } from "@/lib/utils";

type BrandLogoProps = {
  className?: string;
  markClassName?: string;
  textClassName?: string;
  compact?: boolean;
  priority?: boolean;
  size?: "sm" | "md" | "lg";
  tone?: "default" | "inverse";
};

const sizeStyles = {
  sm: {
    root: "gap-2.5",
    mark: "h-10 w-10",
    text: "text-lg",
    sizes: "40px",
  },
  md: {
    root: "gap-3",
    mark: "h-12 w-12",
    text: "text-xl",
    sizes: "48px",
  },
  lg: {
    root: "gap-3.5",
    mark: "h-14 w-14",
    text: "text-2xl",
    sizes: "56px",
  },
} as const;

export function BrandLogo({
  className,
  markClassName,
  textClassName,
  compact = false,
  priority = false,
  size = "md",
  tone = "default",
}: BrandLogoProps) {
  const styles = sizeStyles[size];

  return (
    <span className={cn("inline-flex min-w-0 items-center", styles.root, className)}>
      <span
        className={cn(
          "relative flex shrink-0 overflow-hidden bg-transparent",
          styles.mark,
          markClassName
        )}
      >
        <Image
          src="/images/brand/competence-mark.webp"
          alt="Logo Compétence"
          width={56}
          height={56}
          sizes={styles.sizes}
          priority={priority}
          className="h-full w-full object-contain"
        />
      </span>
      {!compact && (
        <span
          className={cn(
            "truncate font-semibold tracking-tight",
            styles.text,
            tone === "inverse" ? "text-white" : "text-[#111827]",
            textClassName
          )}
        >
          Compétence
        </span>
      )}
    </span>
  );
}
