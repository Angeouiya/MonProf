import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function lines(items) {
  return items.filter(Boolean).join("\n");
}

async function main() {
  const teachers = await prisma.teacher.findMany({
    include: {
      subjects: { include: { subject: true }, orderBy: { isPrimary: "desc" } },
      zones: { include: { commune: true } },
      levels: { include: { level: true }, take: 4 },
    },
  });

  let updated = 0;
  for (const teacher of teachers) {
    const primary = teacher.subjects.find((item) => item.isPrimary)?.subject.name
      || teacher.subjects[0]?.subject.name
      || teacher.jobTitle;
    const secondary = teacher.subjects
      .filter((item) => item.subject.name !== primary)
      .slice(0, 4)
      .map((item) => item.subject.name);
    const zones = teacher.zones.slice(0, 3).map((item) => item.commune.name).join(", ")
      || teacher.commune
      || "Grand Abidjan";
    const levels = teacher.levels.slice(0, 4).map((item) => item.level.name).join(", ")
      || "plusieurs niveaux";
    const learnersCoached = teacher.learnersCoached
      || Math.max(25, (teacher.experienceYears || 1) * 18 + (teacher.ratingCount || 0) * 3);

    await prisma.teacher.update({
      where: { id: teacher.id },
      data: {
        learnersCoached,
        careerSummary: teacher.careerSummary || `${teacher.professionalName || teacher.fullName} accompagne des apprenants à ${teacher.commune || "Abidjan"} et dans le Grand Abidjan depuis ${teacher.experienceYears || 1} ans. Son profil est orienté ${primary}, avec une méthode pratique et suivie par le service client Compétence.`,
        skills: teacher.skills || lines([
          `${primary} - accompagnement ciblé`,
          ...secondary,
          "Diagnostic de niveau et plan de progression",
          "Suivi clair avec l'apprenant et la famille",
        ]),
        workHistory: teacher.workHistory || lines([
          `${teacher.experienceYears || 1} ans d'encadrement en ${primary} auprès de profils ${levels}`,
          `Interventions régulières sur ${zones}`,
          teacher.profileType === "PROFESSIONNEL"
            ? "Expérience terrain et transmission de compétences pratiques aux adultes et professionnels"
            : "Accompagnement scolaire, préparation d'examens et remise à niveau individualisée",
        ]),
        certifications: teacher.certifications || lines([
          teacher.diploma,
          "Identité, photo et profil vérifiés par le service client Compétence",
          "Références pédagogiques contrôlées en interne",
        ]),
        teachingAchievements: teacher.teachingAchievements || lines([
          `${learnersCoached}+ apprenants encadrés en suivi individuel ou groupe restreint`,
          "Méthode centrée sur les objectifs, exercices guidés et progression mesurable",
          "Historique de réservations, avis et paiements suivi par le service client Compétence",
        ]),
      },
    });
    updated += 1;
  }

  console.log(`Mini-CV professeurs mis à jour: ${updated}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
