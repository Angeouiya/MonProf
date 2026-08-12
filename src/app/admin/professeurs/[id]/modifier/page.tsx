import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { TeacherForm } from "@/components/admin/teacher-form";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { getPlatformRuntimeSettings } from "@/lib/platform-settings";
import Image from "next/image";
import { revalidatePath } from "next/cache";

export const dynamic = "force-dynamic";

async function moderateTeacherCover(formData: FormData) {
  "use server";
  await requireAdmin("TEACHERS_MANAGE");
  const teacherId = String(formData.get("teacherId") ?? "");
  const decision = String(formData.get("decision") ?? "");
  const teacher = await db.teacher.findUnique({
    where: { id: teacherId },
    select: { pendingCoverUrl: true },
  });
  if (!teacher?.pendingCoverUrl) return;

  const approved = decision === "approve";
  await db.$transaction([
    db.teacher.update({
      where: { id: teacherId },
      data: approved
        ? { coverUrl: teacher.pendingCoverUrl, pendingCoverUrl: null }
        : { pendingCoverUrl: null },
    }),
    db.teacherNotification.create({
      data: {
        teacherId,
        title: approved ? "Couverture validée" : "Couverture refusée",
        message: approved
          ? "Votre couverture personnalisée a été contrôlée et publiée."
          : "Votre couverture ne respecte pas les règles visuelles. Choisissez une scène d'enseignement sans personne.",
        channel: "INTERNAL",
        sent: true,
        status: "SENT",
      },
    }),
  ]);
  revalidatePath(`/admin/professeurs/${teacherId}/modifier`);
  revalidatePath(`/professeurs/${teacherId}`);
}

export default async function ModifierProfesseurPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin("TEACHERS_MANAGE");
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
  const [[subjects, levels, communes], settings] = await Promise.all([db.$transaction([
    db.subject.findMany({ orderBy: { name: "asc" } }),
    db.level.findMany({ orderBy: { order: "asc" } }),
    db.commune.findMany({ orderBy: { name: "asc" }, include: { quarters: { where: { isActive: true }, orderBy: { name: "asc" } } } }),
  ]), getPlatformRuntimeSettings()]);

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
      {teacher.pendingCoverUrl ? (
        <section className="overflow-hidden rounded-xl border border-amber-200 bg-amber-50">
          <div className="relative aspect-[3/1] w-full overflow-hidden bg-[#111B4D]">
            <Image src={teacher.pendingCoverUrl} alt="Couverture personnalisée en attente" fill sizes="100vw" className="object-contain" />
          </div>
          <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-semibold text-amber-950">Couverture à contrôler</p>
              <p className="mt-1 text-sm font-medium text-amber-800">Validez uniquement une scène unique liée à l'enseignement, sans humain, sans collage et sans texte trompeur.</p>
            </div>
            <div className="flex gap-2">
              <form action={moderateTeacherCover}>
                <input type="hidden" name="teacherId" value={teacher.id} />
                <input type="hidden" name="decision" value="reject" />
                <Button type="submit" variant="outline">Refuser</Button>
              </form>
              <form action={moderateTeacherCover}>
                <input type="hidden" name="teacherId" value={teacher.id} />
                <input type="hidden" name="decision" value="approve" />
                <Button type="submit">Valider et publier</Button>
              </form>
            </div>
          </div>
        </section>
      ) : null}
      <TeacherForm
        mode="edit"
        teacherId={teacher.id}
        initial={initial}
        subjects={subjects.map((s) => ({ id: s.id, name: s.name }))}
        levels={levels.map((l) => ({ id: l.id, name: l.name, order: l.order }))}
        communes={communes.map((c) => ({ id: c.id, name: c.name, quarters: c.quarters.map((q) => ({ id: q.id, name: q.name })) }))}
        defaultCommissionPercent={settings.commissionPercent}
      />
    </div>
  );
}
