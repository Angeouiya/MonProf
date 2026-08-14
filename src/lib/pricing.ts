import {
  calculatePaymentServiceFee,
  PAYMENT_SERVICE_FEE_LABEL,
  PAYMENT_SERVICE_FEE_RATE_BPS,
  paymentServiceFeeDescription,
} from "@/lib/payment-service-fees";
import { calculateJekoClientPaymentFee } from "@/lib/jeko-client-payment-fees";
import { ABIDJAN_COMMUNES } from "@/lib/ivory-coast-locations";
import { isProfessionalLevelSelection } from "@/lib/course-catalog";

export const CURRENCY = "XOF";

export const PLATFORM_COMMISSION_RATE = 0.3;
export const TEACHER_RATE = 0.7;
export const PLATFORM_COMMISSION_PERCENT = 30;
export const TEACHER_PERCENT = 70;

export const PRICE_TIERS = {
  IVOIRIEN_CP1_CM1_15000: {
    key: "ivoirien_cp1_cm1_15000",
    label: "Système ivoirien · CP1 à CM1",
    amount: 15000,
    platformCommission: 4500,
    teacherPayout: 10500,
    description: "Tarif officiel par séance pour les classes de CP1 à CM1.",
  },
  IVOIRIEN_CM2_4E_20000: {
    key: "ivoirien_cm2_4e_20000",
    label: "Système ivoirien · CM2 à 4e",
    amount: 20000,
    platformCommission: 6000,
    teacherPayout: 14000,
    description: "Tarif officiel par séance pour les classes de CM2 à 4e.",
  },
  IVOIRIEN_3E_1ERE_25000: {
    key: "ivoirien_3e_1ere_25000",
    label: "Système ivoirien · 3e à 1ère",
    amount: 25000,
    platformCommission: 7500,
    teacherPayout: 17500,
    description: "Tarif officiel par séance pour les classes de 3e à 1ère.",
  },
  IVOIRIEN_TERMINALE_30000: {
    key: "ivoirien_terminale_30000",
    label: "Système ivoirien · Terminale",
    amount: 30000,
    platformCommission: 9000,
    teacherPayout: 21000,
    description: "Tarif officiel par séance pour la Terminale.",
  },
  FRANCAIS_CP_CM1_37500: {
    key: "francais_cp_cm1_37500",
    label: "Système français · CP1 à CM1",
    amount: 37500,
    platformCommission: 11250,
    teacherPayout: 26250,
    description: "Tarif officiel par séance pour les classes de CP1 à CM1.",
  },
  FRANCAIS_CM2_4E_50000: {
    key: "francais_cm2_4e_50000",
    label: "Système français · CM2 à 4e",
    amount: 50000,
    platformCommission: 15000,
    teacherPayout: 35000,
    description: "Tarif officiel par séance pour les classes de CM2 à 4e.",
  },
  FRANCAIS_3E_1ERE_62500: {
    key: "francais_3e_1ere_62500",
    label: "Système français · 3e à 1ère",
    amount: 62500,
    platformCommission: 18750,
    teacherPayout: 43750,
    description: "Tarif officiel par séance pour les classes de 3e à 1ère.",
  },
  FRANCAIS_TERMINALE_75000: {
    key: "francais_terminale_75000",
    label: "Système français · Terminale",
    amount: 75000,
    platformCommission: 22500,
    teacherPayout: 52500,
    description: "Tarif officiel par séance pour la Terminale.",
  },
  PROFESSIONNEL_40000: {
    key: "professionnel_40000",
    label: "Parcours professionnel",
    amount: 40000,
    platformCommission: 12000,
    teacherPayout: 28000,
    description: "Tarif officiel d'une séance de formation professionnelle.",
  },
  // Paliers historiques conservés pour relire correctement les anciens
  // snapshots. Ils ne sont plus utilisés pour une nouvelle réservation.
  BASIC_7500: {
    key: "basic_7500",
    label: "Basique",
    amount: 7500,
    platformCommission: 2250,
    teacherPayout: 5250,
    description: "Prix d'appel limite : en ligne, primaire simple, aide aux devoirs ou professeur très proche.",
  },
  STANDARD_10000: {
    key: "standard_10000",
    label: "Standard",
    amount: 10000,
    platformCommission: 3000,
    teacherPayout: 7000,
    description: "Minimum réel pour un cours à domicile normal.",
  },
  RENFORCEMENT_12500: {
    key: "renforcement_12500",
    label: "Renforcement",
    amount: 12500,
    platformCommission: 3750,
    teacherPayout: 8750,
    description: "Collège avancé, lycée début, bureautique, anglais.",
  },
  AVANCE_15000: {
    key: "avance_15000",
    label: "Avance",
    amount: 15000,
    platformCommission: 4500,
    teacherPayout: 10500,
    description: "Lycee, examens, BTS, formation professionnelle.",
  },
  PREMIUM_20000: {
    key: "premium_20000",
    label: "Premium",
    amount: 20000,
    platformCommission: 6000,
    teacherPayout: 14000,
    description: "Experts, Terminale, lycée français, data, informatique, BTP.",
  },
  SUR_DEVIS: {
    key: "expert_personnalise",
    label: "Expert personnalisé",
    amount: 25000,
    platformCommission: 7500,
    teacherPayout: 17500,
    description: "Entreprise, pack personnalisé, formation spéciale, mémoire, soutenance ou zone étendue.",
  },
} as const;

export type PriceTierCode = keyof typeof PRICE_TIERS;
export type PriceTierKey = (typeof PRICE_TIERS)[PriceTierCode]["key"];

export const TRANSPORT_FEES = {
  ONLINE: {
    key: "online",
    label: "Cours en ligne",
    amount: 0,
  },
  SAME_NEIGHBORHOOD: {
    key: "same_neighborhood",
    label: "Même quartier exact",
    amount: 0,
  },
  SAME_AREA: {
    key: "same_area",
    label: "Même commune, quartier différent",
    amount: 1000,
  },
  NEAR_COMMUNE: {
    key: "near_commune",
    label: "Commune proche",
    amount: 2500,
  },
  FAR_COMMUNE: {
    key: "far_commune",
    label: "Commune éloignée",
    amount: 4500,
  },
  OUTSIDE_GRAND_ABIDJAN: {
    key: "outside_grand_abidjan",
    label: "Ville intérieure / zone étendue",
    amount: 8000,
  },
} as const;

export type TransportFeeCode = keyof typeof TRANSPORT_FEES;
export type TransportFeeKey = (typeof TRANSPORT_FEES)[TransportFeeCode]["key"];
export const PENDING_TRANSPORT_FEE_KEY = "pending_location" as const;
export type ResolvedTransportFeeKey = TransportFeeKey | typeof PENDING_TRANSPORT_FEE_KEY;

export type NeighborhoodAliasMap = {
  resolved: Record<string, string>;
  /** Stable CommuneQuarter identity for every resolved catalogue label/alias. */
  canonicalKeys: Record<string, string>;
  ambiguous: string[];
};

export type TransportFeeResult = {
  key: ResolvedTransportFeeKey;
  label: string;
  amount: number | null;
  originCommune: string | null;
  destinationCommune: string | null;
  originQuartier?: string | null;
  destinationQuartier?: string | null;
  routeLabel: string;
  ruleLabel: string;
  coveredByTeacherZone: boolean;
  isGrandAbidjanRoute: boolean;
  isQuoteOnly: boolean;
};

export const GRAND_ABIDJAN_AREAS = [
  ...ABIDJAN_COMMUNES,
] as const;

export const GRAND_ABIDJAN_NEAR_ROUTES = [
  ["Cocody", "Plateau"],
  ["Cocody", "Adjamé"],
  ["Cocody", "Marcory"],
  ["Cocody", "Koumassi"],
  ["Cocody", "Bingerville"],
  ["Angré", "Bingerville"],
  ["Riviera", "Bingerville"],
  ["Plateau", "Treichville"],
  ["Plateau", "Adjamé"],
  ["Plateau", "Attécoubé"],
  ["Plateau", "Marcory"],
  ["Plateau", "Koumassi"],
  ["Plateau", "Yopougon"],
  ["Marcory", "Koumassi"],
  ["Marcory", "Treichville"],
  ["Marcory", "Port-Bouët"],
  ["Koumassi", "Treichville"],
  ["Koumassi", "Port-Bouët"],
  ["Treichville", "Port-Bouët"],
  ["Yopougon", "Attécoubé"],
  ["Yopougon", "Songon"],
  ["Abobo", "Adjamé"],
  ["Abobo", "Cocody"],
  ["Abobo", "Angré"],
  ["Abobo", "Anyama"],
  ["Anyama", "Adjamé"],
  ["Anyama", "Cocody"],
  ["Anyama", "Angré"],
  ["Abobo", "Plateau"],
  ["Adjamé", "Attécoubé"],
] as const;

export const COURSE_PACKS = {
  SINGLE: {
    key: "single_session",
    label: "Séance unique",
    sessions: 1,
    discountRate: 0,
  },
  PACK_4: {
    key: "pack_4",
    label: "Pack 4 séances",
    sessions: 4,
    discountRate: 0,
  },
  PACK_8: {
    key: "pack_8",
    label: "Pack 8 séances",
    sessions: 8,
    discountRate: 0.05,
  },
  PACK_12: {
    key: "pack_12",
    label: "Pack 12 séances",
    sessions: 12,
    discountRate: 0.07,
  },
  CUSTOM: {
    key: "custom_pack",
    label: "Pack personnalisé 12 séances",
    sessions: 12,
    discountRate: 0.08,
  },
  EXAM_PREP: {
    key: "legacy_exam_prep",
    label: "Préparation examen",
    sessions: 10,
    discountRate: 0,
  },
} as const;

export type PricingInput = {
  category: string;
  schoolSystem?: string | null;
  levelGroup?: string;
  exam?: string;
  domain?: string;
  deliveryMode: "domicile" | "en_ligne" | "entreprise";
  isTeacherNearby?: boolean;
  requiresMaterial?: boolean;
  isCompanyTraining?: boolean;
};

export type PricingDerivationInput = {
  category: string;
  schoolSystem?: string | null;
  levelName?: string | null;
  preciseLevel?: string | null;
  subjectName?: string | null;
  courseCatalogName?: string | null;
  objective?: string | null;
  deliveryMode: "domicile" | "en_ligne" | "entreprise";
  isTeacherNearby?: boolean;
  requiresMaterial?: boolean;
  isCompanyTraining?: boolean;
};

export type BookingPricingInput = PricingDerivationInput & {
  packType: string;
  participantsCount?: number;
  teacherPricePerSession?: number | null;
  transportFeeKey?: string | null;
  teacherCommune?: string | null;
  teacherQuartier?: string | null;
  teacherZoneNames?: string[];
  clientCommune?: string | null;
  clientQuartier?: string | null;
  materialFee?: number;
  platformCommissionPercent?: number;
  paymentMethod?: string | null;
  transportFeeAmounts?: Partial<TransportFeeAmounts>;
  grandAbidjanCommuneNames?: string[];
  clientCommuneTransportFeeOverride?: number | null;
  neighborhoodAliases?: NeighborhoodAliasMap;
  partnerDiscountPercent?: number;
  partnerCommissionPercent?: number;
  rewardDiscountPercent?: number;
  minimumPlatformMarginPercent?: number;
};

export type TransportFeeAmounts = {
  sameCommune: number;
  nearCommune: number;
  farCommune: number;
  interior: number;
};

export const DEFAULT_TRANSPORT_FEE_AMOUNTS: TransportFeeAmounts = {
  sameCommune: TRANSPORT_FEES.SAME_AREA.amount,
  nearCommune: TRANSPORT_FEES.NEAR_COMMUNE.amount,
  farCommune: TRANSPORT_FEES.FAR_COMMUNE.amount,
  interior: TRANSPORT_FEES.OUTSIDE_GRAND_ABIDJAN.amount,
};

export type BookingPricingSnapshot = {
  currency: typeof CURRENCY;
  priceTierKey: PriceTierKey;
  priceTierLabel: string;
  courseAmount: number;
  unitSessionAmount: number;
  rawCourseAmount: number;
  platformCommissionRate: number;
  platformCommissionAmount: number;
  teacherRate: number;
  teacherPayoutAmount: number;
  transportFee: number;
  transportFeePerSession: number;
  transportFeeKey: string | null;
  transportFeeLabel?: string;
  transportRouteLabel?: string;
  transportRuleLabel?: string;
  transportCoveredByTeacherZone?: boolean;
  transportFeePending?: boolean;
  materialFee: number;
  totalBeforePaymentServiceFee: number;
  paymentServiceFeeRate: number;
  paymentServiceFeeAmount: number;
  paymentServiceFeeLabel: string;
  totalBeforePaymentProviderFee: number;
  paymentProviderFeeRate: number;
  paymentProviderFeeAmount: number;
  paymentProviderFixedFeeAmount: number;
  paymentProviderFeeLabel: string;
  paymentProviderFeeMethod: string | null;
  paymentProviderFeeMethodLabel: string | null;
  totalClientPays: number;
  totalTeacherReceives: number;
  packKey: string;
  packLabel: string;
  numberOfSessions: number | null;
  discountAmount: number;
  discountRate: number;
  appliedDiscountKind: "NONE" | "PACK" | "PARTNER" | "GIFT";
  packDiscountAmount: number;
  partnerDiscountRate: number;
  partnerDiscountAmount: number;
  rewardDiscountRate: number;
  rewardDiscountAmount: number;
  partnerCommissionRate: number;
  partnerCommissionAmount: number;
  platformNetAfterPartnerAmount: number;
  minimumPlatformMarginAmount: number;
  participantsCount: number;
  groupMultiplier: number;
  isQuoteOnly: boolean;
  quoteReason?: string;
  ruleContext: {
    category: string;
    schoolSystem?: string | null;
    levelGroup?: string;
    exam?: string;
    domain?: string;
    deliveryMode: string;
    requiresMaterial?: boolean;
    isCompanyTraining?: boolean;
    isTeacherNearby?: boolean;
  };
};

const PRICE_TIER_RANK: Record<PriceTierCode, number> = {
  IVOIRIEN_CP1_CM1_15000: 10,
  IVOIRIEN_CM2_4E_20000: 20,
  IVOIRIEN_3E_1ERE_25000: 30,
  IVOIRIEN_TERMINALE_30000: 40,
  FRANCAIS_CP_CM1_37500: 50,
  PROFESSIONNEL_40000: 60,
  FRANCAIS_CM2_4E_50000: 70,
  FRANCAIS_3E_1ERE_62500: 80,
  FRANCAIS_TERMINALE_75000: 90,
  BASIC_7500: 1,
  STANDARD_10000: 2,
  RENFORCEMENT_12500: 3,
  AVANCE_15000: 4,
  PREMIUM_20000: 5,
  SUR_DEVIS: 99,
};

function normalize(value?: string | null) {
  return (value ?? "")
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, "")
    .replace(/[()[\]{}]+/g, " ")
    .replace(/[-_/.,]+/g, " ")
    .replace(/\s+/g, " ")
    .toLowerCase()
    .trim();
}

const NEIGHBORHOOD_ALIASES: Record<string, string> = {
  mermoze: "mermoz",
  "2 plateaux": "deux plateaux",
  "ii plateaux": "deux plateaux",
};

const NEIGHBORHOOD_DISPLAY_NAMES: Record<string, string> = {
  mermoz: "Mermoz",
  "deux plateaux": "Deux Plateaux",
};

function neighborhoodAliasLookupKey(commune?: string | null, neighborhood?: string | null) {
  const normalizedCommune = normalize(commune);
  const normalizedNeighborhood = normalize(neighborhood);
  return normalizedCommune && normalizedNeighborhood
    ? `${normalizedCommune}::${normalizedNeighborhood}`
    : "";
}

type CanonicalNeighborhood = {
  key: string;
  name: string;
};

function configuredNeighborhood(
  value?: string | null,
  commune?: string | null,
  aliases?: NeighborhoodAliasMap,
) {
  const scopedKey = neighborhoodAliasLookupKey(commune, value);
  const lookupKey = scopedKey && aliases?.resolved[scopedKey]
    ? scopedKey
    : normalize(value);
  const canonicalName = aliases?.resolved[lookupKey];
  if (!canonicalName) return undefined;
  return {
    key: aliases?.canonicalKeys?.[lookupKey] ?? `name:${normalize(canonicalName)}`,
    name: canonicalName,
  } satisfies CanonicalNeighborhood;
}

function isAmbiguousNeighborhoodName(
  value?: string | null,
  commune?: string | null,
  aliases?: NeighborhoodAliasMap,
) {
  if (!aliases) return false;
  const scopedKey = neighborhoodAliasLookupKey(commune, value);
  const fallbackKey = normalize(value);
  return (scopedKey ? aliases.ambiguous.includes(scopedKey) : false)
    || aliases.ambiguous.includes(fallbackKey);
}

function normalizeNeighborhood(
  value?: string | null,
  commune?: string | null,
  aliases?: NeighborhoodAliasMap,
) {
  const normalized = normalize(value);
  const configuredCanonical = configuredNeighborhood(value, commune, aliases);
  if (configuredCanonical) return normalize(configuredCanonical.name);
  const normalizedCommune = normalize(commune);
  // Some legacy teacher profiles stored "Commune Quartier" in the quartier
  // field, while some human-entered addresses invert it as "Quartier Commune".
  // Strip only the exact commune prefix/suffix; never use a loose substring
  // comparison that could merge two genuinely different neighborhoods.
  const withoutCommunePrefix = normalizedCommune && normalized.startsWith(`${normalizedCommune} `)
    ? normalized.slice(normalizedCommune.length + 1).trim()
    : normalized;
  const withoutCommuneSuffix = normalizedCommune && withoutCommunePrefix.endsWith(` ${normalizedCommune}`)
    ? withoutCommunePrefix.slice(0, -normalizedCommune.length - 1).trim()
    : withoutCommunePrefix;
  return NEIGHBORHOOD_ALIASES[withoutCommuneSuffix] ?? withoutCommuneSuffix;
}

function displayNeighborhoodName(
  value?: string | null,
  commune?: string | null,
  aliases?: NeighborhoodAliasMap,
) {
  const configuredCanonical = configuredNeighborhood(value, commune, aliases);
  if (configuredCanonical) return configuredCanonical.name;
  const normalized = normalizeNeighborhood(value, commune, aliases);
  return NEIGHBORHOOD_DISPLAY_NAMES[normalized] ?? (value?.trim() || null);
}

export function buildNeighborhoodAliasMap(
  entries: Array<{
    id?: string | null;
    communeId?: string | null;
    name: string;
    aliases?: string | null;
    communeName?: string | null;
  }>,
): NeighborhoodAliasMap {
  const candidates = new Map<string, Map<string, string>>();
  const register = (key: string, canonicalKey: string, canonicalName: string) => {
    if (!key) return;
    const existing = candidates.get(key);
    if (existing) existing.set(canonicalKey, canonicalName);
    else candidates.set(key, new Map([[canonicalKey, canonicalName]]));
  };

  for (const entry of entries) {
    const canonicalName = entry.name.trim();
    if (!canonicalName) continue;
    const normalizedCommune = normalize(entry.communeName);
    const canonicalIdentity = entry.id
      ? `quarter:${entry.id}`
      : `quarter:${entry.communeId ?? (normalizedCommune || "global")}:${normalize(canonicalName)}`;
    const canonicalKey = entry.communeName
      ? neighborhoodAliasLookupKey(entry.communeName, canonicalName)
      : normalize(canonicalName);
    const labels = [canonicalName, ...(entry.aliases ?? "").split(/[,;|\n]+/)]
      .map((label) => label.trim())
      .filter(Boolean);
    register(canonicalKey, canonicalIdentity, canonicalName);
    for (const label of labels) {
      const normalizedLabel = normalize(label);
      const aliasKey = entry.communeName
        ? neighborhoodAliasLookupKey(entry.communeName, label)
        : normalizedLabel;
      register(aliasKey, canonicalIdentity, canonicalName);
      // Accept the exact compound form emitted by legacy/imported profiles,
      // e.g. "Cocody Mermoz", while remaining scoped to Cocody's catalogue.
      if (entry.communeName && normalizedCommune && !normalizedLabel.startsWith(`${normalizedCommune} `)) {
        register(
          neighborhoodAliasLookupKey(entry.communeName, `${entry.communeName} ${label}`),
          canonicalIdentity,
          canonicalName,
        );
        register(
          neighborhoodAliasLookupKey(entry.communeName, `${label} ${entry.communeName}`),
          canonicalIdentity,
          canonicalName,
        );
      }
    }
  }

  const resolved: Record<string, string> = {};
  const canonicalKeys: Record<string, string> = {};
  const ambiguous: string[] = [];
  for (const [key, identities] of Array.from(candidates.entries()).sort(([left], [right]) => left.localeCompare(right, "fr"))) {
    const canonicalEntries = Array.from(identities.entries()).sort(([left], [right]) => left.localeCompare(right, "fr"));
    if (canonicalEntries.length === 1) {
      canonicalKeys[key] = canonicalEntries[0][0];
      resolved[key] = canonicalEntries[0][1];
    }
    else ambiguous.push(key);
  }
  return { resolved, canonicalKeys, ambiguous };
}

function includesAny(value: string, needles: string[]) {
  return needles.some((needle) => value.includes(needle));
}

function includesAnyToken(value: string, tokens: string[]) {
  const words = new Set(value.split(" ").filter(Boolean));
  return tokens.some((token) => words.has(token));
}

function displayAreaName(value?: string | null) {
  const normalized = normalize(value);
  return GRAND_ABIDJAN_AREAS.find((area) => normalize(area) === normalized) ?? (value?.trim() || null);
}

function isGrandAbidjanArea(value?: string | null) {
  const normalized = normalize(value);
  return GRAND_ABIDJAN_AREAS.some((area) => normalize(area) === normalized);
}

function sameArea(origin?: string | null, destination?: string | null) {
  const a = normalize(origin);
  const b = normalize(destination);
  if (!a || !b) return false;
  if (a === b) return true;

  const cocodyInnerAreas = ["cocody", "angre", "riviera", "deux plateaux"];
  return cocodyInnerAreas.includes(a) && cocodyInnerAreas.includes(b);
}

function isNearRoute(origin?: string | null, destination?: string | null) {
  const a = normalize(origin);
  const b = normalize(destination);
  if (!a || !b) return false;
  return GRAND_ABIDJAN_NEAR_ROUTES.some(([left, right]) => {
    const l = normalize(left);
    const r = normalize(right);
    return (a === l && b === r) || (a === r && b === l);
  });
}

function mostExpensiveTier(a: PriceTierCode, b: PriceTierCode): PriceTierCode {
  return PRICE_TIER_RANK[a] >= PRICE_TIER_RANK[b] ? a : b;
}

export function getTransportFeeByKey(key?: string | null) {
  return Object.values(TRANSPORT_FEES).find((fee) => fee.key === key) ?? TRANSPORT_FEES.SAME_AREA;
}

function resolveTransportFeeAmounts(amounts?: Partial<TransportFeeAmounts>): TransportFeeAmounts {
  return {
    sameCommune: nonNegativeAmount(amounts?.sameCommune, DEFAULT_TRANSPORT_FEE_AMOUNTS.sameCommune),
    nearCommune: nonNegativeAmount(amounts?.nearCommune, DEFAULT_TRANSPORT_FEE_AMOUNTS.nearCommune),
    farCommune: nonNegativeAmount(amounts?.farCommune, DEFAULT_TRANSPORT_FEE_AMOUNTS.farCommune),
    interior: nonNegativeAmount(amounts?.interior, DEFAULT_TRANSPORT_FEE_AMOUNTS.interior),
  };
}

function nonNegativeAmount(value: number | undefined, fallback: number) {
  return Number.isFinite(value) ? Math.max(0, Math.round(Number(value))) : fallback;
}

function transportAmountForKey(key: TransportFeeKey, amounts: TransportFeeAmounts) {
  switch (key) {
    case TRANSPORT_FEES.ONLINE.key:
    case TRANSPORT_FEES.SAME_NEIGHBORHOOD.key:
      return 0;
    case TRANSPORT_FEES.NEAR_COMMUNE.key:
      return amounts.nearCommune;
    case TRANSPORT_FEES.FAR_COMMUNE.key:
      return amounts.farCommune;
    case TRANSPORT_FEES.OUTSIDE_GRAND_ABIDJAN.key:
      return amounts.interior;
    default:
      return amounts.sameCommune;
  }
}

export function getTransportFeeResultByKey(key?: string | null, amounts?: Partial<TransportFeeAmounts>): TransportFeeResult {
  const fee = getTransportFeeByKey(key);
  const resolvedAmounts = resolveTransportFeeAmounts(amounts);
  return {
    key: fee.key,
    label: fee.label,
    amount: transportAmountForKey(fee.key, resolvedAmounts),
    originCommune: null,
    destinationCommune: null,
    originQuartier: null,
    destinationQuartier: null,
    routeLabel: fee.label,
    ruleLabel: fee.label,
    coveredByTeacherZone: false,
    isGrandAbidjanRoute: fee.key !== TRANSPORT_FEES.OUTSIDE_GRAND_ABIDJAN.key,
    isQuoteOnly: false,
  };
}

export function calculateGrandAbidjanTransportFee({
  teacherCommune,
  teacherQuartier,
  teacherZoneNames = [],
  clientCommune,
  clientQuartier,
  transportFeeAmounts,
  grandAbidjanCommuneNames = [],
  neighborhoodAliases,
}: {
  teacherCommune?: string | null;
  teacherQuartier?: string | null;
  teacherZoneNames?: string[];
  clientCommune?: string | null;
  clientQuartier?: string | null;
  transportFeeAmounts?: Partial<TransportFeeAmounts>;
  grandAbidjanCommuneNames?: string[];
  neighborhoodAliases?: NeighborhoodAliasMap;
}): TransportFeeResult {
  const amounts = resolveTransportFeeAmounts(transportFeeAmounts);
  const origin = displayAreaName(teacherCommune);
  const destination = displayAreaName(clientCommune);
  const originQuartier = displayNeighborhoodName(teacherQuartier, teacherCommune, neighborhoodAliases);
  const destinationQuartier = displayNeighborhoodName(clientQuartier, clientCommune, neighborhoodAliases);
  const normalizedDestination = normalize(destination);
  const coveredByTeacherZone = teacherZoneNames.some((zone) => normalize(zone) === normalizedDestination);
  // Une zone couverte décrit où le professeur accepte de se déplacer ; ce
  // n'est pas son point de départ. Utiliser la première zone rendait le prix
  // dépendant de l'ordre de retour de la base de données. Sans commune
  // principale, on conserve donc un calcul prudent et déterministe.
  const fallbackOrigin = origin;
  const routeLabel = fallbackOrigin && destination
    ? `${fallbackOrigin}${originQuartier ? ` (${originQuartier})` : ""} -> ${destination}${destinationQuartier ? ` (${destinationQuartier})` : ""}`
    : "Trajet a confirmer";

  if (!destination || !fallbackOrigin) {
    return {
      key: TRANSPORT_FEES.OUTSIDE_GRAND_ABIDJAN.key,
      label: TRANSPORT_FEES.OUTSIDE_GRAND_ABIDJAN.label,
      amount: amounts.interior,
      originCommune: fallbackOrigin,
      destinationCommune: destination,
      originQuartier,
      destinationQuartier,
      routeLabel,
      ruleLabel: "Commune professeur ou client manquante : forfait prudent applique automatiquement.",
      coveredByTeacherZone,
      isGrandAbidjanRoute: false,
      isQuoteOnly: false,
    };
  }

  const dynamicGrandAbidjanAreas = new Set(grandAbidjanCommuneNames.map(normalize).filter(Boolean));
  const isGrandAbidjan = (value: string | null) => isGrandAbidjanArea(value) || dynamicGrandAbidjanAreas.has(normalize(value));
  if (!isGrandAbidjan(fallbackOrigin) || !isGrandAbidjan(destination)) {
    return {
      key: TRANSPORT_FEES.OUTSIDE_GRAND_ABIDJAN.key,
      label: TRANSPORT_FEES.OUTSIDE_GRAND_ABIDJAN.label,
      amount: amounts.interior,
      originCommune: fallbackOrigin,
      destinationCommune: destination,
      originQuartier,
      destinationQuartier,
      routeLabel,
      ruleLabel: "Ville hors zone de proximité : forfait interurbain applique automatiquement.",
      coveredByTeacherZone,
      isGrandAbidjanRoute: false,
      isQuoteOnly: false,
    };
  }

  if (sameArea(fallbackOrigin, destination)) {
    const hasAmbiguousQuartier = isAmbiguousNeighborhoodName(
      teacherQuartier,
      teacherCommune,
      neighborhoodAliases,
    ) || isAmbiguousNeighborhoodName(
      clientQuartier,
      clientCommune,
      neighborhoodAliases,
    );
    const canonicalOriginQuartier = configuredNeighborhood(
      teacherQuartier,
      teacherCommune,
      neighborhoodAliases,
    );
    const canonicalDestinationQuartier = configuredNeighborhood(
      clientQuartier,
      clientCommune,
      neighborhoodAliases,
    );
    const sameCanonicalQuartier = Boolean(
      canonicalOriginQuartier
      && canonicalDestinationQuartier
      && canonicalOriginQuartier.key === canonicalDestinationQuartier.key
    );
    const sameNormalizedFallbackQuartier = Boolean(
      !canonicalOriginQuartier
      && !canonicalDestinationQuartier
      // `sameArea` regroupe aussi certains secteurs du grand Cocody pour leur
      // tarification (Cocody, Riviera, Angré, Deux Plateaux). Sans catalogue,
      // deux libellés génériques identiques comme "Centre" ne prouvent donc
      // pas qu'il s'agit du même quartier. Le fallback textuel n'est sûr que
      // lorsque la commune elle-même est identique.
      && normalize(fallbackOrigin) === normalize(destination)
      && originQuartier
      && destinationQuartier
      && normalizeNeighborhood(originQuartier, teacherCommune, neighborhoodAliases)
        === normalizeNeighborhood(destinationQuartier, clientCommune, neighborhoodAliases)
    );
    const sameKnownQuartier = Boolean(
      !hasAmbiguousQuartier
      && originQuartier
      && destinationQuartier
      && (sameCanonicalQuartier || sameNormalizedFallbackQuartier)
    );
    if (sameKnownQuartier) {
      return {
        key: TRANSPORT_FEES.SAME_NEIGHBORHOOD.key,
        label: TRANSPORT_FEES.SAME_NEIGHBORHOOD.label,
        amount: TRANSPORT_FEES.SAME_NEIGHBORHOOD.amount,
        originCommune: fallbackOrigin,
        destinationCommune: destination,
        originQuartier,
        destinationQuartier,
        routeLabel,
        ruleLabel: "Même quartier exact : aucun frais de déplacement.",
        coveredByTeacherZone,
        isGrandAbidjanRoute: true,
        isQuoteOnly: false,
      };
    }
    return {
      key: TRANSPORT_FEES.SAME_AREA.key,
      label: TRANSPORT_FEES.SAME_AREA.label,
      amount: amounts.sameCommune,
      originCommune: fallbackOrigin,
      destinationCommune: destination,
      originQuartier,
      destinationQuartier,
      routeLabel,
      ruleLabel: "Même commune, mais quartier différent : forfait local appliqué.",
      coveredByTeacherZone,
      isGrandAbidjanRoute: true,
      isQuoteOnly: false,
    };
  }

  if (isNearRoute(fallbackOrigin, destination)) {
    return {
      key: TRANSPORT_FEES.NEAR_COMMUNE.key,
      label: TRANSPORT_FEES.NEAR_COMMUNE.label,
      amount: amounts.nearCommune,
      originCommune: fallbackOrigin,
      destinationCommune: destination,
      originQuartier,
      destinationQuartier,
      routeLabel,
      ruleLabel: "Route proche dans la zone de déplacement.",
      coveredByTeacherZone,
      isGrandAbidjanRoute: true,
      isQuoteOnly: false,
    };
  }

  return {
    key: TRANSPORT_FEES.FAR_COMMUNE.key,
    label: TRANSPORT_FEES.FAR_COMMUNE.label,
    amount: amounts.farCommune,
    originCommune: fallbackOrigin,
    destinationCommune: destination,
    originQuartier,
    destinationQuartier,
    routeLabel,
    ruleLabel: "Route éloignée mais calculée automatiquement.",
    coveredByTeacherZone,
    isGrandAbidjanRoute: true,
    isQuoteOnly: false,
  };
}

function resolveTransportFee(input: BookingPricingInput): TransportFeeResult {
  if (input.deliveryMode !== "domicile") {
    return {
      key: TRANSPORT_FEES.ONLINE.key,
      label: TRANSPORT_FEES.ONLINE.label,
      amount: TRANSPORT_FEES.ONLINE.amount,
      originCommune: null,
      destinationCommune: null,
      originQuartier: null,
      destinationQuartier: null,
      routeLabel: "",
      ruleLabel: "",
      coveredByTeacherZone: false,
      isGrandAbidjanRoute: false,
      isQuoteOnly: false,
    };
  }

  if (
    !input.teacherCommune
    && !input.clientCommune
    && !input.teacherZoneNames?.length
    && !input.transportFeeKey
  ) {
    return {
      key: PENDING_TRANSPORT_FEE_KEY,
      label: "Déplacement à calculer",
      amount: null,
      originCommune: null,
      destinationCommune: null,
      originQuartier: null,
      destinationQuartier: null,
      routeLabel: "",
      ruleLabel: "Choisissez la commune du client pour calculer le déplacement.",
      coveredByTeacherZone: false,
      isGrandAbidjanRoute: false,
      isQuoteOnly: false,
    };
  }

  if (input.teacherCommune || input.clientCommune || input.teacherZoneNames?.length) {
    return calculateGrandAbidjanTransportFee({
      teacherCommune: input.teacherCommune,
      teacherQuartier: input.teacherQuartier,
      teacherZoneNames: input.teacherZoneNames,
      clientCommune: input.clientCommune,
      clientQuartier: input.clientQuartier,
      transportFeeAmounts: input.transportFeeAmounts,
      grandAbidjanCommuneNames: input.grandAbidjanCommuneNames,
      neighborhoodAliases: input.neighborhoodAliases,
    });
  }

  return getTransportFeeResultByKey(input.transportFeeKey, input.transportFeeAmounts);
}

export function getPackConfig(packType: string) {
  return COURSE_PACKS[packType as keyof typeof COURSE_PACKS] ?? COURSE_PACKS.SINGLE;
}

export function packSessionCount(packType: string) {
  return getPackConfig(packType).sessions ?? 0;
}

export function derivePricingContext(input: PricingDerivationInput): PricingInput {
  const category = input.category;
  const schoolSystem = input.schoolSystem || undefined;
  const selectedLevel = normalize([input.levelName, input.preciseLevel].filter(Boolean).join(" "));
  const text = normalize([
    input.levelName,
    input.preciseLevel,
    input.subjectName,
    input.courseCatalogName,
    input.objective,
  ].filter(Boolean).join(" "));

  let levelGroup: string | undefined;
  let exam: string | undefined;
  let domain: string | undefined;

  if (includesAny(text, ["maternelle", "prescolaire", "primaire"])) levelGroup = "official_primary_lower";
  if (includesAnyToken(text, ["cp", "cp1", "cp2", "ce1", "ce2", "cm1"])) levelGroup = "official_primary_lower";
  if (includesAnyToken(text, ["cm2", "6e", "5e", "4e"]) || includesAny(text, ["sixieme", "cinquieme", "quatrieme", "college"])) levelGroup = "official_middle_lower";
  if (includesAny(text, ["cepe"])) exam = "cepe";
  if (includesAnyToken(text, ["3e", "bepc"]) || includesAny(text, ["troisieme"])) {
    levelGroup = "official_secondary_upper";
    if (includesAny(text, ["bepc"])) exam = "bepc";
  }

  if (includesAnyToken(text, ["2nde", "1ere"]) || includesAny(text, ["seconde", "premiere", "lycee"])) levelGroup = "official_secondary_upper";
  if (includesAny(text, ["terminale", "tle "])) levelGroup = "official_terminale";
  if (includesAny(text, ["bac ivoirien", "preparation bac", "bac a", "bac c", "bac d", "bac e"])) exam = "bac_ivoirien";

  if (schoolSystem === "francais") {
    if (includesAnyToken(text, ["cp", "ce1", "ce2", "cm1"]) || includesAny(text, ["primaire"])) levelGroup = "official_primary_lower";
    if (includesAnyToken(text, ["cm2", "6e", "5e", "4e"]) || includesAny(text, ["sixieme", "cinquieme", "quatrieme", "college"])) levelGroup = "official_middle_lower";
    if (includesAnyToken(text, ["3e", "1ere"]) || includesAny(text, ["troisieme", "seconde", "premiere", "lycee"])) levelGroup = "official_secondary_upper";
    if (includesAny(text, ["brevet", "dnb"])) exam = "brevet_dnb";
    if (includesAny(text, ["terminale"])) levelGroup = "official_terminale";
    if (includesAny(text, ["bac francais", "grand oral", "specialite", "specialites", "hggsp", "hlp", "nsi", "ses", "llce"])) {
      exam = "bac_francais_grand_oral_specialites";
    }
  }

  if (includesAny(text, ["bts"])) levelGroup = "bts";
  if (includesAny(text, ["licence"]) || includesAnyToken(text, ["l1", "l2", "l3"])) levelGroup = "licence";
  // Les codes courts doivent correspondre à un mot complet : "m2" ne doit
  // pas faire passer un niveau "CM2" dans le palier Master.
  if (includesAny(text, ["master"]) || includesAnyToken(text, ["m1", "m2"])) levelGroup = "master";
  if (includesAny(text, ["memoire", "rapport de stage", "soutenance"])) levelGroup = "memoire_soutenance";

  if (
    isProfessionalLevelSelection(input.levelName, input.preciseLevel)
    || (
      ["formation_professionnelle", "apprentissage_metier"].includes(category)
      && includesAnyToken(selectedLevel, [
        "avance", "avancee", "avances", "avancees",
      ])
    )
  ) {
    levelGroup = "professional_advanced";
  }

  if (includesAny(text, ["initiation informatique", "utilisation ordinateur"])) domain = "bureautique_base";
  if (includesAnyToken(text, ["word"]) || includesAny(text, ["powerpoint", "excel debutant", "canva"])) {
    domain = "excel_powerpoint_canva";
  }
  if (includesAny(text, ["excel avance", "comptabilite", "marketing digital", "anglais professionnel", "community management", "logistique", "gestion de stock", "entrepreneuriat", "business plan"])) {
    domain = "comptabilite_marketing_anglais_pro";
  }
  if (includesAny(text, ["power bi", "developpement web", "python", "javascript", "data", "cyber", "cloud", "aws", "azure", "autocad", "revit", "archicad", "btp", "electricite batiment", "froid", "climatisation", "solaire"])) {
    domain = "data_dev_btp_cyber_cloud";
  }

  const inferredCompanyTraining = input.isCompanyTraining || category === "formation_entreprise";
  return {
    category,
    schoolSystem,
    levelGroup,
    exam,
    domain,
    deliveryMode: input.deliveryMode,
    isTeacherNearby: input.isTeacherNearby,
    requiresMaterial: false,
    isCompanyTraining: inferredCompanyTraining,
  };
}

export function calculatePriceTier(input: PricingInput): PriceTierCode {
  if (input.deliveryMode === "entreprise" || input.isCompanyTraining) return "SUR_DEVIS";
  // Le parcours professionnel a un prix officiel unique. Cette règle reste
  // prioritaire si un ancien système scolaire subsiste dans un brouillon.
  if (
    input.levelGroup === "professional_advanced"
    || ["enseignement_superieur", "formation_professionnelle", "apprentissage_metier", "langues_communication"].includes(input.category)
  ) return "PROFESSIONNEL_40000";

  if (input.schoolSystem === "francais") {
    if (input.levelGroup === "official_terminale" || input.exam === "bac_francais_grand_oral_specialites") return "FRANCAIS_TERMINALE_75000";
    if (input.levelGroup === "official_secondary_upper" || input.exam === "brevet_dnb") return "FRANCAIS_3E_1ERE_62500";
    if (input.levelGroup === "official_middle_lower") return "FRANCAIS_CM2_4E_50000";
    return "FRANCAIS_CP_CM1_37500";
  }

  if (input.levelGroup === "official_terminale" || input.exam === "bac_ivoirien") return "IVOIRIEN_TERMINALE_30000";
  if (input.levelGroup === "official_secondary_upper" || input.exam === "bepc") return "IVOIRIEN_3E_1ERE_25000";
  if (input.levelGroup === "official_middle_lower" || input.exam === "cepe") return "IVOIRIEN_CM2_4E_20000";
  return "IVOIRIEN_CP1_CM1_15000";
}

export function calculateBookingPricing(input: BookingPricingInput): BookingPricingSnapshot {
  const transport = resolveTransportFee(input);
  const context = derivePricingContext({
    ...input,
    isTeacherNearby: input.isTeacherNearby ?? (
      input.deliveryMode === "domicile"
      && (
        transport.key === TRANSPORT_FEES.SAME_NEIGHBORHOOD.key
        || transport.key === TRANSPORT_FEES.SAME_AREA.key
      )
    ),
  });
  const tierCode = calculatePriceTier(context);
  const pack = getPackConfig(input.packType);
  const participantsCount = Math.max(1, Math.round(Number(input.participantsCount) || 1));
  const groupMultiplier = 1 + Math.max(0, participantsCount - 1) * 0.5;
  const materialFee = Math.max(0, Math.round(Number(input.materialFee) || 0));

  const tier = PRICE_TIERS[tierCode];
  // Les anciens prix propres aux professeurs restent lisibles dans l'historique,
  // mais ne participent jamais au calcul d'une nouvelle réservation.
  const unitSessionAmount = tier.amount;

  const sessions = Math.max(1, pack.sessions ?? 1);
  const rawCourseAmount = Math.round(unitSessionAmount * sessions * groupMultiplier);
  const commissionPercent = Math.max(0, Math.min(60, Number.isFinite(input.platformCommissionPercent)
    ? Math.round(Number(input.platformCommissionPercent))
    : PLATFORM_COMMISSION_PERCENT));
  const platformCommissionRate = commissionPercent / 100;
  const teacherRate = 1 - platformCommissionRate;
  const rawPlatformCommission = Math.round(rawCourseAmount * platformCommissionRate);
  const teacherPayoutAmount = rawCourseAmount - rawPlatformCommission;
  const packDiscountCandidate = Math.round(rawCourseAmount * (pack.discountRate ?? 0));
  const requestedPartnerDiscountRate = Math.max(0, Math.min(10, Number(input.partnerDiscountPercent) || 0)) / 100;
  const requestedRewardDiscountRate = Math.max(0, Math.min(15, Number(input.rewardDiscountPercent) || 0)) / 100;
  const partnerCommissionRate = Math.max(0, Math.min(10, Number(input.partnerCommissionPercent) || 0)) / 100;
  const partnerCommissionAmount = Math.round(rawCourseAmount * partnerCommissionRate);
  const minimumPlatformMarginRate = Math.max(0, Math.min(20, Number(input.minimumPlatformMarginPercent) || 5)) / 100;
  const minimumPlatformMarginAmount = Math.round(rawCourseAmount * minimumPlatformMarginRate);
  const protectsPartnerOrGiftMargin = partnerCommissionAmount > 0
    || requestedPartnerDiscountRate > 0
    || requestedRewardDiscountRate > 0;
  const maximumPromotionalDiscount = protectsPartnerOrGiftMargin
    ? Math.max(0, rawPlatformCommission - partnerCommissionAmount - minimumPlatformMarginAmount)
    : rawPlatformCommission;
  const candidates = [
    { kind: "PACK" as const, amount: packDiscountCandidate, priority: 1 },
    { kind: "PARTNER" as const, amount: Math.round(rawCourseAmount * requestedPartnerDiscountRate), priority: 2 },
    { kind: "GIFT" as const, amount: Math.round(rawCourseAmount * requestedRewardDiscountRate), priority: 3 },
  ].sort((left, right) => right.amount - left.amount || right.priority - left.priority);
  const selectedDiscount = candidates[0];
  const discountAmount = Math.min(maximumPromotionalDiscount, selectedDiscount.amount);
  const appliedDiscountKind = discountAmount > 0 ? selectedDiscount.kind : "NONE";
  const packDiscountAmount = appliedDiscountKind === "PACK" ? discountAmount : 0;
  const partnerDiscountAmount = appliedDiscountKind === "PARTNER" ? discountAmount : 0;
  const rewardDiscountAmount = appliedDiscountKind === "GIFT" ? discountAmount : 0;
  // Le snapshot expose le taux réellement accordé. Lorsque la commission
  // est inférieure à la remise maximale du pack, afficher 5 % ou 7 % serait
  // incohérent avec le montant effectivement déduit.
  const discountRate = rawCourseAmount > 0 ? discountAmount / rawCourseAmount : 0;
  const courseAmount = rawCourseAmount - discountAmount;
  const platformCommissionAmount = courseAmount - teacherPayoutAmount;
  const platformNetAfterPartnerAmount = Math.max(0, platformCommissionAmount - partnerCommissionAmount);
  // Number(null) vaut 0 en JavaScript. Sans cette garde, une commune dont le
  // forfait particulier n'est pas renseigné annule le transport calculé.
  const hasTransportFeeOverride = input.clientCommuneTransportFeeOverride !== null
    && input.clientCommuneTransportFeeOverride !== undefined;
  const transportFeeOverride = hasTransportFeeOverride
    ? Number(input.clientCommuneTransportFeeOverride)
    : Number.NaN;
  const canOverrideTransport = input.deliveryMode === "domicile"
    && transport.key !== TRANSPORT_FEES.SAME_NEIGHBORHOOD.key
    && Number.isFinite(transportFeeOverride)
    && transportFeeOverride >= 0;
  const transportFeePerSession = canOverrideTransport ? Math.round(transportFeeOverride) : (transport.amount ?? 0);
  const transportFee = input.deliveryMode === "en_ligne" ? 0 : transportFeePerSession * sessions;
  // Les frais de service couvrent uniquement le cours et le déplacement.
  // Le matériel reste dû par le client, mais ne doit pas être commissionné.
  const paymentServiceFeeBaseAmount = courseAmount + transportFee;
  const totalBeforePaymentServiceFee = paymentServiceFeeBaseAmount + materialFee;
  const paymentServiceFeeAmount = calculatePaymentServiceFee(paymentServiceFeeBaseAmount);
  const totalBeforePaymentProviderFee = totalBeforePaymentServiceFee + paymentServiceFeeAmount;
  const paymentProviderFee = calculateJekoClientPaymentFee(totalBeforePaymentProviderFee, input.paymentMethod);
  const totalClientPays = totalBeforePaymentProviderFee + paymentProviderFee.amount;
  const totalTeacherReceives = teacherPayoutAmount + transportFee;

  return {
    currency: CURRENCY,
    priceTierKey: tier.key,
    priceTierLabel: tier.label,
    courseAmount,
    unitSessionAmount,
    rawCourseAmount,
    platformCommissionRate,
    platformCommissionAmount,
    teacherRate,
    teacherPayoutAmount,
    transportFee,
    transportFeePerSession,
    transportFeeKey: transport.key,
    transportFeeLabel: transport.label,
    transportRouteLabel: transport.routeLabel,
    transportRuleLabel: canOverrideTransport
      ? `${transport.ruleLabel} Forfait particulier configuré pour la destination.`
      : transport.ruleLabel,
    transportCoveredByTeacherZone: transport.coveredByTeacherZone,
    transportFeePending: transport.key === PENDING_TRANSPORT_FEE_KEY,
    materialFee,
    totalBeforePaymentServiceFee,
    paymentServiceFeeRate: PAYMENT_SERVICE_FEE_RATE_BPS,
    paymentServiceFeeAmount,
    paymentServiceFeeLabel: `${PAYMENT_SERVICE_FEE_LABEL} (${paymentServiceFeeDescription()})`,
    totalBeforePaymentProviderFee,
    paymentProviderFeeRate: paymentProviderFee.rateBps,
    paymentProviderFeeAmount: paymentProviderFee.amount,
    paymentProviderFixedFeeAmount: paymentProviderFee.fixedAmount,
    paymentProviderFeeLabel: paymentProviderFee.label,
    paymentProviderFeeMethod: paymentProviderFee.method,
    paymentProviderFeeMethodLabel: paymentProviderFee.methodLabel,
    totalClientPays,
    totalTeacherReceives,
    packKey: pack.key,
    packLabel: pack.label,
    numberOfSessions: sessions,
    discountAmount,
    discountRate,
    appliedDiscountKind,
    packDiscountAmount,
    partnerDiscountRate: rawCourseAmount > 0 ? partnerDiscountAmount / rawCourseAmount : 0,
    partnerDiscountAmount,
    rewardDiscountRate: rawCourseAmount > 0 ? rewardDiscountAmount / rawCourseAmount : 0,
    rewardDiscountAmount,
    partnerCommissionRate,
    partnerCommissionAmount,
    platformNetAfterPartnerAmount,
    minimumPlatformMarginAmount,
    participantsCount,
    groupMultiplier,
    isQuoteOnly: false,
    ruleContext: context,
  };
}

export function pricingSnapshotToJson(snapshot: BookingPricingSnapshot) {
  return JSON.stringify(snapshot);
}

export function parsePricingSnapshot(value?: string | null): BookingPricingSnapshot | null {
  if (!value) return null;
  try {
    return JSON.parse(value) as BookingPricingSnapshot;
  } catch {
    return null;
  }
}

export function enforceMinimumTier(tierCode: PriceTierCode, minimumTierCode: PriceTierCode) {
  return mostExpensiveTier(tierCode, minimumTierCode);
}
