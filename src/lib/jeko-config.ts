import "server-only";

export type JekoServerConfig = {
  apiBaseUrl: "https://api.jeko.africa";
  apiKey: string;
  apiKeyId: string;
  storeId: string;
  webhookSecret: string;
  timeoutMs: number;
};

export function getJekoServerConfig(): JekoServerConfig | null {
  const apiKey = process.env.JEKO_API_KEY?.trim() ?? "";
  const apiKeyId = process.env.JEKO_API_KEY_ID?.trim() ?? "";
  const storeId = process.env.JEKO_STORE_ID?.trim() ?? "";
  const webhookSecret = process.env.JEKO_WEBHOOK_SECRET?.trim() ?? "";
  if (!apiKey || !apiKeyId || !storeId || !webhookSecret) return null;

  return {
    apiBaseUrl: "https://api.jeko.africa",
    apiKey,
    apiKeyId,
    storeId,
    webhookSecret,
    timeoutMs: normalizeTimeout(process.env.JEKO_API_TIMEOUT_MS),
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
