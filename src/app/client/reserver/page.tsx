import { db } from "@/lib/db";
import { notFound } from "next/navigation";
import { ReserverForm } from "./reserver-form";
import { PageHeader } from "@/components/shared/page-header";

export const dynamic = "force-dynamic";

export default async function ReserverPage({
  searchParams,
}: {
  searchParams: Promise<{ teacherId?: string }>;
}) {
  const { teacherId } = await searchParams;
  if (!teacherId) notFound();

  const teacher = await db.teacher.findUnique({
    where: { id: teacherId, status: "ACTIVE" },
    include: {
      subjects: { include: { subject: true } },
      levels: { include: { level: true } },
    },
  });
  if (!teacher) notFound();

  const [subjects, levels, communes] = await Promise.all([
    db.subject.findMany({ orderBy: { name: "asc" } }),
    db.level.findMany({ orderBy: { order: "asc" } }),
    db.commune.findMany({ orderBy: { name: "asc" } }),
  ]);

  const teacherSubjects = teacher.subjects.map((s) => ({
    name: s.subject.name,
    isPrimary: s.isPrimary,
  }));
  const teacherLevels = teacher.levels.map((l) => l.level.name);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Réserver un cours"
        description={`Avec ${teacher.professionalName || teacher.fullName} — ${teacher.jobTitle}`}
      />
      <ReserverForm
        teacher={{
          id: teacher.id,
          fullName: teacher.fullName,
          professionalName: teacher.professionalName,
          photoUrl: teacher.photoUrl,
          jobTitle: teacher.jobTitle,
          commune: teacher.commune,
          rating: teacher.rating,
          ratingCount: teacher.ratingCount,
          pricePerSession: teacher.pricePerSession,
          pricePack4: teacher.pricePack4,
          pricePack8: teacher.pricePack8,
          commissionRate: teacher.commissionRate,
          offersHome: teacher.offersHome,
          offersOnline: teacher.offersOnline,
          subjects: teacherSubjects,
          levels: teacherLevels,
        }}
        subjects={subjects.map((s) => ({ id: s.id, name: s.name, slug: s.slug }))}
        levels={levels.map((l) => ({ id: l.id, name: l.name, slug: l.slug }))}
        communes={communes.map((c) => ({ id: c.id, name: c.name }))}
      />
    </div>
  );
}
