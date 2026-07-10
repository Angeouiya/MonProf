"use client";

import { useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

const FALLBACK_CHECK_INTERVAL_MS = 45_000;

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

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    let cancelled = false;
    void navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).then(async (registration) => {
      if (cancelled || Notification.permission !== "granted" || !("PushManager" in window)) return;
      const subscription = await registration.pushManager.getSubscription();
      if (!subscription) return;
      await fetch("/api/push/subscriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify(subscription.toJSON()),
      });
    }).catch(() => undefined);

    const onMessage = (event: MessageEvent) => {
      if (event.data?.type === "COMPETENCE_PUSH_RECEIVED") void refreshState(true);
    };
    const onFocus = () => void refreshState(false);
    const onVisibility = () => {
      if (document.visibilityState === "visible") void refreshState(false);
    };
    navigator.serviceWorker.addEventListener("message", onMessage);
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);
    void refreshState(false);
    const interval = window.setInterval(() => void refreshState(false), FALLBACK_CHECK_INTERVAL_MS);

    return () => {
      cancelled = true;
      navigator.serviceWorker.removeEventListener("message", onMessage);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
      window.clearInterval(interval);
    };
  }, [refreshState]);

  return null;
}
