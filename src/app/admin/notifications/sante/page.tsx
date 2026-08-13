import Link from "next/link";
import { Activity, AlertTriangle, ArrowLeft, BellRing, RadioTower, Smartphone, TimerReset, type LucideIcon } from "lucide-react";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/lib/format";
import { WebPushHealthActions } from "./actions-client";

export const dynamic = "force-dynamic";

export default async function AdminWebPushHealthPage() {
  await requireAdmin("COMMUNICATIONS_VIEW");

  const [
    subscriptionGroups,
    platformGroups,
    outboxGroups,
    deliveryGroups,
    oldestOpen,
    recentDead,
    latencyRows,
  ] = await Promise.all([
    db.webPushSubscription.groupBy({ by: ["enabled"], _count: { _all: true } }),
    db.webPushSubscription.groupBy({
      by: ["platform", "enabled"],
      _count: { _all: true },
      orderBy: [{ platform: "asc" }, { enabled: "desc" }],
    }),
    db.webPushOutbox.groupBy({
      by: ["status"],
      _count: { _all: true },
      _min: { createdAt: true },
      orderBy: { status: "asc" },
    }),
    db.webPushDelivery.groupBy({
      by: ["status"],
      _count: { _all: true },
      orderBy: { status: "asc" },
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
  ]);

  const activeDevices = countGroup(subscriptionGroups, true);
  const inactiveDevices = countGroup(subscriptionGroups, false);
  const openOutboxCount = outboxGroups
    .filter((item) => ["PENDING", "FAILED", "PROCESSING"].includes(item.status))
    .reduce((sum, item) => sum + item._count._all, 0);
  const queueLagSeconds = oldestOpen ? Math.max(0, Math.round((Date.now() - oldestOpen.createdAt.getTime()) / 1000)) : 0;
  const latency = latencyRows[0] ?? { avg_ms: null, p95_ms: null, accepted_count: 0 };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Santé notifications push"
        description="Pilotage haute charge : appareils, outbox, livraisons, latence et réparations."
      >
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
          <Button asChild variant="outline" className="rounded-xl border-[#D9E1EF] text-[#111B4D]">
            <Link href="/admin/notifications">
              <ArrowLeft className="h-4 w-4" />
              Notifications
            </Link>
          </Button>
          <WebPushHealthActions />
        </div>
      </PageHeader>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <HealthMetric icon={Smartphone} label="Appareils actifs" value={activeDevices} hint={`${inactiveDevices} désactivé(s) ou révoqué(s)`} />
        <HealthMetric icon={RadioTower} label="Outbox ouverte" value={openOutboxCount} hint={`Lag le plus ancien : ${formatDuration(queueLagSeconds)}`} danger={queueLagSeconds > 120} />
        <HealthMetric icon={BellRing} label="Acceptées 24h" value={Number(latency.accepted_count ?? 0)} hint={`Moyenne ${Math.round(Number(latency.avg_ms ?? 0))} ms`} />
        <HealthMetric icon={TimerReset} label="P95 acceptation" value={`${Math.round(Number(latency.p95_ms ?? 0))} ms`} hint="Objectif critique : 30–60 s max" danger={Number(latency.p95_ms ?? 0) > 60_000} />
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
        <Card className="border-[#D9E1EF]">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-[#111B4D]" />
              <h2 className="text-base font-black text-[#111B4D]">Pipeline d’envoi</h2>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <StatusPanel title="Outbox" rows={outboxGroups.map((item) => ({ label: item.status, value: item._count._all }))} />
              <StatusPanel title="Livraisons appareils" rows={deliveryGroups.map((item) => ({ label: item.status, value: item._count._all }))} />
            </div>
          </CardContent>
        </Card>

        <Card className="border-[#D9E1EF]">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Smartphone className="h-5 w-5 text-[#111B4D]" />
              <h2 className="text-base font-black text-[#111B4D]">Plateformes</h2>
            </div>
            <div className="mt-4 space-y-2">
              {platformGroups.length === 0 ? (
                <p className="rounded-xl bg-[#F8FAFC] px-3 py-4 text-sm font-semibold text-[#64748B]">Aucun appareil push enregistré.</p>
              ) : platformGroups.map((item) => (
                <div key={`${item.platform ?? "unknown"}-${item.enabled}`} className="flex items-center justify-between rounded-xl border border-[#E6EAF3] bg-white px-3 py-2">
                  <span className="text-sm font-black text-[#111827]">{item.platform || "Non détecté"}</span>
                  <span className={item.enabled ? "text-sm font-black text-emerald-700" : "text-sm font-black text-slate-500"}>
                    {item._count._all} {item.enabled ? "actif(s)" : "inactif(s)"}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </section>

      <Card className="border-[#D9E1EF]">
        <CardContent className="p-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-600" />
            <h2 className="text-base font-black text-[#111B4D]">Éléments à surveiller</h2>
          </div>
          <div className="mt-4 overflow-hidden rounded-xl border border-[#E6EAF3]">
            {recentDead.length === 0 ? (
              <p className="bg-white px-4 py-5 text-sm font-semibold text-[#64748B]">Aucun échec récent à traiter. Le moteur push respire bien.</p>
            ) : recentDead.map((item) => (
              <div key={item.id} className="grid gap-2 border-b border-[#E6EAF3] bg-white px-4 py-3 last:border-b-0 md:grid-cols-[160px_minmax(0,1fr)_160px] md:items-center">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className={statusClass(item.status)}>{item.status}</Badge>
                  <span className="text-xs font-black text-[#64748B]">{item.priority}</span>
                </div>
                <p className="min-w-0 truncate text-sm font-semibold text-[#334155]">{item.lastError || "Erreur provider non détaillée."}</p>
                <p className="text-xs font-bold text-[#64748B] md:text-right">{formatDateTime(item.updatedAt)}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function HealthMetric({
  icon: Icon,
  label,
  value,
  hint,
  danger = false,
}: {
  icon: LucideIcon;
  label: string;
  value: number | string;
  hint: string;
  danger?: boolean;
}) {
  return (
    <Card className={danger ? "border-red-200 bg-red-50" : "border-[#D9E1EF] bg-white"}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between gap-3">
          <span className={danger ? "flex h-10 w-10 items-center justify-center rounded-xl bg-red-100 text-red-700" : "flex h-10 w-10 items-center justify-center rounded-xl bg-[#EEF3FF] text-[#111B4D]"}>
            <Icon className="h-5 w-5" />
          </span>
          <span className={danger ? "text-right text-2xl font-black text-red-900" : "text-right text-2xl font-black text-[#111B4D]"}>{value}</span>
        </div>
        <p className="mt-3 text-xs font-black uppercase tracking-wide text-[#64748B]">{label}</p>
        <p className={danger ? "mt-1 text-sm font-semibold text-red-800" : "mt-1 text-sm font-semibold text-[#475569]"}>{hint}</p>
      </CardContent>
    </Card>
  );
}

function StatusPanel({ title, rows }: { title: string; rows: Array<{ label: string; value: number }> }) {
  return (
    <div className="rounded-xl border border-[#E6EAF3] bg-[#F8FAFC] p-3">
      <h3 className="text-sm font-black text-[#111B4D]">{title}</h3>
      <div className="mt-3 space-y-2">
        {rows.length === 0 ? (
          <p className="text-sm font-semibold text-[#64748B]">Aucune donnée.</p>
        ) : rows.map((row) => (
          <div key={row.label} className="flex items-center justify-between gap-3 rounded-lg bg-white px-3 py-2">
            <Badge variant="outline" className={statusClass(row.label)}>{row.label}</Badge>
            <span className="text-sm font-black text-[#111827]">{row.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function countGroup(groups: Array<{ enabled: boolean; _count: { _all: number } }>, enabled: boolean) {
  return groups.find((group) => group.enabled === enabled)?._count._all ?? 0;
}

function formatDuration(seconds: number) {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)} min`;
  return `${Math.round(seconds / 3600)} h`;
}

function statusClass(status: string) {
  if (["SENT", "ACCEPTED"].includes(status)) return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (["PENDING", "PROCESSING", "PARTIAL"].includes(status)) return "border-amber-200 bg-amber-50 text-amber-800";
  if (["FAILED", "DEAD", "REVOKED", "EXPIRED"].includes(status)) return "border-red-200 bg-red-50 text-red-800";
  return "border-[#D9E1EF] bg-white text-[#111B4D]";
}
