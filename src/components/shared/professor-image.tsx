"use client";

import { useState } from "react";
import Image from "next/image";
import { BadgeCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { initials } from "@/lib/format";

type ProfessorImageSize = "sm" | "md" | "lg" | "xl" | number;
type ProfessorImageShape = "circle" | "rounded";

type ProfessorImageProps = {
  photoUrl?: string | null;
  name?: string | null;
  size?: ProfessorImageSize;
  shape?: ProfessorImageShape;
  className?: string;
  priority?: boolean;
  verified?: boolean;
};

const SIZE_MAP: Record<Exclude<ProfessorImageSize, number>, number> = {
  sm: 40,
  md: 56,
  lg: 96,
  xl: 160,
};

function resolveSize(size: ProfessorImageSize) {
  return typeof size === "number" ? size : SIZE_MAP[size];
}

function isRemoteImage(src: string) {
  return /^https?:\/\//i.test(src);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function resolveBadgeMetrics(imageSize: number) {
  const size =
    imageSize < 48
      ? 16
      : imageSize < 72
        ? Math.round(imageSize * 0.34)
        : imageSize < 120
          ? Math.round(imageSize * 0.3)
          : Math.round(imageSize * 0.24);
  const badgeSize = clamp(size, 16, 42);
  const isCompact = imageSize < 64;

  return {
    size: badgeSize,
    iconSize: clamp(Math.round(badgeSize * 0.58), 9, 24),
    borderWidth: isCompact ? 2 : 3,
    haloWidth: isCompact ? 1 : 2,
    offset: Math.round(badgeSize * 0.22),
    shadow: "0 0 0 0 #FFFFFF",
  };
}

export function ProfessorImage({
  photoUrl,
  name,
  size = "md",
  shape = "circle",
  className,
  priority = false,
  verified = false,
}: ProfessorImageProps) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const px = resolveSize(size);
  const displayName = name?.trim() || "Professeur";
  const label = `Photo du professeur ${displayName}`;
  const hasImage = Boolean(photoUrl && failedSrc !== photoUrl);
  const isRemote = Boolean(photoUrl && isRemoteImage(photoUrl));
  const badge = resolveBadgeMetrics(px);

  return (
    <span
      className={cn("relative inline-flex shrink-0 overflow-visible", className)}
      style={{ width: px, height: px }}
      aria-label={hasImage ? label : `Avatar du professeur ${displayName}`}
    >
      <span
        className={cn(
          "relative block h-full w-full overflow-hidden border border-[#E3E8F2] bg-[#111B4D]",
          shape === "circle" ? "rounded-full" : "rounded-2xl"
        )}
      >
        {hasImage && (
          <span
            className="absolute inset-0 flex items-center justify-center bg-[#111B4D] font-bold text-white"
            style={{ fontSize: Math.max(14, Math.round(px * 0.28)) }}
            aria-hidden="true"
          >
            {initials(displayName) || "P"}
          </span>
        )}
        {hasImage && isRemote ? (
          // External professor URLs can come from imports or old records; use a native image so an unconfigured host never crashes the page.
          <img
            src={photoUrl!}
            alt={label}
            className="relative h-full w-full object-cover"
            loading={priority ? "eager" : "lazy"}
            decoding="async"
            onError={() => setFailedSrc(photoUrl!)}
          />
        ) : hasImage ? (
          <Image
            src={photoUrl!}
            alt={label}
            fill
            className="object-cover"
            sizes={`${px}px`}
            {...(priority ? { priority: true } : { loading: "lazy" as const })}
            onError={() => setFailedSrc(photoUrl!)}
          />
        ) : (
          <span
            className="flex h-full w-full items-center justify-center bg-[#111B4D] font-bold text-white"
            style={{ fontSize: Math.max(14, Math.round(px * 0.28)) }}
          >
            {initials(displayName) || "P"}
          </span>
        )}
      </span>
      {verified && (
        <span
          data-professor-image-badge
          className="absolute flex items-center justify-center rounded-full border-white bg-[#1E2A78] text-white"
          style={{
            width: badge.size,
            height: badge.size,
            right: -badge.offset,
            bottom: -badge.offset,
            borderWidth: badge.borderWidth,
            boxShadow: `0 0 0 ${badge.haloWidth}px #FFFFFF`,
          }}
          title="Professeur certifié"
          aria-label="Professeur certifié"
        >
          <BadgeCheck
            style={{
              width: badge.iconSize,
              height: badge.iconSize,
              strokeWidth: px < 64 ? 2.8 : 2.4,
            }}
          />
        </span>
      )}
    </span>
  );
}
