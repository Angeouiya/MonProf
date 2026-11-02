import type { CourseFormat } from "@prisma/client";
import { filterLevelsForJourney, filterSubjectsForJourney } from "@/lib/catalog-journey";
import { getCachedTeacherSearchCatalog } from "@/lib/catalog-cache";
import { parseMarketplaceSlot } from "@/lib/marketplace-core";
import { parseTeacherJourney } from "@/lib/teacher-journeys";
import type { MarketplaceSearchInput } from "@/lib/marketplace-search";

export async function parseMarketplaceSearchInput(value: Record<string, unknown>): Promise<MarketplaceSearchInput> {
  const journey = parseTeacherJourney(typeof value.journey === "string" ? value.journey : null);
  if (!journey) throw new Error("Choisissez un des trois systèmes.");
  const slot = parseMarketplaceSlot(value.date, value.time, Number(value.durationMinutes ?? 120));
  const courseFormat: CourseFormat = value.format === "ONLINE" ? "ONLINE" : value.format === "HOME" ? "HOME" : (() => { throw new Error("Choisissez le format du cours."); })();
  const catalog = await getCachedTeacherSearchCatalog();
  const subject = filterSubjectsForJourney(catalog.subjects, journey).find((item) => item.id === value.subjectId);
  const level = filterLevelsForJourney(catalog.levels, journey).find((item) => item.id === value.levelId);
  if (!subject || !level) throw new Error("Cette matière ou ce niveau n’appartient pas au système choisi.");
  const commune = typeof value.commune === "string" ? value.commune.trim().slice(0, 100) : "";
  const quartier = typeof value.quartier === "string" ? value.quartier.trim().slice(0, 100) : "";
  if (courseFormat === "HOME" && (!commune || !quartier)) {
    throw new Error("Précisez la commune et le quartier du cours.");
  }
  if (commune && !catalog.communes.some((item) => item.name.toLowerCase() === commune.toLowerCase())) {
    throw new Error("Choisissez une commune du catalogue.");
  }
  return {
    ...slot, journey, subjectId: subject.id, subjectName: subject.name, levelId: level.id, levelName: level.name,
    courseFormat, commune: commune || null, quartier: quartier || null,
  };
}
