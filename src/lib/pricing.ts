import {
  calculatePaymentServiceFee,
  PAYMENT_SERVICE_FEE_LABEL,
  PAYMENT_SERVICE_FEE_RATE_BPS,
  paymentServiceFeeDescription,
} from "@/lib/payment-service-fees";
import { ABIDJAN_COMMUNES } from "@/lib/ivory-coast-locations";

export const CURRENCY = "XOF";

export const PLATFORM_COMMISSION_RATE = 0.3;
export const TEACHER_RATE = 0.7;
export const PLATFORM_COMMISSION_PERCENT = 30;
export const TEACHER_PERCENT = 70;

export const PRICE_TIERS = {
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

export type TransportFeeResult = {
  key: TransportFeeKey;
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
  ["Cocody", "Angré"],
  ["Cocody", "Riviera"],
  ["Cocody", "Deux Plateaux"],
  ["Cocody", "Plateau"],
  ["Cocody", "Adjamé"],
  ["Cocody", "Marcory"],
  ["Cocody", "Koumassi"],
  ["Cocody", "Bingerville"],
  ["Angré", "Riviera"],
  ["Angré", "Deux Plateaux"],
  ["Angré", "Bingerville"],
  ["Riviera", "Deux Plateaux"],
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
  transportFeeAmounts?: Partial<TransportFeeAmounts>;
  grandAbidjanCommuneNames?: string[];
  clientCommuneTransportFeeOverride?: number | null;
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
  transportFeeKey: string | null;
  transportFeeLabel?: string;
  transportRouteLabel?: string;
  transportRuleLabel?: string;
  transportCoveredByTeacherZone?: boolean;
  materialFee: number;
  totalBeforePaymentServiceFee: number;
  paymentServiceFeeRate: number;
  paymentServiceFeeAmount: number;
  paymentServiceFeeLabel: string;
  totalClientPays: number;
  totalTeacherReceives: number;
  packKey: string;
  packLabel: string;
  numberOfSessions: number | null;
  discountAmount: number;
  discountRate: number;
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
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function includesAny(value: string, needles: string[]) {
  return needles.some((needle) => value.includes(needle));
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
}: {
  teacherCommune?: string | null;
  teacherQuartier?: string | null;
  teacherZoneNames?: string[];
  clientCommune?: string | null;
  clientQuartier?: string | null;
  transportFeeAmounts?: Partial<TransportFeeAmounts>;
  grandAbidjanCommuneNames?: string[];
}): TransportFeeResult {
  const amounts = resolveTransportFeeAmounts(transportFeeAmounts);
  const origin = displayAreaName(teacherCommune);
  const destination = displayAreaName(clientCommune);
  const originQuartier = teacherQuartier?.trim() || null;
  const destinationQuartier = clientQuartier?.trim() || null;
  const normalizedDestination = normalize(destination);
  const coveredByTeacherZone = teacherZoneNames.some((zone) => normalize(zone) === normalizedDestination);
  const fallbackOrigin = origin || teacherZoneNames.map(displayAreaName).find(Boolean) || null;
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
    const sameKnownQuartier = Boolean(originQuartier && destinationQuartier && normalize(originQuartier) === normalize(destinationQuartier));
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

  if (input.teacherCommune || input.clientCommune || input.teacherZoneNames?.length) {
    return calculateGrandAbidjanTransportFee({
      teacherCommune: input.teacherCommune,
      teacherQuartier: input.teacherQuartier,
      teacherZoneNames: input.teacherZoneNames,
      clientCommune: input.clientCommune,
      clientQuartier: input.clientQuartier,
      transportFeeAmounts: input.transportFeeAmounts,
      grandAbidjanCommuneNames: input.grandAbidjanCommuneNames,
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

  if (includesAny(text, ["maternelle", "prescolaire"])) levelGroup = "prescolaire";
  if (includesAny(text, ["cp1", "cp2", "ce1", "ce2"])) levelGroup = "primaire_cp_ce";
  if (includesAny(text, ["cm1", "cm2"])) levelGroup = "primaire_cm";
  if (includesAny(text, ["cepe"])) exam = "cepe";
  if (includesAny(text, ["6e", "sixieme", "5e", "cinquieme", "4e", "quatrieme"])) levelGroup = "college_6_5_4";
  if (includesAny(text, ["3e", "troisieme", "bepc"])) {
    levelGroup = "troisieme_bepc";
    if (includesAny(text, ["bepc"])) exam = "bepc";
  }

  if (includesAny(text, ["2nde", "seconde", "1ere a", "premiere a"])) levelGroup = "lycee_2nde_1ere";
  if (includesAny(text, ["1ere c", "1ere d", "1ere e", "premiere c", "premiere d", "premiere e"])) levelGroup = "premiere_c_d_e";
  if (includesAny(text, ["terminale a", "tle a"])) levelGroup = "terminale_a";
  if (includesAny(text, ["terminale c", "terminale d", "terminale e", "tle c", "tle d", "tle e"])) levelGroup = "terminale_c_d_e";
  if (includesAny(text, ["bac ivoirien", "preparation bac", "bac a", "bac c", "bac d", "bac e"])) exam = "bac_ivoirien";

  if (schoolSystem === "francais") {
    if (includesAny(text, ["primaire", "cp", "ce1", "ce2", "cm1", "cm2"])) levelGroup = "primaire";
    if (includesAny(text, ["6e", "sixieme", "5e", "cinquieme", "4e", "quatrieme", "3e", "troisieme"])) levelGroup = "college";
    if (includesAny(text, ["brevet", "dnb"])) exam = "brevet_dnb";
    if (includesAny(text, ["seconde"])) levelGroup = "seconde";
    if (includesAny(text, ["premiere", "1ere"])) levelGroup = "premiere";
    if (includesAny(text, ["terminale"])) levelGroup = "terminale";
    if (includesAny(text, ["bac francais", "grand oral", "specialite", "specialites", "hggsp", "hlp", "nsi", "ses", "llce"])) {
      exam = "bac_francais_grand_oral_specialites";
    }
  }

  if (includesAny(text, ["bts"])) levelGroup = "bts";
  if (includesAny(text, ["licence", "l1", "l2", "l3"])) levelGroup = "licence";
  if (includesAny(text, ["master", "m1", "m2"])) levelGroup = "master";
  if (includesAny(text, ["memoire", "rapport de stage", "soutenance"])) levelGroup = "memoire_soutenance";

  if (includesAny(text, ["initiation informatique", "utilisation ordinateur"])) domain = "bureautique_base";
  if (includesAny(text, ["word", "powerpoint", "excel debutant", "canva"])) domain = "excel_powerpoint_canva";
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

  if (input.schoolSystem === "francais") {
    if (input.levelGroup === "terminale" || input.exam === "bac_francais_grand_oral_specialites") return "PREMIUM_20000";
    if (["college", "seconde", "premiere"].includes(input.levelGroup || "") || input.exam === "brevet_dnb") return "AVANCE_15000";
    if (input.levelGroup === "primaire") return "RENFORCEMENT_12500";
    return "RENFORCEMENT_12500";
  }

  if (
    input.deliveryMode === "en_ligne"
    && input.category === "soutien_scolaire"
    && ["prescolaire", "primaire_cp_ce"].includes(input.levelGroup || "")
  ) {
    return "BASIC_7500";
  }

  if (
    input.deliveryMode === "domicile"
    && input.isTeacherNearby === true
    && input.category === "soutien_scolaire"
    && ["prescolaire", "primaire_cp_ce"].includes(input.levelGroup || "")
  ) {
    return "BASIC_7500";
  }

  if (
    input.deliveryMode === "domicile"
    && ["prescolaire", "primaire_cp_ce", "primaire_cm", "college_6_5_4"].includes(input.levelGroup || "")
  ) {
    return "STANDARD_10000";
  }

  if (input.exam === "cepe") return "STANDARD_10000";
  if (input.exam === "bepc") return "RENFORCEMENT_12500";
  if (input.exam === "bac_ivoirien") return "AVANCE_15000";

  if (input.levelGroup === "lycee_2nde_1ere") return "RENFORCEMENT_12500";
  if (input.levelGroup === "premiere_c_d_e") return "AVANCE_15000";
  if (input.levelGroup === "terminale_a") return "AVANCE_15000";
  if (input.levelGroup === "terminale_c_d_e") return "PREMIUM_20000";

  if (input.levelGroup === "bts") return "AVANCE_15000";
  if (input.levelGroup === "licence") return "AVANCE_15000";
  if (input.levelGroup === "master") return "PREMIUM_20000";
  if (input.levelGroup === "memoire_soutenance") return "SUR_DEVIS";

  if (input.domain === "bureautique_base") return "STANDARD_10000";
  if (input.domain === "excel_powerpoint_canva") return "RENFORCEMENT_12500";
  if (input.domain === "comptabilite_marketing_anglais_pro") return "AVANCE_15000";
  if (input.domain === "data_dev_btp_cyber_cloud") return "PREMIUM_20000";

  if (input.category === "enseignement_superieur" || input.category === "formation_professionnelle") return "AVANCE_15000";
  if (input.category === "langues_communication") return "RENFORCEMENT_12500";

  return "STANDARD_10000";
}

export function calculateBookingPricing(input: BookingPricingInput): BookingPricingSnapshot {
  const transport = resolveTransportFee(input);
  const context = derivePricingContext({
    ...input,
    isTeacherNearby: input.isTeacherNearby ?? (
      input.deliveryMode === "domicile" && transport.key === TRANSPORT_FEES.SAME_AREA.key
    ),
  });
  let tierCode = calculatePriceTier(context);
  const pack = getPackConfig(input.packType);
  const participantsCount = Math.max(1, Math.round(Number(input.participantsCount) || 1));
  const groupMultiplier = 1 + Math.max(0, participantsCount - 1) * 0.5;
  const materialFee = 0;

  if (pack.key === "custom_pack") tierCode = mostExpensiveTier(tierCode, "PREMIUM_20000");
  if (transport.key === TRANSPORT_FEES.OUTSIDE_GRAND_ABIDJAN.key) {
    tierCode = mostExpensiveTier(tierCode, "PREMIUM_20000");
  }

  const tier = PRICE_TIERS[tierCode];
  const teacherPricePerSession = Math.max(0, Math.round(Number(input.teacherPricePerSession) || 0));
  const unitSessionAmount = teacherPricePerSession > 0 ? teacherPricePerSession : tier.amount;

  const sessions = Math.max(1, pack.sessions ?? 1);
  const rawCourseAmount = Math.round(unitSessionAmount * sessions * groupMultiplier);
  const commissionPercent = Math.max(0, Math.min(60, Number.isFinite(input.platformCommissionPercent)
    ? Math.round(Number(input.platformCommissionPercent))
    : PLATFORM_COMMISSION_PERCENT));
  const platformCommissionRate = commissionPercent / 100;
  const teacherRate = 1 - platformCommissionRate;
  const rawPlatformCommission = Math.round(rawCourseAmount * platformCommissionRate);
  const teacherPayoutAmount = rawCourseAmount - rawPlatformCommission;
  const discountRate = pack.discountRate ?? 0;
  const discountAmount = Math.min(rawPlatformCommission, Math.round(rawCourseAmount * discountRate));
  const courseAmount = rawCourseAmount - discountAmount;
  const platformCommissionAmount = courseAmount - teacherPayoutAmount;
  const transportFeeOverride = Number(input.clientCommuneTransportFeeOverride);
  const canOverrideTransport = input.deliveryMode === "domicile"
    && transport.key !== TRANSPORT_FEES.SAME_NEIGHBORHOOD.key
    && Number.isFinite(transportFeeOverride)
    && transportFeeOverride >= 0;
  const transportFee = canOverrideTransport ? Math.round(transportFeeOverride) : (transport.amount ?? 0);
  const totalBeforePaymentServiceFee = courseAmount + transportFee + materialFee;
  const paymentServiceFeeAmount = calculatePaymentServiceFee(totalBeforePaymentServiceFee);
  const totalClientPays = totalBeforePaymentServiceFee + paymentServiceFeeAmount;
  const totalTeacherReceives = teacherPayoutAmount + transportFee;

  return {
    currency: CURRENCY,
    priceTierKey: tier.key,
    priceTierLabel: teacherPricePerSession > 0 ? "Prix professeur" : tier.label,
    courseAmount,
    unitSessionAmount,
    rawCourseAmount,
    platformCommissionRate,
    platformCommissionAmount,
    teacherRate,
    teacherPayoutAmount,
    transportFee,
    transportFeeKey: transport.key,
    transportFeeLabel: transport.label,
    transportRouteLabel: transport.routeLabel,
    transportRuleLabel: canOverrideTransport
      ? `${transport.ruleLabel} Forfait particulier configuré pour la destination.`
      : transport.ruleLabel,
    transportCoveredByTeacherZone: transport.coveredByTeacherZone,
    materialFee,
    totalBeforePaymentServiceFee,
    paymentServiceFeeRate: PAYMENT_SERVICE_FEE_RATE_BPS,
    paymentServiceFeeAmount,
    paymentServiceFeeLabel: `${PAYMENT_SERVICE_FEE_LABEL} (${paymentServiceFeeDescription()})`,
    totalClientPays,
    totalTeacherReceives,
    packKey: pack.key,
    packLabel: pack.label,
    numberOfSessions: sessions,
    discountAmount,
    discountRate,
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
