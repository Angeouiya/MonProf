"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatFCFA } from "@/lib/format";
import { paymentMethodLabel } from "@/lib/payment-methods";

export function RescheduleRefundButton({
  rescheduleRequestId,
  bookingReference,
  clientName,
  clientPhone,
  amount,
  paymentMethod,
}: {
  rescheduleRequestId: string;
  bookingReference: string;
  clientName: string;
  clientPhone: string | null;
  amount: number;
  paymentMethod: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [externalReference, setExternalReference] = useState("");
  const [loading, setLoading] = useState(false);
  const trimmedReference = externalReference.trim();

  async function submitRefund() {
    if (trimmedReference.length < 3) {
      toast.error("Saisissez la référence du dépôt réellement effectué.");
      return;
    }
    setLoading(true);
    try {
      const response = await fetch(
        `/api/admin/reschedule-requests/${encodeURIComponent(rescheduleRequestId)}/refund`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ externalReference: trimmedReference }),
        },
      );
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error || "Remboursement du supplément impossible.");
      }
      toast.success(
        payload.alreadyRefunded
          ? "Ce supplément était déjà remboursé."
          : `Remboursement de ${formatFCFA(payload.amount)} enregistré.`,
      );
      setOpen(false);
      setExternalReference("");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Remboursement du supplément impossible.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="mt-3 rounded-lg">
          <RefreshCw className="mr-1.5 h-4 w-4" />
          Rembourser ce supplément
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Clôturer le remboursement du supplément</DialogTitle>
          <DialogDescription>
            Confirmez uniquement après le dépôt réel. Le montant vient du paiement vérifié et ne peut pas être modifié ici.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-xl border border-violet-200 bg-violet-50 p-4">
            <p className="font-mono text-xs font-bold text-violet-900">{bookingReference}</p>
            <p className="mt-2 text-2xl font-bold text-violet-950">{formatFCFA(amount)}</p>
            <p className="mt-1 text-xs leading-5 text-violet-800">
              Client : {clientName}
              {clientPhone ? ` · ${clientPhone}` : ""}
              {paymentMethod ? ` · ${paymentMethodLabel(paymentMethod)}` : ""}
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor={`reschedule-refund-reference-${rescheduleRequestId}`}>
              Référence du dépôt ou du reçu
            </Label>
            <Input
              id={`reschedule-refund-reference-${rescheduleRequestId}`}
              value={externalReference}
              onChange={(event) => setExternalReference(event.target.value)}
              maxLength={160}
              placeholder="Ex : Jèko/Wave TX-9344"
              autoComplete="off"
            />
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={loading}>
            Annuler
          </Button>
          <Button type="button" onClick={submitRefund} disabled={loading || trimmedReference.length < 3}>
            {loading ? "Enregistrement…" : `Confirmer ${formatFCFA(amount)}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
