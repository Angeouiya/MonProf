export const OWNER_ADMIN_EMAIL = "angeouiya@gmail.com";

export function normalizeEmail(email?: string | null) {
  return (email ?? "").trim().toLowerCase();
}

export function isOwnerAdminEmail(email?: string | null) {
  return normalizeEmail(email) === OWNER_ADMIN_EMAIL;
}

export function isOwnerAdminAccount(input: { role?: string | null; email?: string | null }) {
  return input.role === "ADMIN" && isOwnerAdminEmail(input.email);
}

export function canUseAccountPasswordFlow(input: { role?: string | null; email?: string | null }) {
  return input.role === "CLIENT" || isOwnerAdminAccount(input);
}
