"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CheckCircle2, Loader2, ShieldAlert, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

const MIN_RESPONSE_LENGTH_FOR_ISSUE = 10;
const MAX_RESPONSE_LENGTH = 700;

export function MissionActions({ token, disabled }: { token: string; disabled: boolean }) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [response, setResponse] = useState("");
  const [done, setDone] = useState(false);
  const cleanResponse = response.trim();
  const responseTooLong = cleanResponse.length > MAX_RESPONSE_LENGTH;

  async function send(action: "confirm" | "unavailable" | "problem") {
    if (responseTooLong) {
      toast.error(`Message trop long (${MAX_RESPONSE_LENGTH} caractères maximum).`);
      return;
    }
    if ((action === "unavailable" || action === "problem") && cleanResponse.length < MIN_RESPONSE_LENGTH_FOR_ISSUE) {
      toast.error("Veuillez expliquer brièvement la raison pour aider l'administration.");
      return;
    }
    setLoading(action);
    try {
      const res = await fetch(`/api/mission/${token}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, response: cleanResponse }),
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
      <div className="rounded-3xl border border-blue-100 bg-blue-50/80 p-4 text-sm font-medium text-blue-800">
        Merci, votre réponse a été transmise à l'administration MonProf CI.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <Textarea
        rows={3}
        value={response}
        onChange={(event) => setResponse(event.target.value)}
        maxLength={MAX_RESPONSE_LENGTH + 50}
        placeholder="Message pour l'administration : confirmation, précision d'adresse, indisponibilité, besoin d'information..."
        disabled={disabled}
      />
      <div className="flex flex-col gap-1 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <p className={responseTooLong ? "font-medium text-red-600" : ""}>
          {cleanResponse.length}/{MAX_RESPONSE_LENGTH} caractères
        </p>
        <p>Obligatoire si vous êtes indisponible ou si vous signalez un problème.</p>
      </div>
      <div className="grid gap-2 sm:grid-cols-3">
        <Button disabled={disabled || !!loading} onClick={() => send("confirm")} className="min-h-11 rounded-2xl">
          {loading === "confirm" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
          Je confirme ma disponibilité
        </Button>
        <Button variant="outline" disabled={disabled || !!loading} onClick={() => send("unavailable")} className="min-h-11 rounded-2xl border-amber-200 text-amber-800 hover:bg-amber-50">
          {loading === "unavailable" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <XCircle className="mr-2 h-4 w-4" />}
          Je suis indisponible
        </Button>
        <Button variant="outline" disabled={disabled || !!loading} onClick={() => send("problem")} className="min-h-11 rounded-2xl border-red-200 text-red-700 hover:bg-red-50">
          {loading === "problem" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldAlert className="mr-2 h-4 w-4" />}
          Signaler un problème
        </Button>
      </div>
    </div>
  );
}
