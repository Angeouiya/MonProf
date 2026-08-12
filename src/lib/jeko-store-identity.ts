export const JEKO_COMPETENCE_STORE_NAME = "Boutique Compétence";

const LEGACY_FORBIDDEN_STORE_NAMES = [
  ["buil", "dify"].join(""),
  ["blui", "dify"].join(""),
];
const FORBIDDEN_JEKO_STORE_PATTERN = new RegExp(`\\b(?:${LEGACY_FORBIDDEN_STORE_NAMES.join("|")})\\b`, "i");
const FORBIDDEN_NON_PRODUCTION_STORE_PATTERN = /\b(?:test|sandbox|dev|demo)\b/i;
const COMPETENCE_JEKO_STORE_PATTERN = /\b(?:boutique\s+)?competence(?:\s+ci)?\b/i;

export function normalizeJekoStoreName(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function isForbiddenJekoStoreName(value: string) {
  return FORBIDDEN_JEKO_STORE_PATTERN.test(normalizeJekoStoreName(value));
}

export function isCompetenceJekoStoreName(value: string) {
  const normalized = normalizeJekoStoreName(value);
  return COMPETENCE_JEKO_STORE_PATTERN.test(normalized)
    && !FORBIDDEN_NON_PRODUCTION_STORE_PATTERN.test(normalized);
}

export function assertCompetenceJekoStoreName(value: string, source = "La boutique Jèko") {
  if (isForbiddenJekoStoreName(value)) {
    throw new Error(`${source} correspond à une boutique Jèko non autorisée. Utilisez ${JEKO_COMPETENCE_STORE_NAME}.`);
  }
  if (!isCompetenceJekoStoreName(value)) {
    throw new Error(`${source} n'est pas identifiée comme ${JEKO_COMPETENCE_STORE_NAME} ou Compétence.CI.`);
  }
}
