import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { OPEN_SUBJECT_PRESETS } from "../src/lib/open-subject-catalog";
import { normalizeTeacherPhone } from "../src/lib/teacher-portal";

const prisma = new PrismaClient();

const SUBJECTS = [
  { name: "Aide aux devoirs", slug: "aide-aux-devoirs", icon: "BookOpen" },
  { name: "Algèbre", slug: "algebre", icon: "Calculator" },
  { name: "Allemand", slug: "allemand", icon: "Languages" },
  { name: "Analyse mathématique", slug: "analyse-mathematique", icon: "Calculator" },
  { name: "Mathématiques", slug: "mathematiques", icon: "Calculator" },
  { name: "Français", slug: "francais", icon: "BookOpen" },
  { name: "Anglais", slug: "anglais", icon: "Languages" },
  { name: "Anglais professionnel", slug: "anglais-professionnel", icon: "BriefcaseBusiness" },
  { name: "Arabe", slug: "arabe", icon: "Languages" },
  { name: "Architecture", slug: "architecture", icon: "DraftingCompass" },
  { name: "Arts plastiques", slug: "arts-plastiques", icon: "Palette" },
  { name: "Bases de données", slug: "bases-de-donnees", icon: "Database" },
  { name: "Bureautique", slug: "bureautique", icon: "Laptop" },
  { name: "Chant", slug: "chant", icon: "Music" },
  { name: "Coiffure", slug: "coiffure", icon: "Scissors" },
  { name: "Communication", slug: "communication", icon: "Megaphone" },
  { name: "Couture", slug: "couture", icon: "Scissors" },
  { name: "Cuisine", slug: "cuisine", icon: "CookingPot" },
  { name: "Culture générale", slug: "culture-generale", icon: "Brain" },
  { name: "Cybersécurité", slug: "cybersecurite", icon: "ShieldCheck" },
  { name: "Data analyse", slug: "data-analyse", icon: "BarChart3" },
  { name: "Développement web", slug: "developpement-web", icon: "Code2" },
  { name: "Design graphique", slug: "design-graphique", icon: "Palette" },
  { name: "Dessin technique", slug: "dessin-technique", icon: "DraftingCompass" },
  { name: "Droit", slug: "droit", icon: "Scale" },
  { name: "Électronique", slug: "electronique", icon: "Cpu" },
  { name: "Entrepreneuriat", slug: "entrepreneuriat", icon: "BriefcaseBusiness" },
  { name: "Espagnol", slug: "espagnol", icon: "Languages" },
  { name: "Physique-Chimie", slug: "physique-chimie", icon: "Atom" },
  { name: "SVT", slug: "svt", icon: "Leaf" },
  { name: "Philosophie", slug: "philosophie", icon: "Brain" },
  { name: "Histoire-Géographie", slug: "histoire-geographie", icon: "Globe" },
  { name: "Informatique", slug: "informatique", icon: "Laptop" },
  { name: "Intelligence artificielle", slug: "intelligence-artificielle", icon: "Bot" },
  { name: "Finance", slug: "finance", icon: "Wallet" },
  { name: "Fiscalité", slug: "fiscalite", icon: "ReceiptText" },
  { name: "Gestion", slug: "gestion", icon: "BriefcaseBusiness" },
  { name: "Gestion de projet", slug: "gestion-de-projet", icon: "ClipboardList" },
  { name: "Guitare", slug: "guitare", icon: "Music" },
  { name: "Comptabilité", slug: "comptabilite", icon: "Coins" },
  { name: "Économie", slug: "economie", icon: "TrendingUp" },
  { name: "Lecture et écriture", slug: "lecture-ecriture", icon: "BookOpen" },
  { name: "Logistique", slug: "logistique", icon: "Truck" },
  { name: "Mandarin", slug: "mandarin", icon: "Languages" },
  { name: "Marketing digital", slug: "marketing-digital", icon: "Megaphone" },
  { name: "Mécanique", slug: "mecanique", icon: "Wrench" },
  { name: "Méthodologie", slug: "methodologie", icon: "ClipboardList" },
  { name: "Montage vidéo", slug: "montage-video", icon: "Video" },
  { name: "Photographie", slug: "photographie", icon: "Camera" },
  { name: "Piano", slug: "piano", icon: "Music" },
  { name: "Préparation concours", slug: "preparation-concours", icon: "BadgeCheck" },
  { name: "Probabilités", slug: "probabilites", icon: "Calculator" },
  { name: "Programmation", slug: "programmation", icon: "Code2" },
  { name: "Réseaux informatiques", slug: "reseaux-informatiques", icon: "Network" },
  { name: "Ressources humaines", slug: "ressources-humaines", icon: "Users" },
  { name: "Statistiques", slug: "statistiques", icon: "BarChart3" },
  { name: "Tests psychotechniques", slug: "tests-psychotechniques", icon: "Brain" },
  { name: "TOEIC / TOEFL", slug: "toeic-toefl", icon: "Languages" },
  { name: "Autre matière / besoin spécifique", slug: "autre-matiere", icon: "PlusCircle" },
  ...OPEN_SUBJECT_PRESETS,
];

const UNIQUE_SUBJECTS = SUBJECTS.filter((subject, index, subjects) => (
  subjects.findIndex((candidate) => candidate.name === subject.name || candidate.slug === subject.slug) === index
));

const LEVELS = [
  { name: "Maternelle", slug: "maternelle", order: 1 },
  { name: "CP - CE1", slug: "cp-ce1", order: 2 },
  { name: "CE2 - CM2", slug: "ce2-cm2", order: 3 },
  { name: "Primaire", slug: "primaire", order: 4 },
  { name: "CEPE", slug: "cepe", order: 5 },
  { name: "Collège", slug: "college", order: 6 },
  { name: "6e", slug: "6e", order: 7 },
  { name: "5e", slug: "5e", order: 8 },
  { name: "4e", slug: "4e", order: 9 },
  { name: "3e", slug: "3e", order: 10 },
  { name: "BEPC", slug: "bepc", order: 11 },
  { name: "Lycée", slug: "lycee", order: 12 },
  { name: "Seconde", slug: "seconde", order: 13 },
  { name: "Première", slug: "premiere", order: 14 },
  { name: "Terminale", slug: "terminale", order: 15 },
  { name: "BAC", slug: "bac", order: 16 },
  { name: "BTS", slug: "bts", order: 17 },
  { name: "Licence", slug: "licence", order: 18 },
  { name: "Master", slug: "master", order: 19 },
  { name: "Université", slug: "universite", order: 20 },
  { name: "Formation professionnelle", slug: "formation-professionnelle", order: 21 },
  { name: "Adultes", slug: "adultes", order: 22 },
  { name: "Alphabétisation", slug: "alphabetisation", order: 23 },
  { name: "Concours", slug: "concours", order: 24 },
  { name: "Concours administratifs", slug: "concours-administratifs", order: 25 },
  { name: "Concours grandes écoles", slug: "concours-grandes-ecoles", order: 26 },
  { name: "Concours santé", slug: "concours-sante", order: 27 },
  { name: "Concours enseignants", slug: "concours-enseignants", order: 28 },
  { name: "Tests internationaux", slug: "tests-internationaux", order: 29 },
];

const COMMUNES = [
  { name: "Abidjan", zone: "District Autonome d'Abidjan" },
  { name: "Cocody", zone: "Abidjan" },
  { name: "Angré", zone: "Abidjan" },
  { name: "Riviera", zone: "Abidjan" },
  { name: "Deux Plateaux", zone: "Abidjan" },
  { name: "Bingerville", zone: "Abidjan" },
  { name: "Yopougon", zone: "Abidjan" },
  { name: "Abobo", zone: "Abidjan" },
  { name: "Anyama", zone: "Abidjan" },
  { name: "Marcory", zone: "Abidjan" },
  { name: "Koumassi", zone: "Abidjan" },
  { name: "Treichville", zone: "Abidjan" },
  { name: "Plateau", zone: "Abidjan" },
  { name: "Port-Bouët", zone: "Abidjan" },
  { name: "Adjamé", zone: "Abidjan" },
  { name: "Attécoubé", zone: "Abidjan" },
  { name: "Songon", zone: "Abidjan" },
  { name: "Grand-Bassam", zone: "Sud-Comoé" },
  { name: "Bonoua", zone: "Sud-Comoé" },
  { name: "Aboisso", zone: "Sud-Comoé" },
  { name: "Adiaké", zone: "Sud-Comoé" },
  { name: "Tiapoum", zone: "Sud-Comoé" },
  { name: "Noé", zone: "Sud-Comoé" },
  { name: "Dabou", zone: "Grands-Ponts" },
  { name: "Jacqueville", zone: "Grands-Ponts" },
  { name: "Grand-Lahou", zone: "Grands-Ponts" },
  { name: "Alépé", zone: "La Mé" },
  { name: "Adzopé", zone: "La Mé" },
  { name: "Akoupé", zone: "La Mé" },
  { name: "Afféry", zone: "La Mé" },
  { name: "Yakassé-Attobrou", zone: "La Mé" },
  { name: "Agboville", zone: "Agnéby-Tiassa" },
  { name: "Azaguié", zone: "Agnéby-Tiassa" },
  { name: "Tiassalé", zone: "Agnéby-Tiassa" },
  { name: "Sikensi", zone: "Agnéby-Tiassa" },
  { name: "Abengourou", zone: "Indénié-Djuablin" },
  { name: "Agnibilékrou", zone: "Indénié-Djuablin" },
  { name: "Niablé", zone: "Indénié-Djuablin" },
  { name: "Bettié", zone: "Indénié-Djuablin" },
  { name: "Bondoukou", zone: "Gontougo" },
  { name: "Tanda", zone: "Gontougo" },
  { name: "Koun-Fao", zone: "Gontougo" },
  { name: "Bouna", zone: "Bounkani" },
  { name: "Doropo", zone: "Bounkani" },
  { name: "Nassian", zone: "Bounkani" },
  { name: "Bouaké", zone: "Gbêkê" },
  { name: "Béoumi", zone: "Gbêkê" },
  { name: "Sakassou", zone: "Gbêkê" },
  { name: "Botro", zone: "Gbêkê" },
  { name: "Katiola", zone: "Hambol" },
  { name: "Dabakala", zone: "Hambol" },
  { name: "Niakaramadougou", zone: "Hambol" },
  { name: "Yamoussoukro", zone: "District Autonome de Yamoussoukro" },
  { name: "Attiégouakro", zone: "District Autonome de Yamoussoukro" },
  { name: "Toumodi", zone: "Bélier" },
  { name: "Tiébissou", zone: "Bélier" },
  { name: "Dimbokro", zone: "N'Zi" },
  { name: "Bocanda", zone: "N'Zi" },
  { name: "Daoukro", zone: "Iffou" },
  { name: "M'Bahiakro", zone: "Iffou" },
  { name: "Prikro", zone: "Iffou" },
  { name: "Daloa", zone: "Haut-Sassandra" },
  { name: "Vavoua", zone: "Haut-Sassandra" },
  { name: "Issia", zone: "Haut-Sassandra" },
  { name: "Zoukougbeu", zone: "Haut-Sassandra" },
  { name: "Gagnoa", zone: "Gôh" },
  { name: "Oumé", zone: "Gôh" },
  { name: "Sinfra", zone: "Marahoué" },
  { name: "Bouaflé", zone: "Marahoué" },
  { name: "Zuénoula", zone: "Marahoué" },
  { name: "San-Pédro", zone: "San-Pédro" },
  { name: "Sassandra", zone: "Gbôklè" },
  { name: "Tabou", zone: "San-Pédro" },
  { name: "Grand-Béréby", zone: "San-Pédro" },
  { name: "Soubré", zone: "Nawa" },
  { name: "Méagui", zone: "Nawa" },
  { name: "Buyo", zone: "Nawa" },
  { name: "Divo", zone: "Lôh-Djiboua" },
  { name: "Lakota", zone: "Lôh-Djiboua" },
  { name: "Guitry", zone: "Lôh-Djiboua" },
  { name: "Fresco", zone: "Gbôklè" },
  { name: "Korhogo", zone: "Poro" },
  { name: "Sinématiali", zone: "Poro" },
  { name: "Ferkessédougou", zone: "Tchologo" },
  { name: "Ouangolodougou", zone: "Tchologo" },
  { name: "Boundiali", zone: "Bagoué" },
  { name: "Tengréla", zone: "Bagoué" },
  { name: "Odienné", zone: "Kabadougou" },
  { name: "Madinani", zone: "Kabadougou" },
  { name: "Minignan", zone: "Folon" },
  { name: "Touba", zone: "Bafing" },
  { name: "Mankono", zone: "Béré" },
  { name: "Séguéla", zone: "Worodougou" },
  { name: "Kani", zone: "Worodougou" },
  { name: "Man", zone: "Tonkpi" },
  { name: "Danané", zone: "Tonkpi" },
  { name: "Biankouma", zone: "Tonkpi" },
  { name: "Zouan-Hounien", zone: "Tonkpi" },
  { name: "Guiglo", zone: "Cavally" },
  { name: "Duékoué", zone: "Guémon" },
  { name: "Bangolo", zone: "Guémon" },
  { name: "Toulépleu", zone: "Cavally" },
  { name: "Bloléquin", zone: "Cavally" },
];

const AVAILABILITY = JSON.stringify({
  mon: { "08-10": false, "10-12": false, "12-14": true, "14-16": true, "16-18": true, "18-20": true, "20-22": false },
  tue: { "08-10": false, "10-12": true, "12-14": true, "14-16": false, "16-18": true, "18-20": true, "20-22": false },
  wed: { "08-10": false, "10-12": false, "12-14": true, "14-16": true, "16-18": true, "18-20": false, "20-22": false },
  thu: { "08-10": false, "10-12": true, "12-14": false, "14-16": true, "16-18": true, "18-20": true, "20-22": false },
  fri: { "08-10": false, "10-12": false, "12-14": true, "14-16": true, "16-18": true, "18-20": true, "20-22": false },
  sat: { "08-10": true, "10-12": true, "12-14": true, "14-16": true, "16-18": false, "18-20": false, "20-22": false },
  sun: { "08-10": true, "10-12": true, "12-14": true, "14-16": false, "16-18": false, "18-20": false, "20-22": false },
});

const TEACHERS = [
  // === 5 professeurs demandés dans le cahier des charges ===
  {
    fullName: "Kouamé Jean",
    professionalName: "M. Kouamé",
    photoUrl: "/images/teachers/kouame-jean.webp",
    jobTitle: "Professeur de Mathématiques",
    bio: "Professeur de mathématiques certifié, 12 ans d'expérience dans l'enseignement secondaire et supérieur. Spécialiste de la préparation au BAC séries C et D. Méthode pédagogique interactive orientée pratique et exercices types du programme ivoirien.",
    phone: "+225 07 01 02 03 04",
    email: "kouame.jean@monprof.ci",
    commune: "Cocody",
    quartier: "Riviera Palmeraie",
    experienceYears: 12,
    diploma: "Master Mathématiques - Université Félix Houphouët-Boigny",
    profileType: "ENSEIGNANT",
    subjects: [
      { name: "Mathématiques", primary: true },
      { name: "Physique-Chimie", primary: false },
      { name: "Algèbre", primary: false },
      { name: "Analyse mathématique", primary: false },
      { name: "Statistiques", primary: false },
      { name: "Probabilités", primary: false },
      { name: "Préparation concours", primary: false },
    ],
    levels: ["Lycée", "Seconde", "Première", "Terminale", "BAC", "BTS", "Licence", "Université", "Concours", "Concours grandes écoles"],
    zones: ["Cocody", "Riviera", "Deux Plateaux", "Angré"],
    pricePerHour: 15000,
    pricePerSession: 15000,
    pricePack4: 57000,
    pricePack8: 108000,
    commissionRate: 20,
    rating: 4.9,
    ratingCount: 47,
    badgeRecommended: true,
    badgePopular: true,
    featured: true,
    pricingTier: "PREMIUM",
  },
  {
    fullName: "Traoré Aïcha",
    professionalName: "Mme Traoré",
    photoUrl: "/images/teachers/traore-aicha.webp",
    jobTitle: "Professeure de Français",
    bio: "Agrégée de lettres modernes, j'accompagne les élèves du collège au lycée en français, expression écrite et orale. Spécialiste de la préparation au BEPC et au BAC série A. Pédagogie bienveillante et structurée.",
    phone: "+225 05 11 22 33 44",
    email: "traore.aicha@monprof.ci",
    commune: "Yopougon",
    quartier: "Selmer",
    experienceYears: 8,
    diploma: "Agrégation Lettres Modernes",
    profileType: "ENSEIGNANT",
    subjects: [
      { name: "Français", primary: true },
      { name: "Philosophie", primary: false },
      { name: "Méthodologie", primary: false },
      { name: "Communication", primary: false },
      { name: "Lecture et écriture", primary: false },
      { name: "Culture générale", primary: false },
    ],
    levels: ["Collège", "3e", "Lycée", "Première", "Terminale", "BEPC", "BAC", "Adultes", "Concours administratifs"],
    zones: ["Yopougon", "Abobo", "Marcory"],
    pricePerHour: 10000,
    pricePerSession: 10000,
    pricePack4: 38000,
    pricePack8: 72000,
    commissionRate: 20,
    rating: 4.8,
    ratingCount: 32,
    badgeRecommended: true,
    featured: true,
    pricingTier: "RECOMMENDED",
  },
  {
    fullName: "Koné Ibrahim",
    professionalName: "M. Koné",
    photoUrl: "/images/teachers/kone-ibrahim.webp",
    jobTitle: "Professeur de Physique-Chimie",
    bio: "Docteur en chimie, j'enseigne la physique-chimie du lycée à l'université. Préparation BAC séries C, D, E et concours d'entrée en école d'ingénieur. Approche méthodique avec focus sur les exercices type et la compréhension des concepts.",
    phone: "+225 01 23 45 67 89",
    email: "kone.ibrahim@monprof.ci",
    commune: "Angré",
    quartier: "8e Tranche",
    experienceYears: 10,
    diploma: "Doctorat Chimie - Université Nangui Abrogoua",
    profileType: "ENSEIGNANT",
    subjects: [
      { name: "Physique-Chimie", primary: true },
      { name: "Mathématiques", primary: false },
      { name: "Électronique", primary: false },
      { name: "Mécanique", primary: false },
      { name: "Préparation concours", primary: false },
    ],
    levels: ["Lycée", "Première", "Terminale", "BAC", "BTS", "Licence", "Université", "Concours", "Concours grandes écoles"],
    zones: ["Angré", "Cocody", "Riviera"],
    pricePerHour: 15000,
    pricePerSession: 15000,
    pricePack4: 57000,
    pricePack8: 108000,
    commissionRate: 20,
    rating: 4.7,
    ratingCount: 28,
    badgePopular: true,
    pricingTier: "RECOMMENDED",
  },
  {
    fullName: "Diabaté Sarah",
    professionalName: "Mme Diabaté",
    photoUrl: "/images/teachers/diabate-sarah.webp",
    jobTitle: "Professeure d'Anglais",
    bio: "Bilingue anglais-français, j'enseigne l'anglais du primaire à l'université. Spécialiste de l'anglais scolaire, de la conversation et de la préparation aux examens. Cours à domicile et en ligne, pédagogie ludique pour les plus jeunes.",
    phone: "+225 07 88 99 00 11",
    email: "diabate.sarah@monprof.ci",
    commune: "Marcory",
    quartier: "Zone 4",
    experienceYears: 6,
    diploma: "Master Anglais - Université Alassane Ouattara",
    profileType: "ENSEIGNANT",
    subjects: [
      { name: "Anglais", primary: true },
      { name: "Anglais professionnel", primary: false },
      { name: "TOEIC / TOEFL", primary: false },
      { name: "Communication", primary: false },
    ],
    levels: ["Primaire", "Collège", "CEPE", "BEPC", "Lycée", "Université", "Adultes", "Tests internationaux"],
    zones: ["Marcory", "Koumassi", "Treichville", "Plateau"],
    pricePerHour: 10000,
    pricePerSession: 10000,
    pricePack4: 38000,
    pricePack8: 72000,
    commissionRate: 20,
    rating: 5.0,
    ratingCount: 19,
    badgeRecommended: true,
    featured: true,
    pricingTier: "RECOMMENDED",
  },
  {
    fullName: "N'Guessan Paul",
    professionalName: "M. N'Guessan",
    photoUrl: "/images/teachers/nguessan-paul.webp",
    jobTitle: "Professeur d'Informatique",
    bio: "Ingénieur informatique senior, j'enseigne la programmation (Python, JavaScript, Java), la bureautique, les bases de données et prépare aux concours d'écoles informatiques. J'accompagne aussi les adultes en reconversion professionnelle.",
    phone: "+225 05 66 77 88 99",
    email: "nguessan.paul@monprof.ci",
    commune: "Cocody",
    quartier: "Deux Plateaux",
    experienceYears: 9,
    diploma: "Diplôme d'Ingénieur Informatique - INPHB Yamoussoukro",
    profileType: "PROFESSIONNEL",
    subjects: [
      { name: "Informatique", primary: true },
      { name: "Programmation", primary: false },
      { name: "Développement web", primary: false },
      { name: "Bureautique", primary: false },
      { name: "Bases de données", primary: false },
      { name: "Data analyse", primary: false },
      { name: "Intelligence artificielle", primary: false },
      { name: "Cybersécurité", primary: false },
      { name: "Réseaux informatiques", primary: false },
      { name: "Mathématiques", primary: false },
    ],
    levels: ["Lycée", "BTS", "Licence", "Master", "Université", "Formation professionnelle", "Adultes", "Concours"],
    zones: ["Cocody", "Deux Plateaux", "Riviera", "Plateau"],
    pricePerHour: 20000,
    pricePerSession: 20000,
    pricePack4: 76000,
    pricePack8: 144000,
    commissionRate: 20,
    rating: 4.8,
    ratingCount: 24,
    badgeRecommended: true,
    badgePopular: true,
    featured: true,
    pricingTier: "PREMIUM",
  },
  // === Professeurs supplémentaires pour enrichir la démonstration ===
  {
    fullName: "Bamba Mariam",
    professionalName: "Mme Bamba",
    photoUrl: "/images/teachers/bamba-mariam.webp",
    jobTitle: "Professeure de SVT",
    bio: "Professeure de SVT, je prépare les élèves aux épreuves de SVT du BEPC et du BAC séries D et C. Approche pédagogique basée sur la compréhension et la mémorisation active avec schémas et fiches.",
    phone: "+225 01 44 55 66 77",
    email: "bamba.mariam@monprof.ci",
    commune: "Bingerville",
    quartier: "Centre",
    experienceYears: 7,
    diploma: "Master Biologie Végétale - Université Nangui Abrogoua",
    profileType: "ENSEIGNANT",
    subjects: [
      { name: "SVT", primary: true },
      { name: "Méthodologie", primary: false },
      { name: "Préparation concours", primary: false },
    ],
    levels: ["Collège", "3e", "Lycée", "Première", "Terminale", "BEPC", "BAC", "Concours santé"],
    zones: ["Bingerville", "Cocody", "Angré"],
    pricePerHour: 10000,
    pricePerSession: 10000,
    pricePack4: 38000,
    pricePack8: 72000,
    commissionRate: 20,
    rating: 4.5,
    ratingCount: 11,
    pricingTier: "STANDARD",
  },
  {
    fullName: "Yao Stéphane",
    professionalName: "M. Yao",
    photoUrl: "/images/teachers/yao-stephane.webp",
    jobTitle: "Professeur de Philosophie",
    bio: "Professeur de philosophie, j'aide les élèves de Terminale à structurer dissertation, commentaire de texte et culture générale. Travail méthodique sur les sujets du BAC ivoirien et la prise de parole.",
    phone: "+225 07 22 33 44 55",
    email: "yao.stephane@monprof.ci",
    commune: "Abobo",
    quartier: "Avocatier",
    experienceYears: 11,
    diploma: "Master Philosophie - Université Félix Houphouët-Boigny",
    profileType: "ENSEIGNANT",
    subjects: [
      { name: "Philosophie", primary: true },
      { name: "Français", primary: false },
      { name: "Culture générale", primary: false },
      { name: "Méthodologie", primary: false },
      { name: "Préparation concours", primary: false },
      { name: "Tests psychotechniques", primary: false },
    ],
    levels: ["Lycée", "Terminale", "BAC", "Université", "Concours", "Concours administratifs"],
    zones: ["Abobo", "Yopougon", "Cocody"],
    pricePerHour: 15000,
    pricePerSession: 15000,
    pricePack4: 57000,
    pricePack8: 108000,
    commissionRate: 20,
    rating: 4.6,
    ratingCount: 18,
    badgePopular: true,
    pricingTier: "STANDARD",
  },
  {
    fullName: "Yéo Fatim",
    professionalName: "Mme Yéo",
    photoUrl: "/images/teachers/yeo-fatim.webp",
    jobTitle: "Professeure de Primaire",
    bio: "Institutrice diplômée, j'accompagne les enfants du CP au CM2 en français, mathématiques et éveil. Préparation au CEPE. Pédagogie bienveillante et patiente, idéale pour les jeunes élèves.",
    phone: "+225 05 99 88 77 66",
    email: "yeo.fatim@monprof.ci",
    commune: "Bingerville",
    quartier: "Centre",
    experienceYears: 4,
    diploma: "Diplôme d'Instituteur - ENS Abidjan",
    profileType: "ENSEIGNANT",
    subjects: [
      { name: "Aide aux devoirs", primary: true },
      { name: "Mathématiques", primary: false },
      { name: "Français", primary: false },
      { name: "Lecture et écriture", primary: false },
    ],
    levels: ["Maternelle", "CP - CE1", "CE2 - CM2", "Primaire", "CEPE"],
    zones: ["Bingerville", "Cocody", "Angré"],
    pricePerHour: 7500,
    pricePerSession: 7500,
    pricePack4: 28000,
    pricePack8: 54000,
    commissionRate: 20,
    rating: 4.9,
    ratingCount: 35,
    badgeRecommended: true,
    featured: true,
    pricingTier: "STANDARD",
  },
];

function buildTeacherProfileExtras(t: (typeof TEACHERS)[number]) {
  const primarySubject = t.subjects.find((subject) => subject.primary)?.name ?? t.subjects[0]?.name ?? "accompagnement";
  const secondarySubjects = t.subjects.filter((subject) => !subject.primary).slice(0, 4).map((subject) => subject.name);
  const coached = Math.max(25, (t.experienceYears * 18) + (t.ratingCount * 3));
  const zones = t.zones.slice(0, 3).join(", ");
  const levels = t.levels.slice(0, 4).join(", ");

  return {
    learnersCoached: coached,
    careerSummary: `${t.professionalName} accompagne des apprenants à ${t.commune} et dans le Grand Abidjan depuis ${t.experienceYears} ans. Son profil est orienté ${primarySubject}, avec une approche pratique, structurée et suivie par le service client Compétence.`,
    skills: [
      `${primarySubject} - accompagnement ciblé`,
      ...secondarySubjects,
      "Diagnostic de niveau et plan de progression",
      "Suivi clair avec l'apprenant et la famille",
    ].join("\n"),
    workHistory: [
      `${t.experienceYears} ans d'encadrement en ${primarySubject} auprès de profils ${levels}`,
      `Interventions régulières sur ${zones}`,
      t.profileType === "PROFESSIONNEL"
        ? "Expérience terrain et transmission de compétences pratiques aux adultes et professionnels"
        : "Accompagnement scolaire, préparation d'examens et remise à niveau individualisée",
    ].join("\n"),
    certifications: [
      t.diploma,
      "Identité, photo et profil vérifiés par le service client Compétence",
      "Références pédagogiques contrôlées en interne",
    ].filter(Boolean).join("\n"),
    teachingAchievements: [
      `${coached}+ apprenants encadrés en suivi individuel ou groupe restreint`,
      "Méthode centrée sur les objectifs, exercices guidés et progression mesurable",
      "Historique de réservations, avis et paiements suivi par le service client Compétence",
    ].join("\n"),
  };
}

async function main() {
  console.log("🧹 Nettoyage...");
  await prisma.teacherPayoutAllocation.deleteMany();
  await prisma.teacherPayoutRecord.deleteMany();
  await prisma.teacherNotification.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.dispute.deleteMany();
  await prisma.review.deleteMany();
  await prisma.transaction.deleteMany();
  await prisma.booking.deleteMany();
  await prisma.teacherSubject.deleteMany();
  await prisma.teacherLevel.deleteMany();
  await prisma.teacherZone.deleteMany();
  await prisma.teacher.deleteMany();
  await prisma.subject.deleteMany();
  await prisma.level.deleteMany();
  await prisma.commune.deleteMany();
  await prisma.contactMessage.deleteMany();
  await prisma.setting.deleteMany();
  await prisma.user.deleteMany();

  console.log("📚 Création des matières...");
  const subjectMap = new Map();
  for (const s of UNIQUE_SUBJECTS) {
    const created = await prisma.subject.create({ data: s });
    subjectMap.set(s.name, created);
  }

  console.log("🎓 Création des niveaux...");
  const levelMap = new Map();
  for (const l of LEVELS) {
    const created = await prisma.level.create({ data: l });
    levelMap.set(l.name, created);
  }

  console.log("🗺️ Création des communes...");
  const communeMap = new Map();
  for (const c of COMMUNES) {
    const created = await prisma.commune.create({ data: c });
    communeMap.set(c.name, created);
  }

  console.log("👤 Création admin + client démo...");
  const adminPass = await bcrypt.hash("admin123", 10);
  const clientPass = await bcrypt.hash("client123", 10);
  const teacherPass = await bcrypt.hash("prof123", 10);
  const admin = await prisma.user.create({
    data: {
      email: "admin@monprof.ci",
      name: "Admin Compétence",
      phone: "+225 07 00 00 00 00",
      passwordHash: adminPass,
      role: "ADMIN",
    },
  });
  const client = await prisma.user.create({
    data: {
      email: "amon@demo.ci",
      name: "Mme Amon",
      phone: "+225 05 44 55 66 77",
      passwordHash: clientPass,
      role: "CLIENT",
      commune: "Cocody",
      quartier: "Riviera Palmeraie",
    },
  });
  const client2 = await prisma.user.create({
    data: {
      email: "kouassi@demo.ci",
      name: "M. Kouassi",
      phone: "+225 01 99 88 77 66",
      passwordHash: clientPass,
      role: "CLIENT",
      commune: "Yopougon",
      quartier: "Selmer",
    },
  });
  const client3 = await prisma.user.create({
    data: {
      email: "kone@demo.ci",
      name: "Mme Koné",
      phone: "+225 07 12 34 56 78",
      passwordHash: clientPass,
      role: "CLIENT",
      commune: "Marcory",
      quartier: "Zone 4",
    },
  });
  const client4 = await prisma.user.create({
    data: {
      email: "traore@demo.ci",
      name: "M. Traoré",
      phone: "+225 05 87 65 43 21",
      passwordHash: clientPass,
      role: "CLIENT",
      commune: "Abobo",
      quartier: "Avocatier",
    },
  });

  console.log("👨‍🏫 Création des professeurs...");
  const teacherMap = new Map();
  for (const t of TEACHERS) {
    const { subjects, levels, zones, ...data } = t;
    const profileExtras = buildTeacherProfileExtras(t);
    const teacher = await prisma.teacher.create({
      data: {
        ...profileExtras,
        ...data,
        status: "ACTIVE",
        availability: AVAILABILITY,
        portalAccessEnabled: true,
        portalPhone: normalizeTeacherPhone(data.phone),
        portalPasswordHash: teacherPass,
      } as any,
    });
    for (const s of subjects) {
      await prisma.teacherSubject.create({
        data: {
          teacherId: teacher.id,
          subjectId: subjectMap.get(s.name)!.id,
          isPrimary: s.primary,
        },
      });
    }
    for (const l of levels) {
      await prisma.teacherLevel.create({
        data: { teacherId: teacher.id, levelId: levelMap.get(l)!.id },
      });
    }
    for (const z of zones) {
      await prisma.teacherZone.create({
        data: { teacherId: teacher.id, communeId: communeMap.get(z)!.id },
      });
    }
    teacherMap.set(t.fullName, teacher);
    console.log(`  ✓ ${t.professionalName}`);
  }

  console.log("📅 Création de réservations d'exemple...");
  const t1 = teacherMap.get("Kouamé Jean")!;
  const t2 = teacherMap.get("Traoré Aïcha")!;
  const t3 = teacherMap.get("Diabaté Sarah")!;

  // Booking 1 - en cours (payé, validé admin, cours effectué, en attente validation client)
  const b1 = await prisma.booking.create({
    data: {
      reference: "MP-1024",
      clientId: client.id,
      teacherId: t1.id,
      subjectName: "Mathématiques",
      levelName: "Terminale",
      objective: "Préparation BAC série D",
      courseFormat: "HOME",
      groupType: "INDIVIDUAL",
      commune: "Cocody",
      quartier: "Riviera Palmeraie",
      addressHint: "Riviera Palmeraie, près de la pharmacie",
      preferredDays: JSON.stringify(["samedi"]),
      preferredTime: "15h-17h",
      scheduledDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      scheduledTime: "15:00",
      sessionsCount: 1,
      packType: "SINGLE",
      unitPrice: 15000,
      totalPrice: 15000,
      commissionRate: 20,
      commissionAmount: 3000,
      teacherNetAmount: 12000,
      status: "PENDING_CLIENT_VALIDATION",
      paymentStatus: "BLOCKED",
      paymentMethod: "ORANGE_MONEY",
      confirmedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
      assignedAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000),
      courseDoneAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
    },
  });
  await prisma.transaction.create({
    data: {
      reference: "TX-5001",
      bookingId: b1.id,
      teacherId: t1.id,
      amount: 15000,
      commission: 3000,
      teacherNet: 12000,
      type: "CLIENT_PAYMENT",
      status: "BLOCKED",
      method: "ORANGE_MONEY",
    },
  });

  // Booking 2 - complété (professeur payé)
  const b2 = await prisma.booking.create({
    data: {
      reference: "MP-1015",
      clientId: client.id,
      teacherId: t2.id,
      subjectName: "Français",
      levelName: "Lycée",
      objective: "Dissertation type BAC",
      courseFormat: "ONLINE",
      groupType: "INDIVIDUAL",
      onlineLink: "https://meet.google.com/abc-defg-hij",
      preferredDays: JSON.stringify(["dimanche"]),
      preferredTime: "10h-12h",
      scheduledDate: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000),
      scheduledTime: "10:00",
      sessionsCount: 4,
      packType: "PACK_4",
      unitPrice: 9500,
      totalPrice: 38000,
      commissionRate: 20,
      commissionAmount: 7600,
      teacherNetAmount: 30400,
      teacherPaidAmount: 30400,
      status: "TEACHER_PAID",
      paymentStatus: "TEACHER_PAID",
      paymentMethod: "WAVE",
      confirmedAt: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000),
      assignedAt: new Date(Date.now() - 19 * 24 * 60 * 60 * 1000),
      courseDoneAt: new Date(Date.now() - 16 * 24 * 60 * 60 * 1000),
      clientValidatedAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000),
      teacherPaidAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000),
    },
  });
  await prisma.transaction.create({
    data: {
      reference: "TX-4980",
      bookingId: b2.id,
      teacherId: t2.id,
      amount: 38000,
      commission: 7600,
      teacherNet: 30400,
      type: "CLIENT_PAYMENT",
      status: "TEACHER_PAID",
      method: "WAVE",
      paidAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000),
    },
  });
  await prisma.teacherPayoutRecord.create({
    data: {
      reference: "PAY-PROF-4981",
      teacherId: t2.id,
      amount: 30400,
      method: "WAVE",
      paymentPhone: "+2250700000002",
      note: "Versement complet démonstration - réservation MP-1015",
      status: "PAID",
      paidAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000),
      createdById: admin.id,
      allocations: {
        create: [{ bookingId: b2.id, amount: 30400 }],
      },
    },
  });
  await prisma.transaction.create({
    data: {
      reference: "TX-4981",
      bookingId: b2.id,
      teacherId: t2.id,
      amount: 30400,
      commission: 0,
      teacherNet: 30400,
      type: "TEACHER_PAYOUT",
      status: "TEACHER_PAID",
      method: "WAVE",
      paidAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000),
    },
  });
  await prisma.review.create({
    data: {
      clientId: client.id,
      teacherId: t2.id,
      bookingId: b2.id,
      rating: 5,
      comment: "Excellente professeure, ma fille a beaucoup progressé en dissertation. Je recommande vivement.",
    },
  });

  // Booking 3 - en attente validation admin (payé)
  const b3 = await prisma.booking.create({
    data: {
      reference: "MP-1031",
      clientId: client2.id,
      teacherId: t3.id,
      subjectName: "Anglais",
      levelName: "Université",
      objective: "Préparation TOEIC",
      courseFormat: "ONLINE",
      groupType: "INDIVIDUAL",
      onlineLink: "",
      preferredDays: JSON.stringify(["mardi", "jeudi"]),
      preferredTime: "19h-20h",
      sessionsCount: 8,
      packType: "PACK_8",
      unitPrice: 9000,
      totalPrice: 72000,
      commissionRate: 20,
      commissionAmount: 14400,
      teacherNetAmount: 57600,
      status: "PENDING_ADMIN_VALIDATION",
      paymentStatus: "BLOCKED",
      paymentMethod: "MTN_MONEY",
    },
  });
  await prisma.transaction.create({
    data: {
      reference: "TX-5010",
      bookingId: b3.id,
      teacherId: t3.id,
      amount: 72000,
      commission: 14400,
      teacherNet: 57600,
      type: "CLIENT_PAYMENT",
      status: "BLOCKED",
      method: "MTN_MONEY",
    },
  });

  // Booking 4 - cours validé par le client, paiement prêt à libérer au professeur
  const b4 = await prisma.booking.create({
    data: {
      reference: "MP-1042",
      clientId: client3.id,
      teacherId: t1.id,
      subjectName: "Mathématiques",
      levelName: "Première",
      objective: "Remise à niveau fonctions et suites",
      courseFormat: "HOME",
      groupType: "INDIVIDUAL",
      commune: "Cocody",
      quartier: "Deux Plateaux",
      addressHint: "Non loin du commissariat du 12e arrondissement",
      preferredDays: JSON.stringify(["mercredi"]),
      preferredTime: "17h-19h",
      scheduledDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
      scheduledTime: "17:00",
      sessionsCount: 1,
      packType: "SINGLE",
      unitPrice: 15000,
      totalPrice: 15000,
      commissionRate: 20,
      commissionAmount: 3000,
      teacherNetAmount: 12000,
      teacherPaidAmount: 0,
      status: "PAYMENT_TO_RELEASE",
      paymentStatus: "TO_PAY_TEACHER",
      paymentMethod: "WAVE",
      confirmedAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000),
      assignedAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000),
      courseDoneAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
      clientValidatedAt: new Date(Date.now() - 18 * 60 * 60 * 1000),
    },
  });
  await prisma.transaction.create({
    data: {
      reference: "TX-5020",
      bookingId: b4.id,
      teacherId: t1.id,
      amount: 15000,
      commission: 3000,
      teacherNet: 12000,
      type: "CLIENT_PAYMENT",
      status: "TO_PAY_TEACHER",
      method: "WAVE",
    },
  });

  // Booking 5 - paiement professeur partiel, reste dû visible dans l'admin
  const b5 = await prisma.booking.create({
    data: {
      reference: "MP-1048",
      clientId: client4.id,
      teacherId: t3.id,
      subjectName: "Anglais",
      levelName: "Adultes",
      objective: "Conversation professionnelle et préparation entretien",
      courseFormat: "ONLINE",
      groupType: "SMALL_GROUP",
      participantsCount: 2,
      onlineLink: "https://meet.google.com/monprof-demo",
      preferredDays: JSON.stringify(["lundi", "mercredi"]),
      preferredTime: "19h-21h",
      scheduledDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
      scheduledTime: "19:00",
      sessionsCount: 4,
      packType: "PACK_4",
      unitPrice: 12500,
      totalPrice: 50000,
      commissionRate: 20,
      commissionAmount: 10000,
      teacherNetAmount: 40000,
      teacherPaidAmount: 20000,
      status: "PAYMENT_TO_RELEASE",
      paymentStatus: "TO_PAY_TEACHER",
      paymentMethod: "MOOV_MONEY",
      confirmedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      assignedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      courseDoneAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
      clientValidatedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
    },
  });
  await prisma.transaction.create({
    data: {
      reference: "TX-5030",
      bookingId: b5.id,
      teacherId: t3.id,
      amount: 50000,
      commission: 10000,
      teacherNet: 40000,
      type: "CLIENT_PAYMENT",
      status: "TO_PAY_TEACHER",
      method: "MOOV_MONEY",
    },
  });
  await prisma.transaction.create({
    data: {
      reference: "TX-PROF-5031",
      bookingId: b5.id,
      teacherId: t3.id,
      amount: 20000,
      commission: 0,
      teacherNet: 20000,
      type: "TEACHER_PAYOUT",
      status: "TO_PAY_TEACHER",
      method: "MOOV_MONEY",
      paidAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
    },
  });
  await prisma.teacherPayoutRecord.create({
    data: {
      reference: "PAY-PROF-5031",
      teacherId: t3.id,
      amount: 20000,
      method: "MOOV_MONEY",
      paymentPhone: "+2250500000003",
      note: "Acompte professeur démonstration - reste dû conservé en comptabilité interne",
      status: "PAID",
      paidAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
      createdById: admin.id,
      allocations: {
        create: [{ bookingId: b5.id, amount: 20000 }],
      },
    },
  });

  console.log("🔔 Création des notifications admin...");
  await prisma.notification.create({
    data: {
      userId: null,
      title: "Nouvelle réservation payée",
      message: "M. Kouassi a réservé Mme Diabaté pour Anglais Université, Pack 8 séances. Montant: 72 000 FCFA. Statut: fonds bloqués.",
      type: "NEW_BOOKING",
      link: "/admin/reservations",
    },
  });
  await prisma.notification.create({
    data: {
      userId: null,
      title: "Cours à confirmer",
      message: "La réservation MP-1024 (Mathématiques Terminale) attend la confirmation du client.",
      type: "PENDING_CLIENT_VALIDATION",
      link: "/admin/reservations",
    },
  });
  await prisma.notification.create({
    data: {
      userId: null,
      title: "Paiement à libérer",
      message: "2 réservations ont un reste dû professeur à libérer (32 000 FCFA net restant).",
      type: "PAYMENT_TO_RELEASE",
      link: "/admin/paiements-a-liberer",
      read: true,
    },
  });

  console.log("⚙️ Paramètres plateforme...");
  await prisma.setting.create({ data: { key: "platform_name", value: "Compétence" } });
  await prisma.setting.create({ data: { key: "default_commission", value: "20" } });
  await prisma.setting.create({ data: { key: "support_phone", value: "+225 27 22 00 00 00" } });
  await prisma.setting.create({ data: { key: "support_email", value: "support@competence.ci" } });

  console.log("\n✅ Seed terminé!");
  console.log("─".repeat(50));
  console.log("👤 Admin: admin@monprof.ci / admin123");
  console.log("👤 Client (Mme Amon): amon@demo.ci / client123");
  console.log("👤 Client (M. Kouassi): kouassi@demo.ci / client123");
  console.log("─".repeat(50));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
