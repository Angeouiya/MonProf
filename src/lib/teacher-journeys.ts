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
  searchAriaLabel: string;
  description: string;
  resultIntro: string;
  primarySubjectFallback: string;
  subjectLabel: string;
  subjectPlaceholder: string;
  subjectSearchPlaceholder: string;
  subjectEmptyLabel: string;
  levelLabel: string;
  levelPlaceholder: string;
  levelSearchPlaceholder: string;
  priceLabel: string;
}> = {
  ivoirien: {
    label: "Système ivoirien",
    shortLabel: "Ivoirien",
    teacherField: "offersIvorianSystem",
    searchPlaceholder: "Matière ou niveau",
    searchAriaLabel: "Rechercher une matière ou un niveau du système ivoirien",
    description: "Cours du système ivoirien, du CP1 à la Terminale.",
    resultIntro: "Matières et niveaux du système ivoirien uniquement.",
    primarySubjectFallback: "Accompagnement scolaire ivoirien",
    subjectLabel: "Matière",
    subjectPlaceholder: "Toutes les matières",
    subjectSearchPlaceholder: "Saisir une matière du système ivoirien...",
    subjectEmptyLabel: "Aucune matière du système ivoirien trouvée",
    levelLabel: "Niveau",
    levelPlaceholder: "Tous les niveaux",
    levelSearchPlaceholder: "Saisir une classe ou un niveau ivoirien...",
    priceLabel: "Dès 15 000 F",
  },
  francais: {
    label: "Système français",
    shortLabel: "Français",
    teacherField: "offersFrenchSystem",
    searchPlaceholder: "Matière ou niveau",
    searchAriaLabel: "Rechercher une matière ou un niveau du système français",
    description: "Cours du système français, du CP1 à la Terminale.",
    resultIntro: "Matières et niveaux du système français uniquement.",
    primarySubjectFallback: "Accompagnement scolaire français",
    subjectLabel: "Matière",
    subjectPlaceholder: "Toutes les matières",
    subjectSearchPlaceholder: "Saisir une matière du système français...",
    subjectEmptyLabel: "Aucune matière du système français trouvée",
    levelLabel: "Niveau",
    levelPlaceholder: "Tous les niveaux",
    levelSearchPlaceholder: "Saisir une classe ou un niveau français...",
    priceLabel: "Dès 37 500 F",
  },
  professionnel: {
    label: "Professionnel",
    shortLabel: "Pro",
    teacherField: "offersProfessionalTraining",
    searchPlaceholder: "Compétence ou métier",
    searchAriaLabel: "Rechercher une compétence ou un métier professionnel",
    description: "Compétences, métiers et formations pour adultes et entreprises.",
    resultIntro: "Compétences et niveaux professionnels uniquement.",
    primarySubjectFallback: "Compétence professionnelle",
    subjectLabel: "Compétence",
    subjectPlaceholder: "Toutes les compétences",
    subjectSearchPlaceholder: "Saisir une compétence ou un métier...",
    subjectEmptyLabel: "Aucune compétence professionnelle trouvée",
    levelLabel: "Profil",
    levelPlaceholder: "Tous les profils",
    levelSearchPlaceholder: "Saisir un profil ou un niveau professionnel...",
    priceLabel: "40 000 F / séance de 2h",
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
