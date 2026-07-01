"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Save } from "lucide-react";

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
    <Card className="max-w-2xl">
      <CardHeader><CardTitle className="text-base">Configuration</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label>Nom de la plateforme</Label>
          <Input value={values.platform_name ?? ""} onChange={(e) => set("platform_name", e.target.value)} className="mt-1.5" />
        </div>
        <div>
          <Label>Commission par défaut (%)</Label>
          <Input type="number" min={0} max={100} value={values.default_commission ?? "20"} onChange={(e) => set("default_commission", e.target.value)} className="mt-1.5" />
        </div>
        <div>
          <Label>Téléphone support</Label>
          <Input value={values.support_phone ?? ""} onChange={(e) => set("support_phone", e.target.value)} placeholder="+225 27 22 00 00 00" className="mt-1.5" />
        </div>
        <div>
          <Label>Email support</Label>
          <Input type="email" value={values.support_email ?? ""} onChange={(e) => set("support_email", e.target.value)} placeholder="support@monprof.ci" className="mt-1.5" />
        </div>
        <div className="pt-2">
          <Button onClick={save} disabled={saving}>
            {saving ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Save className="mr-1.5 h-4 w-4" />}
            Enregistrer
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
