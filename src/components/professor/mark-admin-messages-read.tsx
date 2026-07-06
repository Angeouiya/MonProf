"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export function MarkServiceClientMessagesRead({ enabled }: { enabled: boolean }) {
  const router = useRouter();

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;

    fetch("/api/professor/admin-messages", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    })
      .then(() => {
        if (!cancelled) router.refresh();
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [enabled, router]);

  return null;
}
