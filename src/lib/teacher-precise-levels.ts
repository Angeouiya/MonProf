import { filterLevelsForJourney, filterSubjectsForJourney } from "@/lib/catalog-journey";
import { marketplacePreciseLevels } from "@/lib/marketplace-pricing";
import type { TeacherJourney, TeacherJourneyEligibility } from "@/lib/teacher-journeys";

export const SCHOOL_JOURNEYS = ["ivoirien", "francais"] as const;
export type SchoolJourney = (typeof SCHOOL_JOURNEYS)[number];

export type TeacherPreciseLevelSelection = {
  journey: SchoolJourney;
  className: string;
  subjectId: string;
};

export function teacherPreciseLevelOptions(
  journey: SchoolJourney,
  levels: ReadonlyArray<{ name: string; order?: number }>,
): string[] {
  const eligibleLevels = filterLevelsForJourney([...levels], journey);
  const classes = new Set<string>();
  for (const level of eligibleLevels) {
    for (const className of marketplacePreciseLevels(journey, level.name)) classes.add(className);
  }
  return [...classes];
}

export function validateTeacherPreciseLevels(
  raw: unknown,
  eligibility: TeacherJourneyEligibility,
  levels: ReadonlyArray<{ name: string; order?: number }>,
  subjects: ReadonlyArray<{ id: string; name: string; icon?: string | null }>,
  options: { requireForMarketplace: boolean },
): TeacherPreciseLevelSelection[] {
  if (!Array.isArray(raw) || raw.length > 500) {
    throw new Error("Sélectionnez les associations matière et classe enseignées par le professeur.");
  }
  const result: TeacherPreciseLevelSelection[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    if (!item || typeof item !== "object") throw new Error("Classe enseignée invalide.");
    const value = item as Record<string, unknown>;
    const journey = value.journey;
    const className = value.className;
    const subjectId = value.subjectId;
    if ((journey !== "ivoirien" && journey !== "francais")
      || typeof className !== "string" || typeof subjectId !== "string") {
      throw new Error("Association matière-classe invalide.");
    }
    const field = journey === "ivoirien" ? "offersIvorianSystem" : "offersFrenchSystem";
    if (!eligibility[field]
      || !teacherPreciseLevelOptions(journey, levels).includes(className)
      || !filterSubjectsForJourney([...subjects], journey).some((subject) => subject.id === subjectId)) {
      throw new Error(`La combinaison « ${className} » / matière n'est pas autorisée par le profil du professeur.`);
    }
    const key = `${journey}:${className}:${subjectId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push({ journey, className, subjectId });
  }
  if (options.requireForMarketplace) {
    const missing = SCHOOL_JOURNEYS.filter((journey) => {
      const field = journey === "ivoirien" ? "offersIvorianSystem" : "offersFrenchSystem";
      return eligibility[field] && !result.some((item) => item.journey === journey);
    });
    if (missing.length) {
      throw new Error(`Associez au moins une matière à une classe exacte pour ${missing.map((item) => item === "ivoirien" ? "le système ivoirien" : "le système français").join(" et ")}.`);
    }
  }
  return result;
}

export function isTeacherQualifiedForPreciseLevel(
  journey: TeacherJourney,
  className: string,
  subjectId: string,
  classes: ReadonlyArray<{ journey: string; className: string; subjectId: string }>,
): boolean {
  return journey === "professionnel"
    || classes.some((item) => item.journey === journey
      && item.className === className && item.subjectId === subjectId);
}

export function teacherNeedsPreciseLevelReview(teacher: TeacherJourneyEligibility & {
  portalAccessEnabled: boolean;
  status: string;
  preciseLevels: ReadonlyArray<{ journey: string; className: string; subjectId: string }>;
}): boolean {
  if (!teacher.portalAccessEnabled || teacher.status !== "ACTIVE") return false;
  return SCHOOL_JOURNEYS.some((journey) => {
    const enabled = journey === "ivoirien" ? teacher.offersIvorianSystem : teacher.offersFrenchSystem;
    return enabled && !teacher.preciseLevels.some((item) => item.journey === journey);
  });
}
