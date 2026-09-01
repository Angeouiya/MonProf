import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const checks = [];
const read = (filePath) => fs.readFileSync(path.join(root, filePath), "utf8");
const record = (label, ok) => checks.push({ label, ok: Boolean(ok) });

const packageJson = JSON.parse(read("package.json"));
const envExample = read(".env.example");
const database = read("src/lib/db.ts");
const realtime = read("src/components/shared/web-push-realtime.tsx");
const webPush = read("src/lib/web-push.ts");
const webPushQueue = read("src/lib/web-push-queue.ts");
const session = read("src/lib/session.ts");
const teacherAuth = read("src/lib/teacher-auth.ts");
const clientLayout = read("src/app/client/layout.tsx");
const publicHome = read("src/app/page.tsx");
const teacherSearch = read("src/app/professeurs/page.tsx");
const settings = read("src/lib/platform-settings.ts");
const vercelConfig = JSON.parse(read("vercel.json"));

record("Objectif de charge versionné", fs.existsSync(path.join(root, "docs", "SCALE_100K.md")));
record("Profil k6 distribué 100k versionné", fs.existsSync(path.join(root, "load", "100k-active.k6.js")));
record("Contrôle de capacité inclus dans build:quality", packageJson.scripts?.["build:quality"]?.includes("verify:scale-readiness"));
record(
  "Prisma est isolé par requête Cloudflare",
  database.includes("Symbol.for('competence.prisma.request-context')")
    && database.includes("new AsyncLocalStorage<AppPrismaClient>()")
    && database.includes("runWithDatabaseRequestContext")
    && database.includes("max: 5"),
);
record("Connexion runtime via pooler Supabase", /pooler\.supabase\.com:6543/.test(envExample));
record("PgBouncer activé", /pgbouncer=true/.test(envExample));
record("Une connexion PostgreSQL maximum par instance", /connection_limit=1/.test(envExample));
record("Sessions React mises en cache par rendu", /getSessionUser\s*=\s*cache\(async/.test(session));
record("Sessions professeur mises en cache par rendu", /getTeacherSessionUser\s*=\s*cache\(async/.test(teacherAuth));
record("Shell client sans lecture SQL bloquante", !clientLayout.includes('from "@/lib/db"'));
record("Accueil public sans fan-out base", !publicHome.includes('from "@/lib/db"') && !publicHome.includes("db."));
record("Catalogue professeurs mutualisé", teacherSearch.includes("getCachedTeacherSearchCatalog"));
record("Paramètres runtime mis en cache et invalidables", settings.includes("unstable_cache") && settings.includes('tags: ["platform-settings"]'));
record("Temps réel piloté par événements sans polling global", !realtime.includes("setInterval") && realtime.includes("COMPETENCE_PUSH_RECEIVED"));
record("Web Push traité par lots", /MAX_BATCH_SIZE\s*=\s*500/.test(webPush));
record("Web Push publié dans une file durable", webPushQueue.includes('WEB_PUSH_QUEUE_TOPIC = "web-push-events"'));
record(
  "Consommateurs de files configurés dans Vercel",
  JSON.stringify(vercelConfig.functions ?? {}).includes("web-push-events")
    && JSON.stringify(vercelConfig.functions ?? {}).includes("communication-campaigns"),
);

for (const check of checks) {
  console.log(`${check.ok ? "OK" : "FAIL"} ${check.label}`);
}

const failed = checks.filter((check) => !check.ok);
if (failed.length > 0) {
  console.error(`FAIL Prêt pour charge 100k : ${failed.length} garde-fou(s) absent(s).`);
  process.exitCode = 1;
} else {
  console.log("OK Architecture applicative prête pour un essai de charge distribué à 100 000 actifs.");
}
