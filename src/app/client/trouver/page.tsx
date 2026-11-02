import { redirect } from "next/navigation";
import { requireClient } from "@/lib/session";
import { getCachedTeacherSearchCatalog } from "@/lib/catalog-cache";
import { marketplaceEnabled } from "@/lib/marketplace-core";
import { ClientMarketplaceSearch } from "@/components/marketplace/client-marketplace-search";
import { filterLevelsForJourney, filterSubjectsForJourney } from "@/lib/catalog-journey";
import { TEACHER_JOURNEYS } from "@/lib/teacher-journeys";

export default async function TrouverProfesseurPage() {
  if (!marketplaceEnabled()) redirect("/client/rechercher");
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
      catalogs={catalogs}
      communes={catalog.communes.map((item) => ({ name: item.name }))}
    />
  );
}
