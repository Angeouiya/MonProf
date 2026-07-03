import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function txExists(reference) {
  return Boolean(await prisma.transaction.findUnique({ where: { reference } }));
}

async function ensureTransaction(data) {
  if (await txExists(data.reference)) return;
  await prisma.transaction.create({ data });
}

async function ensurePayout(data) {
  const existing = await prisma.teacherPayoutRecord.findUnique({ where: { reference: data.reference } });
  if (existing) return;
  await prisma.teacherPayoutRecord.create({ data });
}

async function main() {
  const [admin, client3, client4, teacherMath, teacherEnglish] = await Promise.all([
    prisma.user.findFirst({ where: { role: "ADMIN" }, orderBy: { createdAt: "asc" } }),
    prisma.user.findFirst({ where: { email: "kone@demo.ci" } }),
    prisma.user.findFirst({ where: { email: "traore@demo.ci" } }),
    prisma.teacher.findFirst({ where: { fullName: "Kouamé Jean" } }),
    prisma.teacher.findFirst({ where: { fullName: "Diabaté Sarah" } }),
  ]);

  if (!admin || !client3 || !client4 || !teacherMath || !teacherEnglish) {
    throw new Error("Données de base introuvables. Lancez d'abord le seed principal.");
  }

  let b4 = await prisma.booking.findUnique({ where: { reference: "MP-1042" } });
  if (!b4) {
    b4 = await prisma.booking.create({
      data: {
        reference: "MP-1042",
        clientId: client3.id,
        teacherId: teacherMath.id,
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
        scheduledDate: new Date(Date.now() - 24 * 60 * 60 * 1000),
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
        courseDoneAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
        clientValidatedAt: new Date(Date.now() - 18 * 60 * 60 * 1000),
      },
    });
  }
  await ensureTransaction({
    reference: "TX-5020",
    bookingId: b4.id,
    teacherId: teacherMath.id,
    amount: 15000,
    commission: 3000,
    teacherNet: 12000,
    type: "CLIENT_PAYMENT",
    status: "TO_PAY_TEACHER",
    method: "WAVE",
  });

  let b5 = await prisma.booking.findUnique({ where: { reference: "MP-1048" } });
  if (!b5) {
    b5 = await prisma.booking.create({
      data: {
        reference: "MP-1048",
        clientId: client4.id,
        teacherId: teacherEnglish.id,
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
  } else if ((b5.teacherPaidAmount ?? 0) === 0) {
    b5 = await prisma.booking.update({
      where: { id: b5.id },
      data: { teacherPaidAmount: 20000, paymentStatus: "TO_PAY_TEACHER", status: "PAYMENT_TO_RELEASE" },
    });
  }
  await ensureTransaction({
    reference: "TX-5030",
    bookingId: b5.id,
    teacherId: teacherEnglish.id,
    amount: 50000,
    commission: 10000,
    teacherNet: 40000,
    type: "CLIENT_PAYMENT",
    status: "TO_PAY_TEACHER",
    method: "MOOV_MONEY",
  });
  await ensureTransaction({
    reference: "TX-PROF-5031",
    bookingId: b5.id,
    teacherId: teacherEnglish.id,
    amount: 20000,
    commission: 0,
    teacherNet: 20000,
    type: "TEACHER_PAYOUT",
    status: "TO_PAY_TEACHER",
    method: "MOOV_MONEY",
    paidAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
  });
  await ensurePayout({
    reference: "PAY-PROF-5031",
    teacherId: teacherEnglish.id,
    amount: 20000,
    method: "MOOV_MONEY",
    note: "Acompte professeur démonstration - reste dû conservé en comptabilité interne",
    status: "PAID",
    paidAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
    createdById: admin.id,
    allocations: {
      create: [{ bookingId: b5.id, amount: 20000 }],
    },
  });

  console.log("Scénarios paiements professeur prêts : MP-1042 à payer, MP-1048 partiellement payé.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
