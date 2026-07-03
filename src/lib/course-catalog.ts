export type SchoolSystem = "ivoirien" | "francais" | "international" | "autre";

export type CourseCatalogItem = {
  id: string;
  nom: string;
  categorie: string;
  sous_categorie: string;
  systeme_scolaire?: SchoolSystem;
  niveau?: string;
  matiere_ou_competence: string;
  prix_min: number;
  prix_max: number;
  public_cible: string;
  objectif: string;
  actif: boolean;
};

export const CLIENT_TYPES = [
  "Parent",
  "Élève",
  "Étudiant",
  "Professionnel",
  "Entreprise",
] as const;

export const COURSE_CATEGORIES = [
  { code: "soutien_scolaire", label: "Soutien scolaire", publicCible: "Parents d'élèves, élèves" },
  { code: "preparation_examens", label: "Préparation aux examens", publicCible: "CEPE, BEPC, BAC, Brevet, concours" },
  { code: "enseignement_superieur", label: "Enseignement supérieur", publicCible: "Étudiants BTS, Licence, Master" },
  { code: "formation_professionnelle", label: "Formation professionnelle", publicCible: "Adultes, salariés, entrepreneurs" },
  { code: "apprentissage_metier", label: "Apprentissage métier", publicCible: "Jeunes, adultes, reconversion" },
  { code: "langues_communication", label: "Langues et communication", publicCible: "Élèves, étudiants, professionnels" },
  { code: "formation_entreprise", label: "Formation pour entreprise", publicCible: "PME, équipes, organisations" },
] as const;

export const SCHOOL_SYSTEMS: { value: SchoolSystem; label: string }[] = [
  { value: "ivoirien", label: "Système ivoirien" },
  { value: "francais", label: "Système français" },
  { value: "international", label: "Système international" },
  { value: "autre", label: "Autre programme" },
];

export const LYCEE_LEVEL_OPTIONS: Record<SchoolSystem, string[]> = {
  ivoirien: [
    "2nde A", "2nde C", "1ère A", "1ère C", "1ère D", "1ère E",
    "Terminale A1", "Terminale A2", "Terminale C", "Terminale D", "Terminale E", "Autre série",
  ],
  francais: [
    "Seconde", "Première générale", "Terminale générale", "Première technologique", "Terminale technologique",
  ],
  international: ["Seconde internationale", "Première internationale", "Terminale internationale", "Programme autre"],
  autre: ["Niveau lycée autre", "Programme spécialisé", "À préciser avec l'administration"],
};

export const FRENCH_LYCEE_SPECIALTIES = [
  "Mathématiques",
  "Physique-Chimie",
  "SVT",
  "SES",
  "HGGSP",
  "HLP",
  "LLCE Anglais",
  "NSI",
  "Sciences de l'ingénieur",
  "Français",
  "Philosophie",
  "Grand oral",
  "Bac français",
  "Enseignement scientifique",
] as const;

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function course({
  categorie,
  sous_categorie,
  matiere,
  prix,
  publicCible,
  objectif,
  niveau,
  systeme,
}: {
  categorie: string;
  sous_categorie: string;
  matiere: string;
  prix: [number, number];
  publicCible: string;
  objectif: string;
  niveau?: string;
  systeme?: SchoolSystem;
}): CourseCatalogItem {
  const nom = niveau ? `${matiere} - ${niveau}` : matiere;
  const idParts = [categorie, sous_categorie, systeme, niveau, matiere].filter(Boolean).join("-");
  return {
    id: slugify(idParts),
    nom,
    categorie,
    sous_categorie,
    systeme_scolaire: systeme,
    niveau,
    matiere_ou_competence: matiere,
    prix_min: prix[0],
    prix_max: prix[1],
    public_cible: publicCible,
    objectif,
    actif: true,
  };
}

function coursesForLevels(config: {
  categorie: string;
  sous_categorie: string;
  systeme?: SchoolSystem;
  niveaux: string[];
  matieres: string[];
  prix: [number, number];
  publicCible: string;
  objectif: string;
}) {
  return config.niveaux.flatMap((niveau) => (
    config.matieres.map((matiere) => course({ ...config, niveau, matiere }))
  ));
}

const primaryIvorianSubjects = [
  "Français", "Lecture", "Dictée", "Grammaire", "Conjugaison", "Vocabulaire", "Expression écrite",
  "Mathématiques", "Calcul", "Problèmes", "Géométrie", "Mesures", "Éveil scientifique",
  "Histoire-Géographie", "Anglais", "EDHC", "Méthodologie", "Préparation CEPE",
];

const collegeIvorianSubjects = [
  "Mathématiques", "Physique-Chimie", "SVT", "Français", "Grammaire", "Expression écrite",
  "Anglais", "Espagnol", "Allemand", "Histoire-Géographie", "EDHC", "TICE", "Préparation BEPC",
];

const lyceeIvorianSubjects = [
  "Mathématiques", "Physique-Chimie", "SVT", "Français", "Philosophie", "Littérature",
  "Anglais", "Espagnol", "Allemand", "Histoire-Géographie", "EDHC", "TICE",
  "Comptabilité", "Économie", "Droit", "Gestion", "Informatique", "Électricité", "Mécanique",
  "Dessin technique", "Préparation BAC A", "Préparation BAC C", "Préparation BAC D", "Préparation BAC E",
  "Préparation BAC technique",
];

type CourseDomain = {
  sous_categorie: string;
  prix: [number, number];
  matieres: string[];
  publicCible?: string;
  objectif?: string;
};

const professionalDomains: CourseDomain[] = [
  {
    sous_categorie: "bureautique_productivite",
    prix: [10000, 20000] as [number, number],
    matieres: [
      "Initiation informatique", "Utilisation ordinateur", "Microsoft Word", "Microsoft Excel débutant",
      "Microsoft Excel intermédiaire", "Microsoft Excel avancé", "Excel pour comptabilité",
      "Excel pour gestion de stock", "PowerPoint professionnel", "Outlook / Gmail professionnel",
      "Google Docs", "Google Sheets", "Google Drive", "Notion", "Trello", "Saisie professionnelle",
    ],
  },
  {
    sous_categorie: "data_excel_bi",
    prix: [15000, 20000] as [number, number],
    matieres: [
      "Tableaux croisés dynamiques", "Formules Excel", "Power Query", "Power Pivot",
      "Tableaux de bord Excel", "Power BI", "Google Looker Studio", "Analyse de données",
      "Statistiques appliquées", "Python pour data analyse", "SQL débutant", "SQL avancé",
      "Reporting professionnel",
    ],
  },
  {
    sous_categorie: "informatique_developpement",
    prix: [15000, 20000] as [number, number],
    matieres: [
      "HTML", "CSS", "JavaScript", "React", "Node.js", "Python", "PHP", "Laravel", "WordPress",
      "Création site web", "Création application web", "Création application mobile",
      "Base de données SQL", "Git / GitHub", "Déploiement web", "Maintenance informatique",
      "Réseaux informatiques", "Administration système",
    ],
  },
  {
    sous_categorie: "cybersecurite_reseaux_cloud",
    prix: [15000, 20000] as [number, number],
    matieres: [
      "Initiation cybersécurité", "Sécurité des comptes", "Sécurité des entreprises",
      "Réseaux informatiques", "Configuration routeur", "Support informatique", "Linux débutant",
      "Administration serveur", "Cloud computing", "AWS débutant", "Azure débutant",
      "Sauvegarde de données", "Protection des données",
    ],
  },
  {
    sous_categorie: "ia_automatisation",
    prix: [15000, 20000] as [number, number],
    matieres: [
      "ChatGPT pour professionnels", "IA pour entrepreneurs", "IA pour étudiants",
      "Prompt engineering", "Automatisation de tâches", "Création de contenu avec IA",
      "IA pour marketing", "IA pour bureautique", "IA pour analyse de données", "No-code",
      "Zapier", "Make", "Notion AI", "Création de chatbot",
    ],
  },
  {
    sous_categorie: "marketing_vente_ecommerce",
    prix: [15000, 20000] as [number, number],
    matieres: [
      "Marketing digital débutant", "Community management", "Publicité Facebook",
      "Publicité Instagram", "Publicité TikTok", "Publicité Google", "WhatsApp Business",
      "Création boutique en ligne", "E-commerce", "Shopify", "WooCommerce",
      "Prospection commerciale", "Techniques de vente", "Négociation", "Copywriting",
      "Création de contenu", "Stratégie réseaux sociaux", "Service client", "CRM",
    ],
  },
  {
    sous_categorie: "comptabilite_finance_gestion",
    prix: [15000, 20000] as [number, number],
    matieres: [
      "Comptabilité générale", "Comptabilité analytique", "Fiscalité", "Déclaration fiscale",
      "Paie", "Gestion de trésorerie", "Analyse financière", "Budget prévisionnel",
      "Contrôle de gestion", "Sage / SAARI", "Ciel Compta", "Gestion de caisse",
      "Gestion de stock", "Finance personnelle", "Finance pour entrepreneur",
    ],
  },
  {
    sous_categorie: "entrepreneuriat_pme",
    prix: [15000, 20000] as [number, number],
    matieres: [
      "Créer son entreprise", "Business plan", "Business model", "Étude de marché",
      "Fixation des prix", "Gestion des charges", "Gestion commerciale", "Relation client",
      "Organisation PME", "Pitch projet", "Formalisation d'activité", "Stratégie de croissance",
    ],
  },
  {
    sous_categorie: "artisanat_metiers_ivoiriens",
    prix: [12500, 20000] as [number, number],
    matieres: [
      "Structuration d'activité artisanale", "Gestion atelier artisanal", "Calcul de coût de revient artisanal",
      "Vente WhatsApp pour artisan", "Catalogue produits artisanaux", "Packaging produit local",
      "Qualité finition artisanale", "Relation client artisan", "Formalisation activité artisanale",
      "Approvisionnement matières premières", "Gestion commande sur mesure", "Prix et marge artisanale",
    ],
  },
  {
    sous_categorie: "secretariat_administration_pme",
    prix: [12500, 20000] as [number, number],
    matieres: [
      "Secrétariat bureautique", "Assistant administratif", "Classement administratif",
      "Rédaction courrier administratif", "Gestion agenda professionnel", "Accueil physique et téléphonique",
      "Archivage numérique", "Procédures administratives PME", "Suivi facture client",
      "Suivi caisse simple", "Compte rendu réunion", "Organisation bureau",
    ],
  },
  {
    sous_categorie: "genie_civil_btp_operationnel",
    prix: [15000, 20000] as [number, number],
    matieres: [
      "Maîtrise d'ouvrage et chantier", "Organisation chantier BTP", "Planning chantier",
      "Métré bâtiment avancé", "Devis quantitatif estimatif", "Étude de prix bâtiment",
      "Contrôle qualité béton", "Ferraillage bâtiment", "Coffrage bâtiment",
      "VRD initiation", "Assainissement bâtiment", "Implantation chantier",
      "Réception travaux", "Suivi sous-traitants", "Sécurité chantier BTP",
    ],
  },
  {
    sous_categorie: "art_design_creation_ivoirienne",
    prix: [12500, 20000] as [number, number],
    matieres: [
      "Art design", "Direction artistique", "Identité visuelle PME", "Design textile", "Motifs pagne et textile",
      "Sérigraphie", "Impression numérique", "Décoration intérieure", "Scénographie événementielle",
      "Architecture intérieure initiation", "Merchandising boutique", "Création visuels réseaux sociaux",
      "Portfolio créatif", "Branding pour marque locale",
    ],
  },
  {
    sous_categorie: "design_video_creation",
    prix: [12500, 20000] as [number, number],
    matieres: [
      "Canva", "Photoshop", "Illustrator", "InDesign", "Design graphique", "Création logo",
      "Création affiche", "Montage vidéo", "CapCut", "Premiere Pro", "After Effects",
      "Photographie", "Retouche photo", "Création contenu TikTok", "Création contenu Instagram",
      "UX/UI design", "Figma", "Motion design", "Storytelling vidéo", "Prise de vue mobile",
      "Éclairage photo", "Direction photo", "Design éditorial", "Mise en page catalogue",
    ],
  },
  {
    sous_categorie: "btp_genie_civil_architecture",
    prix: [15000, 20000] as [number, number],
    matieres: [
      "Génie civil", "Architecture", "AutoCAD", "Revit", "SketchUp", "ArchiCAD", "Lecture de plan", "Dessin bâtiment",
      "Métré", "Devis bâtiment", "Suivi de chantier", "Topographie", "Béton armé",
      "Électricité bâtiment", "Plomberie bâtiment", "Sécurité chantier", "Coffrage",
      "Ferraillage", "Maçonnerie", "Gros œuvre", "Second œuvre", "Conduite de travaux",
      "Carrelage", "Peinture bâtiment", "Étanchéité",
      "Faux plafond", "Pose pavés", "Charpente", "VRD", "Assainissement",
    ],
  },
  {
    sous_categorie: "electricite_maintenance_energie",
    prix: [15000, 20000] as [number, number],
    matieres: [
      "Installation électrique", "Lecture schéma électrique", "Maintenance électrique",
      "Froid et climatisation", "Installation climatiseur", "Maintenance climatiseur",
      "Énergie solaire", "Installation panneau solaire", "Maintenance industrielle",
      "Automatisme", "Mécanique industrielle", "Soudure industrielle", "Sécurité électrique",
    ],
  },
  {
    sous_categorie: "logistique_transport_achat",
    prix: [15000, 20000] as [number, number],
    matieres: [
      "Gestion de stock", "Magasinage", "Approvisionnement", "Achat", "Transport",
      "Transit", "Douane débutant", "Supply chain", "Incoterms", "Gestion entrepôt",
      "Suivi livraison", "Tableaux de bord logistique", "Excel pour logistique",
    ],
  },
  {
    sous_categorie: "hotellerie_restauration_evenementiel",
    prix: [12500, 20000] as [number, number],
    matieres: [
      "Cuisine", "Pâtisserie", "Cuisine africaine", "Hygiène alimentaire", "Service en salle",
      "Accueil hôtelier", "Réception", "Organisation événement", "Décoration événementielle",
      "Gestion restaurant", "Service client restauration",
    ],
  },
  {
    sous_categorie: "beaute_mode_bien_etre",
    prix: [12500, 20000] as [number, number],
    matieres: [
      "Coiffure femme", "Coiffure homme", "Barber", "Maquillage", "Onglerie", "Esthétique",
      "Attache de foulard", "Couture", "Stylisme", "Modélisme", "Broderie", "Mode africaine",
      "Gestion salon de beauté",
    ],
  },
  {
    sous_categorie: "agrobusiness_transformation",
    prix: [12500, 20000] as [number, number],
    matieres: [
      "Transformation alimentaire", "Jus naturels", "Confitures", "Épices",
      "Conservation alimentaire", "Emballage", "Hygiène production",
      "Commercialisation produits alimentaires", "Gestion petite unité de production",
      "Élevage débutant", "Agriculture urbaine", "Business agricole",
    ],
  },
  {
    sous_categorie: "qhse_securite_hygiene",
    prix: [15000, 20000] as [number, number],
    matieres: [
      "Hygiène et sécurité", "Sécurité au travail", "Prévention incendie", "QHSE débutant",
      "Gestion risques", "Sécurité chantier", "Hygiène alimentaire",
      "Premiers secours avec formateur certifié",
    ],
  },
];

const apprenticeshipDomains: CourseDomain[] = [
  {
    sous_categorie: "artisanat_textile_mode",
    prix: [12500, 20000] as [number, number],
    matieres: [
      "Artisanat textile ivoirien", "Coupe et couture débutant", "Couture femme", "Couture homme", "Couture enfant",
      "Retouche vêtement", "Patronage", "Modélisme", "Stylisme africain",
      "Tenue traditionnelle ivoirienne", "Boubou et ensemble africain", "Chemise et pantalon",
      "Robe de cérémonie", "Broderie", "Perlage", "Pose accessoires textile",
      "Teinture textile", "Batik", "Customisation textile", "Sac en pagne",
      "Gestion atelier couture",
    ],
  },
  {
    sous_categorie: "artisanat_bois_metal_aluminium",
    prix: [12500, 20000] as [number, number],
    matieres: [
      "Menuiserie bois", "Fabrication meuble", "Pose meuble cuisine", "Vernissage bois",
      "Sculpture bois", "Pose porte et fenêtre", "Menuiserie aluminium", "Pose baie vitrée",
      "Ferronnerie", "Soudure à l'arc", "Soudure semi-automatique", "Chaudronnerie",
      "Fabrication grille métallique", "Portail métallique", "Lecture plan atelier",
      "Sécurité atelier soudure",
    ],
  },
  {
    sous_categorie: "artisanat_cuir_bijoux_deco",
    prix: [12500, 20000] as [number, number],
    matieres: [
      "Cordonnerie", "Réparation chaussure", "Fabrication sandales", "Maroquinerie",
      "Sac en cuir", "Ceinture artisanale", "Bijouterie artisanale", "Bijoux en perles",
      "Accessoires de mode", "Vannerie", "Poterie", "Céramique débutant",
      "Décoration artisanale", "Objet décoratif local", "Emballage cadeau premium",
      "Finition produit artisanal",
    ],
  },
  {
    sous_categorie: "btp_genie_civil_chantier",
    prix: [15000, 20000] as [number, number],
    matieres: [
      "Génie civil pratique", "Maçonnerie pratique", "Gros œuvre pratique", "Second œuvre pratique",
      "Coffrage pratique", "Ferraillage pratique", "Béton armé pratique",
      "Carrelage", "Pose faïence", "Pose pavés", "Peinture bâtiment", "Enduit et crépissage",
      "Faux plafond", "Étanchéité toiture", "Charpente légère", "Lecture de plan bâtiment",
      "Dessin bâtiment", "Métré pratique", "Devis bâtiment pratique", "Suivi de chantier",
      "Topographie pratique", "VRD pratique", "Assainissement domestique", "Sécurité chantier",
    ],
  },
  {
    sous_categorie: "installations_batiment_energie",
    prix: [15000, 20000] as [number, number],
    matieres: [
      "Installation électrique bâtiment", "Dépannage électrique", "Lecture schéma électrique",
      "Plomberie sanitaire", "Dépannage plomberie", "Pose chauffe-eau", "Froid et climatisation",
      "Installation climatiseur split", "Maintenance climatiseur", "Énergie solaire",
      "Installation panneau solaire", "Dimensionnement solaire simple", "Vidéosurveillance",
      "Interphone et contrôle accès", "Domotique initiation", "Maintenance pompe à eau",
    ],
  },
  {
    sous_categorie: "mecanique_maintenance_reparation",
    prix: [12500, 20000] as [number, number],
    matieres: [
      "Mécanique auto débutant", "Mécanique moto", "Diagnostic panne véhicule",
      "Entretien moteur", "Électricité auto", "Maintenance groupe électrogène",
      "Réparation smartphone", "Réparation ordinateur", "Maintenance informatique",
      "Électronique de base", "Dépannage électroménager", "Maintenance imprimante",
      "Installation réseau domestique", "Support technique client",
    ],
  },
  {
    sous_categorie: "art_design_creation_visuelle",
    prix: [12500, 20000] as [number, number],
    matieres: [
      "Dessin artistique", "Peinture décorative", "Arts plastiques", "Design graphique pratique",
      "Création logo", "Création affiche", "Sérigraphie pratique", "Impression numérique",
      "Photographie événementielle", "Montage vidéo mobile", "CapCut pratique",
      "Création contenu TikTok", "Création contenu Instagram", "Décoration intérieure",
      "Design textile pratique", "Figma débutant", "Portfolio créatif",
    ],
  },
  {
    sous_categorie: "beaute_bien_etre_services",
    prix: [12500, 20000] as [number, number],
    matieres: [
      "Coiffure femme", "Tresses africaines", "Pose perruque", "Locks et vanilles",
      "Coiffure homme", "Barber", "Maquillage professionnel", "Maquillage mariée",
      "Onglerie", "Pose faux ongles", "Soins visage", "Esthétique débutant",
      "Massage bien-être", "Attache de foulard", "Hygiène salon de beauté",
      "Gestion salon de beauté",
    ],
  },
  {
    sous_categorie: "cuisine_restauration_agro",
    prix: [12500, 20000] as [number, number],
    matieres: [
      "Cuisine ivoirienne", "Cuisine africaine", "Sauces ivoiriennes", "Attiéké et accompagnements",
      "Alloco et grillades", "Cuisine événementielle", "Pâtisserie", "Viennoiserie",
      "Cake design débutant", "Service en salle", "Traiteur", "Hygiène alimentaire",
      "Jus naturels", "Confitures", "Épices et marinades", "Conservation alimentaire",
      "Emballage produit alimentaire", "Gestion restaurant",
    ],
  },
  {
    sous_categorie: "agriculture_elevage_agrobusiness",
    prix: [12500, 20000] as [number, number],
    matieres: [
      "Maraîchage", "Pépinière", "Agriculture urbaine", "Compostage",
      "Élevage volaille", "Élevage lapin", "Pisciculture initiation", "Apiculture initiation",
      "Transformation manioc", "Transformation cacao", "Transformation cajou",
      "Conditionnement produit agricole", "Commercialisation produits agricoles",
      "Business agricole", "Gestion petite unité agrobusiness",
    ],
  },
  {
    sous_categorie: "commerce_services_terrain",
    prix: [10000, 20000] as [number, number],
    matieres: [
      "Vente terrain", "Service client boutique", "Gestion point de vente", "Caisse boutique",
      "Inventaire stock", "Livraison et relation client", "WhatsApp Business pour commerce",
      "Merchandising boutique", "Négociation client", "Prospection locale",
      "Organisation petite activité", "Accueil professionnel",
    ],
  },
];

export const COURSE_CATALOG: CourseCatalogItem[] = [
  ...coursesForLevels({
    categorie: "soutien_scolaire",
    sous_categorie: "prescolaire",
    niveaux: ["Maternelle"],
    matieres: ["Pré-lecture", "Graphisme", "Langage oral", "Initiation aux chiffres", "Logique et éveil", "Anglais enfant", "Aide comportementale douce"],
    prix: [7500, 10000],
    publicCible: "Jeunes enfants et familles",
    objectif: "Éveil, préparation à l'école et routine d'apprentissage",
  }),
  ...coursesForLevels({
    categorie: "soutien_scolaire",
    sous_categorie: "primaire_ivoirien",
    systeme: "ivoirien",
    niveaux: ["CP1", "CP2", "CE1", "CE2", "CM1", "CM2", "Préparation CEPE"],
    matieres: primaryIvorianSubjects,
    prix: [7500, 10000],
    publicCible: "Élèves du primaire ivoirien",
    objectif: "Soutien scolaire, devoirs et préparation CEPE",
  }),
  ...coursesForLevels({
    categorie: "soutien_scolaire",
    sous_categorie: "primaire_francais",
    systeme: "francais",
    niveaux: ["CP", "CE1", "CE2", "CM1", "CM2"],
    matieres: ["Français", "Lecture", "Écriture", "Mathématiques", "Anglais", "Questionner le monde", "Histoire-Géographie", "Sciences", "Méthodologie", "Aide aux devoirs"],
    prix: [10000, 12500],
    publicCible: "Élèves du primaire français",
    objectif: "Soutien aligné au programme français",
  }),
  ...coursesForLevels({
    categorie: "soutien_scolaire",
    sous_categorie: "college_ivoirien",
    systeme: "ivoirien",
    niveaux: ["6e", "5e", "4e", "3e", "Préparation BEPC"],
    matieres: collegeIvorianSubjects,
    prix: [10000, 12500],
    publicCible: "Collégiens du système ivoirien",
    objectif: "Consolider les bases et préparer le BEPC",
  }),
  ...coursesForLevels({
    categorie: "soutien_scolaire",
    sous_categorie: "college_francais",
    systeme: "francais",
    niveaux: ["6e", "5e", "4e", "3e", "Préparation Brevet / DNB"],
    matieres: ["Mathématiques", "Français", "Histoire-Géographie", "Anglais", "Espagnol", "Allemand", "Physique-Chimie", "SVT", "Technologie", "Méthodologie", "Préparation Brevet"],
    prix: [12500, 15000],
    publicCible: "Collégiens du système français",
    objectif: "Soutien et préparation Brevet / DNB",
  }),
  ...coursesForLevels({
    categorie: "soutien_scolaire",
    sous_categorie: "lycee_ivoirien",
    systeme: "ivoirien",
    niveaux: LYCEE_LEVEL_OPTIONS.ivoirien,
    matieres: lyceeIvorianSubjects,
    prix: [12500, 20000],
    publicCible: "Lycéens du système ivoirien",
    objectif: "Soutien, spécialités et préparation BAC ivoirien",
  }),
  ...coursesForLevels({
    categorie: "soutien_scolaire",
    sous_categorie: "lycee_francais",
    systeme: "francais",
    niveaux: LYCEE_LEVEL_OPTIONS.francais,
    matieres: [...FRENCH_LYCEE_SPECIALTIES],
    prix: [15000, 20000],
    publicCible: "Lycéens du système français",
    objectif: "Soutien, spécialités et préparation BAC français",
  }),
  ...["CEPE", "Entrée en 6e", "BEPC", "Brevet / DNB", "BAC ivoirien", "BAC français", "Grand oral", "Concours CAFOP", "Concours fonction publique", "Concours INFS", "Concours police / gendarmerie / armée", "Concours administratifs", "TOEFL", "IELTS", "TOEIC", "Excel", "Bureautique", "Certification numérique"].map((matiere) => course({
    categorie: "preparation_examens",
    sous_categorie: "examens_concours",
    matiere,
    prix: [10000, 20000],
    publicCible: "Élèves, étudiants et adultes en préparation d'examen",
    objectif: "Révision structurée, entraînement et stratégie d'examen",
  })),
  ...coursesForLevels({
    categorie: "enseignement_superieur",
    sous_categorie: "superieur",
    niveaux: ["BTS 1", "BTS 2", "Licence 1", "Licence 2", "Licence 3", "Master 1", "Master 2", "Préparation mémoire", "Préparation soutenance"],
    matieres: ["Comptabilité", "Contrôle de gestion", "Fiscalité", "Audit", "Mathématiques financières", "Analyse financière", "Microéconomie", "Macroéconomie", "Statistiques", "Droit civil", "Droit commercial", "Droit du travail", "Marketing stratégique", "Marketing digital", "Gestion RH", "Paie", "Algorithmique", "Programmation", "Base de données", "Réseau", "Power BI", "Python", "Béton armé", "Topographie", "AutoCAD", "Électrotechnique", "Logistique", "Rapport de stage", "Mémoire", "Soutenance"],
    prix: [15000, 20000],
    publicCible: "Étudiants BTS, Licence et Master",
    objectif: "Réussite des modules, projets, mémoire et soutenance",
  }),
  ...professionalDomains.flatMap((domain) => domain.matieres.map((matiere) => course({
    categorie: "formation_professionnelle",
    sous_categorie: domain.sous_categorie,
    matiere,
    prix: domain.prix,
    publicCible: domain.publicCible ?? "Adultes, salariés, entrepreneurs et jeunes en reconversion",
    objectif: domain.objectif ?? "Compétence pratique applicable au travail, à l'entrepreneuriat ou à la reconversion",
  }))),
  ...apprenticeshipDomains.flatMap((domain) => domain.matieres.map((matiere) => course({
    categorie: "apprentissage_metier",
    sous_categorie: domain.sous_categorie,
    matiere,
    prix: domain.prix,
    publicCible: domain.publicCible ?? "Jeunes, adultes, artisans, entrepreneurs et personnes en reconversion",
    objectif: domain.objectif ?? "Apprentissage pratique encadré, orienté métier et application immédiate",
  }))),
  ...["Anglais débutant", "Anglais scolaire", "Anglais professionnel", "Anglais conversation", "Anglais business", "Anglais pour entretien d'embauche", "Anglais pour voyage", "Préparation TOEFL", "Préparation IELTS", "Préparation TOEIC", "Français professionnel", "Orthographe", "Expression écrite", "Prise de parole en public", "Communication orale", "Rédaction administrative", "Rédaction de CV", "Lettre de motivation", "Préparation entretien", "Espagnol", "Allemand", "Arabe", "Chinois", "Langues locales pour professionnels"].map((matiere) => course({
    categorie: "langues_communication",
    sous_categorie: "langues_communication",
    matiere,
    prix: [10000, 20000],
    publicCible: "Élèves, étudiants, travailleurs et entrepreneurs",
    objectif: "Expression, communication et certification linguistique",
  })),
  ...["Formation Excel équipe", "Formation vente équipe", "Formation service client", "Formation IA entreprise", "Formation sécurité numérique", "Formation bureautique entreprise", "Formation management équipe", "Formation communication professionnelle"].map((matiere) => course({
    categorie: "formation_entreprise",
    sous_categorie: "formations_equipes",
    matiere,
    prix: [20000, 50000],
    publicCible: "PME, équipes et organisations",
    objectif: "Montée en compétence d'équipe avec devis adapté",
  })),
];

export function getCourseCatalog() {
  return COURSE_CATALOG;
}

export function findCourseCatalogItem(id?: string | null) {
  if (!id) return null;
  return COURSE_CATALOG.find((item) => item.id === id) ?? null;
}

export function isLyceeLevel(levelName?: string | null) {
  if (!levelName) return false;
  const normalized = slugify(levelName);
  return /(lycee|seconde|premiere|terminale|bac)/.test(normalized);
}

export function getPreciseLevelOptions(system?: string | null) {
  const schoolSystem = isSchoolSystem(system) ? system : "autre";
  return LYCEE_LEVEL_OPTIONS[schoolSystem];
}

export function isSchoolSystem(value: unknown): value is SchoolSystem {
  return typeof value === "string" && SCHOOL_SYSTEMS.some((item) => item.value === value);
}

export function validateEducationSelection({
  levelName,
  schoolSystem,
  preciseLevel,
}: {
  levelName: string;
  schoolSystem?: string | null;
  preciseLevel?: string | null;
}) {
  if (!isLyceeLevel(levelName)) return { ok: true as const };
  if (!isSchoolSystem(schoolSystem)) {
    return { ok: false as const, error: "Pour le lycée, choisissez le système scolaire : ivoirien, français, international ou autre." };
  }
  const options = getPreciseLevelOptions(schoolSystem);
  if (!preciseLevel || !options.includes(preciseLevel)) {
    return { ok: false as const, error: "Pour le lycée, choisissez la classe ou série correspondant au système scolaire." };
  }
  return { ok: true as const };
}

export function buildSchoolProgramSummary({
  clientType,
  category,
  schoolSystem,
  preciseLevel,
  courseCatalogId,
  freeProgram,
}: {
  clientType?: string | null;
  category?: string | null;
  schoolSystem?: string | null;
  preciseLevel?: string | null;
  courseCatalogId?: string | null;
  freeProgram?: string | null;
}) {
  const courseItem = findCourseCatalogItem(courseCatalogId);
  const categoryLabel = COURSE_CATEGORIES.find((item) => item.code === category)?.label ?? category;
  const systemLabel = SCHOOL_SYSTEMS.find((item) => item.value === schoolSystem)?.label ?? schoolSystem;
  return [
    clientType ? `Type client: ${clientType}` : "",
    categoryLabel ? `Catégorie: ${categoryLabel}` : "",
    systemLabel ? `Système scolaire: ${systemLabel}` : "",
    preciseLevel ? `Classe / niveau précis: ${preciseLevel}` : "",
    courseItem ? `Cours catalogue: ${courseItem.nom}` : "",
    freeProgram ? `Programme / précision: ${freeProgram}` : "",
  ].filter(Boolean).join(" | ");
}
