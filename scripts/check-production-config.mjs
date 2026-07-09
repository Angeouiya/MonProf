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

checkDatabaseUrl("DATABASE_URL", { requirePgbouncer: true });
checkDatabaseUrl("DIRECT_URL", { requirePgbouncer: false });
checkStrongSecret("NEXTAUTH_SECRET", { minLength: 32 });
checkPublicUrl("NEXT_PUBLIC_APP_URL");
checkOptionalPublicUrl("NEXTAUTH_URL");
checkStrongSecret("CRON_SECRET", { minLength: 24 });
checkBuildDoesNotIgnoreCodeQualityErrors();
checkVercelDeploymentConfig();
checkHealthEndpoint();
checkNoPublicPayDunyaSecrets();
await checkPayDunyaConfiguration();

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
  record(`${key} targets schema=competence`, url.searchParams.get("schema") === "competence");
  if (options.requirePgbouncer) {
    record(`${key} is serverless pooler friendly`, url.searchParams.get("pgbouncer") === "true" && url.searchParams.has("connection_limit"));
  }
}

function checkStrongSecret(key, { minLength }) {
  const value = getEnv(key);
  const ok = value.length >= minLength && !UNSAFE_SECRET_VALUES.has(value);
  record(`${key} is strong and non-placeholder`, ok);
}

function checkPublicUrl(key) {
  const value = getEnv(key);
  const url = parseHttpsUrl(value);
  record(`${key} is HTTPS`, Boolean(url));
  if (url) record(`${key} uses competence.ci`, url.hostname === "competence.ci");
}

function checkOptionalPublicUrl(key) {
  const value = getEnv(key);
  if (!value) {
    warnings.push(`${key} is not set; NextAuth will infer the host on some platforms, but Vercel production should set it to https://competence.ci.`);
    return;
  }
  const url = parseHttpsUrl(value);
  record(`${key} is HTTPS when provided`, Boolean(url));
  if (url) record(`${key} uses competence.ci when provided`, url.hostname === "competence.ci");
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
  const leakedPublicKeys = Object.keys(process.env).filter((key) => key.startsWith("NEXT_PUBLIC_PAYDUNYA"));
  record("No PayDunya secret is exposed through NEXT_PUBLIC_*", leakedPublicKeys.length === 0);
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

  const cron = Array.isArray(config.crons)
    ? config.crons.find((item) => item?.path === "/api/cron/notification-reminders")
    : null;
  record("Vercel notification reminder cron is configured", Boolean(cron));
  if (cron) {
    record("Vercel notification reminder cron runs daily", cron.schedule === "0 8 * * *");
  }

  const cronRoutePath = "src/app/api/cron/notification-reminders/route.ts";
  if (!fs.existsSync(cronRoutePath)) {
    record("Notification reminder cron route exists", false);
    return;
  }

  const cronRoute = fs.readFileSync(cronRoutePath, "utf8");
  record(
    "Notification reminder cron requires CRON_SECRET authorization",
    /process\.env\.CRON_SECRET/.test(cronRoute)
      && /authorization/.test(cronRoute)
      && /Bearer\s/.test(cronRoute)
      && /status:\s*401/.test(cronRoute),
  );

  const ignorePath = ".vercelignore";
  if (!fs.existsSync(ignorePath)) {
    record("Vercel ignore file protects local env files", false);
    return;
  }
  const ignore = fs.readFileSync(ignorePath, "utf8");
  record("Vercel ignore file excludes local env files", /^\.env$/m.test(ignore) && /^\.env\.\*$/m.test(ignore));
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
    "Production health endpoint checks PayDunya without exposing secrets",
    /getPayDunyaConfig/.test(healthRoute)
      && !/masterKey|privateKey|publicKey|token/.test(healthRoute.replace(/getPayDunyaConfig/g, "")),
  );
}

async function checkPayDunyaConfiguration() {
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

  record("PayDunya master key is configured server-side", effective.masterKey);
  record("PayDunya public key is configured server-side", effective.publicKey);
  record("PayDunya private key is configured server-side", effective.privateKey);
  record("PayDunya token is configured server-side", effective.token);
  record("PayDunya mode is live", effective.mode === "live");
}

function normalizeMode(value) {
  const normalized = value.trim().toLowerCase();
  if (["live", "prod", "production", "real", "reel", "réel"].includes(normalized)) return "live";
  if (["sandbox", "test"].includes(normalized)) return "sandbox";
  return "";
}
