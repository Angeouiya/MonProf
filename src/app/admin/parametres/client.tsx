"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BadgePercent, Headphones, Loader2, Mail, Save, Settings, Smartphone } from "lucide-react";
import { PLATFORM_COMMISSION_PERCENT } from "@/lib/pricing";

export function ParametresClient({ initial }: { initial: Record<string, string> }) {
  const router = useRouter();
  const [values, setValues] = useState<Record<string, string>>(initial);
  const [saving, setSaving] = useState(false);

  const set = (k: string, v: string) => setValues((p) => ({ ...p, [k]: v }));

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success("Paramètres enregistrés");
      router.refresh();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="max-w-5xl overflow-hidden">
      <CardHeader className="border-b border-violet-100 bg-gradient-to-r from-violet-50/80 to-blue-50/60">
        <CardTitle className="flex items-center gap-2 text-base">
          <Settings className="h-4 w-4 text-violet-700" />
          Configuration opérationnelle
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6 p-5 sm:p-6">
        <div className="grid gap-4 md:grid-cols-2">
          <SettingField icon={Settings} label="Nom de la plateforme">
            <Input value={values.platform_name ?? ""} onChange={(e) => set("platform_name", e.target.value)} />
          </SettingField>
          <SettingField icon={BadgePercent} label="Commission par défaut (%)">
            <Input type="number" min={0} max={100} value={values.default_commission ?? String(PLATFORM_COMMISSION_PERCENT)} onChange={(e) => set("default_commission", e.target.value)} />
          </SettingField>
          <SettingField icon={Smartphone} label="Téléphone support">
            <Input value={values.support_phone ?? ""} onChange={(e) => set("support_phone", e.target.value)} placeholder="+225 27 22 00 00 00" />
          </SettingField>
          <SettingField icon={Mail} label="Email support">
            <Input type="email" value={values.support_email ?? ""} onChange={(e) => set("support_email", e.target.value)} placeholder="support@monprof.ci" />
          </SettingField>
        </div>

        <div className="flex flex-col gap-4 rounded-3xl border border-amber-200 bg-amber-50/70 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white text-amber-700 ring-1 ring-amber-200">
              <Headphones className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-bold text-foreground">Ces informations apparaissent dans les parcours support.</p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                Gardez-les à jour pour éviter les ruptures de confiance lors des réservations, litiges et demandes de paiement.
              </p>
            </div>
          </div>
          <Button onClick={save} disabled={saving} className="sm:w-auto">
            {saving ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Save className="mr-1.5 h-4 w-4" />}
            Enregistrer
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function SettingField({
  icon: Icon,
  label,
  children,
}: {
  icon: any;
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-3xl border border-violet-100 bg-white/80 p-4 shadow-sm">
      <Label className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-600">
        <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-violet-50 text-violet-700">
          <Icon className="h-3.5 w-3.5" />
        </span>
        {label}
      </Label>
      {children}
    </div>
  );
}
