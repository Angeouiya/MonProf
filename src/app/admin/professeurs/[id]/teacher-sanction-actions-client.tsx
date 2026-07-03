"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { formatFCFA } from "@/lib/format";

export function TeacherSanctionActionsClient({
  sanctionId,
  financial,
  amount,
}: {
  sanctionId: string;
  financial: boolean;
  amount: number;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState<"apply" | "cancel" | null>(null);
  const [decisionNote, setDecisionNote] = useState("");
  const decisionNoteLength = decisionNote.trim().length;
  const decisionInvalid = financial && decisionNoteLength < 10;
  const decisionTooLong = decisionNoteLength > 700;

  const run = async (action: "apply" | "cancel") => {
    if (decisionInvalid) {
      toast.error("Ajoutez une justification admin d'au moins 10 caractères.");
      return;
    }
    if (decisionTooLong) {
      toast.error("La justification admin ne doit pas dépasser 700 caractères.");
      return;
    }
    setLoading(action);
    try {
      const res = await fetch(`/api/admin/teacher-sanctions/${sanctionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, decisionNote: decisionNote.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Action impossible.");
      toast.success(action === "apply" ? "Sanction validée." : "Sanction annulée.");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Action impossible.");
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="mt-3 rounded-2xl border border-red-100 bg-white/80 p-3">
      {financial && (
        <div className="mb-3 space-y-2">
          <p className="text-xs font-medium text-red-800">
            Validation manuelle obligatoire avant impact comptable: {formatFCFA(amount)}
          </p>
          <Textarea
            value={decisionNote}
            onChange={(event) => setDecisionNote(event.target.value)}
            maxLength={760}
            placeholder="Justification admin obligatoire : preuve, décision, contexte de retenue..."
            className="min-h-20 rounded-2xl text-sm"
          />
          <p className={decisionInvalid || decisionTooLong ? "text-xs font-medium text-red-700" : "text-xs text-muted-foreground"}>
            {decisionNoteLength}/700 caractères. Minimum 10 caractères pour valider ou annuler une retenue.
          </p>
        </div>
      )}
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button size="sm" variant="destructive" disabled={!!loading || decisionInvalid || decisionTooLong} onClick={() => run("apply")}>
          {loading === "apply" ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-1.5 h-4 w-4" />}
          Valider
        </Button>
        <Button size="sm" variant="outline" disabled={!!loading || decisionInvalid || decisionTooLong} onClick={() => run("cancel")}>
          {loading === "cancel" ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <XCircle className="mr-1.5 h-4 w-4" />}
          Annuler
        </Button>
      </div>
    </div>
  );
}
