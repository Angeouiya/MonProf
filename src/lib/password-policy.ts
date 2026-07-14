import { isOwnerAdminAccount } from "@/lib/owner-account";

export const STANDARD_PASSWORD_MIN_LENGTH = 6;
export const ADMIN_PASSWORD_MIN_LENGTH = 10;

export function isAdminPasswordAccount(input: { role?: string | null; email?: string | null }) {
  return input.role === "ADMIN" || isOwnerAdminAccount(input);
}

export function validatePasswordForAccount(
  password: string,
  input: { role?: string | null; email?: string | null },
) {
  if (isAdminPasswordAccount(input)) {
    if (
      password.length < ADMIN_PASSWORD_MIN_LENGTH
      || !/[A-Za-z]/.test(password)
      || !/\d/.test(password)
    ) {
      return {
        ok: false as const,
        error: "Le mot de passe administrateur doit contenir au moins 10 caractères, une lettre et un chiffre.",
      };
    }
    return { ok: true as const };
  }

  if (password.length < STANDARD_PASSWORD_MIN_LENGTH) {
    return {
      ok: false as const,
      error: "Le nouveau mot de passe doit contenir au moins 6 caractères.",
    };
  }

  return { ok: true as const };
}

export function passwordHashRounds(input: { role?: string | null; email?: string | null }) {
  return isAdminPasswordAccount(input) ? 12 : 10;
}
