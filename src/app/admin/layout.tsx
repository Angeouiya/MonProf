import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { AdminLayout } from "@/components/layouts/admin-layout";

export const dynamic = "force-dynamic";

export default async function AdminRootLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/connexion?from=/admin");
  if ((session.user as any).role !== "ADMIN") redirect("/");

  return <AdminLayout userName={session.user.name}>{children}</AdminLayout>;
}
