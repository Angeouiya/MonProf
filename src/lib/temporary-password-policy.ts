// Tout mot de passe temporaire attribué par le service client reste utilisable
// pendant 24 heures au maximum. Après sa première connexion réussie, son
// horodatage est consommé atomiquement et le secret ne peut plus être réutilisé.
export const TEMPORARY_PASSWORD_TTL_HOURS = 24;

const TEMPORARY_PASSWORD_TTL_MS = TEMPORARY_PASSWORD_TTL_HOURS * 60 * 60 * 1000;

export function temporaryPasswordExpiresAt(issuedAt: Date) {
  return new Date(issuedAt.getTime() + TEMPORARY_PASSWORD_TTL_MS);
}

export function isTemporaryPasswordUsable(
  issuedAt: Date | null | undefined,
  now = new Date(),
) {
  if (!issuedAt || !Number.isFinite(issuedAt.getTime())) return false;
  return temporaryPasswordExpiresAt(issuedAt).getTime() > now.getTime();
}
