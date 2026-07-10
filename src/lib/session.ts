import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { cache } from "react";
import { db } from "@/lib/db";
import {
  type AdminPermission,
  hasAdminPermission,
  isActiveAdminAccount,
  normalizeAdminRole,
  resolveAdminPermissions,
} from "@/lib/admin-permissions";

export type SessionUser = {
  id: string;
  email?: string | null;
  name: string;
  role: "CLIENT" | "ADMIN" | "TEACHER";
  teacherId?: string | null;
  phone?: string | null;
  adminTeamRole?: string | null;
  adminPermissions?: AdminPermission[];
};

export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const session = await getServerSession(authOptions);
  if (!session?.user) return null;
  return {
    id: (session.user as any).id,
    email: session.user.email,
    name: session.user.name!,
    role: (session.user as any).role,
    teacherId: (session.user as any).teacherId ?? null,
    phone: (session.user as any).phone ?? null,
  };
});

export async function requireClient() {
  const u = await getSessionUser();
  if (!u) redirect("/connexion");
  if (u.role === "TEACHER") redirect("/professeur");
  if (u.role !== "CLIENT") redirect("/admin");
  return u;
}

const getActiveAdminAccount = cache(async (id: string) => {
  return db.user.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      role: true,
      adminTeamRole: true,
      adminAccountStatus: true,
      adminPermissions: true,
      adminAccessEnabled: true,
      adminDeletedAt: true,
    },
  });
});

export async function requireAdmin(permission: AdminPermission = "DASHBOARD_VIEW") {
  const u = await getSessionUser();
  if (!u) redirect("/admin/connexion");
  if (u.role === "TEACHER") redirect("/professeur");
  if (u.role !== "ADMIN") redirect("/");
  const account = await getActiveAdminAccount(u.id);
  if (!account || !isActiveAdminAccount(account)) redirect("/admin/connexion?error=access");
  const permissions = resolveAdminPermissions(account);
  if (!hasAdminPermission(permissions, permission)) redirect("/admin/acces-refuse");
  return {
    ...u,
    name: account.name,
    email: account.email,
    phone: account.phone,
    adminTeamRole: normalizeAdminRole(account.adminTeamRole),
    adminPermissions: permissions,
  };
}

/** Récupère le client connecté ou null (pour les pages publiques qui s'adaptent) */
export async function optionalClient() {
  return await getSessionUser();
}
