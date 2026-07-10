import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { PageHeader } from "@/components/shared/page-header";
import { AdminTeamClient } from "./team-client";
import { resolveAdminPermissions } from "@/lib/admin-permissions";

export const dynamic = "force-dynamic";

export default async function AdminTeamPage() {
  const current = await requireAdmin("TEAM_MANAGE");
  const admins = await db.user.findMany({
    where: { role: "ADMIN", adminDeletedAt: null },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      adminTeamRole: true,
      adminAccountStatus: true,
      adminPermissions: true,
      adminAccessEnabled: true,
      adminLastLoginAt: true,
      adminPasswordChangedAt: true,
      adminSuspensionReason: true,
      createdAt: true,
    },
    orderBy: [{ adminTeamRole: "asc" }, { createdAt: "asc" }],
  });

  return (
    <div className="space-y-5">
      <PageHeader
        title="Équipe administratrice"
        description="Rôles, droits d'accès, suspensions et traçabilité des comptes internes."
      />
      <AdminTeamClient
        currentAdminId={current.id}
        admins={admins.map((admin) => ({
          ...admin,
          adminTeamRole: admin.adminTeamRole || (admin.email.toLowerCase() === "angeouiya@gmail.com" ? "OWNER" : "SUPER_ADMIN"),
          adminAccountStatus: admin.adminAccountStatus || "ACTIVE",
          adminPermissions: resolveAdminPermissions(admin),
          usesRoleDefaults: !Array.isArray(admin.adminPermissions),
          adminLastLoginAt: admin.adminLastLoginAt?.toISOString() ?? null,
          adminPasswordChangedAt: admin.adminPasswordChangedAt?.toISOString() ?? null,
          createdAt: admin.createdAt.toISOString(),
        }))}
      />
    </div>
  );
}
