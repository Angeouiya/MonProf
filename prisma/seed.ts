import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const SUBJECTS = [
  { name: "Mathématiques", slug: "mathematiques", icon: "Calculator" },
  { name: "Français", slug: "francais", icon: "BookOpen" },
  { name: "Anglais", slug: "anglais", icon: "Languages" },
  { name: "Physique-Chimie", slug: "physique-chimie", icon: "Atom" },
  { name: "SVT", slug: "svt", icon: "Leaf" },
  { name: "Philosophie", slug: "philosophie", icon: "Brain" },
  { name: "Histoire-Géographie", slug: "histoire-geographie", icon: "Globe" },
  { name: "Informatique", slug: "informatique", icon: "Laptop" },
  { name: "Comptabilité", slug: "comptabilite", icon: "Coins" },
  { name: "Économie", slug: "economie", icon: "TrendingUp" },
  { name: "Allemand", slug: "allemand", icon: "Languages" },
  { name: "Espagnol", slug: "espagnol", icon: "Languages" },
];

const LEVELS = [
  { name: "Primaire", slug: "primaire", order: 1 },
  { name: "Collège", slug: "college", order: 2 },
  { name: "CEPE", slug: "cepe", order: 3 },
  { name: "Lycée", slug: "lycee", order: 4 },
  { name: "BEPC", slug: "bepc", order: 5 },
  { name: "Terminale", slug: "terminale", order: 6 },
  { name: "BAC", slug: "bac", order: 7 },
  { name: "Université", slug: "universite", order: 8 },
  { name: "Concours", slug: "concours", order: 9 },
  { name: "Adultes", slug: "adultes", order: 10 },
];

const COMMUNES = [
  { name: "Cocody", zone: "Abidjan" },
  { name: "Angré", zone: "Abidjan" },
  { name: "Riviera", zone: "Abidjan" },
  { name: "Deux Plateaux", zone: "Abidjan" },
  { name: "Bingerville", zone: "Abidjan" },
  { name: "Yopougon", zone: "Abidjan" },
  { name: "Abobo", zone: "Abidjan" },
  { name: "Marcory", zone: "Abidjan" },
  { name: "Koumassi", zone: "Abidjan" },
  { name: "Treichville", zone: "Abidjan" },
  { name: "Plateau", zone: "Abidjan" },
  { name: "Port-Bouët", zone: "Abidjan" },
  { name: "Adjamé", zone: "Abidjan" },
  { name: "Attécoubé", zone: "Abidjan" },
  { name: "Songon", zone: "Abidjan" },
];

const AVAILABILITY = JSON.stringify({
  mon: { morning: false, afternoon: true, evening: true },
  tue: { morning: false, afternoon: true, evening: true },
  wed: { morning: false, afternoon: true, evening: true },
  thu: { morning: false, afternoon: true, evening: true },
  fri: { morning: false, afternoon: true, evening: true },
  sat: { morning: true, afternoon: true, evening: false },
  sun: { morning: true, afternoon: true, evening: false },
});

const TEACHERS = [
  // === 5 professeurs demandés dans le cahier des charges ===
  {
    fullName: "Kouamé Jean",
    professionalName: "M. Kouamé",
    jobTitle: "Professeur de Mathématiques",
    bio: "Professeur de mathématiques certifié, 12 ans d'expérience dans l'enseignement secondaire et supérieur. Spécialiste de la préparation au BAC séries C et D. Méthode pédagogique interactive orientée pratique et exercices types du programme ivoirien.",
    phone: "+225 07 01 02 03 04",
    email: "kouame.jean@monprof.ci",
    commune: "Cocody",
    quartier: "Riviera Palmeraie",
    experienceYears: 12,
    diploma: "Master Mathématiques - Université Félix Houphouët-Boigny",
    profileType: "ENSEIGNANT",
    subjects: [{ name: "Mathématiques", primary: true }, { name: "Physique-Chimie", primary: false }],
    levels: ["Lycée", "Terminale", "BAC", "Université", "Concours"],
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
    jobTitle: "Professeure de Français",
    bio: "Agrégée de lettres modernes, j'accompagne les élèves du collège au lycée en français, expression écrite et orale. Spécialiste de la préparation au BEPC et au BAC série A. Pédagogie bienveillante et structurée.",
    phone: "+225 05 11 22 33 44",
    email: "traore.aicha@monprof.ci",
    commune: "Yopougon",
    quartier: "Selmer",
    experienceYears: 8,
    diploma: "Agrégation Lettres Modernes",
    profileType: "ENSEIGNANT",
    subjects: [{ name: "Français", primary: true }, { name: "Philosophie", primary: false }],
    levels: ["Collège", "Lycée", "BEPC", "BAC"],
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
    jobTitle: "Professeur de Physique-Chimie",
    bio: "Docteur en chimie, j'enseigne la physique-chimie du lycée à l'université. Préparation BAC séries C, D, E et concours d'entrée en école d'ingénieur. Approche méthodique avec focus sur les exercices type et la compréhension des concepts.",
    phone: "+225 01 23 45 67 89",
    email: "kone.ibrahim@monprof.ci",
    commune: "Angré",
    quartier: "8e Tranche",
    experienceYears: 10,
    diploma: "Doctorat Chimie - Université Nangui Abrogoua",
    profileType: "ENSEIGNANT",
    subjects: [{ name: "Physique-Chimie", primary: true }, { name: "Mathématiques", primary: false }],
    levels: ["Lycée", "Terminale", "BAC", "Université", "Concours"],
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
    jobTitle: "Professeure d'Anglais",
    bio: "Bilingue anglais-français, j'enseigne l'anglais du primaire à l'université. Spécialiste de l'anglais scolaire, de la conversation et de la préparation aux examens. Cours à domicile et en ligne, pédagogie ludique pour les plus jeunes.",
    phone: "+225 07 88 99 00 11",
    email: "diabate.sarah@monprof.ci",
    commune: "Marcory",
    quartier: "Zone 4",
    experienceYears: 6,
    diploma: "Master Anglais - Université Alassane Ouattara",
    profileType: "ENSEIGNANT",
    subjects: [{ name: "Anglais", primary: true }],
    levels: ["Primaire", "Collège", "CEPE", "BEPC", "Lycée"],
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
    jobTitle: "Professeur d'Informatique",
    bio: "Ingénieur informatique senior, j'enseigne la programmation (Python, JavaScript, Java), la bureautique, les bases de données et prépare aux concours d'écoles informatiques. J'accompagne aussi les adultes en reconversion professionnelle.",
    phone: "+225 05 66 77 88 99",
    email: "nguessan.paul@monprof.ci",
    commune: "Cocody",
    quartier: "Deux Plateaux",
    experienceYears: 9,
    diploma: "Diplôme d'Ingénieur Informatique - INPHB Yamoussoukro",
    profileType: "PROFESSIONNEL",
    subjects: [{ name: "Informatique", primary: true }, { name: "Mathématiques", primary: false }],
    levels: ["Lycée", "Université", "Adultes", "Concours"],
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
    fullName: "Affoué Christelle",
    professionalName: "Mme Christelle",
    jobTitle: "Professeure de SVT",
    bio: "Professeure de SVT, je prépare les élèves aux épreuves de SVT du BEPC et du BAC séries D et C. Approche pédagogique basée sur la compréhension et la mémorisation active avec schémas et fiches.",
    phone: "+225 01 44 55 66 77",
    email: "affoue.christelle@monprof.ci",
    commune: "Abobo",
    quartier: "Avocatier",
    experienceYears: 7,
    diploma: "Master Biologie Végétale - Université Nangui Abrogoua",
    profileType: "ENSEIGNANT",
    subjects: [{ name: "SVT", primary: true }],
    levels: ["Collège", "Lycée", "BEPC", "BAC"],
    zones: ["Abobo", "Yopougon", "Cocody"],
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
    fullName: "Brou Éric",
    professionalName: "M. Brou",
    jobTitle: "Professeur d'Économie et Comptabilité",
    bio: "Expert-comptable et enseignant, j'accompagne les étudiants en économie, comptabilité et gestion. Préparation BAC série D2 et concours d'écoles de commerce.",
    phone: "+225 07 22 33 44 55",
    email: "brou.eric@monprof.ci",
    commune: "Plateau",
    quartier: "Centre des affaires",
    experienceYears: 11,
    diploma: "DEC - Diplôme d'Expert-Comptable",
    profileType: "PROFESSIONNEL",
    subjects: [{ name: "Comptabilité", primary: true }, { name: "Économie", primary: false }],
    levels: ["Lycée", "Terminale", "BAC", "Université", "Concours", "Adultes"],
    zones: ["Plateau", "Cocody", "Marcory"],
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
    jobTitle: "Professeure de Primaire",
    bio: "Institutrice diplômée, j'accompagne les enfants du CP au CM2 en français, mathématiques et éveil. Préparation au CEPE. Pédagogie bienveillante et patiente, idéale pour les jeunes élèves.",
    phone: "+225 05 99 88 77 66",
    email: "yeo.fatim@monprof.ci",
    commune: "Bingerville",
    quartier: "Centre",
    experienceYears: 4,
    diploma: "Diplôme d'Instituteur - ENS Abidjan",
    profileType: "ENSEIGNANT",
    subjects: [{ name: "Mathématiques", primary: true }, { name: "Français", primary: false }],
    levels: ["Primaire", "CEPE"],
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

async function main() {
  console.log("🧹 Nettoyage...");
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
  for (const s of SUBJECTS) {
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
  const admin = await prisma.user.create({
    data: {
      email: "admin@monprof.ci",
      name: "Admin MonProf",
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
    const teacher = await prisma.teacher.create({
      data: {
        ...data,
        status: "ACTIVE",
        availability: AVAILABILITY,
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
      message: "1 paiement est prêt à être libéré au professeur (12 000 FCFA net).",
      type: "PAYMENT_TO_RELEASE",
      link: "/admin/paiements-a-liberer",
      read: true,
    },
  });

  console.log("⚙️ Paramètres plateforme...");
  await prisma.setting.create({ data: { key: "platform_name", value: "MonProf CI" } });
  await prisma.setting.create({ data: { key: "default_commission", value: "20" } });
  await prisma.setting.create({ data: { key: "support_phone", value: "+225 27 22 00 00 00" } });
  await prisma.setting.create({ data: { key: "support_email", value: "support@monprof.ci" } });

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
