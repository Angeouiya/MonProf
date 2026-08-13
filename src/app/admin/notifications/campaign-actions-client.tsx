"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export function DeleteCommunicationCampaignButton({ id, title }: { id: string; title: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState("");

  async function deleteCampaign() {
    setLoading(true);
    setNotice("");
    try {
      const response = await fetch(`/api/admin/communication-campaigns/${id}`, {
        method: "DELETE",
        credentials: "same-origin",
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Suppression impossible.");
      setNotice("Campagne masquée et retirée des interfaces.");
      router.refresh();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Suppression impossible.");
    } finally {
      setLoading(false);
      setConfirming(false);
    }
  }

  return (
    <div className="rounded-lg border border-[#E2E8F0] bg-white p-2 text-left">
      {confirming ? (
        <div className="grid gap-2">
          <p className="text-xs font-semibold leading-5 text-[#475569]">
            Masquer « {title} » pour les destinataires ? Les journaux d’audit restent conservés.
          </p>
          <div className="grid gap-2 min-[460px]:grid-cols-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setConfirming(false)} disabled={loading} className="min-h-10 rounded-lg">
              Annuler
            </Button>
            <Button type="button" size="sm" onClick={deleteCampaign} disabled={loading} className="min-h-10 rounded-lg bg-red-700 text-white hover:bg-red-800">
              {loading ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Trash2 className="mr-1.5 h-4 w-4" />}
              Masquer
            </Button>
          </div>
        </div>
      ) : (
        <Button type="button" variant="outline" size="sm" onClick={() => setConfirming(true)} className="min-h-10 w-full rounded-lg border-red-100 text-red-700 hover:border-red-200">
          <Trash2 className="mr-1.5 h-4 w-4" />
          Supprimer des interfaces
        </Button>
      )}
      {notice && <p className="mt-2 text-xs font-bold text-[#111B4D]" role="status">{notice}</p>}
    </div>
  );
}
