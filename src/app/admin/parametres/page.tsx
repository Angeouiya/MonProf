import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck } from "lucide-react";
import { ParametresClient } from "./client";
import { getNotificationProviderStatus } from "@/lib/notification-delivery";
import { platformSettingsForForm } from "@/lib/platform-settings";

export const dynamic = "force-dynamic";

export default async function AdminParametresPage() {
  await requireAdmin("SETTINGS_MANAGE");
  const rows = await db.setting.findMany();
  const [schemaStats, teacherCount, subjectCount, levelCount, communeCount, quarterCount, activeCommuneCount, userCount] = await db.$transaction([
    db.$queryRaw<Array<{ table_schema: string; tables: bigint | number }>>`
      SELECT table_schema, COUNT(*)::int AS tables
      FROM information_schema.tables
      WHERE table_type = 'BASE TABLE'
        AND table_schema IN ('public', 'competence')
      GROUP BY table_schema
      ORDER BY table_schema
    `,
    db.teacher.count(),
    db.subject.count(),
    db.level.count(),
    db.commune.count(),
    db.communeQuarter.count(),
    db.commune.count({ where: { isActive: true } }),
    db.user.count(),
  ]);
  const settings = platformSettingsForForm(rows);
  const configuredSettingKeys = new Set(rows.filter((row) => row.value.trim()).map((row) => row.key));
  const providerStatus = getNotificationProviderStatus({
    webPushConfigured: configuredSettingKeys.has("web_push_vapid_public_key")
      && configuredSettingKeys.has("web_push_vapid_private_key"),
  });
  const databaseStatus = {
    projectLabel: "Supabase Production",
    schema: "competence",
    tableCount: Number(schemaStats.find((item) => item.table_schema === "competence")?.tables ?? 0),
    publicTableCount: Number(schemaStats.find((item) => item.table_schema === "public")?.tables ?? 0),
    teacherCount,
    subjectCount,
    levelCount,
    communeCount,
    quarterCount,
    activeCommuneCount,
    userCount,
  };

  return (
    <div className="space-y-5">
      <PageHeader title="Paramètres plateforme" description="Configuration générale de Compétence" rootPage>
        <Badge variant="outline" className="border-violet-200 bg-violet-50 text-violet-700">
          <ShieldCheck className="mr-1.5 h-3.5 w-3.5" />
          Configuration sensible
        </Badge>
      </PageHeader>
      <ParametresClient initial={settings} providerStatus={providerStatus} databaseStatus={databaseStatus} />
    </div>
  );
}
