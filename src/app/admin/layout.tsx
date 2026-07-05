import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { AdminLayout } from "@/components/layouts/admin-layout";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function AdminRootLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/connexion?from=/admin");
  if ((session.user as any).role !== "ADMIN") redirect("/");
  const [summary] = await db.$queryRaw<Array<{
    notificationCount: number;
    urgentCount: number;
    teacherCount: number;
    paymentCount: number;
  }>>`
    SELECT
      COUNT(*) FILTER (
        WHERE "userId" IS NULL
          AND "read" = false
          AND "priority" IN ('IMPORTANT', 'URGENT', 'CRITICAL')
      )::int AS "notificationCount",
      COUNT(*) FILTER (
        WHERE "userId" IS NULL
          AND "read" = false
          AND "priority" IN ('URGENT', 'CRITICAL')
      )::int AS "urgentCount",
      COUNT(*) FILTER (
        WHERE "userId" IS NULL
          AND "status" IN ('CREATED', 'SENT', 'RELAUNCHED', 'EXPIRED')
          AND ("recipientType" = 'TEACHER' OR "teacherId" IS NOT NULL)
      )::int AS "teacherCount",
      COUNT(*) FILTER (
        WHERE "userId" IS NULL
          AND "read" = false
          AND ("type" ILIKE '%PAY%' OR "type" ILIKE '%PAYMENT%' OR "type" ILIKE '%FUNDS%')
      )::int AS "paymentCount"
    FROM competence."Notification"
  `;

  const notificationCount = summary?.notificationCount ?? 0;
  const urgentCount = summary?.urgentCount ?? 0;
  const teacherCount = summary?.teacherCount ?? 0;
  const paymentCount = summary?.paymentCount ?? 0;

  return (
    <AdminLayout
      userName={session.user.name}
      notificationCount={notificationCount}
      notificationSummary={{
        total: notificationCount,
        urgent: urgentCount,
        teacher: teacherCount,
        payment: paymentCount,
      }}
    >
      {children}
    </AdminLayout>
  );
}
