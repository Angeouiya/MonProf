import "server-only";
import {
  productionIntegrationsAreEnabled,
  type RuntimeEnvironment,
} from "./production-integration-policy";

export type JekoServerConfig = {
  apiBaseUrl: "https://api.jeko.africa";
  apiKey: string;
  apiKeyId: string;
  storeId: string;
  webhookSecret: string;
  timeoutMs: number;
};

export function getJekoServerConfig(): JekoServerConfig | null {
  if (!productionIntegrationsAreEnabled()) return null;
  return readJekoEnvironmentConfig();
}

export function hasJekoEnvironmentConfiguration() {
  return Boolean(readJekoEnvironmentConfig());
}

function readJekoEnvironmentConfig(
  environment: RuntimeEnvironment = process.env,
): JekoServerConfig | null {
  const apiKey = environment.JEKO_API_KEY?.trim() ?? "";
  const apiKeyId = environment.JEKO_API_KEY_ID?.trim() ?? "";
  const storeId = environment.JEKO_STORE_ID?.trim() ?? "";
  const webhookSecret = environment.JEKO_WEBHOOK_SECRET?.trim() ?? "";
  if (!apiKey || !apiKeyId || !storeId || !webhookSecret) return null;

  return {
    apiBaseUrl: "https://api.jeko.africa",
    apiKey,
    apiKeyId,
    storeId,
    webhookSecret,
    timeoutMs: normalizeTimeout(environment.JEKO_API_TIMEOUT_MS),
  };
}

export function requireJekoServerConfig() {
  const config = getJekoServerConfig();
  if (!config) {
    throw new Error(
      "Jèko n'est pas configuré. JEKO_API_KEY, JEKO_API_KEY_ID, JEKO_STORE_ID et JEKO_WEBHOOK_SECRET sont requis.",
    );
  }
  return config;
}

function normalizeTimeout(raw: string | undefined) {
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return 8_000;
  return Math.min(20_000, Math.max(2_000, Math.round(parsed)));
}
