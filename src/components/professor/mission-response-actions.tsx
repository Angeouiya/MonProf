"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarClock, CheckCircle2, Loader2, ShieldAlert, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const MIN_RESPONSE_LENGTH_FOR_ISSUE = 10;
const MAX_RESPONSE_LENGTH = 700;

export function MissionResponseActions({
  token,
  disabled,
  compact = false,
}: {
  token: string;
  disabled?: boolean;
  compact?: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [response, setResponse] = useState("");
  const [showReschedule, setShowReschedule] = useState(false);
  const [proposalDate, setProposalDate] = useState("");
  const [proposalStartTime, setProposalStartTime] = useState("");
  const [done, setDone] = useState(false);
  const cleanResponse = response.trim();
  const responseTooLong = cleanResponse.length > MAX_RESPONSE_LENGTH;

  async function send(action: "confirm" | "unavailable" | "problem" | "reschedule") {
    if (responseTooLong) {
      toast.error(`Message trop long (${MAX_RESPONSE_LENGTH} caractères maximum).`);
      return;
    }
    if ((action === "unavailable" || action === "problem" || action === "reschedule") && cleanResponse.length < MIN_RESPONSE_LENGTH_FOR_ISSUE) {
      toast.error("Expliquez brièvement la raison pour aider le service client.");
      return;
    }
    if (action === "reschedule") {
      if (!proposalDate || !proposalStartTime) {
        toast.error("Indiquez une date et une heure de début pour le nouveau créneau.");
        return;
      }
      if (proposalDate < minimumProposalDateInput()) {
        toast.error("Proposez un créneau au moins 24h après aujourd'hui.");
        return;
      }
    }

    setLoading(action);
    try {
      const res = await fetch(`/api/mission/${token}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          response: cleanResponse,
          proposedDate: action === "reschedule" ? proposalDate : undefined,
          proposedTime: action === "reschedule" ? formatTwoHourSlot(proposalStartTime) : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Action impossible");
      toast.success("Réponse enregistrée");
      setDone(true);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erreur réseau");
    } finally {
      setLoading(null);
    }
  }

  if (done) {
    return (
      <div className="rounded-lg border border-[#D7DEE9] bg-white p-4 text-sm font-bold text-[#111B4D]">
        Merci, votre réponse a été transmise au service client.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <Textarea
        rows={compact ? 2 : 3}
        value={response}
        onChange={(event) => setResponse(event.target.value)}
        maxLength={MAX_RESPONSE_LENGTH + 50}
        placeholder="Message pour le service client : confirmation, précision, indisponibilité, besoin d'information..."
        disabled={disabled}
        className="rounded-lg border-[#D7DEE9] bg-white"
      />
      <div className="flex flex-col gap-1 text-xs font-semibold text-[#64748B] sm:flex-row sm:items-center sm:justify-between">
        <p className={responseTooLong ? "font-bold text-red-600" : ""}>
          {cleanResponse.length}/{MAX_RESPONSE_LENGTH} caractères
        </p>
        <p>Obligatoire si vous êtes indisponible, signalez un problème ou proposez un autre créneau.</p>
      </div>
      <div className="grid gap-2 sm:grid-cols-3">
        <Button disabled={disabled || !!loading} onClick={() => send("confirm")} className="min-h-11 rounded-lg bg-[#111B4D] text-white hover:bg-[#1E2A78]">
          {loading === "confirm" ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
          Confirmer
        </Button>
        <Button variant="outline" disabled={disabled || !!loading} onClick={() => send("unavailable")} className="min-h-11 rounded-lg border-[#D7DEE9] bg-white text-[#111B4D]">
          {loading === "unavailable" ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
          Indisponible
        </Button>
        <Button variant="outline" disabled={disabled || !!loading} onClick={() => send("problem")} className="min-h-11 rounded-lg border-red-300 bg-white text-red-700">
          {loading === "problem" ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldAlert className="h-4 w-4" />}
          Problème
        </Button>
      </div>
      <div className="rounded-lg border border-[#D7DEE9] bg-white p-3">
        <Button
          type="button"
          variant="ghost"
          disabled={disabled || !!loading}
          onClick={() => setShowReschedule((value) => !value)}
          className="min-h-11 w-full justify-start rounded-lg px-3 text-[#111B4D] hover:bg-[#F8FAFC]"
        >
          <CalendarClock className="h-4 w-4" />
          Proposer un autre créneau
        </Button>
        {showReschedule && (
          <div className="mt-3 space-y-3 border-t border-[#E6EAF3] pt-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="proposalDate">Date proposée</Label>
                <Input
                  id="proposalDate"
                  type="date"
                  min={minimumProposalDateInput()}
                  value={proposalDate}
                  disabled={disabled || !!loading}
                  onChange={(event) => setProposalDate(event.target.value)}
                  className="rounded-lg border-[#D7DEE9] bg-white"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="proposalStartTime">Heure de début</Label>
                <Input
                  id="proposalStartTime"
                  type="time"
                  step={1800}
                  value={proposalStartTime}
                  disabled={disabled || !!loading}
                  onChange={(event) => setProposalStartTime(event.target.value)}
                  className="rounded-lg border-[#D7DEE9] bg-white"
                />
              </div>
            </div>
            <p className="text-xs font-semibold leading-5 text-[#64748B]">
              La séance reste de 2h. Le client recevra une demande d'acceptation ou de refus dans son espace.
            </p>
            <Button
              disabled={disabled || !!loading}
              onClick={() => send("reschedule")}
              className="min-h-11 w-full rounded-lg bg-[#111B4D] text-white hover:bg-[#1E2A78]"
            >
              {loading === "reschedule" ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarClock className="h-4 w-4" />}
              Envoyer le créneau au client
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

function minimumProposalDateInput() {
  const date = new Date(Date.now() + 24 * 60 * 60 * 1000);
  return date.toISOString().slice(0, 10);
}

function formatTwoHourSlot(startTime: string) {
  const [hours, minutes] = startTime.split(":").map(Number);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return startTime;
  const endHour = (hours + 2) % 24;
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${pad(hours)}:${pad(minutes)} - ${pad(endHour)}:${pad(minutes)}`;
}
