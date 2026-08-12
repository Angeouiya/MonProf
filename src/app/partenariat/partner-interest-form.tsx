"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { ArrowRight, Copy, MessageCircle, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type ShareResult = {
  code: string;
  shareUrl: string;
  sharePath: string;
  promotionEndsAt: string;
  message: string;
};

export function PartnerInterestForm() {
  const [submitting, setSubmitting] = useState(false);
  const [inlineMessage, setInlineMessage] = useState("");
  const [result, setResult] = useState<ShareResult | null>(null);
  const [form, setForm] = useState({
    name: "",
    phone: "",
    email: "",
    referredClient: "",
    referredClientPhone: "",
    requestedJourney: "",
    message: "",
  });

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setInlineMessage("");
    try {
      const response = await fetch("/api/partner-interest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await response.json();
      if (!response.ok) {
        setInlineMessage(data.error || "Envoi impossible.");
        return;
      }
      setResult(data);
      setInlineMessage(data.message || "Déclaration enregistrée.");
      setForm((current) => ({
        ...current,
        referredClient: "",
        referredClientPhone: "",
        message: "",
      }));
    } finally {
      setSubmitting(false);
    }
  }

  async function copyLink() {
    if (!result?.shareUrl) return;
    try {
      await navigator.clipboard.writeText(result.shareUrl);
      setInlineMessage("Lien copié. Envoyez-le maintenant au client.");
    } catch {
      setInlineMessage("Copiez le lien affiché ci-dessous.");
    }
  }

  const whatsAppHref = result?.shareUrl
    ? `https://wa.me/?text=${encodeURIComponent(`Bonjour, je vous recommande Compétence.CI pour réserver votre cours. Utilisez ce lien : ${result.shareUrl}`)}`
    : "";

  return (
    <form onSubmit={submit} className="space-y-4 rounded-3xl border border-[#DDE6F7] bg-white p-4 shadow-sm sm:p-5">
      <div className="rounded-2xl border border-[#E3E8F2] bg-[#F8FAFC] p-4">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white text-[#111B4D]">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-semibold text-[#111827]">Déclaration apporteur mobile</p>
            <p className="mt-1 text-xs font-medium leading-5 text-[#64748B]">
              Remplissez, copiez le lien et envoyez-le au client. Le paiement reste contrôlé par Jèko avant toute commission.
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="partner-name">Votre nom</Label>
          <Input id="partner-name" value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="partner-phone">Votre téléphone</Label>
          <Input id="partner-phone" value={form.phone} onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))} required inputMode="tel" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="partner-email">Email facultatif</Label>
          <Input id="partner-email" value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} type="email" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="partner-client">Client concerné</Label>
          <Input id="partner-client" value={form.referredClient} onChange={(event) => setForm((current) => ({ ...current, referredClient: event.target.value }))} placeholder="Nom du client recommandé" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="partner-client-phone">Téléphone client facultatif</Label>
          <Input id="partner-client-phone" value={form.referredClientPhone} onChange={(event) => setForm((current) => ({ ...current, referredClientPhone: event.target.value }))} placeholder="+225 XX XX XX XX XX" inputMode="tel" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="partner-journey">Système conseillé</Label>
          <select
            id="partner-journey"
            value={form.requestedJourney}
            onChange={(event) => setForm((current) => ({ ...current, requestedJourney: event.target.value }))}
            className="h-11 w-full rounded-lg border border-[#DDE6F7] bg-white px-3 text-sm font-semibold text-[#111827] outline-none transition focus:border-[#9AAAD0] focus:ring-2 focus:ring-[#DDE6F7]"
          >
            <option value="">Le client choisira</option>
            <option value="ivoirien">Système ivoirien</option>
            <option value="francais">Système français</option>
            <option value="professionnel">Professionnel</option>
          </select>
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="partner-message">Message facultatif</Label>
        <Textarea id="partner-message" value={form.message} onChange={(event) => setForm((current) => ({ ...current, message: event.target.value }))} placeholder="Ex : client intéressé par un cours à domicile à Cocody." />
      </div>
      <Button type="submit" disabled={submitting} className="min-h-12 w-full rounded-2xl">
        {submitting ? "Création..." : "Créer mon lien apporteur"}
      </Button>

      {inlineMessage && (
        <p className={`rounded-2xl border px-4 py-3 text-sm font-semibold leading-5 ${result ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-amber-200 bg-amber-50 text-amber-900"}`}>
          {inlineMessage}
        </p>
      )}

      {result && (
        <div className="space-y-3 rounded-3xl border border-[#DDE6F7] bg-white p-4 shadow-sm">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-[#64748B]">Code apporteur</p>
            <p className="mt-1 text-2xl font-black tracking-tight text-[#111B4D]">{result.code}</p>
          </div>
          <div className="rounded-2xl border border-[#E3E8F2] bg-[#F8FAFC] p-3">
            <p className="break-all text-sm font-semibold leading-6 text-[#111827]">{result.shareUrl}</p>
          </div>
          <div className="grid gap-2 sm:grid-cols-3">
            <Button type="button" variant="outline" onClick={copyLink} className="min-h-11 rounded-xl">
              <Copy className="mr-2 h-4 w-4" /> Copier
            </Button>
            <Button asChild type="button" variant="outline" className="min-h-11 rounded-xl">
              <a href={whatsAppHref} target="_blank" rel="noreferrer">
                <MessageCircle className="mr-2 h-4 w-4" /> WhatsApp
              </a>
            </Button>
            <Button asChild type="button" className="min-h-11 rounded-xl">
              <a href={result.sharePath}>
                Ouvrir <ArrowRight className="ml-2 h-4 w-4" />
              </a>
            </Button>
          </div>
          <p className="text-xs font-medium leading-5 text-[#64748B]">
            Le client doit réserver avec ce lien avant la fin de la promotion. Sans paiement Jèko confirmé, aucune commission n’est créée.
          </p>
        </div>
      )}
    </form>
  );
}
