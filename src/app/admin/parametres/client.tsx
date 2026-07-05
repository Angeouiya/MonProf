"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BadgePercent, BellRing, CheckCircle2, Headphones, Loader2, Mail, Save, Settings, Smartphone, XCircle } from "lucide-react";
import { PLATFORM_COMMISSION_PERCENT } from "@/lib/pricing";

type ProviderStatus = {
  email: boolean;
  sms: boolean;
  whatsapp: boolean;
  cron: boolean;
};

export function ParametresClient({
  initial,
  providerStatus,
}: {
  initial: Record<string, string>;
  providerStatus: ProviderStatus;
}) {
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
    <Card className="max-w-6xl overflow-hidden border-[#E3E8F2] bg-white">
      <CardHeader className="border-b border-[#E3E8F2] bg-white">
        <CardTitle className="flex items-center gap-2 text-base">
          <Settings className="h-4 w-4 text-[#111B4D]" />
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
            <Input type="email" value={values.support_email ?? ""} onChange={(e) => set("support_email", e.target.value)} placeholder="support@competence.ci" />
          </SettingField>
        </div>

        <div className="rounded-lg border border-[#E3E8F2] bg-white p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="inline-flex items-center gap-2 text-sm font-semibold text-[#111827]">
                <BellRing className="h-4 w-4 text-[#111B4D]" />
                Notifications, cron et providers réels
              </p>
              <p className="mt-1 text-xs font-medium leading-5 text-[#64748B]">
                Les secrets d'envoi restent dans l'environnement serveur. Cette page affiche leur état et pilote seulement les options opérationnelles.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
              <ProviderPill label="Email" ok={providerStatus.email} />
              <ProviderPill label="SMS" ok={providerStatus.sms} />
              <ProviderPill label="WhatsApp" ok={providerStatus.whatsapp} />
              <ProviderPill label="Cron" ok={providerStatus.cron} />
            </div>
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            <SettingField icon={BellRing} label="Relances automatiques">
              <select
                value={values.notification_cron_enabled ?? "true"}
                onChange={(event) => set("notification_cron_enabled", event.target.value)}
                className="h-11 w-full rounded-lg border border-[#DDE6F7] bg-white px-3 text-sm font-semibold text-[#111827] outline-none focus:border-[#111B4D]"
              >
                <option value="true">Actives</option>
                <option value="false">Désactivées</option>
              </select>
            </SettingField>
            <SettingField icon={BellRing} label="Livraison providers">
              <select
                value={values.notification_delivery_enabled ?? "true"}
                onChange={(event) => set("notification_delivery_enabled", event.target.value)}
                className="h-11 w-full rounded-lg border border-[#DDE6F7] bg-white px-3 text-sm font-semibold text-[#111827] outline-none focus:border-[#111B4D]"
              >
                <option value="true">Tenter les envois réels</option>
                <option value="false">Historiser seulement</option>
              </select>
            </SettingField>
            <SettingField icon={Settings} label="Nom expéditeur">
              <Input value={values.notification_from_name ?? "Compétence"} onChange={(e) => set("notification_from_name", e.target.value)} />
            </SettingField>
          </div>
          <div className="mt-4 rounded-lg border border-[#DDE6F7] bg-white p-3 text-xs font-semibold leading-5 text-[#64748B]">
            Variables à configurer côté serveur : <span className="text-[#111827]">CRON_SECRET</span>, <span className="text-[#111827]">RESEND_API_KEY</span>, <span className="text-[#111827]">RESEND_FROM_EMAIL</span>, <span className="text-[#111827]">TWILIO_ACCOUNT_SID</span>, <span className="text-[#111827]">TWILIO_AUTH_TOKEN</span>, <span className="text-[#111827]">TWILIO_FROM_NUMBER</span>, <span className="text-[#111827]">WHATSAPP_ACCESS_TOKEN</span>, <span className="text-[#111827]">WHATSAPP_PHONE_NUMBER_ID</span>.
          </div>
        </div>

        <div className="flex flex-col gap-4 rounded-lg border border-[#E3E8F2] bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#111B4D] text-white">
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

function ProviderPill({ label, ok }: { label: string; ok: boolean }) {
  return (
    <div className="flex min-h-10 items-center justify-center gap-1.5 rounded-lg border border-[#DDE6F7] bg-white px-3 font-semibold text-[#111827]">
      {ok ? <CheckCircle2 className="h-3.5 w-3.5 text-[#111B4D]" /> : <XCircle className="h-3.5 w-3.5 text-red-600" />}
      {label}
    </div>
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
    <div className="rounded-lg border border-[#E3E8F2] bg-white p-4">
      <Label className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-600">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#111B4D] text-white">
          <Icon className="h-3.5 w-3.5" />
        </span>
        {label}
      </Label>
      {children}
    </div>
  );
}
