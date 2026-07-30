const MIN_E164_DIGITS = 8;
const MAX_E164_DIGITS = 15;

/**
 * Canonicalise un numéro utilisé comme identifiant de compte.
 * Les numéros ivoiriens locaux à 10 chiffres reçoivent automatiquement +225;
 * les formats internationaux +... et 00... convergent vers la même valeur.
 */
export function normalizeAccountPhone(value?: string | null) {
  let digits = (value ?? "").replace(/\D/g, "");
  if (!digits) return null;

  if (digits.startsWith("00")) digits = digits.slice(2);
  if (!digits) return null;

  if (!digits.startsWith("225") && digits.length === 10) {
    digits = `225${digits}`;
  }

  if (
    digits.length < MIN_E164_DIGITS
    || digits.length > MAX_E164_DIGITS
    || digits.startsWith("0")
    || /^0+$/.test(digits)
  ) {
    return null;
  }

  return `+${digits}`;
}

export function normalizeAccountEmail(value?: string | null) {
  const email = (value ?? "").trim().toLowerCase();
  return email || null;
}

export function isEmailAccountIdentifier(value?: string | null) {
  return Boolean(normalizeAccountEmail(value)?.includes("@"));
}
