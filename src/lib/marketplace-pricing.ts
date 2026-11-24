import type { TeacherJourney } from "@/lib/teacher-journeys";

export const MARKETPLACE_MIN_DURATION_MINUTES = 60;
export const MARKETPLACE_MAX_DURATION_MINUTES = 360;
export const MARKETPLACE_DURATION_STEP_MINUTES = 5;

export type MarketplaceCourseFormat = "HOME" | "ONLINE";

type PriceAnchors = { oneHour: number; twoHours: number };
type MarketplaceTier =
  | "IVOIRIEN_CP1_CM1_15000"
  | "IVOIRIEN_CM2_4E_20000"
  | "IVOIRIEN_3E_1ERE_25000"
  | "IVOIRIEN_TERMINALE_30000"
  | "FRANCAIS_CP_CM1_37500"
  | "FRANCAIS_CM2_4E_50000"
  | "FRANCAIS_3E_1ERE_62500"
  | "FRANCAIS_TERMINALE_75000"
  | "PROFESSIONNEL_40000";

const IVOIRIAN_LEVELS = {
  primary: ["CP1", "CP2", "CE1", "CE2", "CM1", "CM2"],
  middle: ["6e", "5e", "4e", "3e"],
  second: ["2nde A", "2nde C"],
  first: ["1ère A", "1ère C", "1ère D", "1ère E"],
  terminal: ["Terminale A1", "Terminale A2", "Terminale C", "Terminale D", "Terminale E"],
} as const;

const FRENCH_LEVELS = {
  primary: ["CP", "CE1", "CE2", "CM1", "CM2"],
  middle: ["6e", "5e", "4e", "3e"],
  second: ["Seconde"],
  first: ["Première générale", "Première technologique"],
  terminal: ["Terminale générale", "Terminale technologique"],
} as const;

// Ces paliers s'appliquent seulement aux nouvelles missions marketplace.
// Les anciens dossiers gardent leur prix enregistré dans leur snapshot.
const MARKETPLACE_PRICE_ANCHORS: Record<MarketplaceTier, Record<MarketplaceCourseFormat, PriceAnchors>> = {
  IVOIRIEN_CP1_CM1_15000: {
    ONLINE: { oneHour: 5_000, twoHours: 10_000 },
    HOME: { oneHour: 7_000, twoHours: 13_000 },
  },
  IVOIRIEN_CM2_4E_20000: {
    ONLINE: { oneHour: 5_500, twoHours: 11_000 },
    HOME: { oneHour: 7_500, twoHours: 14_000 },
  },
  IVOIRIEN_3E_1ERE_25000: {
    ONLINE: { oneHour: 6_500, twoHours: 13_000 },
    HOME: { oneHour: 8_500, twoHours: 16_000 },
  },
  IVOIRIEN_TERMINALE_30000: {
    ONLINE: { oneHour: 7_500, twoHours: 15_000 },
    HOME: { oneHour: 9_500, twoHours: 18_000 },
  },
  FRANCAIS_CP_CM1_37500: {
    ONLINE: { oneHour: 6_000, twoHours: 12_000 },
    HOME: { oneHour: 8_000, twoHours: 15_000 },
  },
  FRANCAIS_CM2_4E_50000: {
    ONLINE: { oneHour: 7_000, twoHours: 14_000 },
    HOME: { oneHour: 9_000, twoHours: 17_000 },
  },
  FRANCAIS_3E_1ERE_62500: {
    ONLINE: { oneHour: 8_000, twoHours: 16_000 },
    HOME: { oneHour: 10_000, twoHours: 19_000 },
  },
  FRANCAIS_TERMINALE_75000: {
    ONLINE: { oneHour: 10_000, twoHours: 20_000 },
    HOME: { oneHour: 12_000, twoHours: 23_000 },
  },
  PROFESSIONNEL_40000: {
    ONLINE: { oneHour: 20_000, twoHours: 40_000 },
    HOME: { oneHour: 20_000, twoHours: 40_000 },
  },
};

export function marketplaceCourseAmount(
  journey: TeacherJourney,
  levelName: string,
  courseFormat: MarketplaceCourseFormat,
  durationMinutes: number,
): number {
  if (!Number.isInteger(durationMinutes)
    || durationMinutes < MARKETPLACE_MIN_DURATION_MINUTES
    || durationMinutes > MARKETPLACE_MAX_DURATION_MINUTES
    || durationMinutes % MARKETPLACE_DURATION_STEP_MINUTES !== 0) {
    throw new Error("Choisissez une durée de 1 à 6 heures, par tranche de 5 minutes.");
  }
  if (courseFormat !== "ONLINE" && courseFormat !== "HOME") {
    throw new Error("Choisissez le format du cours.");
  }

  const tier = marketplacePriceTier(journey, levelName);
  const anchors = MARKETPLACE_PRICE_ANCHORS[tier][courseFormat];
  if (!anchors) throw new Error("Ce niveau n'a pas de tarif marketplace.");

  // La première heure conserve son prix affiché. Chaque minute suivante
  // utilise le prix marginal de la deuxième heure, y compris après 2 h.
  const exact = anchors.oneHour
    + (durationMinutes - 60) * (anchors.twoHours - anchors.oneHour) / 60;
  return Math.ceil(exact / 100) * 100;
}

export function formatMarketplaceDuration(durationMinutes: number): string {
  if (!Number.isInteger(durationMinutes) || durationMinutes < 0) return "Durée invalide";
  const hours = Math.floor(durationMinutes / 60);
  const minutes = durationMinutes % 60;
  if (hours === 0) return `${minutes} min`;
  return minutes === 0 ? `${hours} h` : `${hours} h ${String(minutes).padStart(2, "0")}`;
}

export function marketplacePreciseLevels(journey: TeacherJourney, catalogLevelName: string): string[] {
  if (journey === "professionnel") return [];
  const levels = journey === "ivoirien" ? IVOIRIAN_LEVELS : FRENCH_LEVELS;
  const all = [
    ...levels.primary, ...levels.middle, ...levels.second, ...levels.first, ...levels.terminal,
  ];
  const catalogName = normalizeLevelName(catalogLevelName);
  const exact = all.find((item) => normalizeLevelName(item) === catalogName);
  if (exact) return [exact];

  switch (catalogName) {
    case "cp ce1":
      return journey === "ivoirien" ? ["CP1", "CP2", "CE1"] : ["CP", "CE1"];
    case "ce2 cm2":
      return ["CE2", "CM1", "CM2"];
    case "primaire":
      return [...levels.primary];
    case "cepe":
    case "preparation cepe":
      return journey === "ivoirien" ? ["CM2"] : [];
    case "college":
      return [...levels.middle];
    case "bepc":
    case "preparation bepc":
      return journey === "ivoirien" ? ["3e"] : [];
    case "lycee":
      return [...levels.second, ...levels.first, ...levels.terminal];
    case "seconde":
      return [...levels.second];
    case "premiere":
      return [...levels.first];
    case "terminale":
    case "bac":
    case "preparation bac":
      return [...levels.terminal];
    default:
      return [];
  }
}

export function resolveMarketplaceLevelName(
  journey: TeacherJourney,
  catalogLevelName: string,
  preciseLevel: unknown,
): string {
  if (journey === "professionnel") return catalogLevelName;
  const options = marketplacePreciseLevels(journey, catalogLevelName);
  if (!options.length) throw new Error("Ce niveau n'est pas disponible dans ce système.");
  const selected = typeof preciseLevel === "string" ? preciseLevel.trim() : "";
  if (!options.includes(selected)) {
    throw new Error("Choisissez une classe précise correspondant au niveau sélectionné.");
  }
  return selected;
}

function marketplacePriceTier(journey: TeacherJourney, levelName: string): MarketplaceTier {
  if (journey === "professionnel") return "PROFESSIONNEL_40000";
  const level = normalizeLevelName(levelName);

  // Les intitulés génériques existent dans le catalogue actuel. Ils vont au
  // palier le plus élevé de leur plage pour ne jamais sous-tarifer un CM2,
  // une 3e ou une Terminale en l'absence de classe précise.
  let band: "primary" | "middle" | "upper" | "terminal";
  if (/^(?:terminale|tle|lycee)(?:\s|$)/.test(level) || /^(?:preparation\s+)?bac(?:\s|$)/.test(level)) {
    band = "terminal";
  } else if (/^(?:3e|troisieme|2nde|seconde|1ere|premiere|college)(?:\s|$)/.test(level)
    || /^(?:preparation\s+)?bepc(?:\s|$)/.test(level)) {
    band = "upper";
  } else if (/^(?:cm2|6e|5e|4e|primaire)(?:\s|$)/.test(level)
    || /^(?:preparation\s+)?cepe(?:\s|$)/.test(level)
    || level === "ce2 cm2") {
    band = "middle";
  } else if (/^(?:maternelle|cp|cp1|cp2|ce1|ce2|cm1)(?:\s|$)/.test(level)) {
    band = "primary";
  } else {
    throw new Error("Ce niveau n'a pas de tarif marketplace. Choisissez une classe reconnue.");
  }

  if (journey === "ivoirien") {
    return {
      primary: "IVOIRIEN_CP1_CM1_15000",
      middle: "IVOIRIEN_CM2_4E_20000",
      upper: "IVOIRIEN_3E_1ERE_25000",
      terminal: "IVOIRIEN_TERMINALE_30000",
    }[band] as MarketplaceTier;
  }
  return {
    primary: "FRANCAIS_CP_CM1_37500",
    middle: "FRANCAIS_CM2_4E_50000",
    upper: "FRANCAIS_3E_1ERE_62500",
    terminal: "FRANCAIS_TERMINALE_75000",
  }[band] as MarketplaceTier;
}

function normalizeLevelName(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}
