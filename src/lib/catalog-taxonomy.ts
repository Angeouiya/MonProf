export type CatalogCategory = {
  label: string;
  slug: string;
  className: string;
  icon: string;
  priority: number;
};

const SUBJECT_CATEGORIES = {
  languages: {
    label: "Langues",
    slug: "langues",
    className: "border-blue-200 bg-blue-50 text-blue-700",
    icon: "Languages",
    priority: 20,
  },
  contests: {
    label: "Concours",
    slug: "concours",
    className: "border-amber-200 bg-amber-50 text-amber-700",
    icon: "BadgeCheck",
    priority: 30,
  },
  digital: {
    label: "Numérique",
    slug: "numerique",
    className: "border-violet-200 bg-violet-50 text-violet-700",
    icon: "BookOpen",
    priority: 40,
  },
  professional: {
    label: "Professionnel",
    slug: "professionnel",
    className: "border-cyan-200 bg-cyan-50 text-cyan-700",
    icon: "BriefcaseBusiness",
    priority: 50,
  },
  health: {
    label: "Santé",
    slug: "sante",
    className: "border-red-200 bg-red-50 text-red-700",
    icon: "HeartPulse",
    priority: 52,
  },
  agriculture: {
    label: "Agro & métiers",
    slug: "agro-metiers",
    className: "border-lime-200 bg-lime-50 text-lime-800",
    icon: "Sprout",
    priority: 54,
  },
  services: {
    label: "Services",
    slug: "services",
    className: "border-sky-200 bg-sky-50 text-sky-700",
    icon: "Headphones",
    priority: 56,
  },
  arts: {
    label: "Arts",
    slug: "arts",
    className: "border-pink-200 bg-pink-50 text-pink-700",
    icon: "Palette",
    priority: 60,
  },
  technical: {
    label: "Technique",
    slug: "technique",
    className: "border-slate-200 bg-slate-50 text-slate-700",
    icon: "Wrench",
    priority: 70,
  },
  openNeeds: {
    label: "Besoins ouverts",
    slug: "besoins-ouverts",
    className: "border-fuchsia-200 bg-fuchsia-50 text-fuchsia-700",
    icon: "Tag",
    priority: 80,
  },
  school: {
    label: "Scolaire",
    slug: "scolaire",
    className: "border-emerald-200 bg-emerald-50 text-emerald-700",
    icon: "BookOpen",
    priority: 10,
  },
} satisfies Record<string, CatalogCategory>;

const LEVEL_CATEGORIES = {
  contests: {
    label: "Concours",
    slug: "concours",
    className: "border-amber-200 bg-amber-50 text-amber-700",
    icon: "BadgeCheck",
    priority: 40,
  },
  higher: {
    label: "Supérieur",
    slug: "superieur",
    className: "border-violet-200 bg-violet-50 text-violet-700",
    icon: "GraduationCap",
    priority: 30,
  },
  adults: {
    label: "Adultes",
    slug: "adultes",
    className: "border-cyan-200 bg-cyan-50 text-cyan-700",
    icon: "BriefcaseBusiness",
    priority: 50,
  },
  international: {
    label: "International",
    slug: "international",
    className: "border-blue-200 bg-blue-50 text-blue-700",
    icon: "Landmark",
    priority: 60,
  },
  exams: {
    label: "Examens",
    slug: "examens",
    className: "border-emerald-200 bg-emerald-50 text-emerald-700",
    icon: "BadgeCheck",
    priority: 20,
  },
  school: {
    label: "Scolaire",
    slug: "scolaire",
    className: "border-slate-200 bg-slate-50 text-slate-700",
    icon: "BookOpen",
    priority: 10,
  },
} satisfies Record<string, CatalogCategory>;

export function getSubjectCategory(name: string, icon?: string | null): CatalogCategory {
  const normalized = `${name} ${icon ?? ""}`
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  if (/(anglais|francais|allemand|espagnol|arabe|mandarin|toeic|toefl|lang)/.test(normalized)) {
    return SUBJECT_CATEGORIES.languages;
  }
  if (/(concours|psychotechnique|culture generale|ena|infas|cafop|police|gendarmerie)/.test(normalized)) {
    return SUBJECT_CATEGORIES.contests;
  }
  if (/(informatique|programmation|web|data|cyber|reseaux|base|ia|laptop|code|database|bot|bureautique)/.test(normalized)) {
    return SUBJECT_CATEGORIES.digital;
  }
  if (/(gestion|finance|comptabilite|economie|droit|fiscalite|marketing|rh|logistique|entrepreneuriat|communication|management|secretariat|assistant administratif|commerce|vente|immobilier|mobile money|budget|leadership|briefcase)/.test(normalized)) {
    return SUBJECT_CATEGORIES.professional;
  }
  if (/(sante|infirmier|infirmiere|aide-soignant|soins|paramedical|infas|hygiene alimentaire|heart|medical)/.test(normalized)) {
    return SUBJECT_CATEGORIES.health;
  }
  if (/(agriculture|agro|agroalimentaire|transformation|elevage|peche|pisciculture|apiculture|maraichage|pepiniere|manioc|cacao|cajou|compost|sprout|factory)/.test(normalized)) {
    return SUBJECT_CATEGORIES.agriculture;
  }
  if (/(relation client|hotellerie|restauration|transport|livraison|transit|douane|douanes|caisse|service client|accueil|vente terrain|point de vente|inventaire|merchandising|headphones|hotel|ship|shopping)/.test(normalized)) {
    return SUBJECT_CATEGORIES.services;
  }
  if (/(art|design|photo|video|chant|piano|guitare|palette|music|camera|dessin|theatre|peinture|serigraphie|impression numerique|motif|pagne|textile|decoration|scenographie|branding|logo|affiche|portfolio)/.test(normalized)) {
    return SUBJECT_CATEGORIES.arts;
  }
  if (/(mecanique|electronique|architecture|genie civil|dessin technique|couture|coiffure|cuisine|wrench|cpu|drafting|scissors|btp|electricite|solaire|climatisation|plomberie|froid|reparation smartphone|maintenance|artisan|maconnerie|coffrage|ferraillage|beton|gros oeuvre|second oeuvre|conduite de travaux|carrelage|faience|paves|enduit|crepissage|faux plafond|etancheite|charpente|topographie|vrd|assainissement|menuiserie|aluminium|ferronnerie|soudure|chaudronnerie|cordonnerie|maroquinerie|poterie|ceramique|vannerie|bijouterie|perlage|broderie|batik|teinture|climatiseur|videosurveillance|interphone|domotique|groupe electrogene|electromenager|pompe a eau)/.test(normalized)) {
    return SUBJECT_CATEGORIES.technical;
  }
  if (/(autre|besoin specifique|adulte|universit|professionnel|technique|metier|specialise)/.test(normalized)) {
    return SUBJECT_CATEGORIES.openNeeds;
  }
  return SUBJECT_CATEGORIES.school;
}

export function getLevelCategory(name: string, order = 0): CatalogCategory {
  const normalized = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  if (/(concours)/.test(normalized)) {
    return LEVEL_CATEGORIES.contests;
  }
  if (/(universite|bts|licence|master|doctorat|superieur)/.test(normalized) || (order >= 17 && order <= 20)) {
    return LEVEL_CATEGORIES.higher;
  }
  if (/(adulte|formation|alphabetisation|professionnel)/.test(normalized)) {
    return LEVEL_CATEGORIES.adults;
  }
  if (/(test|toeic|toefl|ielts|cambridge)/.test(normalized)) {
    return LEVEL_CATEGORIES.international;
  }
  if (/(cepe|bepc|bac)/.test(normalized)) {
    return LEVEL_CATEGORIES.exams;
  }
  return LEVEL_CATEGORIES.school;
}

export function groupByCatalogCategory<T>(
  items: T[],
  getCategory: (item: T) => CatalogCategory,
) {
  const groups = new Map<string, { category: CatalogCategory; items: T[] }>();
  for (const item of items) {
    const category = getCategory(item);
    const existing = groups.get(category.slug);
    if (existing) {
      existing.items.push(item);
    } else {
      groups.set(category.slug, { category, items: [item] });
    }
  }
  return Array.from(groups.values()).sort((a, b) => a.category.priority - b.category.priority || a.category.label.localeCompare(b.category.label));
}
