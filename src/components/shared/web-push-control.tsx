"use client";

import { useEffect, useState } from "react";
import { BellOff, BellRing, LoaderCircle, ShieldCheck, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";

type PushStatus = "loading" | "unsupported" | "unconfigured" | "denied" | "available" | "enabled" | "saving" | "error";

export function WebPushControl({ audienceLabel }: { audienceLabel: string }) {
  const [status, setStatus] = useState<PushStatus>("loading");
  const [message, setMessage] = useState("Vérification de cet appareil...");
  const [publicKey, setPublicKey] = useState("");
  const [activeDevices, setActiveDevices] = useState(0);

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
        body: JSON.stringify(subscription.toJSON()),
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
          <Button
            type="button"
            onClick={enabled ? disable : enable}
            disabled={busy}
            className="min-h-11 w-full shrink-0 rounded-lg bg-[#111B4D] px-4 text-white hover:bg-[#1E2A78] sm:w-auto"
          >
            {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : enabled ? <BellOff className="h-4 w-4" /> : <BellRing className="h-4 w-4" />}
            {busy ? "Patientez" : enabled ? "Désactiver sur cet appareil" : "Activer sur cet appareil"}
          </Button>
        )}
      </div>
      <div className="mt-4 grid gap-2 border-t border-[#E6EAF3] pt-4 text-xs font-semibold text-[#475569] sm:grid-cols-3">
        <p className="flex items-center gap-2"><Smartphone className="h-4 w-4 text-[#111B4D]" /> {activeDevices} appareil(s) actif(s)</p>
        <p className="flex items-center gap-2"><BellRing className="h-4 w-4 text-[#111B4D]" /> Badges mis à jour automatiquement</p>
        <p className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-[#111B4D]" /> Abonnement chiffré par navigateur</p>
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
      body: JSON.stringify(subscription.toJSON()),
    });
    return { status: "enabled" as const, message: "Cet appareil reçoit les alertes en temps réel.", publicKey: data.publicKey, activeDevices: Math.max(1, Number(data.activeDevices || 0)) };
  }
  return { status: "available" as const, message: "Activez les alertes pour ne manquer aucune action importante.", publicKey: data.publicKey, activeDevices: Number(data.activeDevices || 0) };
}

function urlBase64ToUint8Array(value: string) {
  const padding = "=".repeat((4 - value.length % 4) % 4);
  const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  return Uint8Array.from([...raw].map((character) => character.charCodeAt(0)));
}
