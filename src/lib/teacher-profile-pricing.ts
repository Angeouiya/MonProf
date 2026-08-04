import { formatFCFA } from "@/lib/format";
import { calculatePriceTier, derivePricingContext, PRICE_TIERS } from "@/lib/pricing";
import type { TeacherJourney } from "@/lib/teacher-journeys";

export function teacherJourneyPriceLabel(journey: TeacherJourney, levelNames: string[]) {
  if (journey === "professionnel") {
    return `${formatFCFA(PRICE_TIERS.PROFESSIONNEL_40000.amount)} / séance de 2h`;
  }

  const schoolSystem = journey === "francais" ? "francais" : "ivoirien";
  const amounts = levelNames.map((levelName) => {
    const context = derivePricingContext({
      category: "soutien_scolaire",
      schoolSystem,
      levelName,
      deliveryMode: "en_ligne",
    });
    return PRICE_TIERS[calculatePriceTier(context)].amount;
  });
  const fallback = journey === "francais"
    ? PRICE_TIERS.FRANCAIS_CP_CM1_37500.amount
    : PRICE_TIERS.IVOIRIEN_CP1_CM1_15000.amount;
  const minimum = amounts.length > 0 ? Math.min(...amounts) : fallback;
  return `Dès ${formatFCFA(minimum)} / séance de 2h`;
}
