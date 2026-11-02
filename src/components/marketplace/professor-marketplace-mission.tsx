"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, CalendarDays, Clock3, MapPin, Phone, RefreshCw } from "lucide-react";
import { ImportantActionConfirm } from "@/components/shared/important-action-confirm";

type Mission = {
  offer: { status: string; expiresAt: string; totalClientPrice: number; transportFee: number };
  request: {
    id: string; reference: string; status: string; subjectName: string; levelName: string; journey: string;
    scheduledDate: string; scheduledTime: string; durationMinutes: number; courseFormat: string;
    commune: string | null; quartier: string | null; addressHint: string | null; objective: string | null;
    courseAmount: number; commissionAmount: number; startedAt: string | null; dueAt: string | null;
    client: { name: string; phone: string | null };
  };
};
const money = (value: number) => `${new Intl.NumberFormat("fr-FR").format(value)} F`;

export function ProfessorMarketplaceMission({ requestId }: { requestId: string }) {
  const [mission, setMission] = useState<Mission | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(Date.now());
  const load = useCallback(async () => {
    try {
      const response = await fetch(`/api/professor/marketplace/offers/${requestId}`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Mission indisponible.");
      setMission(data);
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Mission indisponible.");
    }
  }, [requestId]);
  useEffect(() => {
    const initial = window.setTimeout(() => void load(), 0);
    const onFocus = () => void load();
    window.addEventListener("focus", onFocus);
    const refresh = window.setInterval(() => void load(), 60_000);
    const tick = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => { window.clearTimeout(initial); window.removeEventListener("focus", onFocus); window.clearInterval(refresh); window.clearInterval(tick); };
  }, [load]);

  async function act(action: "accept" | "decline" | "start" | "end" | "cancel") {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/professor/marketplace/offers/${requestId}`, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ action, code }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Action impossible.");
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Action impossible.");
    } finally {
      setBusy(false);
    }
  }

  const remaining = mission?.request.dueAt ? Math.max(0, Math.ceil((new Date(mission.request.dueAt).getTime() - now) / 1_000)) : null;
  return (
    <main className="mx-auto max-w-3xl bg-white px-4 pb-14 pt-6 text-[#12243A] sm:px-7">
      <Link href="/professeur/marche" className="inline-flex items-center gap-2 text-sm text-[#526174] hover:text-[#092A55]"><ArrowLeft className="h-4 w-4" />Missions proposées</Link>
      {!mission ? <div className="mt-10 text-sm text-[#526174]">{error || "Chargement…"}</div> : (
        <>
          <div className="mt-6 flex flex-wrap items-start justify-between gap-3">
            <div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#9A6A10]">{mission.request.reference}</p><h1 className="mt-2 text-3xl font-semibold tracking-[-0.03em]">{mission.request.subjectName}</h1><p className="mt-2 text-sm text-[#526174]">{mission.request.levelName} · {mission.request.journey}</p></div>
            <span className="rounded-full bg-[#EAF1F7] px-3 py-2 text-xs font-semibold text-[#092A55]">{mission.offer.status === "PENDING" ? "Réponse attendue" : mission.request.status === "IN_PROGRESS" ? "Cours en cours" : mission.request.status === "AWAITING_CLIENT" ? "Fin à confirmer" : mission.request.status === "COMPLETED" ? "Terminé" : mission.offer.status === "ACCEPTED" ? "Accepté" : mission.offer.status}</span>
          </div>
          <div className="mt-7 rounded-2xl border border-[#DCE2E8] p-5">
            <div className="grid gap-4 text-sm sm:grid-cols-2">
              <p className="flex items-center gap-2"><CalendarDays className="h-4 w-4 text-[#526174]" />{new Date(mission.request.scheduledDate).toLocaleDateString("fr-FR", { timeZone: "UTC", dateStyle: "full" })}</p>
              <p className="flex items-center gap-2"><Clock3 className="h-4 w-4 text-[#526174]" />{mission.request.scheduledTime} · {mission.request.durationMinutes / 60} h</p>
              <p className="flex items-center gap-2 sm:col-span-2"><MapPin className="h-4 w-4 text-[#526174]" />{mission.request.courseFormat === "ONLINE" ? "En ligne" : `${mission.request.quartier}, ${mission.request.commune}`}</p>
            </div>
            {mission.request.objective && <p className="mt-5 border-t border-[#E3E7EB] pt-4 text-sm text-[#526174]">{mission.request.objective}</p>}
            <div className="mt-5 flex flex-wrap justify-between gap-4 border-t border-[#E3E7EB] pt-4"><div><span className="block text-xs text-[#526174]">Prix annoncé au client</span><strong className="mt-1 block text-lg">{money(mission.offer.totalClientPrice)}</strong></div><div><span className="block text-xs text-[#526174]">Commission Compétence</span><strong className="mt-1 block text-lg">{money(mission.request.commissionAmount)}</strong></div></div>
          </div>

          {mission.offer.status === "PENDING" && (
            <div className="mt-5 rounded-2xl border border-[#DCE2E8] p-5">
              <p className="text-sm leading-6 text-[#526174]">Acceptez seulement si ce créneau vous convient. La commission sera réservée sur votre portefeuille, puis débitée uniquement lorsque le client vous donnera son code au début réel du cours.</p>
              <p className="mt-2 text-xs text-[#526174]">Offre valable jusqu’à {new Date(mission.offer.expiresAt).toLocaleTimeString("fr-FR", { timeZone: "UTC", hour: "2-digit", minute: "2-digit" })}.</p>
              <div className="mt-5 flex flex-wrap gap-3"><button disabled={busy} onClick={() => act("accept")} className="min-h-12 rounded-xl bg-[#092A55] px-5 text-sm font-semibold text-white disabled:opacity-60">Accepter la mission</button><button disabled={busy} onClick={() => act("decline")} className="min-h-12 rounded-xl border border-[#DCE2E8] px-5 text-sm font-semibold text-[#526174] disabled:opacity-60">Refuser</button></div>
            </div>
          )}
          {mission.offer.status === "ACCEPTED" && (
            <div className="mt-5 rounded-2xl border border-[#DCE2E8] p-5">
              <h2 className="text-base font-semibold">Coordination avec le client</h2>
              <p className="mt-3 text-sm">{mission.request.client.name}</p>
              {mission.request.client.phone && <a href={`tel:${mission.request.client.phone}`} className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-[#092A55]"><Phone className="h-4 w-4" />{mission.request.client.phone}</a>}
              {mission.request.addressHint && <p className="mt-3 text-sm text-[#526174]">Repère : {mission.request.addressHint}</p>}
            </div>
          )}
          {mission.offer.status === "ACCEPTED" && mission.request.status === "ACCEPTED" && (
            <div className="mt-5 rounded-2xl border border-[#BBD6C7] bg-[#F5FAF7] p-5">
              <h2 className="text-base font-semibold">Commencer le cours</h2>
              <p className="mt-2 text-sm leading-6 text-[#526174]">Demandez le code à six chiffres au client lorsque la séance commence. Sa saisie déclenche le compte à rebours et le prélèvement de la commission réservée.</p>
              <label className="mt-4 block text-sm font-medium">Code du client<input inputMode="numeric" pattern="[0-9]*" maxLength={6} value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))} className="mt-2 min-h-12 w-full max-w-56 rounded-xl border border-[#DCE2E8] bg-white px-4 font-mono text-lg tracking-[0.2em] outline-none focus:border-[#092A55]" /></label>
              <button disabled={busy || code.length !== 6} onClick={() => act("start")} className="mt-4 min-h-12 rounded-xl bg-[#092A55] px-5 text-sm font-semibold text-white disabled:opacity-60">Démarrer avec le code</button>
              <div className="mt-5"><ImportantActionConfirm trigger={<button type="button" disabled={busy} className="text-sm font-semibold text-[#8B2727] underline underline-offset-4 disabled:opacity-60">Je ne peux plus assurer ce cours</button>} title="Annuler votre mission ?" description="Le client sera informé, votre commission réservée sera libérée et la demande sera proposée au professeur suivant si possible." confirmLabel="Annuler la mission" danger onConfirm={() => act("cancel")} /></div>
            </div>
          )}
          {mission.request.status === "IN_PROGRESS" && remaining !== null && (
            <div className="mt-5 rounded-2xl bg-[#092A55] p-5 text-white"><p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#CBD8E8]">Cours en cours</p><p className="mt-2 font-mono text-3xl font-semibold">{String(Math.floor(remaining / 3600)).padStart(2, "0")}:{String(Math.floor(remaining % 3600 / 60)).padStart(2, "0")}:{String(remaining % 60).padStart(2, "0")}</p><button disabled={busy || remaining > 0} onClick={() => act("end")} className="mt-5 min-h-11 rounded-xl bg-white px-5 text-sm font-semibold text-[#092A55] disabled:opacity-60">{remaining > 0 ? "Fin du cours à l’issue du compte à rebours" : "Marquer le cours terminé"}</button></div>
          )}
          {mission.request.status === "AWAITING_CLIENT" && <p className="mt-5 rounded-xl bg-[#F5FAF7] p-4 text-sm text-[#245843]">Vous avez marqué le cours terminé. Le client doit maintenant confirmer.</p>}
          {error && <p role="alert" className="mt-5 rounded-xl bg-[#FFF8F8] p-3 text-sm text-[#8B2727]">{error}</p>}
          <button type="button" onClick={() => void load()} className="mt-7 inline-flex items-center gap-2 text-xs font-semibold text-[#092A55]"><RefreshCw className="h-4 w-4" />Actualiser</button>
        </>
      )}
    </main>
  );
}
