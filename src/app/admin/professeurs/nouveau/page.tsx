import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { PageHeader } from "@/components/shared/page-header";
import { TeacherForm } from "@/components/admin/teacher-form";

export const dynamic = "force-dynamic";

export default async function NouveauProfesseurPage() {
  await requireAdmin("TEACHERS_MANAGE");
  const [subjects, levels, communes] = await db.$transaction([
    db.subject.findMany({ orderBy: { name: "asc" } }),
    db.level.findMany({ orderBy: { order: "asc" } }),
    db.commune.findMany({ orderBy: { name: "asc" } }),
  ]);

  return (
    <div className="space-y-5">
      <PageHeader title="Ajouter un professeur" description="Renseignez les informations du professeur. Tous les champs marqués * sont obligatoires." />
      <TeacherForm
        mode="create"
        subjects={subjects.map((s) => ({ id: s.id, name: s.name }))}
        levels={levels.map((l) => ({ id: l.id, name: l.name }))}
        communes={communes.map((c) => ({ id: c.id, name: c.name }))}
      />
    </div>
  );
}
