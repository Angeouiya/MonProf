import { isOwnerAdminEmail } from "@/lib/owner-account";

export const ADMIN_PERMISSIONS = [
  "DASHBOARD_VIEW",
  "OPERATIONS_MANAGE",
  "TEACHERS_VIEW",
  "TEACHERS_MANAGE",
  "CLIENTS_VIEW",
  "CLIENTS_MANAGE",
  "BOOKINGS_VIEW",
  "BOOKINGS_MANAGE",
  "FINANCE_VIEW",
  "FINANCE_MANAGE",
  "DISPUTES_MANAGE",
  "REVIEWS_MANAGE",
  "COMMUNICATIONS_VIEW",
  "COMMUNICATIONS_SEND",
  "CATALOG_MANAGE",
  "SETTINGS_MANAGE",
  "TEAM_MANAGE",
  "AUDIT_VIEW",
] as const;

export type AdminPermission = (typeof ADMIN_PERMISSIONS)[number];

export const ADMIN_TEAM_ROLES = [
  "OWNER",
  "SUPER_ADMIN",
  "OPERATIONS",
  "FINANCE",
  "SUPPORT",
  "QUALITY",
  "CONTENT",
  "OBSERVER",
] as const;

export type AdminTeamRoleValue = (typeof ADMIN_TEAM_ROLES)[number];

const ALL = [...ADMIN_PERMISSIONS];

export const ADMIN_ROLE_PERMISSIONS: Record<AdminTeamRoleValue, readonly AdminPermission[]> = {
  OWNER: ALL,
  SUPER_ADMIN: ALL.filter((permission) => permission !== "TEAM_MANAGE"),
  OPERATIONS: [
    "DASHBOARD_VIEW", "OPERATIONS_MANAGE", "TEACHERS_VIEW", "TEACHERS_MANAGE",
    "CLIENTS_VIEW", "CLIENTS_MANAGE", "BOOKINGS_VIEW", "BOOKINGS_MANAGE",
    "FINANCE_VIEW", "DISPUTES_MANAGE", "REVIEWS_MANAGE", "COMMUNICATIONS_VIEW",
    "COMMUNICATIONS_SEND", "AUDIT_VIEW",
  ],
  FINANCE: [
    "DASHBOARD_VIEW", "TEACHERS_VIEW", "CLIENTS_VIEW", "BOOKINGS_VIEW",
    "FINANCE_VIEW", "FINANCE_MANAGE", "DISPUTES_MANAGE", "COMMUNICATIONS_VIEW",
    "AUDIT_VIEW",
  ],
  SUPPORT: [
    "DASHBOARD_VIEW", "OPERATIONS_MANAGE", "TEACHERS_VIEW", "CLIENTS_VIEW",
    "CLIENTS_MANAGE", "BOOKINGS_VIEW", "BOOKINGS_MANAGE", "DISPUTES_MANAGE",
    "COMMUNICATIONS_VIEW", "COMMUNICATIONS_SEND",
  ],
  QUALITY: [
    "DASHBOARD_VIEW", "TEACHERS_VIEW", "TEACHERS_MANAGE", "CLIENTS_VIEW",
    "BOOKINGS_VIEW", "DISPUTES_MANAGE", "REVIEWS_MANAGE", "COMMUNICATIONS_VIEW",
    "COMMUNICATIONS_SEND", "AUDIT_VIEW",
  ],
  CONTENT: [
    "DASHBOARD_VIEW", "TEACHERS_VIEW", "TEACHERS_MANAGE", "CLIENTS_VIEW",
    "COMMUNICATIONS_VIEW", "COMMUNICATIONS_SEND", "CATALOG_MANAGE",
  ],
  OBSERVER: [
    "DASHBOARD_VIEW", "TEACHERS_VIEW", "CLIENTS_VIEW", "BOOKINGS_VIEW",
    "FINANCE_VIEW", "COMMUNICATIONS_VIEW", "AUDIT_VIEW",
  ],
};

export const ADMIN_ROLE_LABELS: Record<AdminTeamRoleValue, string> = {
  OWNER: "Propriétaire",
  SUPER_ADMIN: "Super administrateur",
  OPERATIONS: "Responsable opérations",
  FINANCE: "Responsable finance",
  SUPPORT: "Service client",
  QUALITY: "Responsable qualité",
  CONTENT: "Catalogue & contenu",
  OBSERVER: "Lecture seule",
};

export const ADMIN_PERMISSION_LABELS: Record<AdminPermission, string> = {
  DASHBOARD_VIEW: "Voir le tableau de bord",
  OPERATIONS_MANAGE: "Gérer le centre opérationnel",
  TEACHERS_VIEW: "Voir les professeurs",
  TEACHERS_MANAGE: "Créer et modifier les professeurs",
  CLIENTS_VIEW: "Voir les clients",
  CLIENTS_MANAGE: "Gérer les clients",
  BOOKINGS_VIEW: "Voir les réservations",
  BOOKINGS_MANAGE: "Gérer les réservations",
  FINANCE_VIEW: "Voir la comptabilité",
  FINANCE_MANAGE: "Valider paiements et remboursements",
  DISPUTES_MANAGE: "Gérer les litiges",
  REVIEWS_MANAGE: "Gérer les avis et notes",
  COMMUNICATIONS_VIEW: "Voir les communications",
  COMMUNICATIONS_SEND: "Envoyer des communications",
  CATALOG_MANAGE: "Gérer matières, niveaux et communes",
  SETTINGS_MANAGE: "Modifier les paramètres plateforme",
  TEAM_MANAGE: "Gérer l'équipe administratrice",
  AUDIT_VIEW: "Consulter le journal d'audit",
};

function isPermission(value: unknown): value is AdminPermission {
  return typeof value === "string" && (ADMIN_PERMISSIONS as readonly string[]).includes(value);
}

export function normalizeAdminRole(value: unknown): AdminTeamRoleValue {
  return typeof value === "string" && (ADMIN_TEAM_ROLES as readonly string[]).includes(value)
    ? value as AdminTeamRoleValue
    : "SUPER_ADMIN";
}

export function resolveAdminPermissions(input: {
  email?: string | null;
  adminTeamRole?: string | null;
  adminPermissions?: unknown;
}) {
  if (isOwnerAdminEmail(input.email)) return [...ADMIN_ROLE_PERMISSIONS.OWNER];
  const role = normalizeAdminRole(input.adminTeamRole);
  if (Array.isArray(input.adminPermissions)) {
    return Array.from(new Set(input.adminPermissions.filter(isPermission)));
  }
  return [...ADMIN_ROLE_PERMISSIONS[role]];
}

export function hasAdminPermission(
  permissions: readonly string[] | null | undefined,
  permission: AdminPermission,
) {
  return Boolean(permissions?.includes(permission));
}

export function isActiveAdminAccount(input: {
  role?: string | null;
  adminAccessEnabled?: boolean | null;
  adminAccountStatus?: string | null;
  adminDeletedAt?: Date | string | null;
}) {
  return input.role === "ADMIN"
    && input.adminAccessEnabled !== false
    && input.adminAccountStatus !== "SUSPENDED"
    && input.adminAccountStatus !== "BLOCKED"
    && !input.adminDeletedAt;
}
