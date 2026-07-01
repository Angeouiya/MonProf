import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { PageHeader } from "@/components/shared/page-header";
import { ParametresClient } from "./client";

export const dynamic = "force-dynamic";

export default async function AdminParametresPage() {
  await requireAdmin();
  const rows = await db.setting.findMany();
  const settings: Record<string, string> = {
    platform_name: "MonProf CI",
    default_commission: "20",
    support_phone: "",
    support_email: "",
  };
  for (const r of rows) settings[r.key] = r.value;

  return (
    <div className="space-y-5">
      <PageHeader title="Paramètres plateforme" description="Configuration générale de MonProf CI" />
      <ParametresClient initial={settings} />
    </div>
  );
}
