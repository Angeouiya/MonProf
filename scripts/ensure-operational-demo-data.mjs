import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function ensureMission({ bookingRef, token, createdHoursAgo, titleSuffix }) {
  const booking = await prisma.booking.findUnique({
    where: { reference: bookingRef },
    include: { teacher: true },
  });
  if (!booking) throw new Error(`Réservation ${bookingRef} introuvable.`);

  const existing = await prisma.teacherMissionLink.findFirst({
    where: { bookingId: booking.id, token },
  });
  if (existing) return existing;

  const now = Date.now();
  return prisma.teacherMissionLink.create({
    data: {
      token,
      teacherId: booking.teacherId,
      bookingId: booking.id,
      title: `Mission ${booking.reference} - ${booking.subjectName} ${titleSuffix}`,
      instructions: "Merci de confirmer rapidement votre disponibilité depuis ce lien privé sécurisé.",
      status: "PENDING_CONFIRMATION",
      createdAt: new Date(now - createdHoursAgo * 60 * 60 * 1000),
      expiresAt: new Date(now + 24 * 60 * 60 * 1000),
      createdById: (await prisma.user.findFirst({ where: { role: "ADMIN" }, select: { id: true } }))?.id,
    },
  });
}

async function main() {
  await ensureMission({
    bookingRef: "MP-1042",
    token: "demo-relance-professeur-mp-1042",
    createdHoursAgo: 0.75,
    titleSuffix: "(relance attendue)",
  });
  await ensureMission({
    bookingRef: "MP-1048",
    token: "demo-remplacement-professeur-mp-1048",
    createdHoursAgo: 3,
    titleSuffix: "(remplacement recommandé attendu)",
  });
  console.log("Scénarios opérationnels prêts : mission à relancer et remplacement recommandé.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
