import { redirect } from "next/navigation";
import { managedCoursesEnabled } from "@/lib/managed-courses-core";
import { marketplaceEnabled } from "@/lib/marketplace-core";
import { getSessionUser } from "@/lib/session";
import { isOwnerAdminAccount } from "@/lib/owner-account";
import { parseTeacherJourney } from "@/lib/teacher-journeys";

export default async function MarketplaceEntryPage({
  searchParams,
}: {
  searchParams: Promise<{ journey?: string | string[] }>;
}) {
  if (managedCoursesEnabled()) redirect("/demande-cours");
  const params = await searchParams;
  const journey = parseTeacherJourney(typeof params.journey === "string" ? params.journey : null) ?? "ivoirien";
  if (!marketplaceEnabled()) redirect(`/professeurs?journey=${journey}`);

  const destination = `/client/trouver?journey=${journey}`;
  const user = await getSessionUser();
  if (!user) redirect(`/connexion?from=${encodeURIComponent(destination)}`);
  if (user.role === "TEACHER") redirect("/professeur");
  if (user.role === "ADMIN" && !isOwnerAdminAccount({ role: user.role, adminTeamRole: user.adminTeamRole })) {
    redirect("/admin");
  }
  redirect(destination);
}
