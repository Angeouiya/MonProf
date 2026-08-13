"use client";

import { useEffect, useState } from "react";
import { BellOff, BellRing, LoaderCircle, RadioTower, ShieldCheck, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { buildSubscriptionPayload, urlBase64ToUint8Array } from "@/lib/web-push-client";

type PushStatus = "loading" | "unsupported" | "unconfigured" | "denied" | "available" | "enabled" | "saving" | "error";

export function WebPushControl({ audienceLabel }: { audienceLabel: string }) {
  const [status, setStatus] = useState<PushStatus>("loading");
  const [message, setMessage] = useState("Vérification de cet appareil...");
  const [publicKey, setPublicKey] = useState("");
  const [activeDevices, setActiveDevices] = useState(0);
  const [testing, setTesting] = useState(false);
  const [testMessage, setTestMessage] = useState("");

  useEffect(() => {
    let cancelled = false;
    void inspect().then((result) => {
      if (cancelled) return;
      setStatus(result.status);
      setMessage(result.message);
      setPublicKey(result.publicKey);
      setActiveDevices(result.activeDevices);
    });
    return () => { cancelled = true; };
  }, []);

  async function enable() {
    setTestMessage("");
    setStatus("saving");
    setMessage("Activation sécurisée en cours...");
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setStatus(permission === "denied" ? "denied" : "available");
        setMessage(permission === "denied"
          ? "Les notifications sont bloquées dans les réglages de ce navigateur."
          : "L'autorisation n'a pas été accordée.");
        return;
      }
      const registration = await navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" });
      const current = await registration.pushManager.getSubscription();
      const subscription = current || await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });
      const response = await fetch("/api/push/subscriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify(buildSubscriptionPayload(subscription)),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error || "Activation impossible.");
      setStatus("enabled");
      setActiveDevices((value) => Math.max(1, value));
      setMessage("Cet appareil recevra les alertes en temps réel, même lorsque l'application est fermée.");
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Activation impossible sur cet appareil.");
    }
  }

  async function disable() {
    setTestMessage("");
    setStatus("saving");
    setMessage("Désactivation en cours...");
    try {
      const registration = await navigator.serviceWorker.getRegistration("/");
      const subscription = await registration?.pushManager.getSubscription();
      const endpoint = subscription?.endpoint;
      const response = await fetch("/api/push/subscriptions", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ endpoint }),
      });
      if (!response.ok) throw new Error("La désactivation n'a pas pu être enregistrée.");
      await subscription?.unsubscribe();
      setStatus("available");
      setActiveDevices((value) => Math.max(0, value - 1));
      setMessage("Les alertes push sont désactivées sur cet appareil.");
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Désactivation impossible.");
    }
  }

  async function testThisDevice() {
    setTestMessage("");
    if (status !== "enabled") {
      setTestMessage("Activez d'abord les notifications sur cet appareil, puis relancez le test.");
      return;
    }
    setTesting(true);
    try {
      const response = await fetch("/api/push/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ reason: `test_${audienceLabel}` }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Test push impossible.");
      setTestMessage(data.message || "Notification test envoyée. Si elle n'apparaît pas, vérifiez les réglages du téléphone.");
    } catch (error) {
      setTestMessage(error instanceof Error ? error.message : "Test push impossible sur cet appareil.");
    } finally {
      setTesting(false);
    }
  }

  const enabled = status === "enabled";
  const busy = status === "loading" || status === "saving";
  const actionable = !["unsupported", "unconfigured", "denied"].includes(status);

  return (
    <section data-web-push-control className="rounded-lg border border-[#D9E1EF] bg-white p-4 sm:p-5" aria-live="polite">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-[#111B4D] text-white">
            {enabled ? <BellRing className="h-5 w-5" /> : <BellOff className="h-5 w-5" />}
          </span>
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wider text-[#64748B]">Alertes {audienceLabel}</p>
            <h2 className="mt-1 text-base font-semibold text-[#111827]">Notifications push en temps réel</h2>
            <p className="mt-1 max-w-2xl text-sm font-medium leading-6 text-[#64748B]">{message}</p>
          </div>
        </div>
        {actionable && (
          <div className="grid w-full shrink-0 gap-2 sm:w-auto sm:min-w-64">
            <Button
              type="button"
              onClick={enabled ? disable : enable}
              disabled={busy || testing}
              className="min-h-11 w-full rounded-lg bg-[#111B4D] px-4 text-white hover:bg-[#1E2A78]"
            >
              {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : enabled ? <BellOff className="h-4 w-4" /> : <BellRing className="h-4 w-4" />}
              {busy ? "Patientez" : enabled ? "Désactiver sur cet appareil" : "Activer sur cet appareil"}
            </Button>
            {enabled && (
              <Button
                type="button"
                variant="outline"
                onClick={testThisDevice}
                disabled={busy || testing}
                className="min-h-11 w-full rounded-lg border-[#D9E1EF] bg-white text-[#111B4D]"
              >
                {testing ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <RadioTower className="h-4 w-4" />}
                Tester sur cet appareil
              </Button>
            )}
          </div>
        )}
      </div>
      {testMessage && (
        <p
          role="status"
          aria-live="polite"
          className="mt-4 rounded-lg border border-[#D9E1EF] bg-white px-3 py-2 text-sm font-semibold leading-6 text-[#111B4D]"
          data-web-push-test-result
        >
          {testMessage}
        </p>
      )}
      <div className="mt-4 grid gap-2 border-t border-[#E6EAF3] pt-4 text-xs font-semibold text-[#475569] sm:grid-cols-3">
        <p className="flex items-center gap-2"><Smartphone className="h-4 w-4 text-[#111B4D]" /> {activeDevices} appareil(s) actif(s)</p>
        <p className="flex items-center gap-2"><BellRing className="h-4 w-4 text-[#111B4D]" /> Badges mis à jour automatiquement</p>
        <p className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-[#111B4D]" /> Abonnement chiffré par navigateur</p>
      </div>
      <div data-pwa-install-guide className="mt-4 rounded-lg border border-[#E6EAF3] bg-[#F8FAFC] p-3 text-sm font-medium leading-6 text-[#475569]">
        <p className="font-black text-[#111B4D]">Installer l’application Compétence</p>
        <p className="mt-1">
          Sur Android/Chrome, utilisez “Installer l’application”. Sur iPhone/iPad, ajoutez Compétence à l’écran d’accueil puis activez les notifications depuis cette carte.
        </p>
        <p className="mt-1 text-xs font-semibold text-[#64748B]">
          Les sons et vibrations restent contrôlés par le téléphone et le navigateur ; Compétence force le mode non silencieux pour les alertes urgentes quand c’est supporté.
        </p>
      </div>
    </section>
  );
}

async function inspect() {
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
    return { status: "unsupported" as const, message: "Ce navigateur ne prend pas en charge les notifications push web.", publicKey: "", activeDevices: 0 };
  }
  const response = await fetch("/api/push/subscriptions", { cache: "no-store", credentials: "same-origin" });
  const data = await response.json().catch(() => null);
  if (!response.ok || !data?.configured || !data?.publicKey) {
    return { status: "unconfigured" as const, message: data?.error || "Le service push n'est pas encore configuré.", publicKey: "", activeDevices: Number(data?.activeDevices || 0) };
  }
  const registration = await navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" });
  const subscription = await registration.pushManager.getSubscription();
  if (Notification.permission === "denied") {
    return { status: "denied" as const, message: "Les notifications sont bloquées dans les réglages de ce navigateur.", publicKey: data.publicKey, activeDevices: Number(data.activeDevices || 0) };
  }
  if (subscription && Notification.permission === "granted") {
    await fetch("/api/push/subscriptions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify(buildSubscriptionPayload(subscription)),
    });
    return { status: "enabled" as const, message: "Cet appareil reçoit les alertes en temps réel.", publicKey: data.publicKey, activeDevices: Math.max(1, Number(data.activeDevices || 0)) };
  }
  return { status: "available" as const, message: "Activez les alertes pour ne manquer aucune action importante.", publicKey: data.publicKey, activeDevices: Number(data.activeDevices || 0) };
}
