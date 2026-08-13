"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export function DeleteTeacherNotificationButton({ id }: { id: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState("");

  async function remove() {
    setNotice("");
    setLoading(true);
    try {
      const response = await fetch(`/api/professor/notifications/${id}`, {
        method: "DELETE",
        credentials: "same-origin",
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Suppression impossible.");
      setNotice("Notification supprimée.");
      router.refresh();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Suppression impossible.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid gap-1">
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={remove}
        disabled={loading}
        className="min-h-10 rounded-lg border-red-100 text-red-700 hover:border-red-200"
      >
        {loading ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Trash2 className="mr-1.5 h-4 w-4" />}
        Supprimer
      </Button>
      {notice && <p className="text-xs font-bold text-[#111B4D]" role="status">{notice}</p>}
    </div>
  );
}
