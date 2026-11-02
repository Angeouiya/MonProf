"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ImportantActionConfirm } from "@/components/shared/important-action-confirm";

export function AdminMarketplaceDisputeActions({ requestId }: { requestId: string }) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function resolve(action: "CONFIRM_COURSE" | "CREDIT_COMMISSION") {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/admin/marketplace/${requestId}/resolve`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, note }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Décision impossible.");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Décision impossible.");
    } finally { setBusy(false); }
  }
  return <div className="rounded-xl border border-[#E8DBB7] bg-[#FFFBF2] p-4 sm:col-span-3">
    <label htmlFor={`resolution-${requestId}`} className="block text-xs font-semibold text-[#6E4A13]">Décision documentée · 20 caractères minimum</label>
    <textarea id={`resolution-${requestId}`} rows={2} maxLength={1000} value={note} onChange={(event) => setNote(event.target.value)} className="mt-2 w-full rounded-lg border border-[#D7CBAF] bg-white p-3 text-sm text-[#12243A]" />
    <div className="mt-2 flex flex-wrap gap-2">
      <ImportantActionConfirm trigger={<button type="button" disabled={busy || note.trim().length < 20} className="min-h-10 rounded-lg border border-[#092A55] bg-white px-3 text-xs font-semibold text-[#092A55] disabled:opacity-50">Clôturer le cours</button>} title="Clôturer ce litige ?" description="La mission sera marquée terminée. Aucun paiement direct n’est vérifié par cette action." confirmLabel="Clôturer" onConfirm={() => resolve("CONFIRM_COURSE")} />
      <ImportantActionConfirm trigger={<button type="button" disabled={busy || note.trim().length < 20} className="min-h-10 rounded-lg bg-[#092A55] px-3 text-xs font-semibold text-white disabled:opacity-50">Recréditer la commission</button>} title="Recréditer la commission ?" description="La mission sera annulée et la commission de plateforme reversée au portefeuille du professeur. Aucun paiement direct du client n’est remboursé par Compétence." confirmLabel="Recréditer" danger onConfirm={() => resolve("CREDIT_COMMISSION")} />
    </div>
    {error && <p role="alert" className="mt-2 text-xs text-[#8B2727]">{error}</p>}
  </div>;
}
