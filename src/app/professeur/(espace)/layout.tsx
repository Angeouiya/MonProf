import { db } from "@/lib/db";
import { unstable_cache } from "next/cache";
import { requireTeacher } from "@/lib/teacher-auth";
import { ProfessorLayout } from "@/components/layouts/professor-layout";
import { TemporaryPasswordGate } from "@/components/professor/temporary-password-gate";

export const dynamic = "force-dynamic";

const getCachedProfessorShellSummary = unstable_cache(
  async (teacherId: string) => {
    const [summary] = await db.$queryRaw<Array<{
      notificationCount: number;
      missionCount: number;
      taskCount: number;
      messageCount: number;
    }>>`
      WITH verified_bookings AS (
        SELECT b."id"
        FROM competence."Booking" b
        WHERE b."teacherId" = ${teacherId}
          AND b."paymentStatus" IN (
            'RECEIVED', 'BLOCKED', 'VALIDATED', 'TO_PAY_TEACHER', 'TEACHER_PAID',
            'DISPUTED', 'REFUND_PENDING', 'PARTIAL_REFUND_PENDING',
            'PARTIALLY_REFUNDED', 'REFUNDED', 'RETAINED'
          )
          AND (
            (b."paydunyaStatus" = 'COMPLETED' AND b."paydunyaVerifiedAt" IS NOT NULL)
            OR (
              b."paymentProvider" = 'JEKO'
              AND b."providerPaymentStatus" = 'SUCCESS'
              AND b."paymentVerifiedAt" IS NOT NULL
            )
          )
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
              AND tr."amount" = CASE WHEN b."totalClientPays" > 0 THEN b."totalClientPays" ELSE b."totalPrice" END
              AND tr."amount" > 0
          )
      )
      SELECT
        (
          SELECT COUNT(*)::int
          FROM competence."TeacherNotification" tn
          WHERE tn."teacherId" = ${teacherId}
            AND tn."status" IN ('DRAFT', 'PENDING', 'SENT', 'FAILED')
            AND tn."deletedAt" IS NULL
            AND (tn."expiresAt" IS NULL OR tn."expiresAt" > NOW())
        ) AS "notificationCount",
        (
          SELECT COUNT(*)::int
          FROM competence."TeacherMissionLink" ml
          WHERE ml."teacherId" = ${teacherId}
            AND ml."status" IN ('PENDING_CONFIRMATION', 'RELAUNCHED')
            AND ml."expiresAt" >= NOW()
            AND ml."bookingId" IN (SELECT "id" FROM verified_bookings)
        ) AS "missionCount",
        (
          SELECT COUNT(*)::int
          FROM competence."TeacherTask" tt
          WHERE tt."teacherId" = ${teacherId}
            AND tt."status" IN ('TODO', 'SENT_TO_TEACHER', 'SEEN_BY_TEACHER', 'IN_PROGRESS', 'LATE')
            AND tt."bookingId" IN (SELECT "id" FROM verified_bookings)
        ) AS "taskCount",
        (
          SELECT COUNT(*)::int
          FROM competence."TeacherAdminMessage" tam
          WHERE tam."teacherId" = ${teacherId}
            AND tam."sender" = 'ADMIN'
            AND tam."readByTeacherAt" IS NULL
        ) AS "messageCount"
    `;
    return summary;
  },
  ["professor-shell-summary-v1"],
  { revalidate: 5, tags: ["professor-shell-summary"] },
);

export default async function ProfesseurProtectedLayout({ children }: { children: React.ReactNode }) {
  const { teacher } = await requireTeacher();
  const teacherName = teacher.professionalName || teacher.fullName;

  if (teacher.portalPasswordMustChange) {
    return <TemporaryPasswordGate teacherName={teacherName} />;
  }

  const summary = await getCachedProfessorShellSummary(teacher.id);
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
