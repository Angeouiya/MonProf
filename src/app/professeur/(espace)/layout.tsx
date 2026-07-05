import { db } from "@/lib/db";
import { requireTeacher } from "@/lib/teacher-auth";
import { ProfessorLayout } from "@/components/layouts/professor-layout";
import { verifiedPayDunyaBookingWhere } from "@/lib/payment-security";

export const dynamic = "force-dynamic";

export default async function ProfesseurProtectedLayout({ children }: { children: React.ReactNode }) {
  const { teacher } = await requireTeacher();
  const teacherName = teacher.professionalName || teacher.fullName;

  const [notificationCount, missionCount, taskCount, messageCount] = await db.$transaction([
    db.teacherNotification.count({
      where: {
        teacherId: teacher.id,
        status: { in: ["DRAFT", "PENDING", "SENT", "FAILED"] },
      },
    }),
    db.teacherMissionLink.count({
      where: {
        teacherId: teacher.id,
        status: { in: ["PENDING_CONFIRMATION", "RELAUNCHED"] },
        expiresAt: { gte: new Date() },
        booking: { is: verifiedPayDunyaBookingWhere({ teacherId: teacher.id }) },
      },
    }),
    db.teacherTask.count({
      where: {
        teacherId: teacher.id,
        status: { in: ["TODO", "SENT_TO_TEACHER", "SEEN_BY_TEACHER", "IN_PROGRESS", "LATE"] },
        booking: { is: verifiedPayDunyaBookingWhere({ teacherId: teacher.id }) },
      },
    }),
    db.teacherAdminMessage.count({
      where: {
        teacherId: teacher.id,
        sender: "ADMIN",
        readByTeacherAt: null,
      },
    }),
  ]);

  return (
    <ProfessorLayout
      teacherName={teacherName}
      photoUrl={teacher.photoUrl}
      notificationCount={notificationCount}
      missionCount={missionCount}
      taskCount={taskCount}
      messageCount={messageCount}
    >
      {children}
    </ProfessorLayout>
  );
}
