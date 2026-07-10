import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { PageHeader } from "@/components/shared/page-header";
import { TeacherForm } from "@/components/admin/teacher-form";
import { getPlatformRuntimeSettings } from "@/lib/platform-settings";

export const dynamic = "force-dynamic";

export default async function NouveauProfesseurPage() {
  await requireAdmin("TEACHERS_MANAGE");
  const [[subjects, levels, communes], settings] = await Promise.all([db.$transaction([
    db.subject.findMany({ orderBy: { name: "asc" } }),
    db.level.findMany({ orderBy: { order: "asc" } }),
    db.commune.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, include: { quarters: { where: { isActive: true }, orderBy: { name: "asc" } } } }),
  ]), getPlatformRuntimeSettings()]);

  return (
    <div className="space-y-5">
      <PageHeader title="Ajouter un professeur" description="Renseignez les informations du professeur. Tous les champs marqués * sont obligatoires." />
      <TeacherForm
        mode="create"
        subjects={subjects.map((s) => ({ id: s.id, name: s.name }))}
        levels={levels.map((l) => ({ id: l.id, name: l.name }))}
        communes={communes.map((c) => ({ id: c.id, name: c.name, quarters: c.quarters.map((q) => ({ id: q.id, name: q.name })) }))}
        defaultCommissionPercent={settings.commissionPercent}
      />
    </div>
  );
}
