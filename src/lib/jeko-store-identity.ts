export const JEKO_COMPETENCE_STORE_NAME = "Boutique Compétence";

const FORBIDDEN_JEKO_STORE_PATTERN = /\b(?:buildify|bluidify)\b/i;

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
  return normalizeJekoStoreName(value).includes("competence");
}

export function assertCompetenceJekoStoreName(value: string, source = "La boutique Jèko") {
  if (isForbiddenJekoStoreName(value)) {
    throw new Error(`${source} correspond encore à Buildify/Bluidify. Utilisez ${JEKO_COMPETENCE_STORE_NAME}.`);
  }
  if (!isCompetenceJekoStoreName(value)) {
    throw new Error(`${source} n'est pas identifiée comme ${JEKO_COMPETENCE_STORE_NAME}.`);
  }
}
