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
  const [notificationCount, urgentCount, teacherCount, paymentCount] = await db.$transaction([
    db.notification.count({
      where: { userId: null, read: false, priority: { in: ["IMPORTANT", "URGENT", "CRITICAL"] } },
    }),
    db.notification.count({
      where: { userId: null, read: false, priority: { in: ["URGENT", "CRITICAL"] } },
    }),
    db.notification.count({
      where: {
        userId: null,
        status: { in: ["CREATED", "SENT", "RELAUNCHED", "EXPIRED"] },
        OR: [{ recipientType: "TEACHER" }, { teacherId: { not: null } }],
      },
    }),
    db.notification.count({
      where: {
        userId: null,
        read: false,
        OR: [
          { type: { contains: "PAY" } },
          { type: { contains: "PAYMENT" } },
          { type: { contains: "FUNDS" } },
        ],
      },
    }),
  ]);

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
