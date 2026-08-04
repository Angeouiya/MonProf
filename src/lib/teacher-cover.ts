export const TEACHER_COVER_CATALOG = [
  {
    id: "academic-library",
    label: "Bibliothèque académique",
    description: "Un cadre studieux, lumineux et rassurant.",
    url: "/images/teacher-covers/academic-library.webp",
  },
  {
    id: "professional-studio",
    label: "Atelier professionnel",
    description: "Une atmosphère premium dédiée aux compétences métiers.",
    url: "/images/teacher-covers/professional-studio.webp",
  },
  {
    id: "science-lab",
    label: "Sciences et innovation",
    description: "Un univers élégant pour les sciences et la technologie.",
    url: "/images/teacher-covers/science-lab.webp",
  },
  {
    id: "early-reading",
    label: "Premières lectures",
    description: "Un univers chaleureux pour la petite enfance.",
    url: "/images/teacher-covers/early-reading.webp",
  },
  {
    id: "primary-math",
    label: "Mathématiques primaire",
    description: "Concentration, méthode et apprentissage fondamental.",
    url: "/images/teacher-covers/primary-math.webp",
  },
  {
    id: "children-science",
    label: "Découverte scientifique",
    description: "Une science joyeuse et accessible aux enfants.",
    url: "/images/teacher-covers/children-science.webp",
  },
  {
    id: "language-learning",
    label: "Langues vivantes",
    description: "Un cadre calme pour apprendre et communiquer.",
    url: "/images/teacher-covers/language-learning.webp",
  },
  {
    id: "secondary-math",
    label: "Physique et astronomie",
    description: "Un univers scientifique pour collège et lycée.",
    url: "/images/teacher-covers/secondary-math.webp",
  },
  {
    id: "literature-library",
    label: "Arts et design",
    description: "Création, dessin et conception dans un atelier élégant.",
    url: "/images/teacher-covers/literature-library.webp",
  },
  {
    id: "robotics-learning",
    label: "Robotique et technologie",
    description: "Un apprentissage moderne tourné vers l'innovation.",
    url: "/images/teacher-covers/robotics-learning.webp",
  },
  {
    id: "exam-preparation",
    label: "Préparation aux examens",
    description: "Un environnement serein pour viser l'excellence.",
    url: "/images/teacher-covers/exam-preparation.webp",
  },
  {
    id: "university-research",
    label: "Études supérieures",
    description: "Recherche, autonomie et rigueur universitaire.",
    url: "/images/teacher-covers/university-research.webp",
  },
  {
    id: "business-english",
    label: "Droit et sciences humaines",
    description: "Un cadre sobre pour l'analyse et la réflexion.",
    url: "/images/teacher-covers/business-english.webp",
  },
  {
    id: "finance-mentoring",
    label: "Finance et gestion",
    description: "Un accompagnement premium pour décideurs.",
    url: "/images/teacher-covers/finance-mentoring.webp",
  },
  {
    id: "public-speaking",
    label: "Prise de parole",
    description: "Présenter, convaincre et diriger avec assurance.",
    url: "/images/teacher-covers/public-speaking.webp",
  },
  {
    id: "data-analysis",
    label: "Data et numérique",
    description: "Compétences digitales et analyse de données.",
    url: "/images/teacher-covers/data-analysis.webp",
  },
  {
    id: "architecture-training",
    label: "Architecture et BTP",
    description: "Conception, plans et apprentissage technique.",
    url: "/images/teacher-covers/architecture-training.webp",
  },
  {
    id: "culinary-training",
    label: "Cuisine et hôtellerie",
    description: "Une formation pratique dans un cadre d'excellence.",
    url: "/images/teacher-covers/culinary-training.webp",
  },
  {
    id: "renewable-energy",
    label: "Énergie et électricité",
    description: "Une formation technique tournée vers l'avenir.",
    url: "/images/teacher-covers/renewable-energy.webp",
  },
] as const;

export const TEACHER_COVER_COLOR_CATALOG = [
  { id: "color-bleu-nuit", label: "Bleu nuit", url: "/images/teacher-covers/colors/bleu-nuit.svg" },
  { id: "color-indigo", label: "Indigo", url: "/images/teacher-covers/colors/indigo.svg" },
  { id: "color-emeraude", label: "Émeraude", url: "/images/teacher-covers/colors/emeraude.svg" },
  { id: "color-lagune", label: "Lagune", url: "/images/teacher-covers/colors/lagune.svg" },
  { id: "color-terracotta", label: "Terracotta", url: "/images/teacher-covers/colors/terracotta.svg" },
  { id: "color-sable", label: "Sable", url: "/images/teacher-covers/colors/sable.svg" },
  { id: "color-aubergine", label: "Aubergine", url: "/images/teacher-covers/colors/aubergine.svg" },
  { id: "color-ardoise", label: "Ardoise", url: "/images/teacher-covers/colors/ardoise.svg" },
] as const;

export type TeacherCoverCatalogItem = (typeof TEACHER_COVER_CATALOG)[number];
export type TeacherCoverColorItem = (typeof TEACHER_COVER_COLOR_CATALOG)[number];
export type TeacherCoverOption = TeacherCoverCatalogItem | TeacherCoverColorItem;

function stableCoverHash(value: string) {
  let hash = 2166136261;
  for (const character of value) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash);
}

export function selectLeastUsedTeacherCover(
  usedCoverUrls: Array<string | null | undefined>,
  seed: string,
): TeacherCoverCatalogItem {
  const usage = new Map<string, number>(TEACHER_COVER_CATALOG.map((cover) => [cover.url, 0]));
  for (const url of usedCoverUrls) {
    if (url && usage.has(url)) usage.set(url, (usage.get(url) ?? 0) + 1);
  }

  const start = stableCoverHash(seed) % TEACHER_COVER_CATALOG.length;
  let selected = TEACHER_COVER_CATALOG[start];
  for (let offset = 1; offset < TEACHER_COVER_CATALOG.length; offset += 1) {
    const candidate = TEACHER_COVER_CATALOG[(start + offset) % TEACHER_COVER_CATALOG.length];
    if ((usage.get(candidate.url) ?? 0) < (usage.get(selected.url) ?? 0)) selected = candidate;
  }
  return selected;
}

export function isTeacherCoverCatalogUrl(value: unknown): value is TeacherCoverOption["url"] {
  return typeof value === "string" && (
    TEACHER_COVER_CATALOG.some((item) => item.url === value)
    || TEACHER_COVER_COLOR_CATALOG.some((item) => item.url === value)
  );
}

export function resolveTeacherCover({
  teacherId,
  coverUrl,
}: {
  teacherId: string;
  coverUrl?: string | null;
}): TeacherCoverOption | { id: "custom"; label: "Couverture personnalisée"; description: string; url: string } {
  const custom = coverUrl?.trim();
  if (custom) {
    const catalogItem = [...TEACHER_COVER_CATALOG, ...TEACHER_COVER_COLOR_CATALOG]
      .find((item) => item.url === custom);
    return catalogItem ?? {
      id: "custom",
      label: "Couverture personnalisée",
      description: "Couverture sélectionnée par le professeur.",
      url: custom,
    };
  }

  return TEACHER_COVER_CATALOG[stableCoverHash(teacherId) % TEACHER_COVER_CATALOG.length];
}
