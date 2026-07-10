import { db } from "@/lib/db";
import { parseAvailability } from "@/lib/scheduling";
import { requireTeacher } from "@/lib/teacher-auth";
import { PortalCard, ProfessorPageHeader } from "@/components/professor/professor-ui";
import { TeacherAvailabilityEditor } from "@/components/professor/teacher-availability-editor";

export const dynamic = "force-dynamic";

export default async function ProfesseurDisponibilitesPage() {
  const { teacher } = await requireTeacher();
  const current = await db.teacher.findUnique({
    where: { id: teacher.id },
    select: { availability: true },
  });

  return (
    <div className="space-y-6">
      <ProfessorPageHeader
        title="Disponibilités"
        description="Ouvrez les créneaux de 2h que vous pouvez réellement assurer."
        rootTab
      />
      <PortalCard>
        <TeacherAvailabilityEditor initialAvailability={parseAvailability(current?.availability)} />
      </PortalCard>
    </div>
  );
}
