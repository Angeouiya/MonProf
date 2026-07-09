"use client";

import { CalendarClock, CheckCircle2, Clock, Hourglass, RefreshCw, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatFCFA } from "@/lib/format";
import { rescheduleWindowLabel } from "@/lib/reschedule-policy";

type RescheduleRequest = {
  id: string;
  status: string;
  oldScheduledDate: string | null;
  oldScheduledTime: string | null;
  proposedDate: string;
  proposedTime: string;
  reason: string | null;
  feeWindow: string;
  feeBaseAmount: number;
  feeRate: number;
  feeAmount: number;
  paymentServiceFeeAmount: number;
  paymentServiceFeeLabel: string | null;
  totalToPay: number;
  paydunyaStatus: string | null;
  paidAt: string | null;
  teacherResponse: string | null;
  teacherRespondedAt: string | null;
  appliedAt: string | null;
  createdAt: string;
  transactionStatus: string | null;
};

export function ClientRescheduleRequestPanel({ requests }: { requests: RescheduleRequest[] }) {
  if (requests.length === 0) return null;
  const latest = requests[0];
  return (
    <section className="overflow-hidden rounded-lg border border-[#DDE6F7] bg-white p-4">
      <div className="flex items-start gap-3 border-b border-[#E6EAF3] pb-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#111B4D] text-white">
          <CalendarClock className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[#64748B]">Créneau</p>
          <h2 className="mt-0.5 text-base font-semibold leading-tight text-[#111827]">
            {latest.status === "APPLIED" ? "Créneau modifié" : "Modification en cours"}
          </h2>
        </div>
      </div>

      <div className="mt-4 space-y-3">
        <div className="rounded-lg border border-[#E3E8F2] bg-white p-3">
          <div className="flex flex-wrap items-center gap-2">
            {statusIcon(latest.status)}
            <span className="text-sm font-semibold text-[#111827]">{statusLabel(latest.status)}</span>
          </div>
          <div className="mt-3 grid gap-2 text-xs min-[520px]:grid-cols-2">
            <MiniLine label="Ancien créneau" value={`${formatDate(latest.oldScheduledDate)} · ${latest.oldScheduledTime || "—"}`} />
            <MiniLine label="Nouveau créneau" value={`${formatDate(latest.proposedDate)} · ${latest.proposedTime}`} />
            <MiniLine label="Règle" value={`${rescheduleWindowLabel(latest.feeWindow)} · ${latest.feeRate}%`} />
            <MiniLine label="Total supplément" value={formatFCFA(latest.totalToPay)} />
          </div>
          {latest.reason && (
            <p className="mt-3 rounded-lg border border-[#E6EAF3] bg-white px-3 py-2 text-xs font-semibold leading-5 text-[#64748B]">
              Motif : {latest.reason}
            </p>
          )}
          {latest.teacherResponse && (
            <p className="mt-3 rounded-lg border border-[#E6EAF3] bg-white px-3 py-2 text-xs font-semibold leading-5 text-[#111B4D]">
              Réponse professeur : {latest.teacherResponse}
            </p>
          )}
          {latest.status === "PAYMENT_PENDING" && (
            <Button asChild className="mt-3 min-h-11 w-full rounded-lg bg-[#111B4D] text-white hover:bg-[#1E2A78]">
              <a href="#actions">
                <RefreshCw className="h-4 w-4" />
                Reprendre le paiement du supplément
              </a>
            </Button>
          )}
        </div>

        {requests.length > 1 && (
          <div className="space-y-2">
            {requests.slice(1, 4).map((request) => (
              <div key={request.id} className="rounded-lg border border-[#E6EAF3] bg-white px-3 py-2 text-xs">
                <p className="font-semibold text-[#111827]">{formatDate(request.proposedDate)} · {request.proposedTime}</p>
                <p className="mt-0.5 text-[#64748B]">{statusLabel(request.status)} · {formatFCFA(request.totalToPay)}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function MiniLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[#E6EAF3] bg-white px-3 py-2">
      <p className="font-semibold uppercase tracking-wide text-[#64748B]">{label}</p>
      <p className="mt-1 font-semibold leading-5 text-[#111827]">{value}</p>
    </div>
  );
}

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    PAYMENT_PENDING: "Paiement du supplément attendu",
    PAYMENT_FAILED: "Paiement du supplément non finalisé",
    AWAITING_TEACHER: "Réponse professeur attendue",
    APPLIED: "Nouveau créneau confirmé",
    TEACHER_REJECTED: "Créneau refusé par le professeur",
    CANCELLED: "Demande annulée",
    REFUND_REQUIRED: "Contrôle remboursement requis",
  };
  return labels[status] ?? status;
}

function statusIcon(status: string) {
  if (status === "APPLIED") return <CheckCircle2 className="h-4 w-4 text-[#111B4D]" />;
  if (status === "TEACHER_REJECTED" || status === "PAYMENT_FAILED") return <XCircle className="h-4 w-4 text-red-600" />;
  if (status === "AWAITING_TEACHER") return <Hourglass className="h-4 w-4 text-[#111B4D]" />;
  return <Clock className="h-4 w-4 text-[#111B4D]" />;
}

function formatDate(value: string | null) {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "—";
  return parsed.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}
