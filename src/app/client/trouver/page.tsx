import { redirect } from "next/navigation";
import { getSessionUser, requireClient } from "@/lib/session";
import { getCachedTeacherSearchCatalog } from "@/lib/catalog-cache";
import { marketplaceEnabled } from "@/lib/marketplace-core";
import { ClientMarketplaceSearch } from "@/components/marketplace/client-marketplace-search";
import { filterLevelsForJourney, filterSubjectsForJourney } from "@/lib/catalog-journey";
import { parseTeacherJourney, TEACHER_JOURNEYS } from "@/lib/teacher-journeys";

export default async function TrouverProfesseurPage({
  searchParams,
}: {
  searchParams: Promise<{ journey?: string | string[] }>;
}) {
  if (!marketplaceEnabled()) redirect("/client/rechercher");
  const params = await searchParams;
  const initialJourney = parseTeacherJourney(typeof params.journey === "string" ? params.journey : null) ?? "ivoirien";
  if (!await getSessionUser()) {
    redirect(`/connexion?from=${encodeURIComponent(`/client/trouver?journey=${initialJourney}`)}`);
  }
  await requireClient();
  const catalog = await getCachedTeacherSearchCatalog();
  const catalogs = Object.fromEntries(TEACHER_JOURNEYS.map((journey) => [
    journey,
    {
      subjects: filterSubjectsForJourney(catalog.subjects, journey).map((item) => ({ id: item.id, name: item.name })),
      levels: filterLevelsForJourney(catalog.levels, journey).map((item) => ({ id: item.id, name: item.name })),
    },
  ])) as Record<(typeof TEACHER_JOURNEYS)[number], { subjects: { id: string; name: string }[]; levels: { id: string; name: string }[] }>;
  return (
    <ClientMarketplaceSearch
      key={initialJourney}
      initialJourney={initialJourney}
      catalogs={catalogs}
      communes={catalog.communes.map((item) => ({ name: item.name }))}
    />
  );
}
