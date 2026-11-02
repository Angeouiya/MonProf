"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowUpRight, RefreshCw, ShieldCheck } from "lucide-react";

type WalletData = {
  balance: number;
  reserved: number;
  available: number;
  topUps: Array<{ id: string; reference: string; amount: number; status: string; paymentMethod: string; createdAt: string; checkoutUrl: string | null }>;
  entries: Array<{ id: string; kind: string; balanceDelta: number; reservedDelta: number; createdAt: string }>;
};
const money = (amount: number) => `${new Intl.NumberFormat("fr-FR").format(amount)} FCFA`;
const methods = [
  { value: "WAVE", label: "Wave" },
  { value: "ORANGE_MONEY", label: "Orange Money" },
  { value: "MTN_MONEY", label: "MTN Money" },
  { value: "MOOV_MONEY", label: "Moov Money" },
  { value: "DJAMO", label: "Djamo" },
];

export function ProfessorMarketplaceWallet() {
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [amount, setAmount] = useState("10000");
  const [method, setMethod] = useState("WAVE");
  const [error, setError] = useState("");
  const paymentKeyRef = useRef<string | null>(null);
  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/professor/marketplace/wallet", { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Portefeuille indisponible.");
      setWallet(result);
      setError("");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Portefeuille indisponible."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { const initial = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(initial); }, [load]);

  async function recharge() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const value = Number(amount);
      if (!Number.isInteger(value) || value < 5000 || value > 500000) throw new Error("Montant autorisé : 5 000 à 500 000 FCFA.");
      const response = await fetch("/api/professor/marketplace/wallet", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: value, method, clientKey: paymentKeyRef.current ??= crypto.randomUUID() }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Recharge impossible.");
      if (!result.checkoutUrl) throw new Error("Jèko n’a pas encore fourni de lien de paiement. Vérifiez l’historique avant de réessayer.");
      window.location.assign(result.checkoutUrl);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Recharge impossible.");
      setBusy(false);
      void load();
    }
  }

  return <main className="mx-auto max-w-5xl space-y-7 bg-white px-4 py-6 text-[#12243A] sm:px-7">
    <Link href="/professeur/marche" className="inline-flex items-center gap-2 text-sm font-semibold text-[#092A55]"><ArrowLeft className="h-4 w-4" /> Missions</Link>
    <header><p className="text-xs font-semibold uppercase tracking-[0.15em] text-[#9A6A10]">Compte professeur</p><h1 className="mt-2 text-3xl font-semibold tracking-[-0.03em]">Portefeuille Compétence</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-[#526174]">Alimentez votre solde avec Jèko pour accepter des missions. La commission est seulement réservée à l’acceptation et débitée au démarrage confirmé par le code du client.</p></header>
    <section className="grid gap-3 sm:grid-cols-3" aria-label="Soldes du portefeuille">
      {[["Disponible", wallet?.available ?? 0], ["Réservé pour missions", wallet?.reserved ?? 0], ["Solde total", wallet?.balance ?? 0]].map(([label, value]) => <div key={label} className="rounded-2xl border border-[#DCE2E8] bg-white p-5"><p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#526174]">{label}</p><p className="mt-2 text-2xl font-semibold text-[#092A55]">{loading ? "…" : money(Number(value))}</p></div>)}
    </section>
    <section className="grid gap-8 lg:grid-cols-[1fr_1fr]">
      <div className="rounded-2xl border border-[#DCE2E8] bg-white p-5 sm:p-7"><h2 className="text-xl font-semibold">Recharger via Jèko</h2><p className="mt-2 text-sm leading-6 text-[#526174]">Le solde augmente uniquement après confirmation serveur du paiement Jèko. La page de retour seule ne valide rien.</p>
        <label className="mt-6 block text-sm font-semibold" htmlFor="wallet-amount">Montant en FCFA</label><input id="wallet-amount" type="number" min="5000" max="500000" step="1000" value={amount} onChange={(event) => { paymentKeyRef.current = null; setAmount(event.target.value); }} className="mt-2 min-h-12 w-full rounded-xl border border-[#C9D2DC] bg-white px-4 text-base text-[#12243A] outline-none focus:border-[#092A55]" />
        <label className="mt-5 block text-sm font-semibold" htmlFor="wallet-method">Moyen de paiement</label><select id="wallet-method" value={method} onChange={(event) => { paymentKeyRef.current = null; setMethod(event.target.value); }} className="mt-2 min-h-12 w-full rounded-xl border border-[#C9D2DC] bg-white px-4 text-base text-[#12243A] outline-none focus:border-[#092A55]">{methods.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select>
        {error && <p role="alert" className="mt-4 rounded-xl border border-[#F0C8C8] bg-[#FFF8F8] p-3 text-sm text-[#8B2727]">{error}</p>}
        <button type="button" disabled={busy} onClick={() => void recharge()} className="mt-6 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#092A55] px-5 text-sm font-semibold text-white disabled:opacity-60">Continuer avec Jèko <ArrowUpRight className="h-4 w-4" /></button>
        <p className="mt-4 flex items-start gap-2 text-xs leading-5 text-[#526174]"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />Le paiement du cours entre client et professeur est distinct de cette recharge.</p>
      </div>
      <div><div className="flex items-center justify-between"><h2 className="text-xl font-semibold">Dernières opérations</h2><button type="button" onClick={() => void load()} aria-label="Actualiser le portefeuille" className="rounded-lg p-2 text-[#092A55] hover:bg-[#F3F6F8]"><RefreshCw className="h-4 w-4" /></button></div>
        <div className="mt-4 divide-y divide-[#E3E7EB] border-y border-[#E3E7EB]">{wallet?.entries.length ? wallet.entries.map((entry) => <div key={entry.id} className="flex items-center justify-between gap-3 py-4 text-sm"><span><strong className="block">{entry.kind === "TOPUP" ? "Recharge Jèko" : entry.kind === "RESERVE" ? "Commission réservée" : entry.kind === "COMMISSION" ? "Commission prélevée" : entry.kind === "ADJUSTMENT" ? "Ajustement de litige" : "Réservation libérée"}</strong><span className="text-xs text-[#526174]">{new Date(entry.createdAt).toLocaleDateString("fr-FR")}</span></span><strong className={entry.balanceDelta < 0 ? "text-[#9A5A17]" : "text-[#245843]"}>{entry.balanceDelta !== 0 ? `${entry.balanceDelta > 0 ? "+" : ""}${money(entry.balanceDelta)}` : `${entry.reservedDelta > 0 ? "+" : ""}${money(entry.reservedDelta)} réservé`}</strong></div>) : <p className="py-8 text-sm text-[#526174]">Aucune opération pour le moment.</p>}</div>
        {wallet?.topUps.some((topUp) => topUp.status === "PENDING") && <p className="mt-4 rounded-xl border border-[#E8DBB7] bg-[#FFFBF2] p-3 text-sm text-[#6E4A13]">Une recharge attend la confirmation de Jèko. Ne la payez pas une seconde fois avant de consulter son état.</p>}
      </div>
    </section>
  </main>;
}
