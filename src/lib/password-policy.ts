export const PASSWORD_MIN_LENGTH = 10;
export const STANDARD_PASSWORD_MIN_LENGTH = PASSWORD_MIN_LENGTH;
export const ADMIN_PASSWORD_MIN_LENGTH = 10;
export const TEACHER_PASSWORD_MIN_LENGTH = PASSWORD_MIN_LENGTH;

export function isAdminPasswordAccount(input: { role?: string | null; email?: string | null }) {
  return input.role === "ADMIN";
}

export function validatePasswordForAccount(
  password: string,
  input: { role?: string | null; email?: string | null },
) {
  if (!isPasswordCompliant(password)) {
    return {
      ok: false as const,
      error: `Le mot de passe doit contenir au moins ${PASSWORD_MIN_LENGTH} caractères, une lettre et un chiffre.`,
    };
  }

  return { ok: true as const };
}

export function passwordHashRounds(input: { role?: string | null; email?: string | null }) {
  return isAdminPasswordAccount(input) ? 12 : 10;
}

export function isPasswordCompliant(password: string) {
  return password.length >= PASSWORD_MIN_LENGTH
    && /[A-Za-z]/.test(password)
    && /\d/.test(password);
}
