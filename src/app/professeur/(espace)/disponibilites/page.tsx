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
        description="Indiquez vos vrais créneaux disponibles. Une séance dure toujours 2h et chaque modification est visible par l'administration."
      />
      <PortalCard>
        <TeacherAvailabilityEditor initialAvailability={parseAvailability(current?.availability)} />
      </PortalCard>
    </div>
  );
}
