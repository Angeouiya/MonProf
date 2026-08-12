export const PASSWORD_MIN_LENGTH = 10;
export const STANDARD_PASSWORD_MIN_LENGTH = PASSWORD_MIN_LENGTH;
export const CLIENT_PASSWORD_MIN_LENGTH = 6;
export const ADMIN_PASSWORD_MIN_LENGTH = 10;
export const TEACHER_PASSWORD_MIN_LENGTH = PASSWORD_MIN_LENGTH;

export function isAdminPasswordAccount(input: { role?: string | null; email?: string | null }) {
  return input.role === "ADMIN";
}

export function validatePasswordForAccount(
  password: string,
  input: { role?: string | null; email?: string | null },
) {
  const minLength = passwordMinLengthForAccount(input);

  if (!isPasswordCompliant(password, minLength)) {
    return {
      ok: false as const,
      error: `Le mot de passe doit contenir au moins ${minLength} caractères, une lettre et un chiffre.`,
    };
  }

  return { ok: true as const };
}

export function passwordHashRounds(input: { role?: string | null; email?: string | null }) {
  return isAdminPasswordAccount(input) ? 12 : 10;
}

export function passwordMinLengthForAccount(input: { role?: string | null; email?: string | null }) {
  return input.role === "CLIENT" ? CLIENT_PASSWORD_MIN_LENGTH : PASSWORD_MIN_LENGTH;
}

export function isClientPasswordCompliant(password: string) {
  return isPasswordCompliant(password, CLIENT_PASSWORD_MIN_LENGTH);
}

export function isPasswordCompliant(password: string, minLength = PASSWORD_MIN_LENGTH) {
  return password.length >= minLength
    && /[A-Za-z]/.test(password)
    && /\d/.test(password);
}
