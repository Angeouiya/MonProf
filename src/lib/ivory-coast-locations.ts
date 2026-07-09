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
  "Aboisso",
  "Abengourou",
  "Adiaké",
  "Adzopé",
  "Agboville",
  "Agnibilékrou",
  "Akoupé",
  "Alépé",
  "Assinie-Mafia",
  "Azaguié",
  "Bangolo",
  "Béoumi",
  "Biankouma",
  "Bloléquin",
  "Bocanda",
  "Bondoukou",
  "Bonoua",
  "Botro",
  "Bouaflé",
  "Bouaké",
  "Boundiali",
  "Bouna",
  "Buyo",
  "Dabakala",
  "Dabou",
  "Daloa",
  "Danané",
  "Daoukro",
  "Dimbokro",
  "Divo",
  "Doropo",
  "Duékoué",
  "Ferkessédougou",
  "Fresco",
  "Gagnoa",
  "Grand-Bassam",
  "Grand-Béréby",
  "Grand-Lahou",
  "Guiglo",
  "Guitry",
  "Issia",
  "Jacqueville",
  "Kani",
  "Katiola",
  "Korhogo",
  "Koun-Fao",
  "Lakota",
  "Madinani",
  "Man",
  "Mankono",
  "M'Bahiakro",
  "Méagui",
  "Minignan",
  "Niakaramadougou",
  "Noé",
  "Odienné",
  "Oumé",
  "Ouangolodougou",
  "San-Pédro",
  "Sakassou",
  "Sassandra",
  "Séguéla",
  "Sikensi",
  "Sinfra",
  "Sinématiali",
  "Soubré",
  "Tabou",
  "Tanda",
  "Tengréla",
  "Tiassalé",
  "Tiébissou",
  "Touba",
  "Toulépleu",
  "Toumodi",
  "Vavoua",
  "Yakassé-Attobrou",
  "Yamoussoukro",
  "Zouan-Hounien",
  "Zoukougbeu",
  "Zuénoula",
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
  Adiaké: [
    "Centre",
    "Quartier Administratif",
    "Port",
    "Assinie",
    "Biafra",
  ],
  Adzopé: [
    "Commerce",
    "Dioulakro",
    "TP",
    "Résidentiel",
    "Habitat",
  ],
  Agboville: [
    "Commerce",
    "Dioulakro",
    "Résidentiel",
    "Artisanal",
    "Gare",
  ],
  "Agnibilékrou": [
    "Centre",
    "Commerce",
    "Résidentiel",
    "Dioulakro",
    "CAFOP",
  ],
  Akoupé: [
    "Centre",
    "Commerce",
    "Résidentiel",
    "Dioulakro",
  ],
  Alépé: [
    "Centre",
    "Commerce",
    "Résidentiel",
    "Gare",
  ],
  "Assinie-Mafia": [
    "Mafia",
    "Assouindé",
    "Quartier France",
    "Bord de lagune",
  ],
  Azaguié: [
    "Centre",
    "Commerce",
    "Gare",
    "Résidentiel",
  ],
  Bangolo: [
    "Centre",
    "Commerce",
    "Résidentiel",
    "Dioulabougou",
  ],
  "Béoumi": [
    "Centre",
    "Commerce",
    "Koko",
    "Résidentiel",
  ],
  Biankouma: [
    "Centre",
    "Commerce",
    "Résidentiel",
    "Quartier Lycée",
  ],
  "Bloléquin": [
    "Centre",
    "Commerce",
    "Résidentiel",
    "Gare",
  ],
  Bocanda: [
    "Centre",
    "Commerce",
    "Résidentiel",
    "Dioulakro",
  ],
  Bondoukou: [
    "Centre",
    "Kamaghaya",
    "Donzosso",
    "Commerce",
    "Résidentiel",
  ],
  Bonoua: [
    "Centre",
    "Yaou",
    "Samouo",
    "Résidentiel",
    "Commerce",
  ],
  Botro: [
    "Centre",
    "Commerce",
    "Résidentiel",
    "Quartier Lycée",
  ],
  Bouaflé: [
    "Commerce",
    "Dioulabougou",
    "Koblata",
    "Résidentiel",
    "Kennedy",
  ],
  Boundiali: [
    "Centre",
    "Sokoura",
    "Commerce",
    "Résidentiel",
    "Quartier Lycée",
  ],
  Bouna: [
    "Centre",
    "Commerce",
    "Résidentiel",
    "Dioulabougou",
  ],
  Buyo: [
    "Centre",
    "Lac",
    "Résidentiel",
    "Commerce",
  ],
  Dabakala: [
    "Centre",
    "Commerce",
    "Résidentiel",
    "Dioulabougou",
  ],
  Dabou: [
    "Centre",
    "Commerce",
    "Résidentiel",
    "Gare",
    "Quartier Lycée",
  ],
  Danané: [
    "Centre",
    "Commerce",
    "Résidentiel",
    "Quartier Lycée",
  ],
  Daoukro: [
    "Centre",
    "Commerce",
    "Résidentiel",
    "Dioulakro",
  ],
  Dimbokro: [
    "Commerce",
    "Dioulakro",
    "Résidentiel",
    "Belleville",
  ],
  Doropo: [
    "Centre",
    "Commerce",
    "Résidentiel",
  ],
  "Duékoué": [
    "Carrefour",
    "Commerce",
    "Résidentiel",
    "Quartier Lycée",
  ],
  "Ferkessédougou": [
    "Commerce",
    "Dioulabougou",
    "Résidentiel",
    "Gare",
    "Quartier Lycée",
  ],
  Fresco: [
    "Centre",
    "Port",
    "Commerce",
    "Résidentiel",
  ],
  "Grand-Béréby": [
    "Centre",
    "Bord de mer",
    "Commerce",
    "Résidentiel",
  ],
  "Grand-Lahou": [
    "Centre",
    "Bord lagune",
    "Commerce",
    "Résidentiel",
  ],
  Guiglo: [
    "Commerce",
    "Dioulabougou",
    "Résidentiel",
    "Quartier Lycée",
  ],
  Guitry: [
    "Centre",
    "Commerce",
    "Résidentiel",
  ],
  Issia: [
    "Centre",
    "Commerce",
    "Dioulabougou",
    "Résidentiel",
  ],
  Jacqueville: [
    "Centre",
    "Bord de mer",
    "Résidentiel",
    "Commerce",
  ],
  Katiola: [
    "Centre",
    "Commerce",
    "Résidentiel",
    "Quartier Lycée",
  ],
  Lakota: [
    "Commerce",
    "Dioulabougou",
    "Résidentiel",
    "Gare",
  ],
  Mankono: [
    "Centre",
    "Commerce",
    "Résidentiel",
    "Dioulabougou",
  ],
  "M'Bahiakro": [
    "Centre",
    "Commerce",
    "Résidentiel",
    "Quartier Lycée",
  ],
  "Méagui": [
    "Centre",
    "Commerce",
    "Résidentiel",
    "Campement",
  ],
  Odienné: [
    "Centre",
    "Commerce",
    "Résidentiel",
    "Quartier Lycée",
  ],
  Oumé: [
    "Centre",
    "Commerce",
    "Résidentiel",
    "Dioulabougou",
  ],
  "Sakassou": [
    "Centre",
    "Commerce",
    "Résidentiel",
  ],
  Sassandra: [
    "Centre",
    "Port",
    "Bord de mer",
    "Résidentiel",
  ],
  "Séguéla": [
    "Commerce",
    "Dioulabougou",
    "Résidentiel",
    "Quartier Lycée",
  ],
  Sikensi: [
    "Centre",
    "Commerce",
    "Résidentiel",
  ],
  Sinfra: [
    "Centre",
    "Commerce",
    "Résidentiel",
    "Dioulabougou",
  ],
  Soubré: [
    "Commerce",
    "Dioulabougou",
    "Résidentiel",
    "Quartier Lycée",
  ],
  Tabou: [
    "Centre",
    "Port",
    "Bord de mer",
    "Résidentiel",
  ],
  Tanda: [
    "Centre",
    "Commerce",
    "Résidentiel",
  ],
  "Tengréla": [
    "Centre",
    "Commerce",
    "Résidentiel",
  ],
  "Tiassalé": [
    "Centre",
    "Commerce",
    "Résidentiel",
    "N'Douci",
  ],
  Touba: [
    "Centre",
    "Commerce",
    "Résidentiel",
    "Dioulabougou",
  ],
  "Toulépleu": [
    "Centre",
    "Commerce",
    "Résidentiel",
  ],
  Toumodi: [
    "Centre",
    "Commerce",
    "Résidentiel",
    "Quartier Lycée",
  ],
  Vavoua: [
    "Centre",
    "Commerce",
    "Résidentiel",
    "Dioulabougou",
  ],
  "Zouan-Hounien": [
    "Centre",
    "Commerce",
    "Résidentiel",
  ],
  "Zuénoula": [
    "Centre",
    "Commerce",
    "Résidentiel",
    "Dioulabougou",
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
