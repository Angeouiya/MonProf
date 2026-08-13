"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { RestrictionNoticeDialog } from "@/components/shared/restriction-notice-dialog";

export function ProfessorRescheduleRequestActions({
  requestId,
  disabled,
}: {
  requestId: string;
  disabled?: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState<"accept" | "reject" | null>(null);
  const [response, setResponse] = useState("");
  const [doneMessage, setDoneMessage] = useState("");
  const [errorNotice, setErrorNotice] = useState<string | null>(null);

  async function respond(action: "accept" | "reject") {
    const cleanResponse = response.trim();
    if (action === "reject" && cleanResponse.length < 5) {
      setErrorNotice("Expliquez brièvement pourquoi vous refusez ce créneau.");
      return;
    }
    setLoading(action);
    setDoneMessage("");
    try {
      const res = await fetch(`/api/professor/reschedule-requests/${requestId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, response: cleanResponse }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorNotice(data.error || "Action impossible.");
        return;
      }
      setDoneMessage(action === "accept" ? "Nouveau créneau confirmé." : "Refus transmis au service client.");
      setResponse("");
      router.refresh();
    } catch {
      setErrorNotice("Erreur réseau.");
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="space-y-3">
      <Textarea
        rows={3}
        value={response}
        disabled={disabled || !!loading}
        onChange={(event) => { setResponse(event.target.value); setDoneMessage(""); }}
        placeholder="Message optionnel si vous acceptez, obligatoire si vous refusez."
        className="rounded-lg border-[#D7DEE9] bg-white"
      />
      {doneMessage && (
        <div className="rounded-lg border border-[#DDE6F7] bg-[#F8FAFC] px-3 py-2 text-xs font-semibold leading-5 text-[#111B4D]" data-professor-reschedule-response-state>
          {doneMessage}
        </div>
      )}
      <div className="grid gap-2 min-[520px]:grid-cols-2">
        <Button
          disabled={disabled || !!loading}
          onClick={() => respond("accept")}
          className="min-h-11 rounded-lg bg-[#111B4D] text-white hover:bg-[#1E2A78]"
        >
          {loading === "accept" ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
          Confirmer ce créneau
        </Button>
        <Button
          variant="outline"
          disabled={disabled || !!loading}
          onClick={() => respond("reject")}
          className="min-h-11 rounded-lg border-[#D7DEE9] bg-white text-[#111B4D]"
        >
          {loading === "reject" ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
          Refuser
        </Button>
      </div>
      <RestrictionNoticeDialog
        open={Boolean(errorNotice)}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) setErrorNotice(null);
        }}
        title="Réponse impossible"
        description={errorNotice ?? ""}
        variant="restriction"
      />
    </div>
  );
}
