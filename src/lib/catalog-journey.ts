import type { TeacherJourney } from "@/lib/teacher-journeys";
import {
  getLevelCategory,
  getSubjectCategory,
  type CatalogCategory,
} from "@/lib/catalog-taxonomy";
import { COURSE_CATALOG } from "@/lib/course-catalog";

const SCHOOL_SUBJECT_CATEGORIES = new Set(["scolaire", "langues", "concours", "numerique"]);
const SCHOOL_LEVEL_CATEGORIES = new Set(["scolaire", "examens"]);
const PROFESSIONAL_COURSE_CATEGORIES = new Set([
  "enseignement_superieur",
  "formation_professionnelle",
  "apprentissage_metier",
  "langues_communication",
  "formation_entreprise",
]);
const SCHOOL_COURSE_CATEGORIES = new Set(["soutien_scolaire", "preparation_examens"]);

const SUBJECT_JOURNEY_INDEX = buildSubjectJourneyIndex();

export function subjectCategoryMatchesJourney(
  category: CatalogCategory,
  journey: TeacherJourney,
) {
  return journey === "professionnel"
    ? category.slug !== "scolaire"
    : SCHOOL_SUBJECT_CATEGORIES.has(category.slug);
}

export function levelCategoryMatchesJourney(
  category: CatalogCategory,
  journey: TeacherJourney,
) {
  return journey === "professionnel"
    ? !SCHOOL_LEVEL_CATEGORIES.has(category.slug)
    : SCHOOL_LEVEL_CATEGORIES.has(category.slug);
}

export function filterSubjectsForJourney<
  T extends { name: string; icon?: string | null },
>(subjects: T[], journey: TeacherJourney) {
  return subjects.filter((item) => {
    const indexedJourneys = SUBJECT_JOURNEY_INDEX.get(normalizeCatalogName(item.name));
    if (indexedJourneys) return indexedJourneys.has(journey);
    return subjectCategoryMatchesJourney(getSubjectCategory(item.name, item.icon), journey);
  });
}

export function filterLevelsForJourney<
  T extends { name: string; order?: number },
>(levels: T[], journey: TeacherJourney) {
  return levels.filter((item) => (
    levelCategoryMatchesJourney(getLevelCategory(item.name, item.order ?? 0), journey)
  ));
}

export function subjectNameMatchesJourney(name: string, journey: TeacherJourney) {
  const indexedJourneys = SUBJECT_JOURNEY_INDEX.get(normalizeCatalogName(name));
  return indexedJourneys
    ? indexedJourneys.has(journey)
    : subjectCategoryMatchesJourney(getSubjectCategory(name), journey);
}

function buildSubjectJourneyIndex() {
  const index = new Map<string, Set<TeacherJourney>>();
  for (const item of COURSE_CATALOG) {
    if (!item.actif) continue;
    const key = normalizeCatalogName(item.matiere_ou_competence);
    if (!key) continue;
    const journeys = index.get(key) ?? new Set<TeacherJourney>();
    if (
      SCHOOL_COURSE_CATEGORIES.has(item.categorie)
      && (item.systeme_scolaire === "ivoirien" || !item.systeme_scolaire)
    ) {
      journeys.add("ivoirien");
    }
    if (
      SCHOOL_COURSE_CATEGORIES.has(item.categorie)
      && (item.systeme_scolaire === "francais" || !item.systeme_scolaire)
    ) {
      journeys.add("francais");
    }
    if (PROFESSIONAL_COURSE_CATEGORIES.has(item.categorie)) {
      journeys.add("professionnel");
    }
    index.set(key, journeys);
  }
  return index;
}

function normalizeCatalogName(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/gi, " ")
    .trim()
    .toLowerCase();
}
