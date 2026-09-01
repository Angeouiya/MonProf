"use client";

import { useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { buildSubscriptionPayload, ensureCurrentPushSubscription } from "@/lib/web-push-client";

export function WebPushRealtime({ initialNotificationCount = 0 }: { initialNotificationCount?: number }) {
  const router = useRouter();
  const knownCount = useRef(initialNotificationCount);
  const checking = useRef(false);

  useEffect(() => {
    knownCount.current = initialNotificationCount;
  }, [initialNotificationCount]);

  const refreshState = useCallback(async (force = false) => {
    if (checking.current || document.visibilityState !== "visible") return;
    checking.current = true;
    try {
      const response = await fetch("/api/push/state", { cache: "no-store", credentials: "same-origin" });
      if (!response.ok) return;
      const data = await response.json() as { notificationCount?: number };
      const nextCount = Number(data.notificationCount ?? 0);
      if (force || nextCount !== knownCount.current) {
        knownCount.current = nextCount;
        window.dispatchEvent(new CustomEvent("competence:notification-count", { detail: { count: nextCount } }));
        router.refresh();
      }
    } finally {
      checking.current = false;
    }
  }, [router]);

  const synchronizePushSubscription = useCallback(async () => {
    if (!("serviceWorker" in navigator) || !("Notification" in window) || !("PushManager" in window)) return;
    await navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" });
    if (Notification.permission !== "granted") return;

    const registration = await navigator.serviceWorker.ready;
    const stateResponse = await fetch("/api/push/subscriptions", { cache: "no-store", credentials: "same-origin" });
    const state = await stateResponse.json().catch(() => null);
    if (!stateResponse.ok || !state?.configured || !state?.publicKey) return;

    const subscription = await ensureCurrentPushSubscription(registration, state.publicKey);
    const syncResponse = await fetch("/api/push/subscriptions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify(buildSubscriptionPayload(subscription)),
    });
    if (!syncResponse.ok) {
      const result = await syncResponse.json().catch(() => null);
      throw new Error(result?.error || "Synchronisation push impossible.");
    }
  }, []);

  useEffect(() => {
    if (!("serviceWorker" in navigator) || !("Notification" in window)) return;
    let cancelled = false;
    const synchronize = () => {
      if (!cancelled) void synchronizePushSubscription().catch(() => undefined);
    };
    synchronize();

    const onMessage = (event: MessageEvent) => {
      if (event.data?.type === "COMPETENCE_PUSH_RECEIVED") void refreshState(true);
    };
    const onFocus = () => {
      synchronize();
      void refreshState(false);
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        synchronize();
        void refreshState(false);
      }
    };
    navigator.serviceWorker.addEventListener("message", onMessage);
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      cancelled = true;
      navigator.serviceWorker.removeEventListener("message", onMessage);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [refreshState, synchronizePushSubscription]);

  return null;
}
