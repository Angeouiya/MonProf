import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  type AdminPermission,
  hasAdminPermission,
  isActiveAdminAccount,
  normalizeAdminRole,
  resolveAdminPermissions,
} from "@/lib/admin-permissions";

export async function requireAdminApi(permission: AdminPermission = "DASHBOARD_VIEW") {
  const session = await getServerSession(authOptions);
  if (!session?.user || (session.user as any).role !== "ADMIN") return null;

  const userId = (session.user as any).id as string;
  const account = await db.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      adminTeamRole: true,
      adminAccountStatus: true,
      adminPermissions: true,
      adminAccessEnabled: true,
      adminDeletedAt: true,
    },
  });
  if (!account || !isActiveAdminAccount(account)) return null;

  const permissions = resolveAdminPermissions(account);
  if (!hasAdminPermission(permissions, permission)) return null;

  return {
    id: account.id,
    name: account.name || "Admin",
    email: account.email,
    teamRole: normalizeAdminRole(account.adminTeamRole),
    permissions,
  };
}
