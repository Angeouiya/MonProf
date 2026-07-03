import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const subjects = [
  ["Aide aux devoirs", "aide-aux-devoirs", "BookOpen"],
  ["Algèbre", "algebre", "Calculator"],
  ["Allemand", "allemand", "Languages"],
  ["Analyse mathématique", "analyse-mathematique", "Calculator"],
  ["Anglais professionnel", "anglais-professionnel", "BriefcaseBusiness"],
  ["Arabe", "arabe", "Languages"],
  ["Architecture", "architecture", "DraftingCompass"],
  ["Arts plastiques", "arts-plastiques", "Palette"],
  ["Bases de données", "bases-de-donnees", "Database"],
  ["Bureautique", "bureautique", "Laptop"],
  ["Chant", "chant", "Music"],
  ["Coiffure", "coiffure", "Scissors"],
  ["Communication", "communication", "Megaphone"],
  ["Couture", "couture", "Scissors"],
  ["Cuisine", "cuisine", "CookingPot"],
  ["Culture générale", "culture-generale", "Brain"],
  ["Cybersécurité", "cybersecurite", "ShieldCheck"],
  ["Data analyse", "data-analyse", "BarChart3"],
  ["Développement web", "developpement-web", "Code2"],
  ["Design graphique", "design-graphique", "Palette"],
  ["Dessin technique", "dessin-technique", "DraftingCompass"],
  ["Droit", "droit", "Scale"],
  ["Électronique", "electronique", "Cpu"],
  ["Entrepreneuriat", "entrepreneuriat", "BriefcaseBusiness"],
  ["Finance", "finance", "Wallet"],
  ["Fiscalité", "fiscalite", "ReceiptText"],
  ["Gestion", "gestion", "BriefcaseBusiness"],
  ["Gestion de projet", "gestion-de-projet", "ClipboardList"],
  ["Guitare", "guitare", "Music"],
  ["Intelligence artificielle", "intelligence-artificielle", "Bot"],
  ["Lecture et écriture", "lecture-ecriture", "BookOpen"],
  ["Logistique", "logistique", "Truck"],
  ["Mandarin", "mandarin", "Languages"],
  ["Marketing digital", "marketing-digital", "Megaphone"],
  ["Mécanique", "mecanique", "Wrench"],
  ["Méthodologie", "methodologie", "ClipboardList"],
  ["Montage vidéo", "montage-video", "Video"],
  ["Photographie", "photographie", "Camera"],
  ["Piano", "piano", "Music"],
  ["Préparation concours", "preparation-concours", "BadgeCheck"],
  ["Probabilités", "probabilites", "Calculator"],
  ["Programmation", "programmation", "Code2"],
  ["Réseaux informatiques", "reseaux-informatiques", "Network"],
  ["Ressources humaines", "ressources-humaines", "Users"],
  ["Statistiques", "statistiques", "BarChart3"],
  ["Tests psychotechniques", "tests-psychotechniques", "Brain"],
  ["TOEIC / TOEFL", "toeic-toefl", "Languages"],
  ["Autre matière / besoin spécifique", "autre-matiere", "PlusCircle"],
];

const levels = [
  ["Maternelle", "maternelle", 1],
  ["CP1", "cp1", 2],
  ["CP2", "cp2", 3],
  ["CP - CE1", "cp-ce1", 4],
  ["CE1", "ce1", 5],
  ["CE2", "ce2", 6],
  ["CM1", "cm1", 7],
  ["CM2", "cm2", 8],
  ["CE2 - CM2", "ce2-cm2", 9],
  ["Primaire", "primaire", 10],
  ["CEPE", "cepe", 11],
  ["Préparation CEPE", "preparation-cepe", 12],
  ["Collège", "college", 13],
  ["6e", "6e", 14],
  ["5e", "5e", 15],
  ["4e", "4e", 16],
  ["3e", "3e", 17],
  ["BEPC", "bepc", 18],
  ["Préparation BEPC", "preparation-bepc", 19],
  ["Brevet / DNB", "brevet-dnb", 20],
  ["Lycée", "lycee", 21],
  ["Seconde", "seconde", 22],
  ["2nde A", "2nde-a", 23],
  ["2nde C", "2nde-c", 24],
  ["Première", "premiere", 25],
  ["1ère A", "1ere-a", 26],
  ["1ère C", "1ere-c", 27],
  ["1ère D", "1ere-d", 28],
  ["1ère E", "1ere-e", 29],
  ["Première générale", "premiere-generale", 30],
  ["Première technologique", "premiere-technologique", 31],
  ["Terminale", "terminale", 32],
  ["Terminale A1", "terminale-a1", 33],
  ["Terminale A2", "terminale-a2", 34],
  ["Terminale C", "terminale-c", 35],
  ["Terminale D", "terminale-d", 36],
  ["Terminale E", "terminale-e", 37],
  ["Terminale générale", "terminale-generale", 38],
  ["Terminale technologique", "terminale-technologique", 39],
  ["BAC", "bac", 40],
  ["BAC ivoirien", "bac-ivoirien", 41],
  ["BAC français", "bac-francais", 42],
  ["Grand oral", "grand-oral", 43],
  ["BTS", "bts", 44],
  ["BTS 1", "bts-1", 45],
  ["BTS 2", "bts-2", 46],
  ["Licence", "licence", 47],
  ["Licence 1", "licence-1", 48],
  ["Licence 2", "licence-2", 49],
  ["Licence 3", "licence-3", 50],
  ["Master", "master", 51],
  ["Master 1", "master-1", 52],
  ["Master 2", "master-2", 53],
  ["Université", "universite", 54],
  ["Préparation mémoire", "preparation-memoire", 55],
  ["Préparation soutenance", "preparation-soutenance", 56],
  ["Formation professionnelle", "formation-professionnelle", 57],
  ["Adultes", "adultes", 58],
  ["Alphabétisation", "alphabetisation", 59],
  ["Concours", "concours", 60],
  ["Concours administratifs", "concours-administratifs", 61],
  ["Concours grandes écoles", "concours-grandes-ecoles", 62],
  ["Concours santé", "concours-sante", 63],
  ["Concours enseignants", "concours-enseignants", 64],
  ["Concours CAFOP", "concours-cafop", 65],
  ["Concours fonction publique", "concours-fonction-publique", 66],
  ["Concours INFS", "concours-infs", 67],
  ["Concours police / gendarmerie / armée", "concours-police-gendarmerie-armee", 68],
  ["Tests internationaux", "tests-internationaux", 69],
  ["TOEFL", "toefl", 70],
  ["IELTS", "ielts", 71],
  ["TOEIC", "toeic", 72],
];

const teacherCatalog = [
  {
    fullName: "Kouamé Jean",
    primary: "Mathématiques",
    subjects: ["Mathématiques", "Physique-Chimie", "Algèbre", "Analyse mathématique", "Statistiques", "Probabilités", "Préparation concours"],
    levels: ["Lycée", "Seconde", "Première", "Terminale", "BAC", "BTS", "Licence", "Université", "Concours", "Concours grandes écoles"],
  },
  {
    fullName: "Traoré Aïcha",
    primary: "Français",
    subjects: ["Français", "Philosophie", "Méthodologie", "Communication", "Lecture et écriture", "Culture générale"],
    levels: ["Collège", "3e", "Lycée", "Première", "Terminale", "BEPC", "BAC", "Adultes", "Concours administratifs"],
  },
  {
    fullName: "Koné Ibrahim",
    primary: "Physique-Chimie",
    subjects: ["Physique-Chimie", "Mathématiques", "Électronique", "Mécanique", "Préparation concours"],
    levels: ["Lycée", "Première", "Terminale", "BAC", "BTS", "Licence", "Université", "Concours", "Concours grandes écoles"],
  },
  {
    fullName: "Diabaté Sarah",
    primary: "Anglais",
    subjects: ["Anglais", "Anglais professionnel", "TOEIC / TOEFL", "Communication"],
    levels: ["Primaire", "Collège", "CEPE", "BEPC", "Lycée", "Université", "Adultes", "Tests internationaux"],
  },
  {
    fullName: "N'Guessan Paul",
    primary: "Informatique",
    subjects: ["Informatique", "Programmation", "Développement web", "Bureautique", "Bases de données", "Data analyse", "Intelligence artificielle", "Cybersécurité", "Réseaux informatiques", "Mathématiques"],
    levels: ["Lycée", "BTS", "Licence", "Master", "Université", "Formation professionnelle", "Adultes", "Concours"],
  },
  {
    fullName: "Bamba Mariam",
    primary: "SVT",
    subjects: ["SVT", "Méthodologie", "Préparation concours"],
    levels: ["Collège", "3e", "Lycée", "Première", "Terminale", "BEPC", "BAC", "Concours santé"],
  },
  {
    fullName: "Yao Stéphane",
    primary: "Philosophie",
    subjects: ["Philosophie", "Français", "Culture générale", "Méthodologie", "Préparation concours", "Tests psychotechniques"],
    levels: ["Lycée", "Terminale", "BAC", "Université", "Concours", "Concours administratifs"],
  },
  {
    fullName: "Yéo Fatim",
    primary: "Aide aux devoirs",
    subjects: ["Aide aux devoirs", "Mathématiques", "Français", "Lecture et écriture"],
    levels: ["Maternelle", "CP - CE1", "CE2 - CM2", "Primaire", "CEPE"],
  },
];

async function main() {
  for (const [name, slug, icon] of subjects) {
    await prisma.subject.upsert({
      where: { slug },
      create: { name, slug, icon },
      update: { name, icon },
    });
  }

  for (const [name, slug, order] of levels) {
    await prisma.level.upsert({
      where: { slug },
      create: { name, slug, order },
      update: { name, order },
    });
  }

  const subjectMap = new Map((await prisma.subject.findMany()).map((subject) => [subject.name, subject]));
  const levelMap = new Map((await prisma.level.findMany()).map((level) => [level.name, level]));

  for (const config of teacherCatalog) {
    const teacher = await prisma.teacher.findFirst({ where: { fullName: config.fullName } });
    if (!teacher) continue;

    await prisma.teacherSubject.updateMany({ where: { teacherId: teacher.id }, data: { isPrimary: false } });

    for (const subjectName of config.subjects) {
      const subject = subjectMap.get(subjectName);
      if (!subject) continue;
      await prisma.teacherSubject.upsert({
        where: { teacherId_subjectId: { teacherId: teacher.id, subjectId: subject.id } },
        create: { teacherId: teacher.id, subjectId: subject.id, isPrimary: subjectName === config.primary },
        update: { isPrimary: subjectName === config.primary },
      });
    }

    for (const levelName of config.levels) {
      const level = levelMap.get(levelName);
      if (!level) continue;
      await prisma.teacherLevel.upsert({
        where: { teacherId_levelId: { teacherId: teacher.id, levelId: level.id } },
        create: { teacherId: teacher.id, levelId: level.id },
        update: {},
      });
    }
  }

  const [subjectCount, levelCount] = await Promise.all([
    prisma.subject.count(),
    prisma.level.count(),
  ]);
  console.log(`Catalogue élargi : ${subjectCount} matières, ${levelCount} niveaux.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
