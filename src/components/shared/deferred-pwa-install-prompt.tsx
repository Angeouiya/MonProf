"use client";

import { lazy, Suspense, useEffect, useState } from "react";

const PWA_PROMPT_AFTER_LOAD_MS = 5_000;
const LazyPwaInstallPrompt = lazy(() => import("@/components/shared/pwa-install-prompt")
  .then((module) => ({ default: module.PwaInstallPrompt })));

export function DeferredPwaInstallPrompt() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let timer: number | undefined;
    const schedule = () => {
      timer = window.setTimeout(() => setReady(true), PWA_PROMPT_AFTER_LOAD_MS);
    };

    if (document.readyState === "complete") schedule();
    else window.addEventListener("load", schedule, { once: true });

    return () => {
      if (timer !== undefined) window.clearTimeout(timer);
      window.removeEventListener("load", schedule);
    };
  }, []);

  if (!ready) return null;
  return (
    <Suspense fallback={null}>
      <LazyPwaInstallPrompt />
    </Suspense>
  );
}
