export function normalizeEmail(email?: string | null) {
  return (email ?? "").trim().toLowerCase();
}

export function isOwnerAdminAccount(input: { role?: string | null; adminTeamRole?: string | null }) {
  return input.role === "ADMIN" && input.adminTeamRole === "OWNER";
}

export function canUseAccountPasswordFlow(input: {
  role?: string | null;
  adminAccessEnabled?: boolean | null;
  adminAccountStatus?: string | null;
  adminDeletedAt?: Date | string | null;
}) {
  if (input.role === "CLIENT") return true;
  return input.role === "ADMIN"
    && input.adminAccessEnabled !== false
    && input.adminAccountStatus !== "SUSPENDED"
    && input.adminAccountStatus !== "BLOCKED"
    && !input.adminDeletedAt;
}
