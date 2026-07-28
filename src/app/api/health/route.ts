import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getPayDunyaConfig } from "@/lib/paydunya";
import { getJekoServerConfig } from "@/lib/jeko-config";
import { isGmailConfigured } from "@/lib/gmail-email";

export const dynamic = "force-dynamic";

type HealthStatus = "ok" | "degraded";

export async function GET() {
  const startedAt = Date.now();
  const checks = {
    database: false,
    catalog: false,
    adminAccount: false,
    jeko: Boolean(getJekoServerConfig()),
    gmail: isGmailConfigured(),
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
      app: "competence",
      checkedAt: new Date().toISOString(),
      responseTimeMs: Date.now() - startedAt,
      checks,
      legacy: { paydunyaConfigured: legacyPaydunya },
    },
    { status: status === "ok" ? 200 : 503 },
  );
}
