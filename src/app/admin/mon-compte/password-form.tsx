"use client";

import { useState } from "react";
import { toast } from "sonner";
import { KeyRound, Loader2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function AdminPasswordForm() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword, confirmPassword }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Modification impossible.");
      setCurrentPassword(""); setNewPassword(""); setConfirmPassword("");
      toast.success("Mot de passe administrateur modifié et action historisée.");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Modification impossible."); }
    finally { setLoading(false); }
  };

  return (
    <Card className="max-w-3xl border-[#CBD5E1] bg-white">
      <CardHeader className="border-b border-[#E2E8F0]">
        <CardTitle className="flex items-center gap-2 text-base"><KeyRound className="h-4 w-4 text-[#111B4D]" /> Modifier mon mot de passe</CardTitle>
        <p className="text-sm leading-6 text-[#64748B]">Votre mot de passe actuel est obligatoire. Le nouveau doit contenir au moins 10 caractères, une lettre et un chiffre.</p>
      </CardHeader>
      <CardContent className="space-y-4 p-4 sm:p-5">
        <Field label="Mot de passe actuel"><Input type="password" autoComplete="current-password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} /></Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nouveau mot de passe"><Input type="password" autoComplete="new-password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} /></Field>
          <Field label="Confirmer le nouveau mot de passe"><Input type="password" autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} /></Field>
        </div>
        <div className="flex justify-end"><Button onClick={submit} disabled={loading} className="min-h-11 bg-[#111B4D] text-white hover:bg-[#1E2A78]">{loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4" />} Enregistrer</Button></div>
      </CardContent>
    </Card>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <div className="space-y-2"><Label>{label}</Label>{children}</div>; }
