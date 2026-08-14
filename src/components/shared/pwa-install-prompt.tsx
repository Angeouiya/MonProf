"use client";

import Image from "next/image";
import { Download, Share2, Smartphone, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

const DISMISSED_AT_KEY = "competence:pwa-install-dismissed-at:v1";
const DISMISS_DURATION_MS = 7 * 24 * 60 * 60 * 1000;

export function PwaInstallPrompt() {
  const deferredPrompt = useRef<InstallPromptEvent | null>(null);
  const [open, setOpen] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const [nativePromptAvailable, setNativePromptAvailable] = useState(false);

  useEffect(() => {
    const navigatorWithStandalone = navigator as Navigator & { standalone?: boolean; userAgentData?: { mobile?: boolean } };
    const installed = window.matchMedia("(display-mode: standalone)").matches || navigatorWithStandalone.standalone === true;
    const mobile = navigatorWithStandalone.userAgentData?.mobile === true
      || /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent)
      || window.matchMedia("(max-width: 820px) and (pointer: coarse)").matches;
    if (!mobile || installed) return;

    const dismissedAt = Number(window.localStorage.getItem(DISMISSED_AT_KEY) || 0);
    if (dismissedAt && Date.now() - dismissedAt < DISMISS_DURATION_MS) return;

    const ios = /iPhone|iPad|iPod/i.test(navigator.userAgent);
    if ("serviceWorker" in navigator) {
      void navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch(() => undefined);
    }

    const showTimer = window.setTimeout(() => {
      setIsIos(ios);
      setOpen(true);
    }, ios ? 700 : 1_400);
    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      deferredPrompt.current = event as InstallPromptEvent;
      setNativePromptAvailable(true);
      setOpen(true);
    };
    const onInstalled = () => {
      deferredPrompt.current = null;
      setNativePromptAvailable(false);
      setOpen(false);
      window.localStorage.removeItem(DISMISSED_AT_KEY);
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.clearTimeout(showTimer);
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  function dismiss() {
    window.localStorage.setItem(DISMISSED_AT_KEY, String(Date.now()));
    setOpen(false);
  }

  async function install() {
    if (!deferredPrompt.current) {
      setNativePromptAvailable(false);
      return;
    }
    await deferredPrompt.current.prompt();
    const choice = await deferredPrompt.current.userChoice;
    deferredPrompt.current = null;
    setNativePromptAvailable(false);
    if (choice.outcome === "accepted") {
      setOpen(false);
      return;
    }
    dismiss();
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[180] flex items-center justify-center bg-[#07102F]/55 p-4 backdrop-blur-sm" role="presentation">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="pwa-install-title"
        aria-describedby="pwa-install-description"
        className="relative w-full max-w-sm rounded-2xl border border-[#DDE6F7] bg-white p-5 shadow-2xl sm:p-6"
        data-pwa-install-prompt
      >
        <button type="button" onClick={dismiss} aria-label="Installer plus tard" className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-lg border border-[#E3E8F2] bg-white text-[#475569]">
          <X className="h-4 w-4" aria-hidden />
        </button>
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-[#DDE6F7] bg-white shadow-sm">
          <Image src="/images/brand/competence-icon-192-safe.png" alt="" width={54} height={54} priority />
        </div>
        <p className="mt-5 text-xs font-black uppercase tracking-[0.14em] text-[#B47C00]">Application Compétence</p>
        <h2 id="pwa-install-title" className="mt-2 text-2xl font-black tracking-tight text-[#111827]">Installez Compétence sur votre téléphone</h2>
        <p id="pwa-install-description" className="mt-2 text-sm font-medium leading-6 text-[#64748B]">
          Retrouvez vos cours, paiements et notifications depuis votre écran d’accueil.
        </p>

        {nativePromptAvailable ? (
          <div className="mt-5 flex items-start gap-3 rounded-xl border border-[#DDE6F7] bg-[#F8FAFC] p-3 text-sm font-semibold text-[#111827]">
            <Smartphone className="mt-0.5 h-5 w-5 shrink-0 text-[#111B4D]" aria-hidden />
            <span>L’installation est prête sur cet appareil.</span>
          </div>
        ) : (
          <div className="mt-5 rounded-xl border border-[#DDE6F7] bg-[#F8FAFC] p-3 text-sm font-semibold leading-6 text-[#111827]">
            <p className="flex items-start gap-2">
              {isIos ? <Share2 className="mt-0.5 h-5 w-5 shrink-0 text-[#111B4D]" aria-hidden /> : <Download className="mt-0.5 h-5 w-5 shrink-0 text-[#111B4D]" aria-hidden />}
              <span>{isIos ? "Touchez Partager, puis Ajouter à l’écran d’accueil." : "Ouvrez le menu du navigateur, puis choisissez Installer l’application ou Ajouter à l’écran d’accueil."}</span>
            </p>
          </div>
        )}

        <div className="mt-5 grid gap-2">
          {nativePromptAvailable ? (
            <Button type="button" onClick={() => void install()} className="min-h-12 w-full rounded-xl">
              <Download className="mr-2 h-4 w-4" aria-hidden /> Installer maintenant
            </Button>
          ) : (
            <Button type="button" onClick={dismiss} className="min-h-12 w-full rounded-xl">J’ai compris</Button>
          )}
          <Button type="button" variant="ghost" onClick={dismiss} className="min-h-11 w-full rounded-xl">Plus tard</Button>
        </div>
      </section>
    </div>
  );
}
