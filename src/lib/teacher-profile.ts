type ParseTeacherProfileListOptions = {
  splitCommas?: boolean;
};

const EMPTY_PROFILE_VALUES = new Set([
  "-",
  "—",
  "aucun",
  "aucune",
  "n a",
  "na",
  "non applicable",
  "non renseigne",
  "non renseignee",
]);

export type TeacherCvPresentation = {
  summary: string | null;
  skills: string[];
  workHistory: string[];
  certifications: string[];
  achievements: string[];
};

export function parseTeacherProfileList(
  value?: string | null,
  options: ParseTeacherProfileListOptions = {},
): string[] {
  if (!value) return [];
  const raw = value.trim();
  if (!raw) return [];

  let sourceItems: string[] = [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      sourceItems = parsed.map(profileItemToText);
    }
  } catch {
    // Plain multiline text is the default input format in the admin form.
  }

  if (sourceItems.length === 0) {
    sourceItems = raw.split(/\r?\n|;|\s+[•·]\s+/);
  }

  if (options.splitCommas && sourceItems.length === 1 && !/[.!?]\s/.test(sourceItems[0])) {
    sourceItems = sourceItems[0].split(/,(?=\s*[^\d])/);
  }

  const result: string[] = [];
  const seen: string[] = [];
  for (const item of sourceItems) {
    const cleaned = cleanProfileItem(item);
    const key = teacherProfileSemanticKey(cleaned);
    if (!key || EMPTY_PROFILE_VALUES.has(key)) continue;
    if (seen.some((existing) => semanticallyEquivalent(existing, key))) continue;
    seen.push(key);
    result.push(cleaned);
  }
  return result;
}

export function previewTeacherProfileList(value?: string | null, limit = 3) {
  return parseTeacherProfileList(value).slice(0, limit);
}

export function normalizeTeacherProfileText(value: unknown) {
  if (typeof value !== "string") return null;
  const cleaned = value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .join("\n");
  return cleaned || null;
}

export function buildTeacherCvPresentation({
  careerSummary,
  skills,
  workHistory,
  certifications,
  teachingAchievements,
  diploma,
}: {
  careerSummary?: string | null;
  skills?: string | null;
  workHistory?: string | null;
  certifications?: string | null;
  teachingAchievements?: string | null;
  diploma?: string | null;
}): TeacherCvPresentation {
  const seen = diploma ? [teacherProfileSemanticKey(diploma)] : [];
  const uniqueSection = (items: string[]) => items.filter((item) => {
    const key = teacherProfileSemanticKey(item);
    if (!key || seen.some((existing) => semanticallyEquivalent(existing, key))) return false;
    seen.push(key);
    return true;
  });

  return {
    summary: normalizeTeacherProfileText(careerSummary),
    skills: uniqueSection(parseTeacherProfileList(skills, { splitCommas: true })),
    workHistory: uniqueSection(parseTeacherProfileList(workHistory)),
    certifications: uniqueSection(parseTeacherProfileList(certifications)),
    achievements: uniqueSection(parseTeacherProfileList(teachingAchievements)),
  };
}

export function hasTeacherCvContent({
  careerSummary,
  skills,
  workHistory,
  certifications,
  teachingAchievements,
  diploma,
  experienceYears,
  learnersCoached,
}: {
  careerSummary?: string | null;
  skills?: string | null;
  workHistory?: string | null;
  certifications?: string | null;
  teachingAchievements?: string | null;
  diploma?: string | null;
  experienceYears?: number | null;
  learnersCoached?: number | null;
}) {
  const presentation = buildTeacherCvPresentation({
    careerSummary,
    skills,
    workHistory,
    certifications,
    teachingAchievements,
    diploma,
  });
  return Boolean(
    presentation.summary
    || presentation.skills.length
    || presentation.workHistory.length
    || presentation.certifications.length
    || presentation.achievements.length
    || diploma?.trim()
    || (experienceYears && experienceYears > 0)
    || (learnersCoached && learnersCoached > 0),
  );
}

function profileItemToText(item: unknown) {
  if (typeof item === "string" || typeof item === "number") return String(item);
  if (!item || typeof item !== "object") return "";
  return Object.values(item)
    .filter((value) => typeof value === "string" || typeof value === "number")
    .map(String)
    .join(" — ");
}

function cleanProfileItem(value: string) {
  return value
    .replace(/^\s*(?:[-–—•·▪◦]|\d+[.)])\s*/, "")
    .replace(/\s+/g, " ")
    .trim();
}

function teacherProfileSemanticKey(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function semanticallyEquivalent(left: string, right: string) {
  if (left === right) return true;
  const shortest = Math.min(left.length, right.length);
  const longest = Math.max(left.length, right.length);
  return shortest >= 18
    && shortest / longest >= 0.82
    && (left.includes(right) || right.includes(left));
}
