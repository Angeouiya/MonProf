import { db } from "@/lib/db";
import { requireTeacher } from "@/lib/teacher-auth";
import { ProfessorLayout } from "@/components/layouts/professor-layout";

export const dynamic = "force-dynamic";

export default async function ProfesseurProtectedLayout({ children }: { children: React.ReactNode }) {
  const { teacher } = await requireTeacher();
  const teacherName = teacher.professionalName || teacher.fullName;

  const now = new Date();
  const [summary] = await db.$queryRaw<Array<{
    notificationCount: number;
    missionCount: number;
    taskCount: number;
    messageCount: number;
  }>>`
    WITH verified_bookings AS (
      SELECT b."id"
      FROM competence."Booking" b
      WHERE b."teacherId" = ${teacher.id}
        AND b."paymentStatus" IN (
          'RECEIVED', 'BLOCKED', 'VALIDATED', 'TO_PAY_TEACHER', 'TEACHER_PAID',
          'DISPUTED', 'REFUND_PENDING', 'PARTIAL_REFUND_PENDING',
          'PARTIALLY_REFUNDED', 'REFUNDED', 'RETAINED'
        )
        AND b."paydunyaStatus" = 'COMPLETED'
        AND b."paydunyaVerifiedAt" IS NOT NULL
        AND EXISTS (
          SELECT 1
          FROM competence."Transaction" tr
          WHERE tr."bookingId" = b."id"
            AND tr."type" = 'CLIENT_PAYMENT'
            AND tr."status" IN (
              'RECEIVED', 'BLOCKED', 'VALIDATED', 'TO_PAY_TEACHER', 'TEACHER_PAID',
              'DISPUTED', 'REFUND_PENDING', 'PARTIAL_REFUND_PENDING',
              'PARTIALLY_REFUNDED', 'REFUNDED', 'RETAINED'
            )
            AND tr."amount" > 0
        )
    )
    SELECT
      (
        SELECT COUNT(*)::int
        FROM competence."TeacherNotification" tn
        WHERE tn."teacherId" = ${teacher.id}
          AND tn."status" IN ('DRAFT', 'PENDING', 'SENT', 'FAILED')
      ) AS "notificationCount",
      (
        SELECT COUNT(*)::int
        FROM competence."TeacherMissionLink" ml
        WHERE ml."teacherId" = ${teacher.id}
          AND ml."status" IN ('PENDING_CONFIRMATION', 'RELAUNCHED')
          AND ml."expiresAt" >= ${now}
          AND ml."bookingId" IN (SELECT "id" FROM verified_bookings)
      ) AS "missionCount",
      (
        SELECT COUNT(*)::int
        FROM competence."TeacherTask" tt
        WHERE tt."teacherId" = ${teacher.id}
          AND tt."status" IN ('TODO', 'SENT_TO_TEACHER', 'SEEN_BY_TEACHER', 'IN_PROGRESS', 'LATE')
          AND tt."bookingId" IN (SELECT "id" FROM verified_bookings)
      ) AS "taskCount",
      (
        SELECT COUNT(*)::int
        FROM competence."TeacherAdminMessage" tam
        WHERE tam."teacherId" = ${teacher.id}
          AND tam."sender" = 'ADMIN'
          AND tam."readByTeacherAt" IS NULL
      ) AS "messageCount"
  `;
  const notificationCount = summary?.notificationCount ?? 0;
  const missionCount = summary?.missionCount ?? 0;
  const taskCount = summary?.taskCount ?? 0;
  const messageCount = summary?.messageCount ?? 0;

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
