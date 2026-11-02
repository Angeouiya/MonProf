"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ImportantActionConfirm } from "@/components/shared/important-action-confirm";

export function AdminMarketplaceReviewAction({ reviewId, published }: { reviewId: string; published: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function update() {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/admin/marketplace/reviews/${reviewId}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ published: !published }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Action impossible.");
      router.refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Action impossible."); }
    finally { setBusy(false); }
  }
  return <span className="inline-flex flex-wrap items-center gap-2">
    <ImportantActionConfirm trigger={<button type="button" disabled={busy} className="rounded-lg border border-[#DCE2E8] bg-white px-3 py-2 text-xs font-semibold text-[#092A55] disabled:opacity-50">{published ? "Masquer l’avis" : "Publier l’avis"}</button>} title={published ? "Masquer cet avis ?" : "Publier cet avis ?"} description="La note publique du professeur sera recalculée. La décision est journalisée." confirmLabel={published ? "Masquer" : "Publier"} onConfirm={update} />
    {error && <span role="alert" className="text-xs text-[#8B2727]">{error}</span>}
  </span>;
}
