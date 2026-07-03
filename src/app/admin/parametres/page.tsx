import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck } from "lucide-react";
import { ParametresClient } from "./client";
import { PLATFORM_COMMISSION_PERCENT } from "@/lib/pricing";

export const dynamic = "force-dynamic";

export default async function AdminParametresPage() {
  await requireAdmin();
  const rows = await db.setting.findMany();
  const settings: Record<string, string> = {
    platform_name: "MonProf CI",
    default_commission: String(PLATFORM_COMMISSION_PERCENT),
    support_phone: "",
    support_email: "",
  };
  for (const r of rows) settings[r.key] = r.value;

  return (
    <div className="space-y-5">
      <PageHeader title="Paramètres plateforme" description="Configuration générale de MonProf CI">
        <Badge variant="outline" className="border-violet-200 bg-violet-50 text-violet-700">
          <ShieldCheck className="mr-1.5 h-3.5 w-3.5" />
          Configuration sensible
        </Badge>
      </PageHeader>
      <ParametresClient initial={settings} />
    </div>
  );
}
