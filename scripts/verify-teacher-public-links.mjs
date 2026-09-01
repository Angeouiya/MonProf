import fs from "node:fs";

const read = (file) => fs.readFileSync(file, "utf8");

const helper = read("src/lib/teacher-public-link.ts");
const shortRoute = read("src/app/p/[id]/page.tsx");
const shareControl = read("src/components/shared/teacher-profile-link.tsx");
const publicProfile = read("src/app/professeurs/[id]/page.tsx");
const professorProfile = read("src/app/professeur/(espace)/profil/page.tsx");
const adminProfile = read("src/app/admin/professeurs/[id]/page.tsx");
const terms = read("src/app/conditions-utilisation/page.tsx");
const privacy = read("src/app/politique-confidentialite/page.tsx");

const checks = [
  [
    "Every teacher receives one deterministic short Compétence link",
    /teacherPublicSharePath/.test(helper)
      && /`\/p\/\$\{encodeURIComponent\(teacherId\.trim\(\)\)\}`/.test(helper)
      && /permanentRedirect\(teacherPublicProfilePath\(id\)\)/.test(shortRoute),
  ],
  [
    "The shared link supports native social sharing and a clipboard fallback",
    /navigator\.share/.test(shareControl)
      && /navigator\.clipboard\?\.writeText/.test(shareControl)
      && /document\.execCommand\("copy"\)/.test(shareControl)
      && /publicClientUrl\(sharePath\)/.test(shareControl)
      && /Découvrez le profil de/.test(shareControl),
  ],
  [
    "Professor and admin spaces expose the same public link",
    /mode="panel"/.test(professorProfile)
      && /published=\{profile\.status === "ACTIVE"/.test(professorProfile)
      && /TeacherProfileLink teacherId=\{teacher\.id\}/.test(adminProfile),
  ],
  [
    "The public profile can be shared and has professor-specific social metadata",
    /generateMetadata/.test(publicProfile)
      && /openGraph/.test(publicProfile)
      && /twitter/.test(publicProfile)
      && /teacherPublicSharePath\(teacher\.id\)/.test(publicProfile)
      && /<TeacherProfileLink teacherId=\{teacher\.id\}/.test(publicProfile),
  ],
  [
    "Only active photographed profiles receive a public social preview",
    /status: "ACTIVE"/.test(publicProfile)
      && /photoUrl: \{ not: null \}/.test(publicProfile)
      && /photoUrl: \{ not: "" \}/.test(publicProfile),
  ],
  [
    "CGU and privacy policy govern professor links and social traffic",
    /1er septembre 2026/.test(terms)
      && /Liens publics professeurs et réseaux sociaux/.test(terms)
      && /ne crée ni exclusivité, ni rémunération, ni commission/.test(terms)
      && /désactiver le lien/.test(terms)
      && /1er septembre 2026/.test(privacy)
      && /Données de lien professeur/.test(privacy)
      && /Profils publics et liens de partage/.test(privacy)
      && /ni téléphone privé, ni email privé/.test(privacy),
  ],
];

let failed = 0;
for (const [label, ok] of checks) {
  if (ok) console.log(`OK ${label}`);
  else {
    failed += 1;
    console.error(`FAIL ${label}`);
  }
}

if (failed > 0) process.exit(1);
console.log(`Teacher public link verification passed (${checks.length} checks).`);
