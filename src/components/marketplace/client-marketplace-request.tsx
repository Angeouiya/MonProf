"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, CalendarDays, Clock3, MapPin, Phone, RefreshCw } from "lucide-react";
import { ProfessorImage } from "@/components/shared/professor-image";
import { ImportantActionConfirm } from "@/components/shared/important-action-confirm";

type RequestDetail = {
  id: string; reference: string; status: string; journey: string; subjectName: string; levelName: string;
  courseFormat: "HOME" | "ONLINE"; commune: string | null; quartier: string | null;
  scheduledDate: string; scheduledTime: string; durationMinutes: number;
  courseAmount: number; transportFee: number; totalClientPrice: number;
  offerExpiresAt: string | null; startedAt: string | null; dueAt: string | null;
  assignedTeacher: { fullName: string; professionalName: string | null; photoUrl: string | null; phone: string; rating: number; ratingCount: number } | null;
  review: { id: string; rating: number; comment: string | null } | null;
};

const STATUS: Record<string, string> = {
  OFFERED: "En attente d’une réponse", SEARCHING: "Recherche en cours", ACCEPTED: "Professeur confirmé",
  IN_PROGRESS: "Cours en cours", AWAITING_CLIENT: "Votre confirmation est attendue",
  COMPLETED: "Cours terminé", CANCELLED: "Demande annulée", EXPIRED: "Aucun professeur n’a accepté",
  DISPUTED: "Litige signalé",
};
const money = (value: number) => `${new Intl.NumberFormat("fr-FR").format(value)} F`;

export function ClientMarketplaceRequest({ requestId }: { requestId: string }) {
  const [detail, setDetail] = useState<RequestDetail | null>(null);
  const [code, setCode] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [disputeReason, setDisputeReason] = useState("");
  const [rating, setRating] = useState(0);
  const [reviewComment, setReviewComment] = useState("");
  const [now, setNow] = useState(Date.now());
  const load = useCallback(async () => {
    try {
      const response = await fetch(`/api/marketplace/requests/${requestId}`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Demande indisponible.");
      setDetail(data.request);
      setCode(data.startCode);
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Demande indisponible.");
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

  async function act(action: "cancel" | "confirm" | "dispute") {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/marketplace/requests/${requestId}`, {
        method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ action, reason: disputeReason }),
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

  async function submitReview() {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/marketplace/requests/${requestId}/review`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating, comment: reviewComment }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Avis impossible.");
      await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Avis impossible."); }
    finally { setBusy(false); }
  }

  const remaining = detail?.dueAt ? Math.max(0, Math.ceil((new Date(detail.dueAt).getTime() - now) / 1_000)) : null;
  return (
    <main className="mx-auto max-w-3xl bg-white px-4 pb-14 pt-6 text-[#12243A] sm:px-7">
      <Link href="/client/demandes" className="inline-flex items-center gap-2 text-sm text-[#526174] hover:text-[#092A55]"><ArrowLeft className="h-4 w-4" />Mes demandes</Link>
      {!detail ? <div className="mt-10 text-sm text-[#526174]">{error || "Chargement…"}</div> : (
        <>
          <div className="mt-6 flex flex-wrap items-start justify-between gap-3">
            <div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#9A6A10]">{detail.reference}</p><h1 className="mt-2 text-3xl font-semibold tracking-[-0.03em]">{detail.subjectName}</h1><p className="mt-2 text-sm text-[#526174]">{detail.levelName} · {detail.journey}</p></div>
            <span className="rounded-full bg-[#EAF1F7] px-3 py-2 text-xs font-semibold text-[#092A55]">{STATUS[detail.status] || detail.status}</span>
          </div>
          <div className="mt-8 grid gap-5 sm:grid-cols-2">
            <div className="rounded-2xl border border-[#DCE2E8] p-5">
              <h2 className="text-base font-semibold">Votre cours</h2>
              <p className="mt-4 flex items-center gap-2 text-sm"><CalendarDays className="h-4 w-4 text-[#526174]" />{new Date(detail.scheduledDate).toLocaleDateString("fr-FR", { timeZone: "UTC", dateStyle: "full" })}</p>
              <p className="mt-3 flex items-center gap-2 text-sm"><Clock3 className="h-4 w-4 text-[#526174]" />{detail.scheduledTime} · {detail.durationMinutes / 60} h</p>
              <p className="mt-3 flex items-center gap-2 text-sm"><MapPin className="h-4 w-4 text-[#526174]" />{detail.courseFormat === "ONLINE" ? "En ligne" : `${detail.quartier}, ${detail.commune}`}</p>
              <div className="mt-5 border-t border-[#E3E7EB] pt-4 text-sm">
                <Price label="Cours" value={detail.courseAmount} />
                <Price label="Déplacement" value={detail.transportFee} />
                <Price label="Total estimé" value={detail.totalClientPrice} strong />
              </div>
            </div>
            <div className="rounded-2xl border border-[#DCE2E8] p-5">
              <h2 className="text-base font-semibold">Professeur</h2>
              {detail.assignedTeacher ? (
                <div className="mt-4 flex items-center gap-3"><ProfessorImage photoUrl={detail.assignedTeacher.photoUrl} name={detail.assignedTeacher.professionalName || detail.assignedTeacher.fullName} size={52} /><div><strong className="block text-sm">{detail.assignedTeacher.professionalName || detail.assignedTeacher.fullName}</strong><span className="text-xs text-[#526174]">Mission acceptée</span></div></div>
              ) : <p className="mt-4 text-sm leading-6 text-[#526174]">Nous attendons la réponse d’un professeur compatible. En cas de refus, la demande passe au suivant sans augmentation du total.</p>}
              {detail.assignedTeacher && ["ACCEPTED", "IN_PROGRESS", "AWAITING_CLIENT", "COMPLETED"].includes(detail.status) && (
                <a href={`tel:${detail.assignedTeacher.phone}`} className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl border border-[#DCE2E8] px-4 text-sm font-semibold text-[#092A55]"><Phone className="h-4 w-4" />Appeler le professeur</a>
              )}
              {detail.status === "OFFERED" && detail.offerExpiresAt && <p className="mt-5 text-xs text-[#526174]">Réponse demandée avant {new Date(detail.offerExpiresAt).toLocaleTimeString("fr-FR", { timeZone: "UTC", hour: "2-digit", minute: "2-digit" })}.</p>}
            </div>
          </div>
          {code && detail.status === "ACCEPTED" && (
            <div className="mt-5 rounded-2xl border border-[#BBD6C7] bg-[#F5FAF7] p-5">
              <h2 className="text-base font-semibold">Code de démarrage</h2>
              <p className="mt-2 text-sm text-[#526174]">Communiquez ce code au professeur uniquement lorsque le cours commence réellement. Il déclenche le compte à rebours.</p>
              <div className="mt-4 font-mono text-3xl font-semibold tracking-[0.25em] text-[#092A55]">{code}</div>
            </div>
          )}
          {detail.status === "IN_PROGRESS" && remaining !== null && (
            <div className="mt-5 rounded-2xl bg-[#092A55] p-5 text-white">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#CBD8E8]">Séance en cours</p>
              <p className="mt-2 font-mono text-3xl font-semibold">{String(Math.floor(remaining / 3600)).padStart(2, "0")}:{String(Math.floor(remaining % 3600 / 60)).padStart(2, "0")}:{String(remaining % 60).padStart(2, "0")}</p>
              <p className="mt-2 text-xs text-[#CBD8E8]">Temps indicatif depuis le démarrage confirmé.</p>
            </div>
          )}
          {detail.status === "AWAITING_CLIENT" && <div className="mt-5 rounded-2xl border border-[#DCE2E8] p-5"><p className="text-sm">Le professeur a déclaré le cours terminé. Confirmez uniquement si la séance a bien eu lieu.</p><ImportantActionConfirm trigger={<button type="button" disabled={busy} className="mt-4 min-h-11 rounded-xl bg-[#092A55] px-5 text-sm font-semibold text-white disabled:opacity-60">Confirmer la fin du cours</button>} title="Le cours a-t-il bien eu lieu ?" description="Votre confirmation clôturera la mission. Compétence ne valide ni n’encaisse le paiement convenu directement avec le professeur." confirmLabel="Oui, confirmer" onConfirm={() => act("confirm")} /></div>}
          {detail.status === "COMPLETED" && <div className="mt-5 rounded-2xl border border-[#DCE2E8] p-5"><h2 className="text-base font-semibold">Votre avis</h2>{detail.review ? <p className="mt-2 text-sm text-[#526174]">Merci pour votre note de {detail.review.rating}/5.</p> : <><p className="mt-2 text-sm text-[#526174]">Votre expérience aide les prochaines familles à choisir.</p><div className="mt-4 flex gap-1" role="group" aria-label="Note du professeur">{[1,2,3,4,5].map((value) => <button key={value} type="button" onClick={() => setRating(value)} aria-label={`${value} étoile${value > 1 ? "s" : ""}`} aria-pressed={rating === value} className={`h-11 w-11 rounded-lg text-2xl ${value <= rating ? "text-[#B37A16]" : "text-[#A8B4BF]"}`}>★</button>)}</div><label htmlFor="review-comment" className="mt-4 block text-xs font-medium text-[#526174]">Commentaire {rating <= 3 ? "(20 caractères minimum)" : "facultatif"}</label><textarea id="review-comment" rows={3} maxLength={900} value={reviewComment} onChange={(event) => setReviewComment(event.target.value)} className="mt-2 w-full rounded-xl border border-[#DCE2E8] p-3 text-sm" /><button type="button" disabled={busy || rating < 1 || (rating <= 3 && reviewComment.trim().length < 20)} onClick={() => void submitReview()} className="mt-3 min-h-11 rounded-xl bg-[#092A55] px-5 text-sm font-semibold text-white disabled:opacity-50">Publier mon avis</button></>}</div>}
          {["IN_PROGRESS", "AWAITING_CLIENT", "COMPLETED"].includes(detail.status) && <div className="mt-5 rounded-2xl border border-[#E8DBB7] bg-[#FFFBF2] p-5"><h2 className="text-sm font-semibold">Signaler un problème</h2><label htmlFor="marketplace-dispute" className="mt-2 block text-xs text-[#526174]">Expliquez les faits pour l’équipe Compétence (20 caractères minimum).</label><textarea id="marketplace-dispute" value={disputeReason} onChange={(event) => setDisputeReason(event.target.value)} maxLength={1000} rows={3} className="mt-3 w-full rounded-xl border border-[#DCE2E8] bg-white p-3 text-sm outline-none focus:border-[#092A55]" /><ImportantActionConfirm trigger={<button type="button" disabled={busy || disputeReason.trim().length < 20} className="mt-3 min-h-11 rounded-xl border border-[#D7AE68] px-4 text-sm font-semibold text-[#6E4A13] disabled:opacity-60">Envoyer le signalement</button>} title="Signaler un litige ?" description="L’équipe vérifiera les faits. Aucun remboursement du paiement direct ne peut être déclenché automatiquement par Compétence." confirmLabel="Envoyer" onConfirm={() => act("dispute")} /></div>}
          {["SEARCHING", "OFFERED", "ACCEPTED"].includes(detail.status) && <ImportantActionConfirm trigger={<button type="button" disabled={busy} className="mt-6 text-sm font-medium text-[#8B2727] underline underline-offset-4 disabled:opacity-60">Annuler cette demande</button>} title="Annuler ce cours ?" description="Avant le démarrage, la mission sera annulée et la commission réservée du professeur libérée. Le professeur sera informé." confirmLabel="Annuler la demande" danger onConfirm={() => act("cancel")} />}
          <div className="mt-7 flex items-center justify-between gap-3 border-t border-[#E3E7EB] pt-5">
            <p className="max-w-lg text-xs leading-5 text-[#526174]">Le cours est réglé directement au professeur, par le moyen convenu entre vous. Compétence ne marque pas ce règlement comme vérifié.</p>
            <button type="button" onClick={() => void load()} className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-[#092A55]"><RefreshCw className="h-3.5 w-3.5" />Actualiser</button>
          </div>
          {error && <p role="alert" className="mt-4 rounded-xl bg-[#FFF8F8] p-3 text-sm text-[#8B2727]">{error}</p>}
        </>
      )}
    </main>
  );
}

function Price({ label, value, strong }: { label: string; value: number; strong?: boolean }) {
  return <div className={`mt-2 flex justify-between gap-3 ${strong ? "border-t border-[#E3E7EB] pt-3 font-semibold" : "text-[#526174]"}`}><span>{label}</span><span className="text-[#12243A]">{money(value)}</span></div>;
}
