import { redirect } from "next/navigation";
import { ClientTemporaryPasswordGate } from "@/components/client/temporary-password-gate";
import { ClientLayout } from "@/components/layouts/client-layout";
import { isOwnerAdminAccount } from "@/lib/owner-account";
import { getSessionUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function ClientRootLayout({ children }: { children: React.ReactNode }) {
  const sessionUser = await getSessionUser();
  if (!sessionUser) redirect("/connexion?from=/client");
  const role = sessionUser.role;
  const ownerAdmin = isOwnerAdminAccount({ role, adminTeamRole: sessionUser.adminTeamRole });
  if (role === "TEACHER") redirect("/professeur");
  if (role !== "CLIENT" && !ownerAdmin) redirect("/admin");

  if (role === "CLIENT" && sessionUser.passwordMustChange) {
    return <ClientTemporaryPasswordGate clientName={sessionUser.name} />;
  }

  return <ClientLayout userName={sessionUser.name}>{children}</ClientLayout>;
}
