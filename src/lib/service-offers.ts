export type AcademicSchoolSystem = "ivoirien" | "francais";
export type ServiceTrack = AcademicSchoolSystem | "professionnel";

export type OfficialPriceBand = {
  key: string;
  label: string;
  shortLabel: string;
  amount: number;
};

export const ACADEMIC_LEVEL_OPTIONS: Record<AcademicSchoolSystem, string[]> = {
  ivoirien: [
    "CP1", "CP2", "CE1", "CE2", "CM1", "CM2",
    "6e", "5e", "4e", "3e",
    "2nde A", "2nde C",
    "1ère A", "1ère C", "1ère D", "1ère E",
    "Terminale A1", "Terminale A2", "Terminale C", "Terminale D", "Terminale E",
  ],
  francais: [
    "CP1 / CP", "CE1", "CE2", "CM1", "CM2",
    "6e", "5e", "4e", "3e",
    "Seconde", "Première", "Terminale",
  ],
};

export const OFFICIAL_ACADEMIC_PRICING: Record<AcademicSchoolSystem, OfficialPriceBand[]> = {
  ivoirien: [
    { key: "ivoirien_cp1_cm1", label: "CP1 à CM1", shortLabel: "CP1–CM1", amount: 15_000 },
    { key: "ivoirien_cm2_4e", label: "CM2 à 4e", shortLabel: "CM2–4e", amount: 20_000 },
    { key: "ivoirien_3e_1ere", label: "3e à 1ère", shortLabel: "3e–1ère", amount: 25_000 },
    { key: "ivoirien_terminale", label: "Terminale", shortLabel: "Terminale", amount: 30_000 },
  ],
  francais: [
    { key: "francais_cp_cm1", label: "CP1 à CM1", shortLabel: "CP1–CM1", amount: 37_500 },
    { key: "francais_cm2_4e", label: "CM2 à 4e", shortLabel: "CM2–4e", amount: 50_000 },
    { key: "francais_3e_1ere", label: "3e à 1ère", shortLabel: "3e–1ère", amount: 62_500 },
    { key: "francais_terminale", label: "Terminale", shortLabel: "Terminale", amount: 75_000 },
  ],
};

export const PROFESSIONAL_SESSION_PRICE = 40_000;

export const SERVICE_TRACKS = [
  {
    value: "ivoirien" as const,
    title: "Système ivoirien",
    eyebrow: "Parcours académique",
    description: "Du CP1 à la Terminale, selon le programme ivoirien.",
  },
  {
    value: "francais" as const,
    title: "Système français",
    eyebrow: "Parcours académique",
    description: "Du primaire à la Terminale, selon le programme français.",
  },
  {
    value: "professionnel" as const,
    title: "Formation professionnelle",
    eyebrow: "Compétences & métiers",
    description: "Une compétence pratique, un métier ou un besoin d’entreprise.",
  },
] as const;

export function isAcademicSchoolSystem(value?: string | null): value is AcademicSchoolSystem {
  return value === "ivoirien" || value === "francais";
}

export function isAcademicCourseCategory(category?: string | null) {
  return category === "soutien_scolaire" || category === "preparation_examens";
}

export function getAcademicLevelOptions(system?: string | null) {
  return isAcademicSchoolSystem(system) ? ACADEMIC_LEVEL_OPTIONS[system] : [];
}

export function getServiceTrack(category?: string | null, schoolSystem?: string | null): ServiceTrack {
  if (!isAcademicCourseCategory(category)) return "professionnel";
  return schoolSystem === "francais" ? "francais" : "ivoirien";
}

function normalize(value?: string | null) {
  return (value ?? "")
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, "")
    .replace(/[-_/.,]+/g, " ")
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function academicBandIndex(level?: string | null) {
  const text = normalize(level);
  if (!text) return 0;
  if (/\bterminale\b|\btle\b/.test(text)) return 3;
  if (/\b3e\b|troisieme|\b2nde\b|seconde|\b1ere\b|premiere/.test(text)) return 2;
  if (/\bcm2\b|\b6e\b|sixieme|\b5e\b|cinquieme|\b4e\b|quatrieme/.test(text)) return 1;
  return 0;
}

export function resolveOfficialSessionPrice({
  category,
  schoolSystem,
  preciseLevel,
  levelName,
}: {
  category?: string | null;
  schoolSystem?: string | null;
  preciseLevel?: string | null;
  levelName?: string | null;
}): OfficialPriceBand & { track: ServiceTrack } {
  if (!isAcademicCourseCategory(category)) {
    return {
      key: "professionnel_40000",
      label: "Formation professionnelle",
      shortLabel: "Professionnel",
      amount: PROFESSIONAL_SESSION_PRICE,
      track: "professionnel",
    };
  }

  const system: AcademicSchoolSystem = schoolSystem === "francais" ? "francais" : "ivoirien";
  const band = OFFICIAL_ACADEMIC_PRICING[system][academicBandIndex(preciseLevel || levelName)];
  return {
    ...band,
    label: `${system === "francais" ? "Système français" : "Système ivoirien"} · ${band.label}`,
    track: system,
  };
}
