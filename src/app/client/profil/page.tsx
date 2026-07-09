import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getCachedCommunesWithTeacherCounts } from "@/lib/catalog-cache";
import { getSessionUser } from "@/lib/session";
import { isOwnerAdminAccount } from "@/lib/owner-account";
import { ProfileClient, type ClientCommuneOption, type ClientProfile } from "./profile-client";

export const dynamic = "force-dynamic";

export default async function ProfilPage() {
  const sessionUser = await getSessionUser();
  if (!sessionUser) redirect("/connexion?from=/client/profil");

  const ownerAdmin = isOwnerAdminAccount({ role: sessionUser.role, email: sessionUser.email });
  if (sessionUser.role === "TEACHER") redirect("/professeur");
  if (sessionUser.role !== "CLIENT" && !ownerAdmin) redirect("/admin");

  const profile = await db.user.findUnique({
    where: { id: sessionUser.id },
    select: {
      id: true,
      email: true,
      name: true,
      phone: true,
      commune: true,
      quartier: true,
    },
  });

  if (!profile) redirect("/connexion?from=/client/profil");

  const communes = await getCachedCommunesWithTeacherCounts();

  const initialProfile: ClientProfile = {
    id: profile.id,
    email: profile.email,
    name: profile.name,
    phone: profile.phone,
    commune: profile.commune,
    quartier: profile.quartier,
  };
  const initialCommuneOptions: ClientCommuneOption[] = communes.map((commune) => ({
    id: commune.id,
    name: commune.name,
    zone: commune.zone,
    teachersCount: commune._count.teachers,
  }));

  return <ProfileClient initialProfile={initialProfile} initialCommuneOptions={initialCommuneOptions} />;
}
