export const TEACHER_JOURNEYS = ["ivoirien", "francais", "professionnel"] as const;

export type TeacherJourney = (typeof TEACHER_JOURNEYS)[number];

export type TeacherJourneyEligibility = {
  offersIvorianSystem: boolean;
  offersFrenchSystem: boolean;
  offersProfessionalTraining: boolean;
};

export const TEACHER_JOURNEY_CONFIG: Record<TeacherJourney, {
  label: string;
  shortLabel: string;
  teacherField: keyof TeacherJourneyEligibility;
  searchPlaceholder: string;
  priceLabel: string;
}> = {
  ivoirien: {
    label: "Système ivoirien",
    shortLabel: "Ivoirien",
    teacherField: "offersIvorianSystem",
    searchPlaceholder: "Matière ou niveau",
    priceLabel: "Dès 15 000 F",
  },
  francais: {
    label: "Système français",
    shortLabel: "Français",
    teacherField: "offersFrenchSystem",
    searchPlaceholder: "Matière ou niveau",
    priceLabel: "Dès 37 500 F",
  },
  professionnel: {
    label: "Professionnel",
    shortLabel: "Pro",
    teacherField: "offersProfessionalTraining",
    searchPlaceholder: "Compétence ou métier",
    priceLabel: "40 000 F / séance",
  },
};

const PROFESSIONAL_COURSE_CATEGORIES = new Set([
  "formation_professionnelle",
  "apprentissage_metier",
  "enseignement_superieur",
  "langues_communication",
]);

export function parseTeacherJourney(value?: string | null): TeacherJourney | null {
  return TEACHER_JOURNEYS.includes(value as TeacherJourney) ? value as TeacherJourney : null;
}

export function teacherJourneyWhere(journey: TeacherJourney): Record<keyof TeacherJourneyEligibility, true> {
  return { [TEACHER_JOURNEY_CONFIG[journey].teacherField]: true } as Record<keyof TeacherJourneyEligibility, true>;
}

export function teacherSupportsJourney(teacher: TeacherJourneyEligibility, journey: TeacherJourney): boolean {
  return teacher[TEACHER_JOURNEY_CONFIG[journey].teacherField] === true;
}

export function teacherEligibleJourneys(teacher: TeacherJourneyEligibility): TeacherJourney[] {
  return TEACHER_JOURNEYS.filter((journey) => teacherSupportsJourney(teacher, journey));
}

export function hasTeacherJourney(teacher: TeacherJourneyEligibility): boolean {
  return teacherEligibleJourneys(teacher).length > 0;
}

export function resolveTeacherJourney({
  courseCategory,
  schoolSystem,
}: {
  courseCategory?: string | null;
  schoolSystem?: string | null;
}): TeacherJourney | null {
  if (courseCategory && PROFESSIONAL_COURSE_CATEGORIES.has(courseCategory)) return "professionnel";
  if (schoolSystem === "francais") return "francais";
  if (schoolSystem === "ivoirien") return "ivoirien";
  return null;
}
