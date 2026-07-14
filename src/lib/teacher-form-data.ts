const NULLABLE_TEACHER_FORM_FIELDS = [
  "professionalName",
  "photoUrl",
  "portalPhone",
  "email",
  "commune",
  "quartier",
  "addressHint",
  "diploma",
  "cvUrl",
  "careerSummary",
  "skills",
  "workHistory",
  "certifications",
  "teachingAchievements",
  "adminRatingNote",
  "internalNote",
] as const;

export function normalizeTeacherFormInitial<T extends Record<string, unknown>>(initial: T) {
  const normalized: Record<string, unknown> = { ...initial };

  for (const field of NULLABLE_TEACHER_FORM_FIELDS) {
    if (normalized[field] === null || normalized[field] === undefined) {
      normalized[field] = "";
    }
  }

  return normalized as T;
}
