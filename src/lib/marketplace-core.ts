import { calculatePriceTier, derivePricingContext, PRICE_TIERS } from "@/lib/pricing";
import type { TeacherJourney } from "@/lib/teacher-journeys";
import { parseAvailability, WEEK_DAYS } from "@/lib/scheduling";

export const MARKETPLACE_OFFER_TTL_MS = 3 * 60_000;
export const MARKETPLACE_COMMISSION_BPS = 3_000;

export type MarketplaceSlot = {
  scheduledDate: Date;
  scheduledTime: string;
  durationMinutes: 60 | 120;
};

export function marketplaceEnabled() {
  return process.env.MARKETPLACE_V2_ENABLED === "true";
}

export function parseMarketplaceSlot(dateValue: unknown, timeValue: unknown, durationValue: unknown, now = new Date()): MarketplaceSlot {
  if (typeof dateValue !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(dateValue)) {
    throw new Error("Choisissez une date valide.");
  }
  if (typeof timeValue !== "string" || !/^(0[8-9]|1\d|2[01]):(00|30)$/.test(timeValue)) {
    throw new Error("Choisissez une heure entre 08 h et 22 h, par tranche de 30 minutes.");
  }
  if (durationValue !== 60 && durationValue !== 120) {
    throw new Error("Choisissez une séance d’une ou de deux heures.");
  }
  const scheduledDate = new Date(`${dateValue}T00:00:00.000Z`);
  if (!Number.isFinite(scheduledDate.getTime()) || scheduledDate.toISOString().slice(0, 10) !== dateValue) {
    throw new Error("Date invalide.");
  }
  const [hours, minutes] = timeValue.split(":").map(Number);
  if (hours * 60 + minutes + durationValue > 22 * 60) {
    throw new Error("La séance doit se terminer avant 22 h.");
  }
  const beginsAt = new Date(scheduledDate.getTime() + (hours * 60 + minutes) * 60_000);
  if (beginsAt.getTime() < now.getTime() + 30 * 60_000) {
    throw new Error("Choisissez un horaire au moins 30 minutes à l’avance.");
  }
  if (beginsAt.getTime() > now.getTime() + 60 * 24 * 60 * 60_000) {
    throw new Error("Les demandes sont ouvertes sur les 60 prochains jours.");
  }
  return { scheduledDate, scheduledTime: timeValue, durationMinutes: durationValue };
}

export function marketplaceCourseAmount(journey: TeacherJourney, levelName: string): number {
  if (journey === "professionnel") return PRICE_TIERS.PROFESSIONNEL_40000.amount;
  const context = derivePricingContext({
    category: "soutien_scolaire",
    schoolSystem: journey,
    levelName,
    deliveryMode: "en_ligne",
  });
  return PRICE_TIERS[calculatePriceTier(context)].amount;
}

export function marketplaceCommission(courseAmount: number, rateBps = MARKETPLACE_COMMISSION_BPS) {
  if (!Number.isInteger(courseAmount) || courseAmount <= 0 || !Number.isInteger(rateBps) || rateBps < 0 || rateBps > 10_000) {
    throw new Error("Montant ou taux de commission invalide.");
  }
  return Math.round(courseAmount * rateBps / 10_000);
}

export function rankMarketplaceTeacher(input: {
  sameQuartier: boolean;
  sameCommune: boolean;
  rating: number;
  ratingCount: number;
  featured: boolean;
  responseMinutes?: number | null;
}) {
  // La proximité est prioritaire. Les avis départagent les profils de même zone.
  const proximity = input.sameQuartier ? 10_000 : input.sameCommune ? 6_000 : 2_000;
  const confidence = Math.min(input.ratingCount, 30) / 30;
  return proximity + Math.round(input.rating * 100 * confidence)
    + (input.featured ? 50 : 0)
    - Math.min(Math.max(input.responseMinutes ?? 0, 0), 120);
}

export function walletAvailable(balance: number, reserved: number) {
  if (!Number.isInteger(balance) || !Number.isInteger(reserved) || balance < 0 || reserved < 0 || reserved > balance) {
    throw new Error("Solde professeur incohérent.");
  }
  return balance - reserved;
}

export function teacherAvailableInGrid(availabilityJson: string | null, slot: MarketplaceSlot) {
  const grid = parseAvailability(availabilityJson);
  const day = WEEK_DAYS[(slot.scheduledDate.getUTCDay() + 6) % 7].key;
  const [hour, minute] = slot.scheduledTime.split(":").map(Number);
  const start = hour * 60 + minute;
  const end = start + slot.durationMinutes;
  for (let block = Math.floor((start - 8 * 60) / 120); 8 * 60 + block * 120 < end; block++) {
    const beginHour = 8 + block * 2;
    const key = `${String(beginHour).padStart(2, "0")}-${String(beginHour + 2).padStart(2, "0")}`;
    if (!grid[day]?.[key]) return false;
  }
  return true;
}

export function isWithinStartWindow(start: Date, now = new Date()) {
  const delta = now.getTime() - start.getTime();
  return delta >= -15 * 60_000 && delta <= 45 * 60_000;
}
