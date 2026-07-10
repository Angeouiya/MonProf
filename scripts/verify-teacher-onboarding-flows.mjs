import fs from "node:fs";
import { createJiti } from "jiti";

const checks = [];
const teacherForm = read("src/components/admin/teacher-form.tsx");
const cvRoute = read("src/app/api/admin/teachers/analyze-cv/route.ts");
const teacherCreateRoute = read("src/app/api/admin/teachers/route.ts");
const teacherUpdateRoute = read("src/app/api/admin/teachers/[id]/route.ts");
const scheduling = read("src/lib/scheduling.ts");

record(
  "CV upload starts analysis and applies every professional field automatically",
  /onChange=\{\(event\)\s*=>\s*\{[\s\S]*?analyzeCv\(event\.target\.files\?\.\[0\]\)/.test(teacherForm)
    && /setCvAnalysis\(data\);\s*applyCvAnalysis\(\{\s*\.\.\.data\.fields,\s*cvUrl:\s*data\.cvUrl\s*\}\)/.test(teacherForm)
    && [
      "fullName",
      "email",
      "phone",
      "commune",
      "quartier",
      "jobTitle",
      "bio",
      "diploma",
      "careerSummary",
      "skills",
      "workHistory",
      "certifications",
      "teachingAchievements",
      "experienceYears",
      "learnersCoached",
    ].every((field) => teacherForm.includes(`\"${field}\"`)),
);

record(
  "CV analysis endpoint is admin-only and validates file safety",
  /requireAdminApi/.test(cvRoute)
    && /MAX_CV_SIZE\s*=\s*4\s*\*\s*1024\s*\*\s*1024/.test(cvRoute)
    && /ALLOWED_EXTENSIONS/.test(cvRoute)
    && /analyzeTeacherCv/.test(cvRoute),
);

record(
  "Availability exposes seven explicit two-hour columns",
  (scheduling.match(/key:\s*"\d{2}-\d{2}"/g) ?? []).length === 7
    && /08h00 - 10h00/.test(scheduling)
    && /20h00 - 22h00/.test(scheduling)
    && /Plage horaire/.test(teacherForm)
    && /aria-label=\{`\$\{d\.label\}, plage horaire \$\{s\.label\}`\}/.test(teacherForm),
);

record(
  "Active teachers require persisted server-validated availability",
  /countAvailabilitySlots\(normalizedAvailability\)\s*===\s*0/.test(teacherCreateRoute)
    && /JSON\.stringify\(normalizedAvailability\)/.test(teacherCreateRoute)
    && /countAvailabilitySlots\(normalizedAvailability\)\s*===\s*0/.test(teacherUpdateRoute)
    && /parseAvailability\(existingTeacher\.availability\)/.test(teacherUpdateRoute),
);

const jiti = createJiti(import.meta.url);
const { analyzeTeacherCv } = await jiti.import("../src/lib/teacher-cv-analysis.ts");
const sampleCv = `
PROFIL
Formateur en mathématiques et préparation aux concours à Abidjan.

COMPÉTENCES
Mathématiques
Préparation BAC
Pédagogie active

EXPÉRIENCES
2016-2026 - Enseignant et formateur en soutien scolaire
10 ans d'expérience en enseignement

FORMATION
Master en sciences de l'éducation

RÉSULTATS
120 apprenants encadrés
Progression et réussite au BAC
`;
const parsedCv = await analyzeTeacherCv({
  buffer: Buffer.from(sampleCv, "utf8"),
  filename: "cv-professeur.txt",
  mimeType: "text/plain",
});

record(
  "CV engine extracts experience, skills, education, history and achievements",
  parsedCv.fields.experienceYears === 10
    && parsedCv.fields.learnersCoached === 120
    && parsedCv.fields.skills?.includes("Mathématiques")
    && parsedCv.fields.workHistory?.includes("2016-2026")
    && parsedCv.fields.diploma?.includes("Master")
    && parsedCv.fields.teachingAchievements?.includes("120 apprenants"),
);

const sparseCv = await analyzeTeacherCv({
  buffer: Buffer.from(`
KOUAME JEAN
Formateur en mathématiques
Téléphone : 07 01 02 03 04
Localisation : Abidjan, Cocody
5 ans d'expérience en enseignement
Mathématiques
Préparation BAC
Pédagogie active
Licence de mathématiques
`, "utf8"),
  filename: "cv-court.txt",
  mimeType: "text/plain",
});

record(
  "Sparse CV receives an evidence-based biography without invented facts",
  sparseCv.generatedFields.includes("careerSummary")
    && sparseCv.generatedFields.includes("bio")
    && sparseCv.fields.careerSummary?.includes("KOUAME JEAN")
    && sparseCv.fields.careerSummary?.includes("5 années d'expérience")
    && sparseCv.fields.diploma === "Licence de mathématiques"
    && !/profil à vérifier|employeur non renseigné/i.test(sparseCv.fields.careerSummary ?? ""),
);

record(
  "CV catalog suggestions stay precise and expose missing interview evidence",
  sparseCv.suggestedSubjects.length === 1
    && sparseCv.suggestedSubjects[0] === "Mathématiques"
    && sparseCv.suggestedLevels.includes("BAC")
    && sparseCv.suggestedLevels.includes("Licence")
    && sparseCv.missingCriticalFields.includes("Expériences"),
);

for (const check of checks) {
  console.log(`${check.ok ? "OK" : "FAIL"} ${check.label}`);
}

const failed = checks.filter((check) => !check.ok);
if (failed.length > 0) {
  console.log(`FAIL Teacher onboarding verification failed: ${failed.length} issue(s).`);
  process.exitCode = 1;
}

function read(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

function record(label, ok) {
  checks.push({ label, ok: Boolean(ok) });
}
