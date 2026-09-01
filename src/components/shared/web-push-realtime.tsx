"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { BellRing, LoaderCircle } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { buildSubscriptionPayload, ensureCurrentPushSubscription } from "@/lib/web-push-client";

const PUSH_PROMPT_DISMISSED_KEY = "competence_push_prompt_dismissed_for_session";

export function WebPushRealtime({ initialNotificationCount = 0 }: { initialNotificationCount?: number }) {
  const router = useRouter();
  const knownCount = useRef(initialNotificationCount);
  const checking = useRef(false);
  const [permissionPromptOpen, setPermissionPromptOpen] = useState(false);
  const [permissionSaving, setPermissionSaving] = useState(false);
  const [permissionError, setPermissionError] = useState("");

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

  const enableAndTestPush = useCallback(async () => {
    setPermissionSaving(true);
    setPermissionError("");
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        throw new Error(permission === "denied"
          ? "Les notifications sont bloquées. Autorisez-les depuis le cadenas du navigateur, puis réessayez."
          : "L'autorisation est nécessaire pour recevoir les notifications Compétence.");
      }

      await synchronizePushSubscription();
      const response = await fetch("/api/push/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ reason: "activation_immediate" }),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.ok) {
        throw new Error(result?.error || result?.message || "Le test de notification n'a pas pu être envoyé.");
      }

      window.sessionStorage.removeItem(PUSH_PROMPT_DISMISSED_KEY);
      setPermissionPromptOpen(false);
      window.dispatchEvent(new CustomEvent("competence:push-enabled"));
    } catch (error) {
      setPermissionError(error instanceof Error ? error.message : "Activation impossible sur cet appareil.");
      setPermissionPromptOpen(true);
    } finally {
      setPermissionSaving(false);
    }
  }, [synchronizePushSubscription]);

  const dismissPermissionPrompt = useCallback(() => {
    window.sessionStorage.setItem(PUSH_PROMPT_DISMISSED_KEY, "1");
    setPermissionPromptOpen(false);
    setPermissionError("");
  }, []);

  useEffect(() => {
    if (!("serviceWorker" in navigator) || !("Notification" in window)) return;
    let cancelled = false;
    const synchronize = () => {
      if (!cancelled) void synchronizePushSubscription().catch(() => undefined);
    };
    synchronize();

    if (
      Notification.permission === "default"
      && "PushManager" in window
      && window.sessionStorage.getItem(PUSH_PROMPT_DISMISSED_KEY) !== "1"
    ) {
      void fetch("/api/push/subscriptions", { cache: "no-store", credentials: "same-origin" })
        .then((response) => response.ok ? response.json() : null)
        .then((state) => {
          if (!cancelled && state?.configured && state?.publicKey) setPermissionPromptOpen(true);
        })
        .catch(() => undefined);
    }

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

  return (
    <AlertDialog
      open={permissionPromptOpen}
      onOpenChange={(open) => {
        if (!open && !permissionSaving) dismissPermissionPrompt();
      }}
    >
      <AlertDialogContent className="max-w-md overflow-hidden border-[#D9E1EF] bg-white p-0">
        <AlertDialogHeader className="items-center px-5 pb-4 pt-6 text-center sm:px-7">
          <div className="mb-2 flex h-24 w-24 items-center justify-center rounded-3xl bg-white shadow-[0_12px_35px_rgba(17,27,77,0.14)] ring-1 ring-[#E3E8F2]">
            <Image
              src="/images/brand/competence-notification-icon-outline-512.png"
              alt="Icône Compétence"
              width={84}
              height={84}
              priority
              className="h-[84px] w-[84px] object-contain"
            />
          </div>
          <AlertDialogTitle className="text-xl font-black tracking-tight text-[#111B4D]">
            Recevez les alertes Compétence
          </AlertDialogTitle>
          <AlertDialogDescription className="max-w-sm text-sm font-semibold leading-6 text-[#526079]">
            Activez cet appareil pour recevoir instantanément les informations importantes, même lorsque l'application est fermée.
          </AlertDialogDescription>
          {permissionError && (
            <p role="alert" className="mt-2 rounded-xl border border-[#F0CACA] bg-[#FFF6F6] px-3 py-2 text-sm font-bold leading-5 text-[#8A1C1C]">
              {permissionError}
            </p>
          )}
        </AlertDialogHeader>
        <AlertDialogFooter className="grid grid-cols-1 gap-2 border-t border-[#E6EAF3] bg-[#FAFBFD] p-4 sm:grid-cols-2 sm:p-5">
          <AlertDialogCancel
            type="button"
            onClick={dismissPermissionPrompt}
            disabled={permissionSaving}
            className="min-h-11 rounded-xl border-[#D9E1EF] bg-white text-[#111B4D]"
          >
            Plus tard
          </AlertDialogCancel>
          <AlertDialogAction
            type="button"
            disabled={permissionSaving}
            onClick={(event) => {
              event.preventDefault();
              void enableAndTestPush();
            }}
            className="min-h-11 rounded-xl bg-[#111B4D] text-white hover:bg-[#1E2A78]"
          >
            {permissionSaving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <BellRing className="h-4 w-4" />}
            {permissionSaving ? "Activation..." : "Activer maintenant"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
