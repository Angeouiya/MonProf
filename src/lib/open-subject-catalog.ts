import { COURSE_CATALOG } from "@/lib/course-catalog";

export type OpenSubjectPreset = {
  name: string;
  slug: string;
  icon: string;
};

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function iconForSubject(name: string) {
  const normalized = slugify(name);
  if (/(anglais|francais|espagnol|allemand|arabe|chinois|toeic|toefl|ielts|langue|orthographe|expression)/.test(normalized)) return "Languages";
  if (/(math|calcul|geometrie|statistique|probabilite|finance)/.test(normalized)) return "Calculator";
  if (/(informatique|excel|word|powerpoint|data|python|sql|web|react|node|cyber|reseau|cloud|ia|chatgpt|code|logiciel|ordinateur)/.test(normalized)) return "Laptop";
  if (/(compta|gestion|droit|economie|fiscalite|paie|audit|marketing|vente|business|entrepreneuriat|rh|secretariat|administratif|crm)/.test(normalized)) return "BriefcaseBusiness";
  if (/(btp|genie-civil|autocad|revit|electricite|mecanique|climatisation|solaire|maintenance|plomberie|chantier|topographie|soudure|maconnerie|coffrage|ferraillage|beton|gros-oeuvre|second-oeuvre|conduite-de-travaux|carrelage|faience|paves|enduit|crepissage|faux-plafond|etancheite|charpente|vrd|assainissement|menuiserie|aluminium|ferronnerie|chaudronnerie|climatiseur|videosurveillance|interphone|domotique|groupe-electrogene|electromenager|pompe-a-eau)/.test(normalized)) return "Wrench";
  if (/(design|canva|photoshop|video|photo|figma|logo|affiche|contenu|capcut|dessin|peinture|serigraphie|impression|decoration|scenographie|branding|portfolio|textile|pagne|motif)/.test(normalized)) return "Palette";
  if (/(concours|cepe|bepc|bac|brevet|cafop|infs|police|gendarmerie|douane)/.test(normalized)) return "BadgeCheck";
  if (/(agro|agriculture|elevage|alimentaire|jus|confiture|epice|maraichage|pepiniere|pisciculture|apiculture|manioc|cacao|cajou|compost)/.test(normalized)) return "Sprout";
  if (/(cuisine|patisserie|restaurant|hotellerie|service|accueil|traiteur|attieke|alloco|grillade|sauce|viennoiserie)/.test(normalized)) return "Utensils";
  if (/(coiffure|maquillage|onglerie|mode|couture|beaute|barber|tresse|perruque|locks|vanille|foulard|broderie|perlage|batik|teinture|retouche|patronage|modelisme|stylisme)/.test(normalized)) return "Scissors";
  if (/(cordonnerie|maroquinerie|sandale|sac|cuir|bijou|bijouterie|vannerie|poterie|ceramique|artisan|meuble|bois|vernissage|sculpture)/.test(normalized)) return "Hammer";
  if (/(qhse|securite|hygiene|secours|risque)/.test(normalized)) return "ShieldCheck";
  return "BookOpen";
}

const basePresets: OpenSubjectPreset[] = [
  { name: "Autre matière / besoin spécifique", slug: "autre-matiere-besoin-specifique", icon: "PlusCircle" },
];

const catalogPresets = Array.from(
  new Map(
    COURSE_CATALOG.map((item) => {
      const name = item.matiere_ou_competence;
      return [slugify(name), { name, slug: slugify(name), icon: iconForSubject(name) }];
    }),
  ).values(),
).sort((a, b) => a.name.localeCompare(b.name, "fr"));

export const OPEN_SUBJECT_PRESETS: OpenSubjectPreset[] = [
  ...catalogPresets,
  ...basePresets.filter((preset) => !catalogPresets.some((item) => item.slug === preset.slug)),
];
