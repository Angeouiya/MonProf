const MIN_TERM_LENGTH = 2;

export function buildTeacherSearchClauses(rawSearch?: string | null) {
  const terms = splitTeacherSearchTerms(rawSearch);
  return terms.map((term) => ({ OR: buildTeacherSearchOr(term) }));
}

export function splitTeacherSearchTerms(rawSearch?: string | null) {
  const normalized = (rawSearch ?? "")
    .replace(/[’']/g, " ")
    .replace(/[-_/.,;:]+/g, " ")
    .trim();

  const terms = normalized
    .split(/\s+/)
    .map((term) => term.trim())
    .filter((term) => term.length >= MIN_TERM_LENGTH);

  return Array.from(new Set(terms));
}

function buildTeacherSearchOr(term: string) {
  return [
    { fullName: { contains: term } },
    { professionalName: { contains: term } },
    { jobTitle: { contains: term } },
    { bio: { contains: term } },
    { diploma: { contains: term } },
    { careerSummary: { contains: term } },
    { skills: { contains: term } },
    { workHistory: { contains: term } },
    { certifications: { contains: term } },
    { teachingAchievements: { contains: term } },
    { commune: { contains: term } },
    { quartier: { contains: term } },
    { subjects: { some: { subject: { name: { contains: term } } } } },
    { subjects: { some: { subject: { slug: { contains: term } } } } },
    { levels: { some: { level: { name: { contains: term } } } } },
    { levels: { some: { level: { slug: { contains: term } } } } },
    { zones: { some: { commune: { name: { contains: term } } } } },
    { zones: { some: { commune: { zone: { contains: term } } } } },
  ];
}
