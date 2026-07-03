import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { ClientLayout } from "@/components/layouts/client-layout";

export const dynamic = "force-dynamic";

export default async function ClientRootLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/connexion?from=/client");
  if ((session.user as any).role !== "CLIENT") redirect("/admin");

  const user = await db.user.findUnique({
    where: { id: (session.user as any).id },
    select: { name: true, email: true, phone: true, commune: true, quartier: true, avatarUrl: true },
  });
  const notificationCount = await db.notification.count({
    where: {
      read: false,
      recipientType: "CLIENT",
      OR: [
        { userId: (session.user as any).id },
        { clientId: (session.user as any).id },
      ],
    },
  });

  return <ClientLayout userName={user?.name ?? session.user.name} notificationCount={notificationCount}>{children}</ClientLayout>;
}
