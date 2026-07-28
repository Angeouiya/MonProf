import fs from "node:fs";
import { PrismaClient } from "@prisma/client";

const UNSAFE_SECRET_VALUES = new Set([
  "",
  "change-me",
  "change-me-cron-secret",
  "replace-with-a-strong-random-secret",
  "monprof-ci-dev-secret-change-me",
]);

const PAYDUNYA_SETTING_KEYS = {
  masterKey: "paydunya_master_key",
  publicKey: "paydunya_public_key",
  privateKey: "paydunya_private_key",
  token: "paydunya_token",
  mode: "paydunya_mode",
};

const checks = [];
const warnings = [];

loadEnvFile(".env.production.local");
loadEnvFile(".env.local");
loadEnvFile(".env");

checkDatabaseUrl("DATABASE_URL", {
  requirePgbouncer: true,
  requireSupabaseHost: true,
  expectedRole: "competence_runtime",
});
checkDatabaseUrl("DIRECT_URL", {
  requirePgbouncer: false,
  requireSupabaseHost: true,
  expectedRole: "competence_migrator",
});
checkStrongSecret("NEXTAUTH_SECRET", { minLength: 32 });
checkPublicUrl("NEXT_PUBLIC_APP_URL");
checkOptionalPublicUrl("NEXTAUTH_URL");
record(
  "Compétence service fee is exactly 3 percent",
  Number(getEnv("NEXT_PUBLIC_PAYMENT_SERVICE_FEE_RATE_BPS") || "300") === 300,
);
checkStrongSecret("CRON_SECRET", { minLength: 24 });
await checkWebPushConfiguration();
checkBuildDoesNotIgnoreCodeQualityErrors();
checkProductionScripts();
checkVercelDeploymentConfig();
checkSupabaseDeploymentConfig();
checkHealthEndpoint();
checkNoPublicPayDunyaSecrets();
checkJekoConfiguration();
checkGmailConfiguration();
await checkLegacyPayDunyaConfiguration();

for (const warning of warnings) {
  console.warn(`WARN ${warning}`);
}

for (const check of checks) {
  console.log(`${check.ok ? "OK" : "FAIL"} ${check.label}`);
}

const failed = checks.filter((check) => !check.ok);
if (failed.length > 0) {
  console.log(`FAIL Production config check failed: ${failed.length} blocking issue(s).`);
  process.exitCode = 1;
}

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  const content = fs.readFileSync(filePath, "utf8");
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex <= 0) continue;
    const key = trimmed.slice(0, separatorIndex).trim();
    if (process.env[key]) continue;
    const value = trimmed.slice(separatorIndex + 1).trim().replace(/^["']|["']$/g, "");
    process.env[key] = value;
  }
}

function record(label, ok) {
  checks.push({ label, ok });
}

function getEnv(key) {
  return process.env[key]?.trim() ?? "";
}

function checkDatabaseUrl(key, options) {
  const value = getEnv(key);
  if (!value) {
    record(`${key} is configured`, false);
    return;
  }

  let url;
  try {
    url = new URL(value);
  } catch {
    record(`${key} is a valid URL`, false);
    return;
  }

  record(`${key} uses PostgreSQL`, url.protocol === "postgresql:");
  record(`${key} has no placeholder password`, isSafeDatabasePassword(url.password));
  record(`${key} does not target a local database`, !isLocalDatabaseHost(url.hostname));
  if (options.requireSupabaseHost) {
    record(`${key} targets Supabase Postgres`, isSupabaseDatabaseHost(url.hostname));
  }
  if (options.expectedRole) {
    const databaseRole = decodeURIComponent(url.username).split(".")[0];
    record(`${key} uses the least-privilege ${options.expectedRole} role`, databaseRole === options.expectedRole);
  }
  record(`${key} targets schema=competence`, url.searchParams.get("schema") === "competence");
  if (options.requirePgbouncer) {
    record(`${key} is serverless pooler friendly`, url.searchParams.get("pgbouncer") === "true" && url.searchParams.has("connection_limit"));
  }
}

function isSafeDatabasePassword(password) {
  const decoded = decodeURIComponent(password ?? "").trim();
  if (!decoded) return false;
  const lowered = decoded.toLowerCase();
  return !lowered.includes("your-password")
    && !lowered.includes("password")
    && !lowered.includes("change-me")
    && !lowered.includes("placeholder");
}

function isLocalDatabaseHost(hostname) {
  const normalized = hostname.toLowerCase();
  return normalized === "localhost" || normalized === "127.0.0.1" || normalized === "::1";
}

function isSupabaseDatabaseHost(hostname) {
  const normalized = hostname.toLowerCase();
  return normalized.endsWith(".supabase.co") || normalized.endsWith(".pooler.supabase.com");
}

function checkStrongSecret(key, { minLength }) {
  const value = getEnv(key);
  const ok = value.length >= minLength && !UNSAFE_SECRET_VALUES.has(value);
  record(`${key} is strong and non-placeholder`, ok);
}

async function checkWebPushConfiguration() {
  const publicKey = getEnv("NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY");
  const privateKey = getEnv("WEB_PUSH_VAPID_PRIVATE_KEY");
  let stored = new Map();
  if (getEnv("DATABASE_URL")) {
    const prisma = new PrismaClient();
    try {
      const rows = await prisma.setting.findMany({
        where: { key: { in: ["web_push_vapid_public_key", "web_push_vapid_private_key", "web_push_subject"] } },
        select: { key: true, value: true },
      });
      stored = new Map(rows.map((row) => [row.key, row.value.trim()]));
    } catch (error) {
      warnings.push(`Web Push database settings could not be checked: ${error instanceof Error ? error.message : "unknown error"}.`);
    } finally {
      await prisma.$disconnect();
    }
  }
  const effectivePublicKey = publicKey || stored.get("web_push_vapid_public_key") || "";
  const effectivePrivateKey = privateKey || stored.get("web_push_vapid_private_key") || "";
  const subject = getEnv("WEB_PUSH_SUBJECT") || stored.get("web_push_subject") || "mailto:contact@competence.ci";
  record("Web Push VAPID public key is configured", effectivePublicKey.length >= 64);
  record("Web Push VAPID private key is server-side and configured", effectivePrivateKey.length >= 32);
  record("Web Push subject is a mailto or HTTPS URL", subject.startsWith("mailto:") || Boolean(parseHttpsUrl(subject)));
}

function checkPublicUrl(key) {
  const value = getEnv(key);
  const url = parseHttpsUrl(value);
  record(`${key} is HTTPS`, Boolean(url));
  if (url) record(`${key} uses the canonical www.competence.ci domain`, url.hostname === "www.competence.ci");
}

function checkOptionalPublicUrl(key) {
  const value = getEnv(key);
  if (!value) {
    warnings.push(`${key} is not set; NextAuth will infer the host on some platforms, but Vercel production should set it to https://www.competence.ci.`);
    return;
  }
  const url = parseHttpsUrl(value);
  record(`${key} is HTTPS when provided`, Boolean(url));
  if (url) record(`${key} uses www.competence.ci when provided`, url.hostname === "www.competence.ci");
}

function parseHttpsUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url : null;
  } catch {
    return null;
  }
}

function checkNoPublicPayDunyaSecrets() {
  const leakedPublicKeys = Object.keys(process.env).filter((key) => (
    key.startsWith("NEXT_PUBLIC_PAYDUNYA")
    || key.startsWith("NEXT_PUBLIC_JEKO")
    || key.startsWith("NEXT_PUBLIC_GMAIL")
  ));
  record("No payment or Gmail secret is exposed through NEXT_PUBLIC_*", leakedPublicKeys.length === 0);
}

function checkBuildDoesNotIgnoreCodeQualityErrors() {
  const configPath = "next.config.ts";
  if (!fs.existsSync(configPath)) {
    record("Next.js production config exists", false);
    return;
  }

  const config = fs.readFileSync(configPath, "utf8");
  record("Production build validates TypeScript errors", !/ignoreBuildErrors\s*:\s*true/.test(config));
  record("Production build keeps ESLint checks enabled", !/ignoreDuringBuilds\s*:\s*true/.test(config));
}

function checkProductionScripts() {
  const packagePath = "package.json";
  if (!fs.existsSync(packagePath)) {
    record("Package scripts exist for production checks", false);
    return;
  }

  let pkg;
  try {
    pkg = JSON.parse(fs.readFileSync(packagePath, "utf8"));
  } catch {
    record("Package scripts are valid JSON", false);
    return;
  }

  const productionBuild = pkg.scripts?.["build:production"] ?? "";
  const postinstall = pkg.scripts?.postinstall ?? "";
  const typecheck = pkg.scripts?.["typecheck"] ?? "";
  const clientAppShellVerify = pkg.scripts?.["verify:client-app-shell"] ?? "";
  const operationalFlowVerify = pkg.scripts?.["verify:operational-flows"] ?? "";
  const teacherOnboardingVerify = pkg.scripts?.["verify:teacher-onboarding"] ?? "";
  const clientMobileVerify = pkg.scripts?.["verify:client-mobile"] ?? "";
  const navigationPerformanceVerify = pkg.scripts?.["verify:navigation-performance"] ?? "";
  const teacherPhotoStorageVerify = pkg.scripts?.["verify:teacher-photo-storage"] ?? "";
  const deploymentSafetyVerify = pkg.scripts?.["verify:deployment-safety"] ?? "";
  const databaseDeploy = pkg.scripts?.["db:deploy"] ?? "";
  record("Production build runs explicit TypeScript gate", productionBuild.includes("npm run typecheck") && /tsc\s+--noEmit/.test(typecheck));
  record("Production install regenerates Prisma Client", /prisma\s+generate/.test(postinstall));
  record("Production database deploy applies versioned migrations", /prisma\s+migrate\s+deploy/.test(databaseDeploy));
  record(
    "Production database deploy safely adopts the legacy Prisma baseline",
    databaseDeploy.startsWith("node scripts/ensure-prisma-migration-baseline.mjs"),
  );
  record(
    "Production build verifies Prisma migration completeness",
    productionBuild.includes("npm run verify:migrations")
      && (pkg.scripts?.["verify:migrations"] ?? "").includes("verify-prisma-migrations.mjs"),
  );
  record("Production build runs explicit ESLint gate", productionBuild.includes("npm run lint") && (pkg.scripts?.lint ?? "").includes("eslint ."));
  record("Production build verifies installable client app shell", productionBuild.includes("npm run verify:client-app-shell") && clientAppShellVerify.includes("verify-client-app-shell.mjs"));
  record("Production build verifies database readiness", productionBuild.includes("npm run db:verify"));
  record("Production build audits payment integrity", productionBuild.includes("npm run payment:audit"));
  record("Production build verifies client mobile UX gates", productionBuild.includes("npm run verify:client-mobile") && clientMobileVerify.includes("verify-client-mobile-navigation.mjs"));
  record("Production build verifies booking operational flows", productionBuild.includes("npm run verify:operational-flows") && operationalFlowVerify.includes("verify-operational-booking-flows.mjs"));
  record("Production build verifies teacher onboarding flows", productionBuild.includes("npm run verify:teacher-onboarding") && teacherOnboardingVerify.includes("verify-teacher-onboarding-flows.mjs"));
  record("Production build verifies navigation performance gates", productionBuild.includes("npm run verify:navigation-performance") && navigationPerformanceVerify.includes("verify-navigation-performance.mjs"));
  record("Production build verifies persistent teacher photo storage", productionBuild.includes("npm run verify:teacher-photo-storage") && teacherPhotoStorageVerify.includes("verify-teacher-photo-storage.mjs"));
  record(
    "Production build verifies Vercel integration isolation and cron authorization",
    productionBuild.includes("npm run verify:deployment-safety")
      && deploymentSafetyVerify.includes("verify-deployment-safety.mjs"),
  );
}

function checkVercelDeploymentConfig() {
  const vercelPath = "vercel.json";
  if (!fs.existsSync(vercelPath)) {
    record("Vercel deployment config exists", false);
    return;
  }

  let config;
  try {
    config = JSON.parse(fs.readFileSync(vercelPath, "utf8"));
  } catch {
    record("Vercel deployment config is valid JSON", false);
    return;
  }

  record("Vercel uses the full production build pipeline", config.buildCommand === "npm run build:production");
  record(
    "Vercel functions run next to Supabase in London",
    Array.isArray(config.regions) && config.regions.length === 1 && config.regions[0] === "lhr1",
  );

  const cron = Array.isArray(config.crons)
    ? config.crons.find((item) => item?.path === "/api/cron/notification-reminders")
    : null;
  record("Vercel notification reminder cron is configured", Boolean(cron));
  if (cron) {
    record("Vercel notification reminder cron runs daily", cron.schedule === "0 8 * * *");
  }

  const passwordEmailCron = Array.isArray(config.crons)
    ? config.crons.find((item) => item?.path === "/api/cron/password-email-outbox")
    : null;
  record("Vercel password email outbox cron is configured", Boolean(passwordEmailCron));
  if (passwordEmailCron) {
    record("Vercel password email outbox cron runs every five minutes", passwordEmailCron.schedule === "*/5 * * * *");
  }

  const cronRoutePath = "src/app/api/cron/notification-reminders/route.ts";
  if (!fs.existsSync(cronRoutePath)) {
    record("Notification reminder cron route exists", false);
    return;
  }

  const cronRoute = fs.readFileSync(cronRoutePath, "utf8");
  record(
    "Notification reminder cron requires exact CRON_SECRET Bearer authorization",
    /process\.env\.CRON_SECRET/.test(cronRoute)
      && /authorization/.test(cronRoute)
      && /authorization !== `Bearer \$\{configuredSecret\}`/.test(cronRoute)
      && /status:\s*401/.test(cronRoute),
  );
  record(
    "Notification reminder cron never accepts a secret in the URL or a fallback header",
    !/nextUrl\.searchParams/.test(cronRoute) && !/x-cron-secret/i.test(cronRoute),
  );

  const webPushCronRoutePath = "src/app/api/cron/web-push/route.ts";
  const webPushCronRoute = fs.existsSync(webPushCronRoutePath)
    ? fs.readFileSync(webPushCronRoutePath, "utf8")
    : "";
  record(
    "Web Push cron requires exact CRON_SECRET Bearer authorization",
    /process\.env\.CRON_SECRET/.test(webPushCronRoute)
      && /authorization !== `Bearer \$\{configuredSecret\}`/.test(webPushCronRoute)
      && /status:\s*401/.test(webPushCronRoute),
  );
  record(
    "Web Push cron never accepts a secret in the URL or a fallback header",
    Boolean(webPushCronRoute)
      && !/nextUrl\.searchParams/.test(webPushCronRoute)
      && !/x-cron-secret/i.test(webPushCronRoute),
  );

  const ignorePath = ".vercelignore";
  if (!fs.existsSync(ignorePath)) {
    record("Vercel ignore file protects local env files", false);
    return;
  }
  const ignore = fs.readFileSync(ignorePath, "utf8");
  record("Vercel ignore file excludes local env files", /^\.env$/m.test(ignore) && /^\.env\.\*$/m.test(ignore));
}

function checkSupabaseDeploymentConfig() {
  const configPath = "supabase/config.toml";
  if (!fs.existsSync(configPath)) {
    record("Supabase project config exists", false);
    return;
  }

  const config = fs.readFileSync(configPath, "utf8");
  record("Supabase auth site URL uses competence.ci", /site_url\s*=\s*"https:\/\/competence\.ci"/.test(config));
  record("Supabase redirects allow competence.ci", /additional_redirect_urls\s*=\s*\[[^\]]*"https:\/\/competence\.ci"[^\]]*"https:\/\/www\.competence\.ci"/s.test(config));
  record("Supabase public auth signup is disabled", /\[auth\][\s\S]*?enable_signup\s*=\s*false/.test(config));
  record("Supabase email auth signup is disabled", /\[auth\.email\][\s\S]*?enable_signup\s*=\s*false/.test(config));

  const passwordLength = Number(config.match(/minimum_password_length\s*=\s*(\d+)/)?.[1] ?? 0);
  record("Supabase password minimum is production-grade", passwordLength >= 12);
  record("Supabase password policy requires mixed characters", /password_requirements\s*=\s*"lower_upper_letters_digits_symbols"/.test(config));
}

function checkHealthEndpoint() {
  const healthRoutePath = "src/app/api/health/route.ts";
  if (!fs.existsSync(healthRoutePath)) {
    record("Production health endpoint exists", false);
    return;
  }

  const healthRoute = fs.readFileSync(healthRoutePath, "utf8");
  record(
    "Production health endpoint checks database readiness",
    /db\.\$queryRaw/.test(healthRoute)
      && /db\.subject\.count/.test(healthRoute)
      && /db\.level\.count/.test(healthRoute)
      && /db\.commune\.count/.test(healthRoute)
      && /db\.user\.count/.test(healthRoute),
  );
  record(
    "Production health endpoint separates configuration from live verification",
    /getJekoServerConfig/.test(healthRoute)
      && /isGmailConfigured/.test(healthRoute)
      && /hasGmailEnvironmentConfiguration/.test(healthRoute)
      && /liveVerification:\s*"not_checked_by_health"/.test(healthRoute)
      && /scope:\s*"configuration-readiness"/.test(healthRoute)
      && !/apiKey|clientSecret|refreshToken|webhookSecret/.test(
        healthRoute.replace(
          /getJekoServerConfig|isGmailConfigured|hasGmailEnvironmentConfiguration/g,
          "",
        ),
      ),
  );

  const passwordEmailCronRoutePath = "src/app/api/cron/password-email-outbox/route.ts";
  const passwordEmailCronRoute = fs.existsSync(passwordEmailCronRoutePath)
    ? fs.readFileSync(passwordEmailCronRoutePath, "utf8")
    : "";
  record(
    "Password email outbox cron requires CRON_SECRET authorization",
    /process\.env\.CRON_SECRET/.test(passwordEmailCronRoute)
      && /authorization/.test(passwordEmailCronRoute)
      && /Bearer /.test(passwordEmailCronRoute)
      && /status:\s*401/.test(passwordEmailCronRoute),
  );
}

function checkJekoConfiguration() {
  if (isVercelNonProductionDeployment()) {
    const source = fs.readFileSync("src/lib/jeko-config.ts", "utf8");
    record(
      "Jèko is disabled by code outside Vercel Production",
      /if \(!productionIntegrationsAreEnabled\(\)\) return null/.test(source),
    );
    return;
  }

  record("Jèko API key is configured server-side", Boolean(getEnv("JEKO_API_KEY")));
  record("Jèko API key id is configured server-side", Boolean(getEnv("JEKO_API_KEY_ID")));
  record("Jèko store id is configured server-side", Boolean(getEnv("JEKO_STORE_ID")));
  record("Jèko webhook secret is strong and server-side", getEnv("JEKO_WEBHOOK_SECRET").length >= 24);
}

function checkGmailConfiguration() {
  if (isVercelNonProductionDeployment()) {
    const source = fs.readFileSync("src/lib/gmail-email.ts", "utf8");
    record(
      "Gmail is disabled by code outside Vercel Production",
      /if \(!productionIntegrationsAreEnabled\(\)\) return null/.test(source),
    );
    return;
  }

  record("Gmail OAuth client id is configured server-side", Boolean(getEnv("GMAIL_CLIENT_ID")));
  record("Gmail OAuth client secret is configured server-side", Boolean(getEnv("GMAIL_CLIENT_SECRET")));
  record("Gmail OAuth refresh token is configured server-side", Boolean(getEnv("GMAIL_REFRESH_TOKEN")));
  record(
    "Gmail sender is diplomateimmobilier99@gmail.com",
    getEnv("GMAIL_SENDER_EMAIL").toLowerCase() === "diplomateimmobilier99@gmail.com",
  );
}

function isVercelNonProductionDeployment() {
  const vercelEnvironment = getEnv("VERCEL_ENV").toLowerCase();
  return Boolean(vercelEnvironment && vercelEnvironment !== "production");
}

async function checkLegacyPayDunyaConfiguration() {
  const envConfig = {
    masterKey: Boolean(getEnv("PAYDUNYA_MASTER_KEY")),
    publicKey: Boolean(getEnv("PAYDUNYA_PUBLIC_KEY")),
    privateKey: Boolean(getEnv("PAYDUNYA_PRIVATE_KEY")),
    token: Boolean(getEnv("PAYDUNYA_TOKEN")),
    mode: normalizeMode(getEnv("PAYDUNYA_MODE")),
  };

  let settingsConfig = null;
  if (getEnv("DATABASE_URL")) {
    const prisma = new PrismaClient();
    try {
      const rows = await prisma.setting.findMany({
        where: { key: { in: Object.values(PAYDUNYA_SETTING_KEYS) } },
        select: { key: true, value: true },
      });
      const settings = new Map(rows.map((row) => [row.key, row.value.trim()]));
      settingsConfig = {
        masterKey: Boolean(settings.get(PAYDUNYA_SETTING_KEYS.masterKey)),
        publicKey: Boolean(settings.get(PAYDUNYA_SETTING_KEYS.publicKey)),
        privateKey: Boolean(settings.get(PAYDUNYA_SETTING_KEYS.privateKey)),
        token: Boolean(settings.get(PAYDUNYA_SETTING_KEYS.token)),
        mode: normalizeMode(settings.get(PAYDUNYA_SETTING_KEYS.mode) ?? ""),
      };
    } catch (error) {
      warnings.push(`PayDunya database settings could not be checked: ${error instanceof Error ? error.message : "unknown error"}.`);
    } finally {
      await prisma.$disconnect();
    }
  }

  const effective = {
    masterKey: envConfig.masterKey || Boolean(settingsConfig?.masterKey),
    publicKey: envConfig.publicKey || Boolean(settingsConfig?.publicKey),
    privateKey: envConfig.privateKey || Boolean(settingsConfig?.privateKey),
    token: envConfig.token || Boolean(settingsConfig?.token),
    mode: settingsConfig?.mode || envConfig.mode,
  };

  const legacyReady = effective.masterKey
    && effective.publicKey
    && effective.privateKey
    && effective.token
    && effective.mode === "live";
  if (!legacyReady) {
    warnings.push("PayDunya legacy credentials are incomplete; old pending PayDunya returns cannot be reconciled until they are restored.");
  }
}

function normalizeMode(value) {
  const normalized = value.trim().toLowerCase();
  if (["live", "prod", "production", "real", "reel", "réel"].includes(normalized)) return "live";
  if (["sandbox", "test"].includes(normalized)) return "sandbox";
  return "";
}
