import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { TeacherForm } from "@/components/admin/teacher-form";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default async function ModifierProfesseurPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const teacher = await db.teacher.findUnique({
    where: { id },
    include: {
      subjects: { include: { subject: true } },
      levels: { include: { level: true } },
      zones: { include: { commune: true } },
    },
  });
  if (!teacher) notFound();
  const [subjects, levels, communes] = await Promise.all([
    db.subject.findMany({ orderBy: { name: "asc" } }),
    db.level.findMany({ orderBy: { order: "asc" } }),
    db.commune.findMany({ orderBy: { name: "asc" } }),
  ]);

  const { portalPasswordHash, ...teacherFormData } = teacher as any;
  const initial = {
    ...teacherFormData,
    hasPortalPassword: Boolean(portalPasswordHash),
    subjects: teacher.subjects.map((s) => ({ subjectId: s.subject.id, isPrimary: s.isPrimary })),
    levels: teacher.levels.map((l) => ({ levelId: l.level.id })),
    zones: teacher.zones.map((z) => ({ communeId: z.commune.id })),
    availability: teacher.availability ? JSON.parse(teacher.availability) : null,
  };

  return (
    <div className="space-y-5">
      <PageHeader title={`Modifier — ${teacher.professionalName || teacher.fullName}`} description="Mettez à jour les informations du professeur.">
        <Button asChild variant="outline">
          <Link href={`/admin/professeurs/${teacher.id}`}>Retour</Link>
        </Button>
      </PageHeader>
      <TeacherForm
        mode="edit"
        teacherId={teacher.id}
        initial={initial}
        subjects={subjects.map((s) => ({ id: s.id, name: s.name }))}
        levels={levels.map((l) => ({ id: l.id, name: l.name }))}
        communes={communes.map((c) => ({ id: c.id, name: c.name }))}
      />
    </div>
  );
}
