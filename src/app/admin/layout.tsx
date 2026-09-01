import { AdminLayout } from "@/components/layouts/admin-layout";
import { unstable_cache } from "next/cache";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";

export const dynamic = "force-dynamic";

const getCachedAdminNotificationSummary = unstable_cache(
  async () => db.$queryRaw<Array<{
    notificationCount: number;
    urgentCount: number;
    teacherCount: number;
    paymentCount: number;
  }>>`
    SELECT
      COUNT(*) FILTER (
        WHERE "userId" IS NULL
          AND "deletedAt" IS NULL
          AND ("expiresAt" IS NULL OR "expiresAt" > NOW())
          AND "read" = false
          AND "priority" IN ('IMPORTANT', 'URGENT', 'CRITICAL')
      )::int AS "notificationCount",
      COUNT(*) FILTER (
        WHERE "userId" IS NULL
          AND "deletedAt" IS NULL
          AND ("expiresAt" IS NULL OR "expiresAt" > NOW())
          AND "read" = false
          AND "priority" IN ('URGENT', 'CRITICAL')
      )::int AS "urgentCount",
      COUNT(*) FILTER (
        WHERE "userId" IS NULL
          AND "deletedAt" IS NULL
          AND ("expiresAt" IS NULL OR "expiresAt" > NOW())
          AND "status" IN ('CREATED', 'SENT', 'RELAUNCHED', 'EXPIRED')
          AND ("recipientType" = 'TEACHER' OR "teacherId" IS NOT NULL)
      )::int AS "teacherCount",
      COUNT(*) FILTER (
        WHERE "userId" IS NULL
          AND "deletedAt" IS NULL
          AND ("expiresAt" IS NULL OR "expiresAt" > NOW())
          AND "read" = false
          AND ("type" ILIKE '%PAY%' OR "type" ILIKE '%PAYMENT%' OR "type" ILIKE '%FUNDS%')
      )::int AS "paymentCount"
    FROM competence."Notification"
  `,
  ["admin-notification-summary-v1"],
  { revalidate: 5, tags: ["admin-notifications"] },
);

export default async function AdminRootLayout({ children }: { children: React.ReactNode }) {
  const sessionUser = await requireAdmin();
  const [summary] = await getCachedAdminNotificationSummary();

  const notificationCount = summary?.notificationCount ?? 0;
  const urgentCount = summary?.urgentCount ?? 0;
  const teacherCount = summary?.teacherCount ?? 0;
  const paymentCount = summary?.paymentCount ?? 0;

  return (
    <AdminLayout
      userName={sessionUser.name}
      notificationCount={notificationCount}
      notificationSummary={{
        total: notificationCount,
        urgent: urgentCount,
        teacher: teacherCount,
        payment: paymentCount,
      }}
      permissions={sessionUser.adminPermissions}
      teamRole={sessionUser.adminTeamRole}
    >
      {children}
    </AdminLayout>
  );
}
