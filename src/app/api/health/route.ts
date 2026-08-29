import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getPayDunyaConfig } from "@/lib/paydunya";
import {
  getJekoServerConfig,
  hasJekoEnvironmentConfiguration,
} from "@/lib/jeko-config";
import { getOperationalRiskRadar, type OperationalRiskRadar } from "@/lib/operational-risk-radar";
import {
  hasGmailEnvironmentConfiguration,
  isGmailConfigured,
} from "@/lib/gmail-email";
import { readPasswordEmailProvider } from "@/lib/password-email-provider";
import { getProductionIntegrationPolicy } from "@/lib/production-integration-policy";
import {
  hasResendEnvironmentConfiguration,
  isResendConfigured,
} from "@/lib/resend-email";

export const dynamic = "force-dynamic";

type HealthStatus = "ok" | "degraded";

export async function GET() {
  const startedAt = Date.now();
  const integrationPolicy = getProductionIntegrationPolicy();
  const passwordEmailProvider = readPasswordEmailProvider();
  const gmailConfigured = hasGmailEnvironmentConfiguration();
  const gmailRuntimeEnabled = isGmailConfigured();
  const resendConfigured = hasResendEnvironmentConfiguration();
  const resendRuntimeEnabled = isResendConfigured();
  const selectedEmailConfigured = passwordEmailProvider === "gmail"
    ? gmailConfigured
    : passwordEmailProvider === "resend"
      ? resendConfigured
      : false;
  const selectedEmailRuntimeEnabled = passwordEmailProvider === "gmail"
    ? gmailRuntimeEnabled
    : passwordEmailProvider === "resend"
      ? resendRuntimeEnabled
      : false;
  const integrations = {
    jeko: {
      configured: hasJekoEnvironmentConfiguration(),
      runtimeEnabled: Boolean(getJekoServerConfig()),
      liveVerification: "not_checked_by_health" as const,
    },
    gmail: {
      configured: gmailConfigured,
      runtimeEnabled: gmailRuntimeEnabled,
      selectedForPasswordEmail: passwordEmailProvider === "gmail",
      liveVerification: "not_checked_by_health" as const,
    },
    resend: {
      configured: resendConfigured,
      runtimeEnabled: resendRuntimeEnabled,
      selectedForPasswordEmail: passwordEmailProvider === "resend",
      liveVerification: "not_checked_by_health" as const,
    },
    passwordEmail: {
      provider: passwordEmailProvider,
      configured: selectedEmailConfigured,
      runtimeEnabled: selectedEmailRuntimeEnabled,
      liveVerification: "not_checked_by_health" as const,
    },
  };
  const checks = {
    database: false,
    catalog: false,
    adminAccount: false,
    sensitiveFlowsHealthy: false,
    integrationsConfigured: !integrationPolicy.enabled
      || (integrations.jeko.runtimeEnabled && integrations.passwordEmail.runtimeEnabled),
  };
  let legacyPaydunya = false;
  let operationalRisk: OperationalRiskRadar | null = null;

  try {
    await db.$queryRaw`SELECT 1`;
    checks.database = true;

    const [subjects, levels, communes, admins, paydunyaConfig, riskRadar] = await Promise.all([
      db.subject.count(),
      db.level.count(),
      db.commune.count(),
      db.user.count({ where: { role: "ADMIN" } }),
      getPayDunyaConfig().catch(() => null),
      getOperationalRiskRadar(),
    ]);

    checks.catalog = subjects > 0 && levels > 0 && communes > 0;
    checks.adminAccount = admins > 0;
    checks.sensitiveFlowsHealthy = riskRadar.status !== "critical";
    legacyPaydunya = Boolean(paydunyaConfig);
    operationalRisk = riskRadar;
  } catch (error) {
    console.error("[health] Operational readiness check failed.", error instanceof Error ? error.message : error);
    // Keep the response intentionally non-sensitive; logs can carry details server-side.
  }

  const status: HealthStatus = Object.values(checks).every(Boolean) ? "ok" : "degraded";
  return NextResponse.json(
    {
      ok: status === "ok",
      status,
      scope: "configuration-readiness",
      app: "competence",
      checkedAt: new Date().toISOString(),
      responseTimeMs: Date.now() - startedAt,
      checks,
      integrationPolicy: {
        mode: integrationPolicy.mode,
        deploymentPlatform: integrationPolicy.deploymentPlatform,
        cloudflareEnvironment: integrationPolicy.cloudflareEnvironment,
        vercelEnvironment: integrationPolicy.vercelEnvironment,
      },
      integrations,
      operationalRisk,
      legacy: { paydunyaConfigured: legacyPaydunya },
    },
    {
      status: status === "ok" ? 200 : 503,
      headers: { "Cache-Control": "no-store" },
    },
  );
}
