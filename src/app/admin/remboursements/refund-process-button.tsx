"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, RefreshCw } from "lucide-react";
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
import { paymentMethodLabel } from "@/lib/platform-labels";
import { cn } from "@/lib/utils";

type RefundRequestInfo = {
  reference: string;
  amount: number;
  method: string;
  paymentPhone: string;
  accountName: string | null;
  status: string;
  externalReference: string | null;
};

export function AdminRefundProcessButton({
  bookingId,
  bookingReference,
  refundAmount,
  serviceFeeAmount,
  teacherPenaltyAmount,
  platformPenaltyAmount,
  refundRequest,
  className,
}: {
  bookingId: string;
  bookingReference: string;
  refundAmount: number;
  serviceFeeAmount: number;
  teacherPenaltyAmount: number;
  platformPenaltyAmount: number;
  refundRequest: RefundRequestInfo | null | undefined;
  className?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [externalReference, setExternalReference] = useState("");
  const [loading, setLoading] = useState(false);
  const trimmedReference = externalReference.trim();
  const canProcess = Boolean(refundRequest && ["PENDING", "APPROVED"].includes(refundRequest.status) && refundAmount > 0);

  if (!refundRequest) {
    return (
      <Button size="sm" variant="outline" disabled className={cn("rounded-lg", className)}>
        Numéro attendu
      </Button>
    );
  }

  if (refundRequest.status === "PAID") {
    return (
      <Button size="sm" variant="outline" disabled className={cn("rounded-lg", className)}>
        Remboursé
      </Button>
    );
  }

  if (!canProcess) {
    return (
      <Button size="sm" variant="outline" disabled className={cn("rounded-lg", className)}>
        Non traitable
      </Button>
    );
  }

  const submit = async () => {
    if (trimmedReference.length < 3) {
      toast.error("Saisissez la référence du dépôt Mobile Money.");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`/api/admin/bookings/${bookingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "refund", externalReference: trimmedReference }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Remboursement impossible.");
      toast.success("Remboursement marqué effectué.");
      setOpen(false);
      setExternalReference("");
      router.refresh();
    } catch (error: any) {
      toast.error(error.message || "Une erreur est survenue.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className={cn("rounded-lg bg-[#111B4D] text-white hover:bg-[#1E2A78]", className)}>
          <RefreshCw className="mr-1.5 h-4 w-4" />
          Traiter
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Traiter le remboursement</DialogTitle>
          <DialogDescription>
            Confirmez uniquement après dépôt réel au client. La référence sera enregistrée dans l'historique.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-lg border border-[#DDE3EE] bg-white p-3">
            <p className="font-mono text-xs font-bold text-[#111B4D]">{bookingReference}</p>
            <p className="mt-2 text-2xl font-semibold text-[#111827]">{formatFCFA(refundAmount)}</p>
            <p className="mt-1 text-xs font-medium text-[#64748B]">
              À déposer via {paymentMethodLabel(refundRequest.method)} au {refundRequest.paymentPhone}
              {refundRequest.accountName ? ` · ${refundRequest.accountName}` : ""}.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <RefundAmount label="Frais service" value={serviceFeeAmount} />
            <RefundAmount label="Professeur" value={teacherPenaltyAmount} />
            <RefundAmount label="Plateforme" value={platformPenaltyAmount} />
          </div>

          <div className="rounded-lg border border-[#DDE3EE] bg-white p-3 text-xs leading-5 text-[#64748B]">
            <p className="font-semibold text-[#111827]">{refundRequest.reference}</p>
            <p>Statut actuel : {refundRequest.status}</p>
            <p>Les frais service ne sont pas remboursés au client. La part professeur reste visible dans sa comptabilité.</p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor={`refund-reference-${bookingId}`}>Référence du dépôt</Label>
            <Input
              id={`refund-reference-${bookingId}`}
              value={externalReference}
              onChange={(event) => setExternalReference(event.target.value)}
              placeholder="Ex: Wave TX-9344, reçu Orange Money..."
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={loading} className="rounded-lg">
            Retour
          </Button>
          <Button onClick={submit} disabled={loading || trimmedReference.length < 3} className="rounded-lg bg-[#111B4D] text-white hover:bg-[#1E2A78]">
            {loading && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
            Remboursement effectué
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RefundAmount({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-[#DDE3EE] bg-white px-3 py-2">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-[#64748B]">{label}</p>
      <p className="mt-1 text-sm font-semibold text-[#111827]">{formatFCFA(value)}</p>
    </div>
  );
}
