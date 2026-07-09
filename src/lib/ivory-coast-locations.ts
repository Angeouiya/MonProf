export type LocationSelectOption = {
  value: string;
  label: string;
  keywords?: string;
};

export const ABIDJAN_CITY = "Abidjan";

export const ABIDJAN_COMMUNES = [
  "Abobo",
  "Adjamé",
  "Attécoubé",
  "Cocody",
  "Koumassi",
  "Marcory",
  "Plateau",
  "Port-Bouët",
  "Treichville",
  "Yopougon",
  "Bingerville",
  "Anyama",
  "Songon",
  "Angré",
  "Riviera",
  "Deux Plateaux",
] as const;

export const COTE_DIVOIRE_CITY_OPTIONS = [
  "Abidjan",
  "Bouaké",
  "Yamoussoukro",
  "San-Pédro",
  "Daloa",
  "Korhogo",
  "Man",
  "Gagnoa",
  "Abengourou",
  "Grand-Bassam",
  "Bonoua",
  "Aboisso",
  "Divo",
  "Agboville",
  "Adzopé",
  "Dabou",
  "Jacqueville",
  "Séguéla",
  "Odienné",
  "Bondoukou",
  "Ferkessédougou",
  "Soubré",
  "Guiglo",
  "Duékoué",
  "Toumodi",
  "Dimbokro",
  "Daoukro",
] as const;

export const LOCATION_QUARTIERS: Record<string, string[]> = {
  Abobo: [
    "Avocatier",
    "PK18",
    "Anador",
    "Abobo Baoulé",
    "Belleville",
    "Sagbé",
    "N'Dotré",
    "Plaque",
    "Akeikoi",
    "Samaké",
  ],
  Adjamé: [
    "220 Logements",
    "Bromakoté",
    "Liberté",
    "Williamsville",
    "Dallas",
    "Forum",
    "Gare",
  ],
  "Attécoubé": [
    "Banco",
    "Locodjro",
    "Abobodoumé",
    "Santé",
    "Agban",
    "Fromager",
  ],
  Cocody: [
    "Riviera Palmeraie",
    "Riviera 2",
    "Riviera 3",
    "Riviera Golf",
    "Angré 7e Tranche",
    "Angré 8e Tranche",
    "Deux Plateaux Vallon",
    "Deux Plateaux Mobile",
    "Bonoumin",
    "Danga",
    "Mermoz",
    "Saint-Jean",
    "Faya",
    "Akouédo",
  ],
  Angré: [
    "7e Tranche",
    "8e Tranche",
    "9e Tranche",
    "Château",
    "Star 9B",
    "Djibi",
    "Gestoci",
  ],
  Riviera: [
    "Riviera Palmeraie",
    "Riviera 2",
    "Riviera 3",
    "Riviera Golf",
    "Bonoumin",
    "Faya",
    "M'Badon",
  ],
  "Deux Plateaux": [
    "Vallon",
    "Mobile",
    "ENNA",
    "ENA",
    "Agban",
    "Les Oscars",
  ],
  Koumassi: [
    "Remblais",
    "Sicogi",
    "Campement",
    "Grand Carrefour",
    "Divo",
    "Prodomo",
    "Zone industrielle",
  ],
  Marcory: [
    "Zone 4",
    "Biétry",
    "Résidentiel",
    "Anoumabo",
    "Sans-fil",
    "Champroux",
    "Remblais",
  ],
  Plateau: [
    "Centre",
    "Cité administrative",
    "Commerce",
    "Avenue Chardy",
    "Indénié",
  ],
  "Port-Bouët": [
    "Aéroport",
    "Vridi",
    "Gonzagueville",
    "Adjouffou",
    "Phare",
    "Jean Folly",
  ],
  Treichville: [
    "Avenue 21",
    "Avenue 16",
    "Arras",
    "Biafra",
    "Zone portuaire",
    "Habitat",
  ],
  Yopougon: [
    "Selmer",
    "Niangon",
    "Sicogi",
    "Maroc",
    "Toits Rouges",
    "Wassakara",
    "Kouté",
    "Ananeraie",
    "Banco",
    "Sideci",
    "Gesco",
  ],
  Bingerville: [
    "Centre",
    "Palmeraie",
    "Gbagba",
    "M'Pouto",
    "Akandjé",
    "Eloka",
  ],
  Anyama: [
    "Centre",
    "Zossonkoi",
    "Schneider",
    "Résidentiel",
    "Ahouabo",
  ],
  Songon: [
    "Songon-Agban",
    "Songon-Kassemblé",
    "Songon-Dagbé",
    "Songon-Té",
  ],
  Bouaké: [
    "Air France",
    "Koko",
    "Nimbo",
    "Belleville",
    "Kennedy",
    "Dar Es Salam",
    "Broukro",
    "Zone industrielle",
  ],
  Yamoussoukro: [
    "Habitat",
    "Morofé",
    "Dioulakro",
    "Assabou",
    "Millionnaire",
    "N'Zuessy",
    "Kokrénou",
  ],
  "San-Pédro": [
    "Balmer",
    "Bardot",
    "Lac",
    "Séwéké",
    "Cité",
    "Zone portuaire",
  ],
  Daloa: [
    "Commerce",
    "Tazibouo",
    "Lobia",
    "Kennedy",
    "Orly",
    "Gbeuliville",
  ],
  Korhogo: [
    "Soba",
    "Teguéré",
    "Koko",
    "Petit Paris",
    "Résidentiel",
    "Zone industrielle",
  ],
  Man: [
    "Libreville",
    "Grand Gbapleu",
    "Campus",
    "Dioulabougou",
    "Résidentiel",
  ],
  Gagnoa: [
    "Garahio",
    "Dioulabougou",
    "Barouhio",
    "Commerce",
    "Résidentiel",
  ],
  Abengourou: [
    "Agni",
    "Commerce",
    "Cafétou",
    "Plateau",
    "Résidentiel",
  ],
  "Grand-Bassam": [
    "France",
    "Impérial",
    "Mockey-Ville",
    "Azuretti",
    "Quartier Phare",
  ],
  Aboisso: [
    "Commerce",
    "TP",
    "Belleville",
    "Sans-fil",
    "Résidentiel",
  ],
  Divo: [
    "Commerce",
    "Dioulabougou",
    "Bada",
    "Libreville",
    "Résidentiel",
  ],
};

export function normalizeLocationName(value?: string | null) {
  return (value ?? "")
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, "")
    .replace(/\s+/g, " ")
    .toLowerCase();
}

export function isAbidjanCity(value?: string | null) {
  return normalizeLocationName(value) === normalizeLocationName(ABIDJAN_CITY);
}

export function isGrandAbidjanCommune(value?: string | null) {
  const normalized = normalizeLocationName(value);
  return ABIDJAN_COMMUNES.some((commune) => normalizeLocationName(commune) === normalized);
}

function uniqOptions(values: string[]) {
  const seen = new Set<string>();
  return values
    .map((value) => value.trim())
    .filter(Boolean)
    .filter((value) => {
      const key = normalizeLocationName(value);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

export function buildCityOptions(communeNames: string[]): LocationSelectOption[] {
  const grandAbidjanSet = new Set(ABIDJAN_COMMUNES.map(normalizeLocationName));
  const values = uniqOptions([
    ...COTE_DIVOIRE_CITY_OPTIONS,
    ...communeNames.filter((name) => !grandAbidjanSet.has(normalizeLocationName(name)) || isAbidjanCity(name)),
  ]);

  return values.map((name) => ({
    value: name,
    label: isAbidjanCity(name) ? "Abidjan (choisir commune et quartier)" : name,
    keywords: `${name} Côte d'Ivoire ville commune quartier`,
  }));
}

export function buildAbidjanCommuneOptions(): LocationSelectOption[] {
  return ABIDJAN_COMMUNES.map((name) => ({
    value: name,
    label: name,
    keywords: `${name} Abidjan commune quartier`,
  }));
}

export function buildQuartierOptions(area?: string | null): LocationSelectOption[] {
  const normalized = normalizeLocationName(area);
  const matchKey = Object.keys(LOCATION_QUARTIERS).find((key) => normalizeLocationName(key) === normalized);
  const quartiers = matchKey ? LOCATION_QUARTIERS[matchKey] : [];

  return quartiers.map((quartier) => ({
    value: quartier,
    label: quartier,
    keywords: `${quartier} ${area ?? ""} quartier`,
  }));
}

export function formatLocationSummary(city?: string | null, commune?: string | null, quartier?: string | null) {
  return [city, isAbidjanCity(city) ? commune : null, quartier]
    .filter(Boolean)
    .join(" · ");
}
