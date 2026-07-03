"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { formatFCFA } from "@/lib/format";

type AdjustmentAction = "apply" | "cancel";

export function TeacherPaymentAdjustmentActionsClient({
  adjustmentId,
  amount,
  reason,
  bookingReference,
}: {
  adjustmentId: string;
  amount: number;
  reason: string;
  bookingReference?: string | null;
}) {
  const router = useRouter();
  const [action, setAction] = useState<AdjustmentAction | null>(null);
  const [decisionNote, setDecisionNote] = useState("");
  const [loading, setLoading] = useState(false);
  const noteTooShort = decisionNote.trim().length > 0 && decisionNote.trim().length < 10;
  const noteTooLong = decisionNote.trim().length > 700;
  const canSubmit = decisionNote.trim().length >= 10 && !noteTooLong && !loading;
  const title = action === "apply" ? "Valider la retenue" : "Annuler la retenue";
  const verb = action === "apply" ? "validée" : "annulée";

  async function submitDecision() {
    if (!action || !canSubmit) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/teacher-payment-adjustments/${adjustmentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, decisionNote }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Décision impossible.");
      toast.success(`Retenue ${verb}.`);
      setAction(null);
      setDecisionNote("");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Décision impossible.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
        <Button
          type="button"
          size="sm"
          className="bg-blue-950 text-white hover:bg-blue-900"
          onClick={() => setAction("apply")}
        >
          <CheckCircle2 className="mr-1.5 h-4 w-4" />
          Valider retenue
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="border-slate-200 text-slate-700 hover:bg-slate-50"
          onClick={() => setAction("cancel")}
        >
          <XCircle className="mr-1.5 h-4 w-4" />
          Annuler
        </Button>
      </div>

      <Dialog open={!!action} onOpenChange={(open) => !open && !loading && setAction(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>
              Décision manuelle obligatoire pour {formatFCFA(amount)}. {bookingReference ? `Réservation ${bookingReference}. ` : ""}
              Motif : {reason}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <label htmlFor={`adjustment-note-${adjustmentId}`} className="text-sm font-semibold text-foreground">
              Justification admin
            </label>
            <Textarea
              id={`adjustment-note-${adjustmentId}`}
              value={decisionNote}
              onChange={(event) => setDecisionNote(event.target.value)}
              placeholder="Ex : Preuve vérifiée, décision validée après échange avec le client et contrôle qualité."
              className="min-h-28"
              maxLength={740}
            />
            <p className={noteTooShort || noteTooLong ? "text-xs font-medium text-red-700" : "text-xs text-muted-foreground"}>
              {decisionNote.trim().length}/700 caractères. Minimum 10 caractères.
            </p>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setAction(null)} disabled={loading}>
              Fermer
            </Button>
            <Button type="button" onClick={submitDecision} disabled={!canSubmit}>
              {loading && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
              Confirmer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
