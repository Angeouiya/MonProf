import type { CourseFormat } from "@prisma/client";

export type MarketplaceTransportLesson = {
  teacherId: string;
  scheduledDate: Date;
  scheduledTime: string | null;
  durationMinutes: number;
  courseFormat: CourseFormat;
  commune: string | null;
  quartier: string | null;
};

type TransportOrigin = {
  commune: string | null;
  quartier: string | null;
  source: "previous_lesson" | "declared_zone";
  label: string;
};

function minutesOfDay(time: string | null) {
  if (!time || !/^\d{2}:\d{2}$/.test(time)) return null;
  const [hour, minute] = time.split(":").map(Number);
  if (hour > 23 || minute > 59) return null;
  return hour * 60 + minute;
}

/**
 * The last confirmed lesson is the travel origin only when its location is
 * known. An online lesson has no trustworthy physical location, so we fall
 * back to the teacher's declared area instead of inventing GPS coordinates.
 */
export function marketplaceTransportOrigin(input: {
  teacherId: string;
  teacherCommune: string | null;
  teacherQuartier: string | null;
  scheduledDate: Date;
  scheduledTime: string;
  lessons: MarketplaceTransportLesson[];
}): TransportOrigin {
  const requestedStart = minutesOfDay(input.scheduledTime);
  const day = input.scheduledDate.toISOString().slice(0, 10);
  let previous: MarketplaceTransportLesson | null = null;
  let previousEnd = -1;

  for (const lesson of input.lessons) {
    if (lesson.teacherId !== input.teacherId || lesson.scheduledDate.toISOString().slice(0, 10) !== day) continue;
    const start = minutesOfDay(lesson.scheduledTime);
    if (start === null || requestedStart === null || !Number.isFinite(lesson.durationMinutes)) continue;
    const end = start + lesson.durationMinutes;
    if (end <= requestedStart && end > previousEnd) {
      previous = lesson;
      previousEnd = end;
    }
  }

  if (previous?.courseFormat === "HOME" && previous.commune?.trim()) {
    const commune = previous.commune.trim();
    const quartier = previous.quartier?.trim() || null;
    return {
      commune,
      quartier,
      source: "previous_lesson",
      // Do not reveal another client's lesson address to a new requester.
      label: "Depuis le précédent cours confirmé du professeur",
    };
  }

  return {
    commune: input.teacherCommune,
    quartier: input.teacherQuartier,
    source: "declared_zone",
    label: "Depuis la zone déclarée du professeur (estimation)",
  };
}
