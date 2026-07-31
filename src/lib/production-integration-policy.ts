export type RuntimeEnvironment = Readonly<Record<string, string | undefined>>;

export type ProductionIntegrationPolicy = {
  enabled: boolean;
  mode: "vercel-production" | "vercel-non-production" | "local-explicit";
  vercelEnvironment: string | null;
};

/**
 * Live financial and email-provider integrations are never available from a
 * Vercel Preview or Development deployment. When VERCEL_ENV is absent, an
 * explicit local verification remains possible with locally supplied
 * credentials.
 */
export function getProductionIntegrationPolicy(
  environment: RuntimeEnvironment = process.env,
): ProductionIntegrationPolicy {
  const vercelEnvironment = environment.VERCEL_ENV?.trim().toLowerCase() || null;

  if (!vercelEnvironment) {
    return {
      enabled: true,
      mode: "local-explicit",
      vercelEnvironment: null,
    };
  }

  if (vercelEnvironment === "production") {
    return {
      enabled: true,
      mode: "vercel-production",
      vercelEnvironment,
    };
  }

  return {
    enabled: false,
    mode: "vercel-non-production",
    vercelEnvironment,
  };
}

export function productionIntegrationsAreEnabled(
  environment: RuntimeEnvironment = process.env,
) {
  return getProductionIntegrationPolicy(environment).enabled;
}
