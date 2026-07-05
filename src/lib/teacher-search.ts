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
  const textMatch = (value: string) => ({ contains: value, mode: "insensitive" as const });

  return [
    { fullName: textMatch(term) },
    { professionalName: textMatch(term) },
    { jobTitle: textMatch(term) },
    { bio: textMatch(term) },
    { diploma: textMatch(term) },
    { careerSummary: textMatch(term) },
    { skills: textMatch(term) },
    { workHistory: textMatch(term) },
    { certifications: textMatch(term) },
    { teachingAchievements: textMatch(term) },
    { commune: textMatch(term) },
    { quartier: textMatch(term) },
    { subjects: { some: { subject: { name: textMatch(term) } } } },
    { subjects: { some: { subject: { slug: textMatch(term) } } } },
    { levels: { some: { level: { name: textMatch(term) } } } },
    { levels: { some: { level: { slug: textMatch(term) } } } },
    { zones: { some: { commune: { name: textMatch(term) } } } },
    { zones: { some: { commune: { zone: textMatch(term) } } } },
  ];
}
