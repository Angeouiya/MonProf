export type RuntimeEnvironment = Readonly<Record<string, string | undefined>>;

export type ProductionIntegrationPolicy = {
  enabled: boolean;
  mode:
    | "cloudflare-production"
    | "cloudflare-non-production"
    | "vercel-production"
    | "vercel-non-production"
    | "local-explicit";
  deploymentPlatform: "cloudflare" | "vercel" | "local";
  cloudflareEnvironment: string | null;
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
  const deploymentPlatform = environment.APP_DEPLOYMENT_PLATFORM?.trim().toLowerCase() || null;
  const cloudflareEnvironment = (
    environment.APP_DEPLOYMENT_ENV || environment.CLOUDFLARE_ENV
  )?.trim().toLowerCase() || null;
  const vercelEnvironment = environment.VERCEL_ENV?.trim().toLowerCase() || null;

  if (deploymentPlatform === "cloudflare" || cloudflareEnvironment) {
    const production = cloudflareEnvironment === "production";
    return {
      enabled: production,
      mode: production ? "cloudflare-production" : "cloudflare-non-production",
      deploymentPlatform: "cloudflare",
      cloudflareEnvironment,
      vercelEnvironment: null,
    };
  }

  if (!vercelEnvironment) {
    return {
      enabled: true,
      mode: "local-explicit",
      deploymentPlatform: "local",
      cloudflareEnvironment: null,
      vercelEnvironment: null,
    };
  }

  if (vercelEnvironment === "production") {
    return {
      enabled: true,
      mode: "vercel-production",
      deploymentPlatform: "vercel",
      cloudflareEnvironment: null,
      vercelEnvironment,
    };
  }

  return {
    enabled: false,
    mode: "vercel-non-production",
    deploymentPlatform: "vercel",
    cloudflareEnvironment: null,
    vercelEnvironment,
  };
}

export function productionIntegrationsAreEnabled(
  environment: RuntimeEnvironment = process.env,
) {
  return getProductionIntegrationPolicy(environment).enabled;
}
