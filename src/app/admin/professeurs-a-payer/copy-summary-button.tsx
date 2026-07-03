"use client";

import { ClipboardCopy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { formatFCFA } from "@/lib/format";

type PaymentSummaryRow = {
  reference: string;
  clientName: string;
  paid: number;
  retained: number;
  remaining: number;
};

export function CopyTeacherPaymentSummaryButton({
  teacherName,
  total,
  grossTotal,
  retainedTotal,
  pendingRetentions,
  rows,
}: {
  teacherName: string;
  total: number;
  grossTotal: number;
  retainedTotal: number;
  pendingRetentions: number;
  rows: PaymentSummaryRow[];
}) {
  async function copySummary() {
    const details = rows.map((row) => (
      `- ${row.reference} | Client: ${row.clientName} | Déjà payé: ${formatFCFA(row.paid)} | Retenu: ${formatFCFA(row.retained)} | Reste: ${formatFCFA(row.remaining)}`
    ));
    const message = [
      `Synthèse paiement professeur - ${teacherName}`,
      `Net à payer maintenant : ${formatFCFA(total)}`,
      `Brut avant ajustements : ${formatFCFA(grossTotal)}`,
      `Retenues appliquées : ${formatFCFA(retainedTotal)}`,
      `Retenues en attente : ${formatFCFA(pendingRetentions)}`,
      `Nombre de cours concernés : ${rows.length}`,
      "",
      "Détail des réservations :",
      ...details,
      "",
      `Copié le : ${new Date().toLocaleString("fr-FR")}`,
    ].join("\n");
    await navigator.clipboard.writeText(message);
    toast.success("Synthèse paiement copiée.");
  }

  return (
    <Button type="button" variant="outline" onClick={copySummary}>
      <ClipboardCopy className="mr-1.5 h-4 w-4" />
      Copier synthèse
    </Button>
  );
}
