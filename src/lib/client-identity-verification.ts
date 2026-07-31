export const CLIENT_IDENTITY_VERIFICATION_METHOD_LABELS = {
  REGISTERED_PHONE_CALLBACK: "Rappel au numéro enregistré",
  RECENT_BOOKING_DETAILS: "Informations de réservation confirmées",
  IDENTITY_DOCUMENT: "Pièce d'identité contrôlée",
  IN_PERSON: "Vérification en personne",
} as const;

export type ClientIdentityVerificationMethod = keyof typeof CLIENT_IDENTITY_VERIFICATION_METHOD_LABELS;

export const CLIENT_IDENTITY_VERIFICATION_METHOD_OPTIONS = Object.entries(
  CLIENT_IDENTITY_VERIFICATION_METHOD_LABELS,
).map(([value, label]) => ({
  value: value as ClientIdentityVerificationMethod,
  label,
}));

export function isClientIdentityVerificationMethod(
  value: string,
): value is ClientIdentityVerificationMethod {
  return Object.prototype.hasOwnProperty.call(CLIENT_IDENTITY_VERIFICATION_METHOD_LABELS, value);
}

export const IDENTITY_VERIFICATION_REFERENCE_MIN_LENGTH = 4;
export const IDENTITY_VERIFICATION_REFERENCE_MAX_LENGTH = 40;

const IDENTITY_VERIFICATION_REFERENCE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._#/-]*$/;
const SENSITIVE_DIGIT_SEQUENCE_PATTERN = /\d{8,}/;
const SEGMENTED_PHONE_PATTERN = /^(?:\+?\d{1,3}[-./])?(?:\d{2}[-./]){3,5}\d{2}$/;
const SENSITIVE_KEYWORD_PATTERN = /password|motdepasse|secret|otp|pin|code/i;

export function normalizeIdentityVerificationReference(value?: string | null) {
  return (value ?? "").trim();
}

/**
 * Une preuve d'assistance ne conserve qu'une référence interne (ticket,
 * réservation ou dossier). Les textes libres, emails, téléphones et longues
 * suites numériques sont refusés pour éviter de journaliser une donnée sensible.
 */
export function isSafeIdentityVerificationReference(value: string) {
  const normalized = normalizeIdentityVerificationReference(value);
  return normalized.length >= IDENTITY_VERIFICATION_REFERENCE_MIN_LENGTH
    && normalized.length <= IDENTITY_VERIFICATION_REFERENCE_MAX_LENGTH
    && IDENTITY_VERIFICATION_REFERENCE_PATTERN.test(normalized)
    && !SENSITIVE_DIGIT_SEQUENCE_PATTERN.test(normalized)
    && !SEGMENTED_PHONE_PATTERN.test(normalized)
    && !SENSITIVE_KEYWORD_PATTERN.test(normalized);
}
