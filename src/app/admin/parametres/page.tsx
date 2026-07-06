import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck } from "lucide-react";
import { ParametresClient } from "./client";
import { PLATFORM_COMMISSION_PERCENT } from "@/lib/pricing";
import { getNotificationProviderStatus } from "@/lib/notification-delivery";
import { settingsForClient } from "@/lib/settings-security";

export const dynamic = "force-dynamic";

export default async function AdminParametresPage() {
  await requireAdmin();
  const rows = await db.setting.findMany();
  const defaults: Record<string, string> = {
    platform_name: "Compétence",
    default_commission: String(PLATFORM_COMMISSION_PERCENT),
    support_phone: "",
    support_email: "",
    notification_cron_enabled: "true",
    notification_delivery_enabled: "true",
    notification_from_name: "Compétence",
  };
  const settings = settingsForClient(rows, defaults);
  const providerStatus = getNotificationProviderStatus();

  return (
    <div className="space-y-5">
      <PageHeader title="Paramètres plateforme" description="Configuration générale de Compétence">
        <Badge variant="outline" className="border-violet-200 bg-violet-50 text-violet-700">
          <ShieldCheck className="mr-1.5 h-3.5 w-3.5" />
          Configuration sensible
        </Badge>
      </PageHeader>
      <ParametresClient initial={settings} providerStatus={providerStatus} />
    </div>
  );
}
