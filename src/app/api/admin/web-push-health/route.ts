import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdminApi } from "@/lib/admin-api";
import { flushWebPushOutbox } from "@/lib/web-push";
import { publishWebPushFlushEvent } from "@/lib/web-push-queue";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(req: NextRequest) {
  if (!(await requireAdminApi("COMMUNICATIONS_VIEW"))) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
  }

  const summary = await getWebPushHealthSummary();
  const { searchParams } = new URL(req.url);
  if (searchParams.get("format") === "json") {
    return NextResponse.json(summary, {
      headers: {
        "Cache-Control": "no-store",
        "Content-Disposition": `attachment; filename="competence-web-push-health-${new Date().toISOString().slice(0, 10)}.json"`,
      },
    });
  }
  return NextResponse.json(summary, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: NextRequest) {
  const admin = await requireAdminApi("COMMUNICATIONS_SEND");
  if (!admin) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const action = typeof body?.action === "string" ? body.action : "";
  const now = new Date();

  if (action === "flush_now") {
    const queued = await publishWebPushFlushEvent("manual", {
      limit: 500,
      idempotencyKey: `web-push-manual-${admin.id}-${Date.now()}`,
    });
    const directFlush = await flushWebPushOutbox(500);
    await logAction(admin.id, "Relance Web Push immédiate", `Queue=${queued.queued}; direct=${directFlush.claimed} lot(s) traité(s).`);
    return NextResponse.json({ ok: true, queued, directFlush });
  }

  if (action === "retry_failed") {
    const retry = await db.webPushOutbox.updateMany({
      where: {
        OR: [
          { status: { in: ["FAILED", "DEAD"] } },
          { status: "PROCESSING", updatedAt: { lt: new Date(Date.now() - 5 * 60_000) } },
        ],
      },
      data: {
        status: "PENDING",
        attempts: 0,
        nextAttemptAt: now,
        processedAt: null,
        lastError: null,
      },
    });
    await publishWebPushFlushEvent("health_retry", {
      limit: 500,
      idempotencyKey: `web-push-health-retry-${admin.id}-${Date.now()}`,
    });
    await logAction(admin.id, "Relance Web Push échecs", `${retry.count} notification(s) remises en attente.`);
    return NextResponse.json({ ok: true, retry });
  }

  if (action === "disable_dead_subscriptions") {
    const disabled = await db.webPushSubscription.updateMany({
      where: {
        enabled: true,
        OR: [
          { revokedAt: { not: null } },
          { failureCount: { gte: 3 } },
        ],
      },
      data: { enabled: false, revokedAt: now },
    });
    await logAction(admin.id, "Nettoyage endpoints Web Push", `${disabled.count} appareil(s) désactivé(s).`);
    return NextResponse.json({ ok: true, disabled });
  }

  return NextResponse.json({ error: "Action inconnue." }, { status: 400 });
}

async function getWebPushHealthSummary() {
  const [
    subscriptionGroups,
    platformGroups,
    outboxGroups,
    deliveryGroups,
    oldestOpen,
    recentDead,
    latencyRows,
    activeByRole,
    noSubscriptionCount,
  ] = await Promise.all([
    db.webPushSubscription.groupBy({
      by: ["enabled"],
      _count: { _all: true },
    }),
    db.webPushSubscription.groupBy({
      by: ["platform", "enabled"],
      _count: { _all: true },
      orderBy: [{ platform: "asc" }, { enabled: "desc" }],
    }),
    db.webPushOutbox.groupBy({
      by: ["status"],
      _count: { _all: true },
      _min: { createdAt: true },
    }),
    db.webPushDelivery.groupBy({
      by: ["status"],
      _count: { _all: true },
    }),
    db.webPushOutbox.findFirst({
      where: { status: { in: ["PENDING", "FAILED", "PROCESSING"] } },
      orderBy: { createdAt: "asc" },
      select: { id: true, status: true, priority: true, createdAt: true, attempts: true, lastError: true },
    }),
    db.webPushOutbox.findMany({
      where: { status: { in: ["FAILED", "DEAD", "PARTIAL"] } },
      orderBy: { updatedAt: "desc" },
      take: 12,
      select: { id: true, status: true, priority: true, attempts: true, lastError: true, updatedAt: true },
    }),
    db.$queryRaw<Array<{ avg_ms: number | null; p95_ms: number | null; accepted_count: bigint | number }>>`
      SELECT
        AVG(EXTRACT(EPOCH FROM ("acceptedAt" - "createdAt")) * 1000)::float AS avg_ms,
        percentile_cont(0.95) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM ("acceptedAt" - "createdAt")) * 1000)::float AS p95_ms,
        COUNT(*) AS accepted_count
      FROM competence."WebPushDelivery"
      WHERE "status" = 'ACCEPTED'
        AND "acceptedAt" IS NOT NULL
        AND "createdAt" >= NOW() - INTERVAL '24 hours'
    `,
    Promise.all([
      db.webPushSubscription.count({ where: { enabled: true, revokedAt: null, user: { is: { role: "CLIENT" } } } }),
      db.webPushSubscription.count({ where: { enabled: true, revokedAt: null, user: { is: { role: "ADMIN" } } } }),
      db.webPushSubscription.count({ where: { enabled: true, revokedAt: null, teacherId: { not: null } } }),
    ]),
    db.webPushOutbox.count({
      where: {
        status: "NO_SUBSCRIPTION",
        updatedAt: { gte: new Date(Date.now() - 24 * 60 * 60_000) },
      },
    }),
  ]);

  const activeDevices = countGroup(subscriptionGroups, true);
  const inactiveDevices = countGroup(subscriptionGroups, false);
  const openOutboxCount = outboxGroups
    .filter((item) => ["PENDING", "FAILED", "PROCESSING"].includes(item.status))
    .reduce((sum, item) => sum + item._count._all, 0);
  const queueLagSeconds = oldestOpen
    ? Math.max(0, Math.round((Date.now() - oldestOpen.createdAt.getTime()) / 1000))
    : 0;
  const latency = latencyRows[0] ?? { avg_ms: null, p95_ms: null, accepted_count: 0 };

  return {
    generatedAt: new Date().toISOString(),
    activeDevices,
    inactiveDevices,
    permissionProxy: {
      activeRate: activeDevices + inactiveDevices > 0
        ? Math.round((activeDevices / (activeDevices + inactiveDevices)) * 100)
        : 0,
    },
    activeByRole: {
      clients: activeByRole[0],
      admins: activeByRole[1],
      teachers: activeByRole[2],
    },
    queue: {
      openOutboxCount,
      noSubscription24h: noSubscriptionCount,
      queueLagSeconds,
      oldestOpen,
    },
    latency24h: {
      acceptedCount: Number(latency.accepted_count ?? 0),
      avgMs: Math.round(Number(latency.avg_ms ?? 0)),
      p95Ms: Math.round(Number(latency.p95_ms ?? 0)),
    },
    subscriptions: subscriptionGroups,
    platforms: platformGroups,
    outbox: outboxGroups,
    deliveries: deliveryGroups,
    recentDead,
  };
}

function countGroup(groups: Array<{ enabled: boolean; _count: { _all: number } }>, enabled: boolean) {
  return groups.find((group) => group.enabled === enabled)?._count._all ?? 0;
}

async function logAction(adminId: string, action: string, detail: string) {
  await db.adminActionLog.create({
    data: {
      adminId,
      action,
      entityType: "WebPush",
      entityId: "web-push-health",
      detail,
    },
  });
}
