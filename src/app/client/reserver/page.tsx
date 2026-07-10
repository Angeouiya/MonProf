import { db } from "@/lib/db";
import { getCachedTeacherSearchCatalog } from "@/lib/catalog-cache";
import { notFound } from "next/navigation";
import { ReserverForm } from "./reserver-form";

export const dynamic = "force-dynamic";

export default async function ReserverPage({
  searchParams,
}: {
  searchParams: Promise<{ teacherId?: string }>;
}) {
  const { teacherId } = await searchParams;
  if (!teacherId) notFound();

  const teacher = await db.teacher.findFirst({
    where: { id: teacherId, status: "ACTIVE", AND: [{ photoUrl: { not: null } }, { photoUrl: { not: "" } }] },
    include: {
      subjects: { include: { subject: true } },
      levels: { include: { level: true } },
      zones: { include: { commune: true } },
    },
  });
  if (!teacher) notFound();

  const { communes } = await getCachedTeacherSearchCatalog();

  const teacherSubjects = teacher.subjects.map((s) => ({
    id: s.subject.id,
    name: s.subject.name,
    slug: s.subject.slug,
    isPrimary: s.isPrimary,
  }));
  const teacherLevels = teacher.levels.map((l) => ({ id: l.level.id, name: l.level.name, slug: l.level.slug }));
  const teacherZones = teacher.zones.map((zone) => zone.commune.name);

  return (
    <div>
      <ReserverForm
        teacher={{
          id: teacher.id,
          fullName: teacher.fullName,
          professionalName: teacher.professionalName,
          photoUrl: teacher.photoUrl,
          jobTitle: teacher.jobTitle,
          commune: teacher.commune,
          quartier: teacher.quartier,
          rating: teacher.rating,
          ratingCount: teacher.ratingCount,
          pricePerSession: teacher.pricePerSession,
          badgeVerified: teacher.badgeVerified,
          badgeRecommended: teacher.badgeRecommended,
          badgePremium: teacher.badgePremium,
          badgePopular: teacher.badgePopular,
          badgeNew: teacher.badgeNew,
          offersHome: teacher.offersHome,
          offersOnline: teacher.offersOnline,
          offersGroup: teacher.offersGroup,
          availability: teacher.availability,
          zones: teacherZones,
          subjects: teacherSubjects,
          levels: teacherLevels.map((level) => level.name),
        }}
        subjects={teacherSubjects.map((s) => ({ id: s.id, name: s.name, slug: s.slug }))}
        levels={teacherLevels.map((l) => ({ id: l.id, name: l.name, slug: l.slug }))}
        communes={communes.map((c) => ({ id: c.id, name: c.name }))}
      />
    </div>
  );
}
