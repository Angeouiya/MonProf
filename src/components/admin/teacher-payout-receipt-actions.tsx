"use client";

import { ClipboardCopy, MessageCircle, Printer } from "lucide-react";
import { toast } from "sonner";
import { formatDateTime, formatFCFA } from "@/lib/format";
import { buildWhatsAppUrl } from "@/lib/phone";
import { paymentMethodLabel } from "@/lib/platform-labels";
import { Button } from "@/components/ui/button";

type PayoutReceiptAllocation = {
  id?: string;
  amount: number;
  booking: {
    id?: string;
    reference: string;
    subjectName: string;
    levelName: string;
  };
};

type PayoutReceiptRecord = {
  reference: string;
  amount: number;
  method?: string | null;
  note?: string | null;
  status?: string | null;
  paidAt: string | Date;
  createdBy?: { name?: string | null } | null;
  allocations: PayoutReceiptAllocation[];
};

const PAYOUT_STATUS_LABELS: Record<string, string> = {
  DRAFT: "Brouillon",
  PAID: "Payé",
  CANCELLED: "Annulé",
};

export function TeacherPayoutReceiptActions({
  teacherName,
  teacherPhone,
  record,
  compact = false,
}: {
  teacherName: string;
  teacherPhone?: string | null;
  record: PayoutReceiptRecord;
  compact?: boolean;
}) {
  const receipt = buildPayoutReceiptText(teacherName, record);
  const whatsAppUrl = buildWhatsAppUrl(teacherPhone, receipt);

  const copyReceipt = async () => {
    await navigator.clipboard.writeText(receipt);
    toast.success("Reçu professeur copié.");
  };

  const printReceipt = () => {
    const printWindow = window.open("", "_blank", "width=860,height=980");
    if (!printWindow) {
      toast.error("Impossible d'ouvrir la fenêtre d'impression. Le reçu a été copié à la place.");
      void navigator.clipboard.writeText(receipt);
      return;
    }

    printWindow.document.write(buildPayoutReceiptHtml(teacherName, record));
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  };

  return (
    <div className={compact ? "grid gap-2 sm:flex sm:flex-wrap" : "flex flex-wrap items-center gap-2"}>
      <Button type="button" size="sm" variant="outline" onClick={copyReceipt} className={compact ? "h-10 rounded-2xl" : undefined}>
        <ClipboardCopy className="mr-1.5 h-4 w-4" />
        Copier reçu
      </Button>
      <Button type="button" size="sm" variant="outline" onClick={printReceipt} className={compact ? "h-10 rounded-2xl" : undefined}>
        <Printer className="mr-1.5 h-4 w-4" />
        Imprimer
      </Button>
      {whatsAppUrl ? (
        <Button asChild type="button" size="sm" variant="outline" className={compact ? "h-10 rounded-2xl border-blue-100 text-blue-800 hover:bg-blue-50" : "border-blue-100 text-blue-800 hover:bg-blue-50"}>
          <a href={whatsAppUrl} target="_blank" rel="noreferrer">
            <MessageCircle className="mr-1.5 h-4 w-4" />
            WhatsApp
          </a>
        </Button>
      ) : (
        <Button type="button" size="sm" variant="outline" disabled className={compact ? "h-10 rounded-2xl" : undefined}>
          <MessageCircle className="mr-1.5 h-4 w-4" />
          Téléphone absent
        </Button>
      )}
    </div>
  );
}

function buildPayoutReceiptText(teacherName: string, record: PayoutReceiptRecord) {
  const allocationLines = record.allocations.length
    ? record.allocations.map((allocation) => (
        `- ${allocation.booking.reference} | ${allocation.booking.subjectName} (${allocation.booking.levelName}) : ${formatFCFA(allocation.amount)}`
      ))
    : ["- Aucune allocation détaillée"];

  return [
    "Reçu de paiement professeur - MonProf CI",
    `Professeur : ${teacherName}`,
    `Référence reçu : ${record.reference}`,
    `Montant versé : ${formatFCFA(record.amount)}`,
    `Méthode de paiement : ${paymentMethodLabel(record.method)}`,
    `Statut : ${record.status ? PAYOUT_STATUS_LABELS[record.status] ?? record.status : "Payé"}`,
    `Date : ${formatDateTime(record.paidAt)}`,
    record.createdBy?.name ? `Enregistré par : ${record.createdBy.name}` : "",
    record.note ? `Note interne : ${record.note}` : "",
    "",
    "Réservations imputées :",
    ...allocationLines,
    "",
    "Ce reçu est une trace comptable interne MonProf CI. Il confirme le versement enregistré par l'administration et doit être conservé avec la preuve opérateur si disponible.",
  ].filter(Boolean).join("\n");
}

function buildPayoutReceiptHtml(teacherName: string, record: PayoutReceiptRecord) {
  const rows = record.allocations.length
    ? record.allocations.map((allocation) => `
      <tr>
        <td>${escapeHtml(allocation.booking.reference)}</td>
        <td>${escapeHtml(allocation.booking.subjectName)}</td>
        <td>${escapeHtml(allocation.booking.levelName)}</td>
        <td class="amount">${escapeHtml(formatFCFA(allocation.amount))}</td>
      </tr>
    `).join("")
    : `<tr><td colspan="4" class="muted">Aucune allocation détaillée</td></tr>`;

  return `<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <title>Reçu professeur ${escapeHtml(record.reference)}</title>
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; background: #f7f6fb; color: #111827; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    main { width: min(760px, calc(100% - 32px)); margin: 24px auto; border: 1px solid #e7e5f2; border-radius: 24px; background: #fff; padding: 32px; box-shadow: 0 24px 70px rgba(30, 42, 120, 0.12); }
    .brand { display: flex; align-items: center; justify-content: space-between; gap: 16px; border-bottom: 1px solid #e7e5f2; padding-bottom: 18px; }
    .brand h1 { margin: 0; color: #1E2A78; font-size: 24px; line-height: 1.15; }
    .brand p, .muted { color: #6b7280; }
    .pill { border: 1px solid #d8d5ee; border-radius: 999px; color: #1E2A78; font-size: 12px; font-weight: 800; padding: 8px 12px; text-transform: uppercase; }
    .grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; margin: 24px 0; }
    .box { border: 1px solid #e7e5f2; border-radius: 18px; background: #fbfaff; padding: 14px; }
    .box span { display: block; color: #6b7280; font-size: 11px; font-weight: 800; letter-spacing: .04em; text-transform: uppercase; }
    .box strong { display: block; margin-top: 6px; color: #111827; font-size: 15px; }
    .box.total { grid-column: 1 / -1; background: #eef2ff; border-color: #dbe4ff; }
    .box.total strong { color: #1E2A78; font-size: 26px; }
    table { width: 100%; border-collapse: collapse; margin-top: 14px; overflow: hidden; border-radius: 16px; }
    th, td { border-bottom: 1px solid #e7e5f2; padding: 12px; text-align: left; font-size: 13px; }
    th { background: #f5f3ff; color: #4c1d95; font-size: 11px; letter-spacing: .04em; text-transform: uppercase; }
    .amount { text-align: right; font-weight: 800; white-space: nowrap; }
    .note { margin-top: 18px; border: 1px solid #fde68a; border-radius: 18px; background: #fffbeb; color: #78350f; padding: 14px; font-size: 13px; }
    footer { margin-top: 24px; color: #6b7280; font-size: 12px; line-height: 1.55; }
    @media print {
      body { background: #fff; }
      main { width: 100%; margin: 0; border-radius: 0; box-shadow: none; border: 0; }
    }
    @media (max-width: 560px) {
      main { padding: 22px; }
      .brand { align-items: flex-start; flex-direction: column; }
      .grid { grid-template-columns: 1fr; }
      .box.total { grid-column: auto; }
      th, td { padding: 10px 8px; }
    }
  </style>
</head>
<body>
  <main>
    <section class="brand">
      <div>
        <h1>Reçu de paiement professeur</h1>
        <p>MonProf CI - Comptabilité interne</p>
      </div>
      <span class="pill">${escapeHtml(record.status ? PAYOUT_STATUS_LABELS[record.status] ?? record.status : "Payé")}</span>
    </section>
    <section class="grid">
      <div class="box total"><span>Montant versé</span><strong>${escapeHtml(formatFCFA(record.amount))}</strong></div>
      <div class="box"><span>Professeur</span><strong>${escapeHtml(teacherName)}</strong></div>
      <div class="box"><span>Référence reçu</span><strong>${escapeHtml(record.reference)}</strong></div>
      <div class="box"><span>Méthode</span><strong>${escapeHtml(paymentMethodLabel(record.method))}</strong></div>
      <div class="box"><span>Date</span><strong>${escapeHtml(formatDateTime(record.paidAt))}</strong></div>
      <div class="box"><span>Enregistré par</span><strong>${escapeHtml(record.createdBy?.name ?? "Administration")}</strong></div>
      <div class="box"><span>Plateforme</span><strong>MonProf CI</strong></div>
    </section>
    <section>
      <h2>Réservations imputées</h2>
      <table>
        <thead><tr><th>Référence</th><th>Matière</th><th>Niveau</th><th class="amount">Montant</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </section>
    ${record.note ? `<section class="note"><strong>Note interne</strong><br />${escapeHtml(record.note)}</section>` : ""}
    <footer>
      Ce reçu est une trace comptable interne MonProf CI. Il confirme le versement enregistré par l'administration et doit être conservé avec la preuve opérateur si disponible.
    </footer>
  </main>
</body>
</html>`;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
