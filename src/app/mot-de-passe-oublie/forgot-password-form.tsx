"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [devResetUrl, setDevResetUrl] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setDevResetUrl(null);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Demande impossible.");
      setSent(true);
      if (data.devResetUrl) setDevResetUrl(data.devResetUrl);
      toast.success("Si le compte existe, le lien a été envoyé.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Demande impossible.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-5 space-y-4">
      <div>
        <Label htmlFor="forgot-email">Email du compte client</Label>
        <Input
          id="forgot-email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="client@email.com"
          autoComplete="email"
          className="mt-1.5 h-11 rounded-lg border-[#DDE6F7]"
          required
        />
      </div>

      {sent && (
        <div className="rounded-lg border border-[#DDE6F7] bg-white p-3 text-sm font-semibold leading-6 text-[#111B4D]">
          Vérifiez votre boîte email. Le lien expire dans 1 heure.
          {devResetUrl && (
            <a href={devResetUrl} className="mt-2 block break-all text-xs text-[#111B4D] underline">
              Lien local de test : {devResetUrl}
            </a>
          )}
        </div>
      )}

      <Button type="submit" disabled={loading} className="min-h-11 w-full rounded-lg bg-[#111B4D] text-white hover:bg-[#1E2A78]">
        {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Mail className="mr-2 h-4 w-4" />}
        Envoyer le lien email
      </Button>
    </form>
  );
}
