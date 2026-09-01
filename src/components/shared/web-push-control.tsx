"use client";

import { useEffect, useState } from "react";
import { BellOff, BellRing, LoaderCircle, RadioTower } from "lucide-react";
import { Button } from "@/components/ui/button";
import { buildSubscriptionPayload, ensureCurrentPushSubscription } from "@/lib/web-push-client";

type PushStatus = "loading" | "unsupported" | "unconfigured" | "denied" | "available" | "enabled" | "saving" | "error";

export function WebPushControl({ audienceLabel }: { audienceLabel: string }) {
  const [status, setStatus] = useState<PushStatus>("loading");
  const [message, setMessage] = useState("Vérification de cet appareil...");
  const [publicKey, setPublicKey] = useState("");
  const [testing, setTesting] = useState(false);
  const [testMessage, setTestMessage] = useState("");

  useEffect(() => {
    let cancelled = false;
    void inspect().then((result) => {
      if (cancelled) return;
      setStatus(result.status);
      setMessage(result.message);
      setPublicKey(result.publicKey);
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
      await navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" });
      const registration = await navigator.serviceWorker.ready;
      const subscription = await ensureCurrentPushSubscription(registration, publicKey);
      const response = await fetch("/api/push/subscriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify(buildSubscriptionPayload(subscription)),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error || "Activation impossible.");
      setStatus("enabled");
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
      const current = await inspect();
      setStatus(current.status);
      setMessage(current.message);
      setPublicKey(current.publicKey);
      if (current.status !== "enabled") {
        throw new Error(current.message);
      }
      const response = await fetch("/api/push/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ reason: `test_${audienceLabel}` }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Test push impossible.");
      setTestMessage("");
    } catch (error) {
      setTestMessage(error instanceof Error ? error.message : "Test push impossible sur cet appareil.");
    } finally {
      setTesting(false);
    }
  }

  const enabled = status === "enabled";
  const busy = status === "loading" || status === "saving";
  const actionable = !["unsupported", "unconfigured", "denied"].includes(status);
  const showMessage = !actionable || status === "error";

  return (
    <section
      data-web-push-control
      className="rounded-lg border border-[#D9E1EF] bg-white p-3 sm:p-4"
      aria-label={`Alertes ${audienceLabel}`}
      aria-live="polite"
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
        {actionable && (
          <div className="grid w-full gap-2 sm:w-auto sm:min-w-[22rem] sm:grid-cols-2">
            <Button
              type="button"
              onClick={enabled ? disable : enable}
              disabled={busy || testing}
              className="min-h-11 w-full rounded-lg bg-[#111B4D] px-4 text-white hover:bg-[#1E2A78]"
            >
              {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : enabled ? <BellOff className="h-4 w-4" /> : <BellRing className="h-4 w-4" />}
              {busy ? "Patientez" : enabled ? "Désactiver sur cet appareil" : "Activer sur cet appareil"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={testThisDevice}
              disabled={!enabled || busy || testing}
              className="min-h-11 w-full rounded-lg border-[#D9E1EF] bg-white text-[#111B4D] disabled:opacity-50"
            >
              {testing ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <RadioTower className="h-4 w-4" />}
              Tester sur cet appareil
            </Button>
          </div>
        )}
        {showMessage && (
          <p className="rounded-lg border border-[#E6EAF3] bg-[#F8FAFC] px-3 py-2 text-sm font-semibold leading-6 text-[#111B4D]">
            {message}
          </p>
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
    </section>
  );
}

async function inspect() {
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
    return { status: "unsupported" as const, message: "Ce navigateur ne prend pas en charge les notifications push web.", publicKey: "" };
  }
  const response = await fetch("/api/push/subscriptions", { cache: "no-store", credentials: "same-origin" });
  const data = await response.json().catch(() => null);
  if (!response.ok || !data?.configured || !data?.publicKey) {
    return { status: "unconfigured" as const, message: data?.error || "Le service push n'est pas encore configuré.", publicKey: "" };
  }
  await navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" });
  const registration = await navigator.serviceWorker.ready;
  let subscription = await registration.pushManager.getSubscription();
  if (Notification.permission === "denied") {
    return { status: "denied" as const, message: "Les notifications sont bloquées dans les réglages de ce navigateur.", publicKey: data.publicKey };
  }
  if (subscription && Notification.permission === "granted") {
    subscription = await ensureCurrentPushSubscription(registration, data.publicKey);
    const syncResponse = await fetch("/api/push/subscriptions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify(buildSubscriptionPayload(subscription)),
    });
    const syncResult = await syncResponse.json().catch(() => null);
    if (!syncResponse.ok) {
      return {
        status: "error" as const,
        message: syncResult?.error || "Cet appareil n'a pas pu être enregistré pour les notifications.",
        publicKey: data.publicKey,
      };
    }
    return { status: "enabled" as const, message: "Cet appareil reçoit les alertes en temps réel.", publicKey: data.publicKey };
  }
  return { status: "available" as const, message: "Activez les alertes pour ne manquer aucune action importante.", publicKey: data.publicKey };
}
