"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertTriangle, Banknote, CheckCircle2, ClipboardCopy, Download, FileText, Loader2, Lock, MessageCircle, Search, Wallet, type LucideIcon } from "lucide-react";
import { formatDateTime, formatFCFA } from "@/lib/format";
import { buildWhatsAppUrl } from "@/lib/phone";
import { paymentMethodLabel } from "@/lib/payment-methods";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { TeacherPayoutReceiptActions } from "@/components/admin/teacher-payout-receipt-actions";

type PayoutRecord = {
  id: string;
  reference: string;
  amount: number;
  method: string | null;
  note: string | null;
  status: string;
  paidAt: string;
  createdBy?: { name: string } | null;
  allocations: {
    id: string;
    amount: number;
    booking: { id: string; reference: string; subjectName: string; levelName: string };
  }[];
};

type AccountingLedgerRow = {
  id: string;
  reference: string;
  subjectName: string;
  levelName: string;
  clientName: string;
  paymentStatus: string;
  status: string;
  teacherNetAmount: number;
  paid: number;
  retained: number;
  remaining: number;
  scheduledDate: string;
};

const MAX_REFERENCE_LENGTH = 80;
const MAX_NOTE_LENGTH = 500;

const PAYOUT_RECORD_STATUS_LABELS: Record<string, string> = {
  DRAFT: "Brouillon",
  PAID: "Payé",
  CANCELLED: "Annulé",
};

const ACCOUNTING_STATUS_LABELS: Record<string, string> = {
  BLOCKED: "Fonds bloqués",
  VALIDATED: "Fonds validés",
  TO_PAY_TEACHER: "À payer",
  TEACHER_PAID: "Professeur payé",
  REFUNDED: "Remboursé",
  FAILED: "Échec",
};

const ACCOUNTING_FILTERS = [
  { value: "all", label: "Tous les statuts" },
  { value: "BLOCKED", label: "Fonds bloqués" },
  { value: "VALIDATED", label: "Fonds validés" },
  { value: "TO_PAY_TEACHER", label: "À payer" },
  { value: "TEACHER_PAID", label: "Payé" },
  { value: "DISPUTED", label: "Litige" },
  { value: "REFUNDED", label: "Remboursé" },
  { value: "FAILED", label: "Échec" },
];

export function TeacherPayoutClient({
  teacherId,
  teacherName,
  teacherPhone,
  targetBookingId,
  dueAmount,
  grossDueAmount,
  appliedAdjustments,
  pendingAdjustments,
  paidAmount,
  records,
  ledgerRows,
}: {
  teacherId: string;
  teacherName: string;
  teacherPhone?: string | null;
  targetBookingId?: string | null;
  dueAmount: number;
  grossDueAmount: number;
  appliedAdjustments: number;
  pendingAdjustments: number;
  paidAmount: number;
  records: PayoutRecord[];
  ledgerRows: AccountingLedgerRow[];
}) {
  const router = useRouter();
  const targetRow = useMemo(
    () => targetBookingId ? ledgerRows.find((row) => row.id === targetBookingId) ?? null : null,
    [ledgerRows, targetBookingId],
  );
  const targetPayableRow = targetRow && targetRow.paymentStatus === "TO_PAY_TEACHER" && targetRow.remaining > 0 ? targetRow : null;
  const payoutLimit = targetPayableRow ? targetPayableRow.remaining : dueAmount;
  const [amount, setAmount] = useState(payoutLimit > 0 ? String(payoutLimit) : "");
  const [method, setMethod] = useState("WAVE");
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const [ledgerQuery, setLedgerQuery] = useState("");
  const [ledgerStatus, setLedgerStatus] = useState("all");
  const [ledgerStart, setLedgerStart] = useState("");
  const [ledgerEnd, setLedgerEnd] = useState("");
  const [loading, setLoading] = useState(false);

  const cleanAmount = useMemo(() => Number(amount.replace(/\s/g, "")) || 0, [amount]);
  const referenceTooLong = reference.trim().length > MAX_REFERENCE_LENGTH;
  const noteTooLong = note.trim().length > MAX_NOTE_LENGTH;
  const canSubmit = cleanAmount > 0 && cleanAmount <= payoutLimit && !referenceTooLong && !noteTooLong && !loading;
  const projectedRemainingAfterPayment = Math.max(0, payoutLimit - Math.min(cleanAmount, payoutLimit));
  const payableRows = useMemo(
    () => ledgerRows.filter((row) => row.remaining > 0 && row.paymentStatus === "TO_PAY_TEACHER"),
    [ledgerRows],
  );
  const blockedRows = useMemo(
    () => ledgerRows.filter((row) => row.paymentStatus === "BLOCKED"),
    [ledgerRows],
  );
  const sensitiveRows = useMemo(
    () => ledgerRows.filter((row) => row.retained > 0 || ["DISPUTED", "CANCELLED", "REFUNDED"].includes(row.status)),
    [ledgerRows],
  );
  const filteredLedgerRows = useMemo(() => {
    const query = ledgerQuery.trim().toLowerCase();
    const start = ledgerStart ? new Date(`${ledgerStart}T00:00:00`) : null;
    const end = ledgerEnd ? new Date(`${ledgerEnd}T23:59:59`) : null;

    return ledgerRows.filter((row) => {
      const scheduled = new Date(row.scheduledDate);
      const matchesQuery = !query || [
        row.reference,
        row.clientName,
        row.subjectName,
        row.levelName,
        row.paymentStatus,
        row.status,
      ].some((value) => value.toLowerCase().includes(query));
      const matchesStatus = ledgerStatus === "all" || row.paymentStatus === ledgerStatus || row.status === ledgerStatus;
      const matchesStart = !start || scheduled >= start;
      const matchesEnd = !end || scheduled <= end;
      return matchesQuery && matchesStatus && matchesStart && matchesEnd;
    });
  }, [ledgerEnd, ledgerQuery, ledgerRows, ledgerStart, ledgerStatus]);
  const filteredLedgerTotals = useMemo(() => (
    filteredLedgerRows.reduce(
      (acc, row) => ({
        net: acc.net + row.teacherNetAmount,
        paid: acc.paid + row.paid,
        retained: acc.retained + row.retained,
        remaining: acc.remaining + row.remaining,
      }),
      { net: 0, paid: 0, retained: 0, remaining: 0 },
    )
  ), [filteredLedgerRows]);
  const totalBlocked = blockedRows.reduce((sum, row) => sum + row.remaining, 0);
  const totalSensitive = sensitiveRows.reduce((sum, row) => sum + row.remaining + row.retained, 0);
  const accountingTimeline = useMemo(() => {
    const courseRows = ledgerRows.map((row) => ({
      id: `course-${row.id}`,
      date: row.scheduledDate,
      title: `${row.reference} - ${row.subjectName}`,
      description: `${row.clientName} · ${row.levelName}`,
      status: ACCOUNTING_STATUS_LABELS[row.paymentStatus] ?? row.paymentStatus,
      amount: row.remaining > 0 ? row.remaining : row.paid,
      detail: row.retained > 0
        ? `Payé ${formatFCFA(row.paid)} · retenu ${formatFCFA(row.retained)} · reste ${formatFCFA(row.remaining)}`
        : `Payé ${formatFCFA(row.paid)} · reste ${formatFCFA(row.remaining)}`,
      tone: row.remaining > 0 ? "amber" : "blue",
    }));
    const payoutRows = records.map((record) => ({
      id: `payout-${record.id}`,
      date: record.paidAt,
      title: `Versement enregistré - ${record.reference}`,
      description: `${paymentMethodLabel(record.method)}${record.createdBy?.name ? ` · ${record.createdBy.name}` : ""}`,
      status: PAYOUT_RECORD_STATUS_LABELS[record.status] ?? record.status,
      amount: record.amount,
      detail: record.allocations.length
        ? `${record.allocations.length} réservation(s) imputée(s)`
        : "Aucune allocation détaillée",
      tone: "violet",
    }));

    return [...courseRows, ...payoutRows]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 12);
  }, [ledgerRows, records]);
  const teacherPaymentMessage = useMemo(() => {
    const nextPayableLines = payableRows.slice(0, 6).map((row) => (
      `- ${row.reference} : ${row.subjectName}, reste ${formatFCFA(row.remaining)}`
    ));
    return [
      `Bonjour ${teacherName},`,
      "",
      "Voici votre situation de paiement MonProf CI :",
      `Montant déjà enregistré comme payé : ${formatFCFA(paidAmount)}`,
      `Montant actuellement prêt à payer : ${formatFCFA(dueAmount)}`,
      blockedRows.length ? `Montant encore bloqué en attente de validation : ${formatFCFA(totalBlocked)}` : "",
      appliedAdjustments > 0 ? `Retenues validées : ${formatFCFA(appliedAdjustments)}` : "",
      pendingAdjustments > 0 ? `Retenues en attente de décision admin : ${formatFCFA(pendingAdjustments)}` : "",
      "",
      "Réservations prêtes au paiement :",
      ...(nextPayableLines.length ? nextPayableLines : ["- Aucune réservation prête au paiement pour le moment."]),
      payableRows.length > nextPayableLines.length ? `- +${payableRows.length - nextPayableLines.length} autre(s) ligne(s) suivie(s) en interne.` : "",
      "",
      "Les fonds encore bloqués seront libérés après confirmation client/admin et contrôle qualité.",
    ].filter(Boolean).join("\n");
  }, [appliedAdjustments, blockedRows.length, dueAmount, paidAmount, payableRows, pendingAdjustments, teacherName, totalBlocked]);
  const teacherPaymentWhatsAppUrl = buildWhatsAppUrl(teacherPhone, teacherPaymentMessage);
  const payoutModeLabel = targetPayableRow
    ? `Paiement ciblé sur ${targetPayableRow.reference}`
    : "Paiement global professeur";
  const payoutOrderMessage = useMemo(() => {
    const selectedLines = targetPayableRow
      ? [`- ${targetPayableRow.reference} | ${targetPayableRow.clientName} | ${targetPayableRow.subjectName} : plafond ${formatFCFA(targetPayableRow.remaining)}`]
      : payableRows.slice(0, 8).map((row) => (
          `- ${row.reference} | ${row.clientName} | ${row.subjectName} : reste ${formatFCFA(row.remaining)}`
        ));
    const controlLines = [
      blockedRows.length ? `Fonds encore bloqués : ${formatFCFA(totalBlocked)} (${blockedRows.length} ligne(s))` : "",
      sensitiveRows.length ? `Lignes à vérifier : ${sensitiveRows.length} (${formatFCFA(totalSensitive)})` : "",
      appliedAdjustments > 0 ? `Retenues appliquées : ${formatFCFA(appliedAdjustments)}` : "",
      pendingAdjustments > 0 ? `Retenues en attente : ${formatFCFA(pendingAdjustments)}` : "",
    ].filter(Boolean);

    return [
      "Ordre interne de versement professeur",
      `Professeur : ${teacherName}`,
      `Mode : ${payoutModeLabel}`,
      `Méthode prévue : ${method}`,
      `Montant à verser maintenant : ${formatFCFA(cleanAmount)}`,
      `Plafond autorisé : ${formatFCFA(payoutLimit)}`,
      `Reste prévu après ce versement : ${formatFCFA(projectedRemainingAfterPayment)}`,
      reference.trim() ? `Référence opérateur : ${reference.trim()}` : "Référence opérateur : à compléter après paiement",
      note.trim() ? `Note interne : ${note.trim()}` : "",
      "",
      "Imputation prévue :",
      ...(selectedLines.length ? selectedLines : ["- Aucune ligne payable actuellement."]),
      payableRows.length > selectedLines.length && !targetPayableRow ? `- +${payableRows.length - selectedLines.length} autre(s) ligne(s) payable(s) dans le dossier.` : "",
      "",
      "Contrôles avant validation :",
      ...(controlLines.length ? controlLines : ["Aucune alerte comptable particulière."]),
      "",
      "Décision admin : vérifier la preuve opérateur, enregistrer le paiement dans MonProf CI, puis transmettre le reçu au professeur si nécessaire.",
    ].filter(Boolean).join("\n");
  }, [
    appliedAdjustments,
    blockedRows.length,
    cleanAmount,
    method,
    note,
    payableRows,
    payoutLimit,
    payoutModeLabel,
    pendingAdjustments,
    projectedRemainingAfterPayment,
    reference,
    sensitiveRows.length,
    targetPayableRow,
    teacherName,
    totalBlocked,
    totalSensitive,
  ]);
  const accountingState = useMemo(() => {
    if (dueAmount > 0) {
      return {
        label: "Paiement à traiter",
        title: "Un versement professeur peut être enregistré maintenant.",
        detail: `Net payable : ${formatFCFA(dueAmount)}. ${payableRows.length} réservation(s) prête(s), plafond opérationnel ${formatFCFA(payoutLimit)}.`,
        action: "Vérifier la preuve opérateur, enregistrer le versement, puis copier le reçu ou le message professeur.",
        className: "border-amber-100 bg-amber-50/85 text-amber-950",
        badgeClassName: "border-amber-200 bg-white text-amber-800",
      };
    }
    if (totalBlocked > 0) {
      return {
        label: "Attendre validation",
        title: "Des fonds existent, mais ils restent bloqués.",
        detail: `Fonds bloqués : ${formatFCFA(totalBlocked)}. Ils ne doivent pas être versés tant que le cours n'est pas validé.`,
        action: "Relancer la confirmation client/admin ou vérifier les réservations concernées avant paiement.",
        className: "border-violet-100 bg-violet-50/80 text-violet-950",
        badgeClassName: "border-violet-200 bg-white text-violet-800",
      };
    }
    if (pendingAdjustments > 0 || sensitiveRows.length > 0) {
      return {
        label: "Contrôle requis",
        title: "Le dossier contient des retenues ou lignes sensibles.",
        detail: `Retenues en attente : ${formatFCFA(pendingAdjustments)}. ${sensitiveRows.length} ligne(s) à vérifier.`,
        action: "Valider ou annuler les retenues, traiter les litiges, puis recalculer le reste dû.",
        className: "border-red-100 bg-red-50/75 text-red-950",
        badgeClassName: "border-red-200 bg-white text-red-800",
      };
    }
    return {
      label: "Dossier soldé",
      title: "Aucun paiement immédiat n'est nécessaire.",
      detail: `Déjà payé : ${formatFCFA(paidAmount)}. Aucun reste payable ni fonds bloqué à traiter maintenant.`,
      action: "Conserver l'historique et utiliser le reçu interne si le professeur demande une preuve.",
      className: "border-blue-100 bg-blue-50/75 text-blue-950",
      badgeClassName: "border-blue-200 bg-white text-blue-800",
    };
  }, [dueAmount, paidAmount, payableRows.length, payoutLimit, pendingAdjustments, sensitiveRows.length, totalBlocked]);

  const copyAccountingSummary = async () => {
    const message = [
      `Comptabilité interne - ${teacherName}`,
      `Déjà payé : ${formatFCFA(paidAmount)}`,
      `Brut dû : ${formatFCFA(grossDueAmount)}`,
      `Retenues appliquées : ${formatFCFA(appliedAdjustments)}`,
      `Retenues en attente : ${formatFCFA(pendingAdjustments)}`,
      `Net à payer : ${formatFCFA(dueAmount)}`,
      `Dernier contrôle : ${new Date().toLocaleString("fr-FR")}`,
    ].join("\n");
    await navigator.clipboard.writeText(message);
    toast.success("Résumé comptable copié.");
  };

  const copyDetailedAccountingReport = async () => {
    const line = (row: AccountingLedgerRow) => (
      `- ${row.reference} | ${row.clientName} | ${row.subjectName} (${row.levelName}) | net ${formatFCFA(row.teacherNetAmount)} | payé ${formatFCFA(row.paid)} | retenu ${formatFCFA(row.retained)} | reste ${formatFCFA(row.remaining)} | ${row.paymentStatus}`
    );
    const report = [
      `Grand livre professeur - ${teacherName}`,
      `Contrôle : ${new Date().toLocaleString("fr-FR")}`,
      "",
      `Déjà payé : ${formatFCFA(paidAmount)}`,
      `À payer maintenant : ${formatFCFA(dueAmount)}`,
      `Fonds bloqués : ${formatFCFA(totalBlocked)}`,
      `Retenues appliquées : ${formatFCFA(appliedAdjustments)}`,
      `Retenues en attente : ${formatFCFA(pendingAdjustments)}`,
      "",
      "Réservations à payer :",
      ...(payableRows.length ? payableRows.map(line) : ["- Aucune réservation payable maintenant."]),
      "",
      "Fonds encore bloqués :",
      ...(blockedRows.length ? blockedRows.map(line) : ["- Aucun fonds bloqué pour ce professeur."]),
      "",
      "Lignes sensibles / litiges / retenues :",
      ...(sensitiveRows.length ? sensitiveRows.map(line) : ["- Aucune ligne sensible."]),
    ].join("\n");
    await navigator.clipboard.writeText(report);
    toast.success("Grand livre détaillé copié.");
  };

  const copyFilteredLedgerReport = async () => {
    const line = (row: AccountingLedgerRow) => (
      `- ${row.reference} | ${row.clientName} | ${row.subjectName} (${row.levelName}) | ${formatDateTime(row.scheduledDate)} | ${ACCOUNTING_STATUS_LABELS[row.paymentStatus] ?? row.paymentStatus} | net ${formatFCFA(row.teacherNetAmount)} | payé ${formatFCFA(row.paid)} | retenu ${formatFCFA(row.retained)} | reste ${formatFCFA(row.remaining)}`
    );
    const report = [
      `Relevé filtré professeur - ${teacherName}`,
      `Contrôle : ${new Date().toLocaleString("fr-FR")}`,
      `Filtre statut : ${ACCOUNTING_FILTERS.find((item) => item.value === ledgerStatus)?.label ?? ledgerStatus}`,
      ledgerQuery.trim() ? `Recherche : ${ledgerQuery.trim()}` : "",
      ledgerStart ? `Début : ${ledgerStart}` : "",
      ledgerEnd ? `Fin : ${ledgerEnd}` : "",
      "",
      `Lignes : ${filteredLedgerRows.length}`,
      `Net professeur : ${formatFCFA(filteredLedgerTotals.net)}`,
      `Déjà payé : ${formatFCFA(filteredLedgerTotals.paid)}`,
      `Retenu : ${formatFCFA(filteredLedgerTotals.retained)}`,
      `Reste dû : ${formatFCFA(filteredLedgerTotals.remaining)}`,
      "",
      "Détail :",
      ...(filteredLedgerRows.length ? filteredLedgerRows.map(line) : ["- Aucune ligne avec ces filtres."]),
    ].filter(Boolean).join("\n");
    await navigator.clipboard.writeText(report);
    toast.success("Relevé filtré copié.");
  };

  const copyAccountingDecision = async () => {
    await navigator.clipboard.writeText([
      `Décision comptable professeur - ${teacherName}`,
      `Statut : ${accountingState.label}`,
      accountingState.title,
      accountingState.detail,
      `Action admin : ${accountingState.action}`,
      "",
      `Déjà payé : ${formatFCFA(paidAmount)}`,
      `Fonds bloqués : ${formatFCFA(totalBlocked)}`,
      `Net payable : ${formatFCFA(dueAmount)}`,
      `Retenues appliquées : ${formatFCFA(appliedAdjustments)}`,
      `Retenues en attente : ${formatFCFA(pendingAdjustments)}`,
      `Contrôle : ${new Date().toLocaleString("fr-FR")}`,
    ].join("\n"));
    toast.success("Décision comptable copiée.");
  };

  const downloadFilteredLedgerCsv = () => {
    const headers = [
      "reference",
      "client",
      "matiere",
      "niveau",
      "date",
      "statut_reservation",
      "statut_fonds",
      "net_professeur",
      "deja_paye",
      "retenu",
      "reste_du",
    ];
    const rows = filteredLedgerRows.map((row) => [
      row.reference,
      row.clientName,
      row.subjectName,
      row.levelName,
      new Date(row.scheduledDate).toLocaleString("fr-FR"),
      row.status,
      row.paymentStatus,
      row.teacherNetAmount,
      row.paid,
      row.retained,
      row.remaining,
    ]);
    const csv = [headers, ...rows].map((row) => row.map(escapeCsvValue).join(";")).join("\n");
    const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `releve-professeur-${teacherName.toLowerCase().replace(/[^a-z0-9]+/g, "-") || "professeur"}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    toast.success("Export CSV généré.");
  };

  const copyTeacherPaymentMessage = async () => {
    await navigator.clipboard.writeText(teacherPaymentMessage);
    toast.success("Message paiement professeur copié.");
  };

  const copyPayoutOrder = async () => {
    await navigator.clipboard.writeText(payoutOrderMessage);
    toast.success("Ordre de versement copié.");
  };

  const submit = async () => {
    if (!canSubmit) return;
    setLoading(true);
    try {
      const res = await fetch("/api/admin/teacher-payouts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teacherId, bookingId: targetPayableRow?.id, amount: cleanAmount, method, reference, note }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Paiement impossible.");
      toast.success(`Paiement enregistré : ${formatFCFA(cleanAmount)}`);
      setReference("");
      setNote("");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Paiement impossible.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="border-violet-100 shadow-sm">
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <CardTitle className="text-base">Comptabilité interne professeur</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            Registre interne sans wallet professeur : enregistrez les versements réels, puis le système déduit automatiquement le reste dû.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:items-end">
          <Badge variant="outline" className="w-fit border-violet-200 bg-violet-50 text-violet-800">
            Comptabilité agence, pas de wallet
          </Badge>
          <Button variant="outline" onClick={copyAccountingSummary}>
            <ClipboardCopy className="mr-1.5 h-4 w-4" />
            Copier résumé
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className={`rounded-3xl border p-4 shadow-sm ${accountingState.className}`}>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className={`w-fit font-black uppercase tracking-wide ${accountingState.badgeClassName}`}>
                  {accountingState.label}
                </Badge>
                <span className="text-xs font-bold uppercase tracking-wide opacity-65">
                  Décision opérationnelle
                </span>
              </div>
              <p className="mt-3 text-lg font-black leading-snug">{accountingState.title}</p>
              <p className="mt-1 text-sm font-medium opacity-80">{accountingState.detail}</p>
              <p className="mt-3 rounded-2xl border border-white/70 bg-white/55 px-3 py-2 text-sm font-semibold">
                {accountingState.action}
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row lg:flex-col">
              <Button type="button" variant="outline" className="bg-white/80" onClick={copyAccountingDecision}>
                <ClipboardCopy className="mr-1.5 h-4 w-4" />
                Copier décision
              </Button>
              {teacherPaymentWhatsAppUrl ? (
                <Button asChild type="button" variant="outline" className="border-blue-100 bg-white/80 text-blue-800 hover:bg-blue-50">
                  <a href={teacherPaymentWhatsAppUrl} target="_blank" rel="noreferrer">
                    <MessageCircle className="mr-1.5 h-4 w-4" />
                    WhatsApp professeur
                  </a>
                </Button>
              ) : (
                <Button type="button" variant="outline" className="bg-white/80" disabled>
                  <MessageCircle className="mr-1.5 h-4 w-4" />
                  Téléphone absent
                </Button>
              )}
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-blue-100 bg-blue-50/65 p-4">
          <div className="grid gap-3 lg:grid-cols-[1fr_auto] lg:items-center">
            <div>
              <p className="text-sm font-black text-blue-950">Règle de calcul interne</p>
              <p className="mt-1 text-sm text-blue-950/75">
                Reste dû = net professeur validé - paiements enregistrés - retenues validées. Les fonds bloqués restent visibles mais ne sont pas payables avant validation client/admin.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:flex">
              <MiniLedgerPill label="Payé" value={formatFCFA(paidAmount)} />
              <MiniLedgerPill label="Bloqué" value={formatFCFA(totalBlocked)} />
              <MiniLedgerPill label="À payer" value={formatFCFA(dueAmount)} strong />
            </div>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-3xl border border-blue-100 bg-blue-50/70 p-4">
            <Wallet className="h-5 w-5 text-blue-700" />
            <p className="mt-3 text-xs font-bold uppercase tracking-wide text-blue-900/70">Déjà payé</p>
            <p className="mt-1 text-xl font-black text-blue-950">{formatFCFA(paidAmount)}</p>
          </div>
          <div className="rounded-3xl border border-amber-100 bg-amber-50/80 p-4">
            <Banknote className="h-5 w-5 text-amber-700" />
            <p className="mt-3 text-xs font-bold uppercase tracking-wide text-amber-900/70">Net à payer</p>
            <p className="mt-1 text-xl font-black text-amber-950">{formatFCFA(dueAmount)}</p>
            {(appliedAdjustments > 0 || pendingAdjustments > 0) && (
              <p className="mt-1 text-xs font-medium text-amber-900/80">
                Brut {formatFCFA(grossDueAmount)} · retenues validées {formatFCFA(appliedAdjustments)}
              </p>
            )}
          </div>
        </div>

        {targetRow && (
          <div className={targetPayableRow ? "rounded-3xl border border-blue-100 bg-blue-50/75 p-4" : "rounded-3xl border border-amber-100 bg-amber-50/80 p-4"}>
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <p className={targetPayableRow ? "text-sm font-black text-blue-950" : "text-sm font-black text-amber-950"}>
                  {targetPayableRow ? "Paiement ciblé actif" : "Réservation ciblée non payable directement"}
                </p>
                <p className={targetPayableRow ? "mt-1 text-sm text-blue-950/75" : "mt-1 text-sm text-amber-950/75"}>
                  {targetRow.reference} - {targetRow.subjectName} avec {targetRow.clientName}. {targetPayableRow
                    ? `Le versement sera imputé uniquement sur cette réservation, dans la limite de ${formatFCFA(targetPayableRow.remaining)}.`
                    : "Cette ligne n'est pas au statut à payer ou n'a plus de reste dû ; le formulaire reste en mode global professeur."}
                </p>
              </div>
              <Badge variant="outline" className={targetPayableRow ? "w-fit border-blue-200 bg-white text-blue-800" : "w-fit border-amber-200 bg-white text-amber-800"}>
                {payoutModeLabel}
              </Badge>
            </div>
          </div>
        )}

        <div className="rounded-3xl border border-violet-100 bg-violet-50/35 p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-sm font-black text-foreground">Contrôle comptable avant versement</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Vue interne : ce qui peut être payé, ce qui reste bloqué, et les lignes sensibles à vérifier avant d'envoyer l'argent.
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button type="button" variant="outline" onClick={copyDetailedAccountingReport}>
                <ClipboardCopy className="mr-1.5 h-4 w-4" />
                Copier grand livre
              </Button>
              <Button type="button" variant="outline" onClick={copyTeacherPaymentMessage}>
                <ClipboardCopy className="mr-1.5 h-4 w-4" />
                Message professeur
              </Button>
              {teacherPaymentWhatsAppUrl ? (
                <Button asChild type="button" variant="outline" className="border-blue-100 text-blue-800 hover:bg-blue-50">
                  <a href={teacherPaymentWhatsAppUrl} target="_blank" rel="noreferrer">
                    <MessageCircle className="mr-1.5 h-4 w-4" />
                    WhatsApp paiement
                  </a>
                </Button>
              ) : (
                <Button type="button" variant="outline" disabled>
                  <MessageCircle className="mr-1.5 h-4 w-4" />
                  Téléphone manquant
                </Button>
              )}
            </div>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <AccountingControlTile
              icon={Wallet}
              label="Prêt à payer"
              count={payableRows.length}
              amount={dueAmount}
              tone="blue"
            />
            <AccountingControlTile
              icon={Lock}
              label="Fonds bloqués"
              count={blockedRows.length}
              amount={totalBlocked}
              tone="violet"
            />
            <AccountingControlTile
              icon={AlertTriangle}
              label="À vérifier"
              count={sensitiveRows.length}
              amount={totalSensitive}
              tone="amber"
            />
          </div>
          <div className="mt-4 grid gap-2">
            {payableRows.slice(0, 4).map((row) => (
              <div key={row.id} className="flex flex-col gap-2 rounded-2xl border border-white/80 bg-white/85 px-3 py-2 text-sm sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="truncate font-mono text-xs font-bold text-primary">{row.reference}</p>
                  <p className="truncate font-semibold text-foreground">{row.subjectName} - {row.clientName}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className="border-blue-100 bg-blue-50 text-blue-800">Payable</Badge>
                  <span className="font-black text-blue-950">{formatFCFA(row.remaining)}</span>
                </div>
              </div>
            ))}
            {payableRows.length === 0 && (
              <p className="rounded-2xl border border-dashed border-violet-100 bg-white/60 p-3 text-sm text-muted-foreground">
                Aucun paiement immédiat. Les montants sont soit déjà soldés, soit encore bloqués, soit en contrôle.
              </p>
            )}
          </div>
        </div>

        <div className="rounded-3xl border border-violet-100 bg-white/88 p-4 shadow-sm">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-sm font-black text-foreground">Pilotage comptable filtré</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Recherchez une réservation, isolez un statut ou une période, puis copiez ou exportez le relevé exploitable.
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button type="button" variant="outline" onClick={copyFilteredLedgerReport}>
                <ClipboardCopy className="mr-1.5 h-4 w-4" />
                Copier filtré
              </Button>
              <Button type="button" variant="outline" onClick={downloadFilteredLedgerCsv}>
                <Download className="mr-1.5 h-4 w-4" />
                Export CSV
              </Button>
            </div>
          </div>

          <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(220px,1.2fr)_190px_150px_150px]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={ledgerQuery}
                onChange={(event) => setLedgerQuery(event.target.value)}
                placeholder="Référence, client, matière, niveau..."
                className="pl-9"
              />
            </div>
            <Select value={ledgerStatus} onValueChange={setLedgerStatus}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                {ACCOUNTING_FILTERS.map((item) => (
                  <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input type="date" value={ledgerStart} onChange={(event) => setLedgerStart(event.target.value)} aria-label="Date de début du relevé" />
            <Input type="date" value={ledgerEnd} onChange={(event) => setLedgerEnd(event.target.value)} aria-label="Date de fin du relevé" />
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <FilteredLedgerMetric label="Lignes" value={`${filteredLedgerRows.length}`} />
            <FilteredLedgerMetric label="Net prof" value={formatFCFA(filteredLedgerTotals.net)} />
            <FilteredLedgerMetric label="Déjà payé" value={formatFCFA(filteredLedgerTotals.paid)} />
            <FilteredLedgerMetric label="Retenu" value={formatFCFA(filteredLedgerTotals.retained)} danger={filteredLedgerTotals.retained > 0} />
            <FilteredLedgerMetric label="Reste dû" value={formatFCFA(filteredLedgerTotals.remaining)} danger={filteredLedgerTotals.remaining > 0} />
          </div>

          <div className="mt-4 grid gap-2">
            {filteredLedgerRows.slice(0, 8).map((row) => (
              <div key={row.id} className="grid gap-3 rounded-2xl border border-violet-100 bg-violet-50/30 p-3 md:grid-cols-[1fr_auto] md:items-center">
                <div className="min-w-0">
                  <p className="truncate font-mono text-xs font-bold text-primary">{row.reference}</p>
                  <p className="mt-1 truncate text-sm font-black text-foreground">{row.clientName} - {row.subjectName}</p>
                  <p className="mt-1 truncate text-xs text-muted-foreground">
                    {row.levelName} · {formatDateTime(row.scheduledDate)}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2 md:justify-end">
                  <Badge variant="outline" className={row.paymentStatus === "TO_PAY_TEACHER" ? "border-amber-200 bg-amber-50 text-amber-800" : row.paymentStatus === "BLOCKED" ? "border-violet-200 bg-violet-50 text-violet-800" : "border-blue-200 bg-blue-50 text-blue-800"}>
                    {ACCOUNTING_STATUS_LABELS[row.paymentStatus] ?? row.paymentStatus}
                  </Badge>
                  <span className="text-sm font-black text-foreground">{formatFCFA(row.remaining)}</span>
                </div>
              </div>
            ))}
            {filteredLedgerRows.length > 8 && (
              <p className="rounded-2xl border border-dashed border-violet-100 bg-violet-50/25 p-3 text-xs font-medium text-muted-foreground">
                +{filteredLedgerRows.length - 8} autre(s) ligne(s) dans l'export et le relevé copié.
              </p>
            )}
            {filteredLedgerRows.length === 0 && (
              <p className="rounded-2xl border border-dashed border-violet-100 bg-violet-50/25 p-4 text-center text-sm text-muted-foreground">
                Aucune ligne comptable ne correspond aux filtres.
              </p>
            )}
          </div>
        </div>

        {dueAmount > 0 ? (
          <div className="rounded-3xl border border-violet-100 bg-white/80 p-4">
            <div className="mb-4 rounded-3xl border border-blue-100 bg-blue-50/70 p-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <p className="flex items-center gap-2 text-sm font-black text-blue-950">
                    <FileText className="h-4 w-4" />
                    Ordre de versement interne
                  </p>
                  <p className="mt-1 text-sm text-blue-950/75">
                    Prévisualisation exploitable avant paiement : montant prévu, imputation, reste après versement et contrôles à faire.
                  </p>
                </div>
                <Button type="button" variant="outline" className="border-blue-100 bg-white text-blue-800 hover:bg-blue-50" onClick={copyPayoutOrder}>
                  <ClipboardCopy className="mr-1.5 h-4 w-4" />
                  Copier ordre
                </Button>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-blue-100 bg-white/85 p-3">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-blue-950/55">À verser maintenant</p>
                  <p className="mt-1 text-lg font-black text-blue-950">{formatFCFA(cleanAmount)}</p>
                </div>
                <div className="rounded-2xl border border-blue-100 bg-white/85 p-3">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-blue-950/55">Plafond autorisé</p>
                  <p className="mt-1 text-lg font-black text-blue-950">{formatFCFA(payoutLimit)}</p>
                </div>
                <div className="rounded-2xl border border-blue-100 bg-white/85 p-3">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-blue-950/55">Reste après opération</p>
                  <p className="mt-1 text-lg font-black text-blue-950">{formatFCFA(projectedRemainingAfterPayment)}</p>
                </div>
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-[1fr_180px_160px]">
              <div>
                <label className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Montant payé</label>
                <Input inputMode="numeric" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="Ex : 25000" />
                {cleanAmount > payoutLimit && (
                  <p className="mt-1 text-xs font-medium text-red-700">Le montant dépasse le plafond de ce mode de paiement ({formatFCFA(payoutLimit)}).</p>
                )}
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Méthode</label>
                <Select value={method} onValueChange={setMethod}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="WAVE">Wave</SelectItem>
                    <SelectItem value="ORANGE_MONEY">Orange Money</SelectItem>
                    <SelectItem value="MTN_MONEY">MTN Money</SelectItem>
                    <SelectItem value="MOOV_MONEY">Moov Money</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end">
                <Button className="w-full" disabled={!canSubmit} onClick={submit}>
                  {loading ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-1.5 h-4 w-4" />}
                  Enregistrer
                </Button>
              </div>
            </div>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <div>
                <label className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Référence opérateur</label>
                <Input
                  value={reference}
                  onChange={(event) => setReference(event.target.value)}
                  maxLength={MAX_REFERENCE_LENGTH + 10}
                  placeholder="Optionnel"
                />
                <p className={referenceTooLong ? "mt-1 text-xs font-medium text-red-700" : "mt-1 text-xs text-muted-foreground"}>
                  {reference.trim().length}/{MAX_REFERENCE_LENGTH} caractères
                </p>
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Note interne</label>
                <Textarea
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  maxLength={MAX_NOTE_LENGTH + 50}
                  placeholder="Ex : Paiement Wave validé par l'admin"
                  className="min-h-10"
                />
                <p className={noteTooLong ? "mt-1 text-xs font-medium text-red-700" : "mt-1 text-xs text-muted-foreground"}>
                  {note.trim().length}/{MAX_NOTE_LENGTH} caractères
                </p>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button type="button" variant="secondary" onClick={() => setAmount(String(payoutLimit))}>
                {targetPayableRow ? "Payer cette réservation" : "Payer tout le reste"}
              </Button>
              <Button type="button" variant="outline" onClick={() => setAmount(String(Math.ceil(payoutLimit / 2)))}>
                Paiement partiel 50%
              </Button>
            </div>
          </div>
        ) : (
          <div className="rounded-3xl border border-blue-100 bg-blue-50/70 p-4 text-sm font-medium text-blue-900">
            Aucun reste à payer pour ce professeur.
          </div>
        )}

        <div className="rounded-3xl border border-violet-100 bg-white/85 p-4 shadow-sm">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm font-black text-foreground">Relevé comptable chronologique</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Vue rapide des cours, versements, montants restants et retenues pour contrôler l'historique du professeur.
              </p>
            </div>
            <Badge variant="outline" className="w-fit border-violet-200 bg-violet-50 text-violet-800">
              {accountingTimeline.length} ligne(s)
            </Badge>
          </div>
          <div className="mt-4 grid gap-3">
            {accountingTimeline.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-violet-100 bg-violet-50/30 p-4 text-sm text-muted-foreground">
                Aucun mouvement comptable pour ce professeur.
              </p>
            ) : (
              accountingTimeline.map((item) => (
                <div key={item.id} className="grid gap-3 rounded-2xl border border-violet-100 bg-violet-50/30 p-3 sm:grid-cols-[140px_1fr_auto] sm:items-center">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wide text-violet-950/55">Date</p>
                    <p className="mt-1 text-sm font-semibold text-violet-950">{formatDateTime(item.date)}</p>
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-black text-foreground">{item.title}</p>
                    <p className="mt-1 truncate text-xs text-muted-foreground">{item.description}</p>
                    <p className="mt-1 text-xs font-medium text-violet-950/70">{item.detail}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                    <Badge
                      variant="outline"
                      className={
                        item.tone === "amber"
                          ? "border-amber-200 bg-amber-50 text-amber-800"
                          : item.tone === "violet"
                            ? "border-violet-200 bg-violet-50 text-violet-800"
                            : "border-blue-200 bg-blue-50 text-blue-800"
                      }
                    >
                      {item.status}
                    </Badge>
                    <span className="text-sm font-black text-foreground">{formatFCFA(item.amount)}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="space-y-3">
          <p className="text-sm font-bold text-foreground">Versements enregistrés</p>
          {records.length === 0 ? (
            <p className="rounded-3xl border border-dashed border-violet-100 p-4 text-sm text-muted-foreground">Aucun versement interne enregistré.</p>
          ) : (
            records.map((record) => {
              return (
                <div key={record.id} className="rounded-3xl border border-violet-100 bg-white/90 p-4 shadow-sm">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="font-mono text-sm font-bold text-foreground">{record.reference}</p>
                      <p className="text-sm text-muted-foreground">
                        {formatDateTime(record.paidAt)} {record.createdBy?.name ? `par ${record.createdBy.name}` : ""}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                      <Badge variant="outline">{paymentMethodLabel(record.method)}</Badge>
                      <Badge className="bg-blue-50 text-blue-800 border-blue-100">{formatFCFA(record.amount)}</Badge>
                      <TeacherPayoutReceiptActions
                        teacherName={teacherName}
                        teacherPhone={teacherPhone}
                        record={record}
                      />
                    </div>
                  </div>
                  {record.note && <p className="mt-2 text-sm text-muted-foreground">{record.note}</p>}
                  <div className="mt-3 grid gap-2">
                    {record.allocations.map((allocation) => (
                      <div key={allocation.id} className="flex flex-col gap-1 rounded-2xl bg-violet-50/60 px-3 py-2 text-sm sm:flex-row sm:items-center sm:justify-between">
                        <span className="font-medium text-violet-950">
                          {allocation.booking.reference} - {allocation.booking.subjectName} ({allocation.booking.levelName})
                        </span>
                        <span className="font-bold text-violet-900">{formatFCFA(allocation.amount)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function escapeCsvValue(value: string | number) {
  const raw = String(value ?? "");
  return `"${raw.replace(/"/g, '""')}"`;
}

function MiniLedgerPill({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={strong ? "rounded-2xl border border-blue-200 bg-white px-3 py-2" : "rounded-2xl border border-blue-100 bg-white/75 px-3 py-2"}>
      <p className="text-[10px] font-bold uppercase tracking-wide text-blue-950/55">{label}</p>
      <p className={strong ? "mt-0.5 whitespace-nowrap text-sm font-black text-blue-950" : "mt-0.5 whitespace-nowrap text-sm font-bold text-blue-950/82"}>{value}</p>
    </div>
  );
}

function FilteredLedgerMetric({ label, value, danger = false }: { label: string; value: string; danger?: boolean }) {
  return (
    <div className={danger ? "rounded-2xl border border-red-100 bg-red-50/65 p-3" : "rounded-2xl border border-violet-100 bg-violet-50/35 p-3"}>
      <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={danger ? "mt-1 text-sm font-black text-red-800" : "mt-1 text-sm font-black text-foreground"}>{value}</p>
    </div>
  );
}

function AccountingControlTile({
  icon: Icon,
  label,
  count,
  amount,
  tone,
}: {
  icon: LucideIcon;
  label: string;
  count: number;
  amount: number;
  tone: "blue" | "violet" | "amber";
}) {
  const toneClass = {
    blue: "border-blue-100 bg-blue-50/80 text-blue-950",
    violet: "border-violet-100 bg-white/80 text-violet-950",
    amber: "border-amber-100 bg-amber-50/85 text-amber-950",
  }[tone];
  const iconClass = {
    blue: "text-blue-700",
    violet: "text-violet-700",
    amber: "text-amber-700",
  }[tone];

  return (
    <div className={`rounded-3xl border p-4 ${toneClass}`}>
      <Icon className={`h-5 w-5 ${iconClass}`} />
      <p className="mt-3 text-xs font-bold uppercase tracking-wide opacity-70">{label}</p>
      <p className="mt-1 text-lg font-black">{formatFCFA(amount)}</p>
      <p className="mt-1 text-xs font-medium opacity-70">{count} ligne(s)</p>
    </div>
  );
}
