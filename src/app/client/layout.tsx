import { redirect } from "next/navigation";
import { ClientLayout } from "@/components/layouts/client-layout";
import { isOwnerAdminAccount } from "@/lib/owner-account";
import { getSessionUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function ClientRootLayout({ children }: { children: React.ReactNode }) {
  const sessionUser = await getSessionUser();
  if (!sessionUser) redirect("/connexion?from=/client");
  const role = sessionUser.role;
  const ownerAdmin = isOwnerAdminAccount({ role, email: sessionUser.email });
  if (role === "TEACHER") redirect("/professeur");
  if (role !== "CLIENT" && !ownerAdmin) redirect("/admin");

  return <ClientLayout userName={sessionUser.name}>{children}</ClientLayout>;
}
