"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function PartnerInterestForm() {
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    name: "",
    phone: "",
    email: "",
    referredClient: "",
    message: "",
  });

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    try {
      const response = await fetch("/api/partner-interest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await response.json();
      if (!response.ok) {
        toast.error(data.error || "Envoi impossible.");
        return;
      }
      toast.success(data.message || "Demande envoyée.");
      setForm({ name: "", phone: "", email: "", referredClient: "", message: "" });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4 rounded-3xl border border-[#DDE6F7] bg-white p-5 shadow-sm">
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
          <Input id="partner-client" value={form.referredClient} onChange={(event) => setForm((current) => ({ ...current, referredClient: event.target.value }))} placeholder="Nom du client qui vous a déclaré" />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="partner-message">Message</Label>
        <Textarea id="partner-message" value={form.message} onChange={(event) => setForm((current) => ({ ...current, message: event.target.value }))} placeholder="Expliquez brièvement la mise en relation." />
      </div>
      <Button type="submit" disabled={submitting} className="min-h-12 w-full rounded-2xl">
        {submitting ? "Envoi..." : "Contacter Compétence.CI"}
      </Button>
    </form>
  );
}
