import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getPayDunyaConfig } from "@/lib/paydunya";
import {
  getJekoServerConfig,
  hasJekoEnvironmentConfiguration,
} from "@/lib/jeko-config";
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
    integrationsConfigured: !integrationPolicy.enabled
      || (integrations.jeko.runtimeEnabled && integrations.passwordEmail.runtimeEnabled),
  };
  let legacyPaydunya = false;

  try {
    await db.$queryRaw`SELECT 1`;
    checks.database = true;

    const [subjects, levels, communes, admins, paydunyaConfig] = await Promise.all([
      db.subject.count(),
      db.level.count(),
      db.commune.count(),
      db.user.count({ where: { role: "ADMIN" } }),
      getPayDunyaConfig().catch(() => null),
    ]);

    checks.catalog = subjects > 0 && levels > 0 && communes > 0;
    checks.adminAccount = admins > 0;
    legacyPaydunya = Boolean(paydunyaConfig);
  } catch {
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
        vercelEnvironment: integrationPolicy.vercelEnvironment,
      },
      integrations,
      legacy: { paydunyaConfigured: legacyPaydunya },
    },
    {
      status: status === "ok" ? 200 : 503,
      headers: { "Cache-Control": "no-store" },
    },
  );
}
