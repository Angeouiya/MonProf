"use client";

import { useState } from "react";
import { Check, Copy, Eye, EyeOff, KeyRound, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ClientTemporaryPasswordForm({
  clientId,
  clientName,
  hasPendingRequest,
}: {
  clientId: string;
  clientName: string;
  hasPendingRequest: boolean;
}) {
  const [password, setPassword] = useState("");
  const [visible, setVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const [issued, setIssued] = useState(false);

  async function copyPassword() {
    if (!password) return;
    await navigator.clipboard.writeText(password);
    toast.success("Mot de passe temporaire copié. Transmettez-le uniquement au client vérifié.");
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (saving || issued) return;
    setSaving(true);
    try {
      const response = await fetch(`/api/admin/clients/${clientId}/temporary-password`, {
        method: "POST",
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Création impossible.");
      if (typeof data.temporaryPassword !== "string" || !data.temporaryPassword) {
        throw new Error("Le serveur n'a pas remis le mot de passe temporaire attendu.");
      }
      setPassword(data.temporaryPassword);
      setIssued(true);
      setVisible(true);
      toast.success("Accès temporaire créé. Le client devra remplacer ce mot de passe à la connexion.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Création impossible.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-bold text-[#111827]">Accès temporaire de {clientName}</p>
          <p className="mt-1 text-xs font-medium leading-5 text-[#64748B]">
            Vérifiez d'abord l'identité du client. Cette action révoque ses sessions et l'oblige à créer son mot de passe personnel.
          </p>
        </div>
        {hasPendingRequest && (
          <span className="inline-flex w-fit items-center rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-xs font-bold text-amber-800">
            Demande d'assistance en attente
          </span>
        )}
      </div>

      {issued ? (
        <div>
          <Label htmlFor="client-temporary-password">Mot de passe temporaire</Label>
          <div className="relative mt-1.5">
            <Input
              id="client-temporary-password"
              type={visible ? "text" : "password"}
              value={password}
              readOnly
              autoComplete="new-password"
              className="h-11 pr-12"
            />
            <button
              type="button"
              onClick={() => setVisible((current) => !current)}
              className="absolute right-0 top-0 flex h-11 w-11 items-center justify-center text-[#64748B]"
              aria-label={visible ? "Masquer le mot de passe" : "Afficher le mot de passe"}
            >
              {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          <p className="mt-2 text-xs font-semibold text-amber-800">
            Copiez-le maintenant : il ne sera plus affiché après le rechargement de cette page.
          </p>
        </div>
      ) : (
        <p className="rounded-lg border border-[#E3E8F2] bg-[#F8FAFC] px-3 py-2 text-xs font-medium leading-5 text-[#64748B]">
          Le serveur générera un secret aléatoire à usage temporaire. Il n'est jamais envoyé automatiquement par email ni enregistré en clair.
        </p>
      )}

      <div className="flex flex-col gap-2 sm:flex-row">
        <Button type="submit" disabled={saving || issued} className="min-h-11 bg-[#111B4D] text-white hover:bg-[#1E2A78]">
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : issued ? <Check className="mr-2 h-4 w-4" /> : <KeyRound className="mr-2 h-4 w-4" />}
          {issued ? "Accès temporaire créé" : "Créer un accès temporaire sûr"}
        </Button>
        <Button type="button" variant="outline" disabled={!issued || !password} className="min-h-11" onClick={copyPassword}>
          <Copy className="mr-2 h-4 w-4" /> Copier pour transmission sécurisée
        </Button>
      </div>
    </form>
  );
}
