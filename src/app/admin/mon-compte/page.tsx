import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AdminPasswordForm } from "./password-form";
import { ADMIN_ROLE_LABELS, normalizeAdminRole } from "@/lib/admin-permissions";
import { formatDateTime } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function AdminAccountPage() {
  const admin = await requireAdmin();
  const account = await db.user.findUniqueOrThrow({
    where: { id: admin.id },
    select: { name: true, email: true, phone: true, adminTeamRole: true, adminLastLoginAt: true, adminPasswordChangedAt: true },
  });
  const role = normalizeAdminRole(account.adminTeamRole);

  return (
    <div className="space-y-5">
      <PageHeader title="Mon compte administrateur" description="Espace privé pour contrôler votre identité et votre mot de passe." />
      <Card className="border-[#E2E8F0] bg-white">
        <CardContent className="grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-4">
          <Info label="Nom" value={account.name} />
          <Info label="Email" value={account.email} />
          <Info label="Téléphone" value={account.phone || "Non renseigné"} />
          <div><p className="text-xs font-semibold uppercase text-[#64748B]">Rôle</p><Badge variant="outline" className="mt-2 border-[#CBD5E1] bg-white text-[#111B4D]">{ADMIN_ROLE_LABELS[role]}</Badge></div>
          <Info label="Dernière connexion" value={account.adminLastLoginAt ? formatDateTime(account.adminLastLoginAt) : "Non renseignée"} />
          <Info label="Mot de passe modifié" value={account.adminPasswordChangedAt ? formatDateTime(account.adminPasswordChangedAt) : "Non renseigné"} />
        </CardContent>
      </Card>
      <AdminPasswordForm />
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return <div><p className="text-xs font-semibold uppercase text-[#64748B]">{label}</p><p className="mt-2 text-sm font-semibold text-[#111827]">{value}</p></div>;
}
