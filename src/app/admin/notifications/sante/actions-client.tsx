"use client";

import { useState } from "react";
import { BellRing, Download, LoaderCircle, RefreshCw, RotateCcw, ShieldOff } from "lucide-react";
import { Button } from "@/components/ui/button";

type HealthAction = "flush_now" | "retry_failed" | "disable_dead_subscriptions" | "test_current_admin";

export function WebPushHealthActions() {
  const [loading, setLoading] = useState<HealthAction | null>(null);
  const [notice, setNotice] = useState("");

  async function run(action: HealthAction) {
    setLoading(action);
    setNotice("");
    try {
      const response = await fetch(action === "test_current_admin" ? "/api/admin/web-push-test" : "/api/admin/web-push-health", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify(action === "test_current_admin" ? { reason: "admin_health_test" } : { action }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error || "Action impossible.");
      if (action === "test_current_admin") {
        setNotice(data.ok
          ? `Test envoyé sur cet appareil : ${data.activeDevices ?? 0} appareil(s) actif(s), ${data.flush?.sent ?? 0} push accepté(s).`
          : data.message || "Test créé, mais aucun appareil actif n'a reçu le push.");
      } else if (action === "flush_now") {
        setNotice(`Relance lancée : ${data.directFlush?.claimed ?? 0} élément(s) traités immédiatement.`);
      } else if (action === "retry_failed") {
        setNotice(`${data.retry?.count ?? 0} notification(s) remises en attente.`);
      } else {
        setNotice(`${data.disabled?.count ?? 0} appareil(s) obsolète(s) désactivé(s).`);
      }
      if (action !== "test_current_admin") {
        window.setTimeout(() => window.location.reload(), 900);
      }
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Action impossible.");
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
        <Button type="button" onClick={() => run("flush_now")} disabled={!!loading} className="rounded-xl bg-[#111B4D] text-white hover:bg-[#17245F]">
          {loading === "flush_now" ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Relancer maintenant
        </Button>
        <Button type="button" variant="outline" onClick={() => run("test_current_admin")} disabled={!!loading} className="rounded-xl border-[#CAD7F2] text-[#111B4D]">
          {loading === "test_current_admin" ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <BellRing className="h-4 w-4" />}
          Tester mon appareil
        </Button>
        <Button type="button" variant="outline" onClick={() => run("retry_failed")} disabled={!!loading} className="rounded-xl border-[#D9E1EF] text-[#111B4D]">
          {loading === "retry_failed" ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
          Reprendre les échecs
        </Button>
        <Button type="button" variant="outline" onClick={() => run("disable_dead_subscriptions")} disabled={!!loading} className="rounded-xl border-red-200 text-red-700">
          {loading === "disable_dead_subscriptions" ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <ShieldOff className="h-4 w-4" />}
          Nettoyer appareils morts
        </Button>
        <Button type="button" variant="outline" asChild className="rounded-xl border-[#D9E1EF] text-[#111B4D]">
          <a href="/api/admin/web-push-health?format=json">
            <Download className="h-4 w-4" />
            Export audit
          </a>
        </Button>
      </div>
      {notice && (
        <p className="rounded-xl border border-[#D9E1EF] bg-white px-4 py-3 text-sm font-semibold text-[#111B4D]" role="status">
          {notice}
        </p>
      )}
    </div>
  );
}
