"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CalendarClock, CheckCircle2, Clock, ExternalLink, Hourglass, RefreshCw, ShieldCheck, XCircle } from "lucide-react";
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
  paydunyaCheckoutUrl?: string | null;
  paidAt: string | null;
  teacherResponse: string | null;
  teacherRespondedAt: string | null;
  appliedAt: string | null;
  createdAt: string;
  transactionStatus: string | null;
};

export function ClientRescheduleRequestPanel({
  bookingId,
  requests,
}: {
  bookingId: string;
  requests: RescheduleRequest[];
}) {
  const router = useRouter();
  const [loading, setLoading] = useState<"checkout" | "verify" | null>(null);
  if (requests.length === 0) return null;
  const latest = requests[0];

  async function openSupplementCheckout() {
    setLoading("checkout");
    try {
      const res = await fetch(`/api/bookings/${bookingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "reschedule_fee_checkout",
          rescheduleRequestId: latest.id,
        }),
      });
      const data = await res.json();
      const checkoutUrl = data.payment?.checkoutUrl || latest.paydunyaCheckoutUrl;
      if (!res.ok || !checkoutUrl) {
        toast.error(data.error || "Impossible d'ouvrir PayDunya pour ce supplément.");
        return;
      }
      toast.success("Ouverture de PayDunya...");
      window.location.assign(checkoutUrl);
    } catch {
      toast.error("Erreur réseau");
    } finally {
      setLoading(null);
    }
  }

  async function verifySupplementPayment() {
    setLoading("verify");
    try {
      const res = await fetch(`/api/bookings/${bookingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "reschedule_fee_verify",
          rescheduleRequestId: latest.id,
        }),
      });
      const data = await res.json();
      const message = data.payment?.message || data.error || "Vérification PayDunya terminée.";
      if (!res.ok) {
        toast.error(message);
        return;
      }
      if (data.ok || data.payment?.verified) {
        toast.success(message);
      } else {
        toast(message);
      }
      router.refresh();
    } catch {
      toast.error("Erreur réseau");
    } finally {
      setLoading(null);
    }
  }

  const paymentRequired = latest.status === "PAYMENT_PENDING" || latest.status === "PAYMENT_FAILED";
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
            <div className="mt-3 rounded-lg border border-[#DDE6F7] bg-white p-3">
              <div className="flex items-start gap-2 text-xs font-semibold leading-5 text-[#64748B]">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#111B4D]" />
                <span>Le nouveau créneau n'est pas transmis au professeur tant que PayDunya n'a pas confirmé le supplément côté serveur.</span>
              </div>
              <div className="mt-3 grid gap-2 min-[520px]:grid-cols-2">
                <Button
                  onClick={openSupplementCheckout}
                  disabled={!!loading}
                  className="min-h-11 rounded-lg bg-[#111B4D] text-white hover:bg-[#1E2A78]"
                >
                  {loading === "checkout" ? <RefreshCw className="h-4 w-4 animate-spin" /> : <ExternalLink className="h-4 w-4" />}
                  Payer via PayDunya
                </Button>
                <Button
                  variant="outline"
                  onClick={verifySupplementPayment}
                  disabled={!!loading}
                  className="min-h-11 rounded-lg border-[#D7DEE9] bg-white text-[#111B4D]"
                >
                  {loading === "verify" ? <RefreshCw className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                  Vérifier le paiement
                </Button>
              </div>
            </div>
          )}
          {latest.status === "PAYMENT_FAILED" && (
            <div className="mt-3 rounded-lg border border-[#E3E8F2] bg-white p-3">
              <p className="text-xs font-semibold leading-5 text-[#64748B]">
                Le précédent lien PayDunya n'a pas abouti. Vous pouvez relancer un lien sécurisé sans créer une nouvelle demande.
              </p>
              <Button
                onClick={openSupplementCheckout}
                disabled={!!loading}
                className="mt-3 min-h-11 w-full rounded-lg bg-[#111B4D] text-white hover:bg-[#1E2A78]"
              >
                {loading === "checkout" ? <RefreshCw className="h-4 w-4 animate-spin" /> : <ExternalLink className="h-4 w-4" />}
                Relancer PayDunya
              </Button>
            </div>
          )}
          {paymentRequired && latest.paydunyaStatus && (
            <p className="mt-2 text-[11px] font-semibold uppercase tracking-wide text-[#64748B]">
              État PayDunya : {latest.paydunyaStatus}
            </p>
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
