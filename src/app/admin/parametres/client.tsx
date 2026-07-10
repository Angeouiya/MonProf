"use client";

import type { ComponentType, ReactNode } from "react";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import {
  ArrowUpRight, BadgePercent, BellRing, Building2, CalendarClock, CheckCircle2, Clock3, Database,
  Loader2, Mail, MapPinned, Route, Save, Settings, ShieldCheck, Smartphone,
  UsersRound, WalletCards, XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type ProviderStatus = { email: boolean; sms: boolean; whatsapp: boolean; webPush: boolean; cron: boolean };
type DatabaseStatus = {
  projectLabel: string;
  schema: string;
  tableCount: number;
  publicTableCount: number;
  teacherCount: number;
  subjectCount: number;
  levelCount: number;
  communeCount: number;
  quarterCount: number;
  activeCommuneCount: number;
  userCount: number;
};

export function ParametresClient({
  initial,
  providerStatus,
  databaseStatus,
}: {
  initial: Record<string, string>;
  providerStatus: ProviderStatus;
  databaseStatus: DatabaseStatus;
}) {
  const router = useRouter();
  const [values, setValues] = useState(initial);
  const [savedValues, setSavedValues] = useState(initial);
  const [saving, setSaving] = useState(false);
  const commission = clampNumber(values.default_commission, 30, 0, 60);
  const teacherShare = 100 - commission;
  const changed = useMemo(
    () => Object.keys(savedValues).some((key) => savedValues[key] !== values[key]),
    [savedValues, values],
  );
  const set = (key: string, value: string) => setValues((current) => ({ ...current, [key]: value }));

  const save = async () => {
    setSaving(true);
    try {
      const response = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Impossible d'enregistrer les paramètres.");
      const nextValues = data.settings ?? values;
      setValues(nextValues);
      setSavedValues(nextValues);
      const synchronized = Number(data.teacherProfilesSynchronized || 0);
      toast.success(synchronized > 0
        ? `Paramètres enregistrés. ${synchronized} profil(s) au taux précédent ont été synchronisés.`
        : "Paramètres enregistrés et appliqués aux nouveaux calculs.");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Enregistrement impossible.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5 pb-24">
      <SettingSection icon={Building2} title="Identité & service client" description="Informations officielles visibles dans les parcours client et professeur.">
        <div className="grid gap-4 md:grid-cols-2">
          <SettingField icon={Settings} label="Nom de la plateforme">
            <Input value={values.platform_name ?? ""} onChange={(event) => set("platform_name", event.target.value)} />
          </SettingField>
          <SettingField icon={Smartphone} label="Téléphone service client">
            <Input value={values.support_phone ?? ""} onChange={(event) => set("support_phone", event.target.value)} />
          </SettingField>
          <SettingField icon={Mail} label="Email service client">
            <Input type="email" value={values.support_email ?? ""} onChange={(event) => set("support_email", event.target.value)} />
          </SettingField>
          <SettingField icon={BellRing} label="Nom d'expéditeur">
            <Input value={values.notification_from_name ?? ""} onChange={(event) => set("notification_from_name", event.target.value)} />
          </SettingField>
        </div>
      </SettingSection>

      <SettingSection icon={BadgePercent} title="Commission & reversement" description="Règle comptable appliquée aux nouvelles réservations. Les réservations existantes conservent leur taux d'origine.">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(300px,0.8fr)]">
          <SettingField icon={BadgePercent} label="Commission plateforme par défaut (%)">
            <Input type="number" min={0} max={60} step={1} value={values.default_commission ?? "30"} onChange={(event) => set("default_commission", event.target.value)} />
            <p className="mt-2 text-xs leading-5 text-[#64748B]">Le taux général est de 30 %. Une exception peut rester définie sur la fiche d'un professeur.</p>
          </SettingField>
          <div className="grid grid-cols-2 gap-3 rounded-lg border border-[#DDE6F7] bg-white p-4">
            <Metric label="Plateforme" value={`${commission}%`} />
            <Metric label="Professeur" value={`${teacherShare}%`} />
            <p className="col-span-2 text-xs leading-5 text-[#64748B]">Cette répartition est interne. Le client voit uniquement le prix total à payer.</p>
          </div>
        </div>
      </SettingSection>

      <SettingSection icon={CalendarClock} title="Règles de réservation" description="Règles métier obligatoires appliquées de la simulation client jusqu'à la validation serveur.">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <RuleMetric icon={Clock3} label="Anticipation" value="24 heures" detail="Réservation impossible sous ce délai" />
          <RuleMetric icon={CalendarClock} label="Durée séance" value="2 heures" detail="Créneaux détaillés de 08h à 22h" />
          <RuleMetric icon={UsersRound} label="Groupe" value="+50 %" detail="Par participant supplémentaire" />
          <RuleMetric icon={ShieldCheck} label="Paiement" value="PayDunya vérifié" detail="Aucune réservation avant confirmation serveur" />
        </div>
        <p className="mt-4 text-xs font-medium leading-5 text-[#64748B]">
          Ces garanties structurantes sont verrouillées pour éviter qu'un changement de saisie rende les réservations ou la comptabilité incohérentes.
        </p>
      </SettingSection>

      <SettingSection icon={MapPinned} title="Déplacements" description="Forfaits automatiques pour les cours à domicile. Le même quartier exact reste à 0 FCFA.">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MoneyField label="Même commune" value={values.transport_same_commune_fee} onChange={(value) => set("transport_same_commune_fee", value)} />
          <MoneyField label="Commune proche" value={values.transport_near_commune_fee} onChange={(value) => set("transport_near_commune_fee", value)} />
          <MoneyField label="Commune éloignée" value={values.transport_far_commune_fee} onChange={(value) => set("transport_far_commune_fee", value)} />
          <MoneyField label="Ville intérieure" value={values.transport_interior_fee} onChange={(value) => set("transport_interior_fee", value)} />
        </div>
        <div className="mt-4 flex flex-col gap-3 rounded-lg border border-[#DDE6F7] bg-white p-4 text-sm text-[#475569] sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <Route className="mt-0.5 h-4 w-4 shrink-0 text-[#111B4D]" />
            <span>Les classifications, quartiers et forfaits particuliers se gèrent dans le référentiel géographique.</span>
          </div>
          <Button asChild variant="outline" className="min-h-11 shrink-0 border-[#CAD7F2] text-[#111B4D]">
            <Link href="/admin/communes">Communes & quartiers <ArrowUpRight className="ml-2 h-4 w-4" /></Link>
          </Button>
        </div>
      </SettingSection>

      <SettingSection icon={WalletCards} title="Demandes de paiement professeur" description="Délai opérationnel annoncé au professeur après sa demande de paiement.">
        <div className="grid gap-4 sm:grid-cols-2">
          <SettingField icon={Clock3} label="Délai minimum (heures)">
            <Input type="number" min={1} max={72} value={values.teacher_payout_min_hours ?? "1"} onChange={(event) => set("teacher_payout_min_hours", event.target.value)} />
          </SettingField>
          <SettingField icon={Clock3} label="Délai maximum (heures)">
            <Input type="number" min={1} max={72} value={values.teacher_payout_max_hours ?? "72"} onChange={(event) => set("teacher_payout_max_hours", event.target.value)} />
          </SettingField>
        </div>
      </SettingSection>

      <SettingSection icon={BellRing} title="Notifications & automatisations" description="Pilotage des envois réels et des relances programmées. Les secrets restent exclusivement côté serveur.">
        <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-5">
          <ProviderPill label="Email" ok={providerStatus.email} />
          <ProviderPill label="SMS" ok={providerStatus.sms} />
          <ProviderPill label="WhatsApp" ok={providerStatus.whatsapp} />
          <ProviderPill label="Web Push" ok={providerStatus.webPush} />
          <ProviderPill label="Cron" ok={providerStatus.cron} />
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <SelectField label="Relances automatiques" value={values.notification_cron_enabled ?? "true"} onChange={(value) => set("notification_cron_enabled", value)} />
          <SelectField label="Livraison par les providers" value={values.notification_delivery_enabled ?? "true"} onChange={(value) => set("notification_delivery_enabled", value)} />
        </div>
      </SettingSection>

      <SettingSection icon={Database} title="État de la production" description={`Données applicatives isolées dans le schéma PostgreSQL ${databaseStatus.schema}.`}>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <Metric label="Connexion" value={databaseStatus.tableCount > 0 ? "Active" : "À vérifier"} />
          <Metric label="Tables applicatives" value={String(databaseStatus.tableCount)} />
          <Metric label="Professeurs" value={String(databaseStatus.teacherCount)} />
          <Metric label="Utilisateurs" value={String(databaseStatus.userCount)} />
          <Metric label="Matières" value={String(databaseStatus.subjectCount)} />
          <Metric label="Niveaux" value={String(databaseStatus.levelCount)} />
          <Metric label="Communes actives" value={`${databaseStatus.activeCommuneCount}/${databaseStatus.communeCount}`} />
          <Metric label="Quartiers référencés" value={String(databaseStatus.quarterCount)} />
        </div>
      </SettingSection>

      <div className="sticky bottom-4 z-20 flex flex-col gap-3 rounded-lg border border-[#C9D4EA] bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#111B4D] text-white"><ShieldCheck className="h-5 w-5" /></div>
          <div><p className="text-sm font-semibold text-[#111827]">Configuration sensible et journalisée</p><p className="text-xs leading-5 text-[#64748B]">Les changements affectent uniquement les nouveaux calculs et sont conservés dans le journal admin.</p></div>
        </div>
        <Button onClick={save} disabled={saving || !changed} className="min-h-11 bg-[#111B4D] text-white hover:bg-[#0B143D] sm:min-w-48">
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          Enregistrer les paramètres
        </Button>
      </div>
    </div>
  );
}

function SettingSection({ icon: Icon, title, description, children }: { icon: ComponentType<{ className?: string }>; title: string; description: string; children: ReactNode }) {
  return <Card className="overflow-hidden border-[#DDE6F7] bg-white"><CardContent className="p-0"><div className="flex items-start gap-3 border-b border-[#E7ECF5] p-4 sm:p-5"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#111B4D] text-white"><Icon className="h-5 w-5" /></span><div><h2 className="text-base font-semibold text-[#111827]">{title}</h2><p className="mt-1 text-sm leading-5 text-[#64748B]">{description}</p></div></div><div className="p-4 sm:p-5">{children}</div></CardContent></Card>;
}

function SettingField({ icon: Icon, label, children }: { icon: ComponentType<{ className?: string }>; label: string; children: ReactNode }) {
  return <div className="rounded-lg border border-[#DDE6F7] bg-white p-4"><Label className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase text-[#475569]"><Icon className="h-4 w-4 text-[#111B4D]" />{label}</Label>{children}</div>;
}

function MoneyField({ label, value, onChange }: { label: string; value?: string; onChange: (value: string) => void }) {
  return <SettingField icon={MapPinned} label={label}><div className="relative"><Input type="number" min={0} max={100000} step={500} value={value ?? "0"} onChange={(event) => onChange(event.target.value)} className="pr-16" /><span className="absolute inset-y-0 right-3 flex items-center text-xs font-semibold text-[#64748B]">FCFA</span></div></SettingField>;
}

function SelectField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <div><Label className="mb-2 block text-xs font-semibold uppercase text-[#475569]">{label}</Label><select value={value} onChange={(event) => onChange(event.target.value)} className="h-11 w-full rounded-lg border border-[#DDE6F7] bg-white px-3 text-sm font-semibold text-[#111827] outline-none focus:border-[#111B4D]"><option value="true">Actives</option><option value="false">Désactivées</option></select></div>;
}

function ProviderPill({ label, ok }: { label: string; ok: boolean }) {
  return <div className="flex min-h-11 items-center justify-center gap-2 rounded-lg border border-[#DDE6F7] bg-white px-3 text-xs font-semibold text-[#111827]">{ok ? <CheckCircle2 className="h-4 w-4 text-[#111B4D]" /> : <XCircle className="h-4 w-4 text-red-600" />}{label}</div>;
}

function RuleMetric({ icon: Icon, label, value, detail }: { icon: ComponentType<{ className?: string }>; label: string; value: string; detail: string }) {
  return <div className="rounded-lg border border-[#DDE6F7] bg-white p-4"><div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#111B4D] text-white"><Icon className="h-4 w-4" /></div><p className="mt-3 text-[10px] font-semibold uppercase text-[#64748B]">{label}</p><p className="mt-1 text-sm font-semibold text-[#111827]">{value}</p><p className="mt-1 text-xs font-medium leading-5 text-[#64748B]">{detail}</p></div>;
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="min-w-0 rounded-lg border border-[#DDE6F7] bg-white px-3 py-3"><p className="truncate text-[10px] font-semibold uppercase text-[#64748B]">{label}</p><p className="mt-1 truncate text-sm font-semibold text-[#111827]">{value}</p></div>;
}

function clampNumber(value: string | undefined, fallback: number, minimum: number, maximum: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.min(maximum, Math.max(minimum, Math.round(parsed))) : fallback;
}
