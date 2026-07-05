"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarClock, CheckCircle2, Loader2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

type ScheduleProposal = {
  id: string;
  proposedDate: string;
  proposedTime: string;
  reason?: string | null;
  status: string;
  clientResponse?: string | null;
  createdAt: string;
  respondedAt?: string | null;
  teacher?: {
    fullName?: string | null;
    professionalName?: string | null;
  } | null;
};

const STATUS_LABELS: Record<string, string> = {
  PENDING: "Réponse attendue",
  ACCEPTED: "Accepté",
  REJECTED: "Refusé",
  CANCELLED: "Remplacé",
};

export function ScheduleProposalActions({
  bookingId,
  proposals,
}: {
  bookingId: string;
  proposals: ScheduleProposal[];
}) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [response, setResponse] = useState("");
  const pendingProposal = proposals.find((proposal) => proposal.status === "PENDING");

  async function respond(action: "accept_schedule_proposal" | "reject_schedule_proposal") {
    if (!pendingProposal) return;
    setLoading(action);
    try {
      const res = await fetch(`/api/bookings/${bookingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          proposalId: pendingProposal.id,
          clientResponse: response.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Action impossible");
        return;
      }
      toast.success(action === "accept_schedule_proposal"
        ? "Nouveau créneau confirmé."
        : "Refus transmis à l'administration.");
      setResponse("");
      router.refresh();
    } catch {
      toast.error("Erreur réseau");
    } finally {
      setLoading(null);
    }
  }

  if (!pendingProposal && proposals.length === 0) return null;

  return (
    <section className="overflow-hidden rounded-lg border border-[#DDE6F7] bg-white p-4">
      <div className="flex items-start gap-3 border-b border-[#E6EAF3] pb-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#111B4D] text-white">
          <CalendarClock className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[#64748B]">Créneau professeur</p>
          <h2 className="mt-0.5 text-base font-semibold leading-tight text-[#111827]">
            {pendingProposal ? "Nouvelle proposition à valider" : "Historique des propositions"}
          </h2>
        </div>
      </div>

      {pendingProposal && (
        <div className="mt-4 space-y-3">
          <div className="rounded-lg border border-[#DDE6F7] bg-white p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-[#64748B]">Créneau proposé</p>
            <p className="mt-1 text-lg font-semibold leading-tight text-[#111B4D]">
              {formatDate(pendingProposal.proposedDate)}
            </p>
            <p className="mt-1 text-sm font-semibold text-[#111827]">{pendingProposal.proposedTime}</p>
            {pendingProposal.reason && (
              <p className="mt-3 whitespace-pre-line text-sm font-medium leading-6 text-[#64748B]">
                {pendingProposal.reason}
              </p>
            )}
          </div>
          <Textarea
            rows={3}
            value={response}
            onChange={(event) => setResponse(event.target.value)}
            maxLength={700}
            placeholder="Message optionnel pour le professeur ou l'administration."
            className="rounded-lg border-[#DDE6F7] bg-white"
          />
          <div className="grid gap-2 min-[460px]:grid-cols-2">
            <Button
              disabled={!!loading}
              onClick={() => respond("accept_schedule_proposal")}
              className="min-h-11 rounded-lg bg-[#111B4D] text-white hover:bg-[#1E2A78]"
            >
              {loading === "accept_schedule_proposal" ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              Accepter ce créneau
            </Button>
            <Button
              variant="outline"
              disabled={!!loading}
              onClick={() => respond("reject_schedule_proposal")}
              className="min-h-11 rounded-lg border-[#D7DEE9] bg-white text-[#111B4D]"
            >
              {loading === "reject_schedule_proposal" ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
              Refuser
            </Button>
          </div>
          <p className="text-xs font-medium leading-5 text-[#64748B]">
            Si vous refusez, l'administration cherchera un autre professeur ou vous proposera une autre solution.
          </p>
        </div>
      )}

      {proposals.length > 0 && (
        <div className="mt-4 space-y-2">
          {proposals.slice(0, 3).map((proposal) => (
            <div key={proposal.id} className="rounded-lg border border-[#E6EAF3] bg-white px-3 py-2 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-semibold text-[#111827]">{formatDate(proposal.proposedDate)} · {proposal.proposedTime}</p>
                <span className="rounded-full border border-[#DDE6F7] px-2 py-1 text-[11px] font-semibold text-[#111B4D]">
                  {STATUS_LABELS[proposal.status] ?? proposal.status}
                </span>
              </div>
              {proposal.clientResponse && (
                <p className="mt-1 text-xs font-medium leading-5 text-[#64748B]">{proposal.clientResponse}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}
