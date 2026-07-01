"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2, Save, X } from "lucide-react";

const schema = z.object({
  fullName: z.string().min(2, "Nom requis"),
  professionalName: z.string().optional(),
  photoUrl: z.string().optional(),
  phone: z.string().min(5, "Téléphone requis"),
  email: z.string().optional(),
  commune: z.string().optional(),
  quartier: z.string().optional(),
  addressHint: z.string().optional(),
  jobTitle: z.string().min(2, "Titre requis"),
  bio: z.string().min(10, "Bio trop courte"),
  experienceYears: z.coerce.number().min(0).default(0),
  diploma: z.string().optional(),
  cvUrl: z.string().optional(),
  profileType: z.string().default("ENSEIGNANT"),
  status: z.string().default("ACTIVE"),
  featured: z.boolean().default(false),
  rating: z.coerce.number().min(0).max(5).default(0),
  ratingCount: z.coerce.number().min(0).default(0),
  badgeVerified: z.boolean().default(true),
  badgeRecommended: z.boolean().default(false),
  badgeNew: z.boolean().default(true),
  badgePopular: z.boolean().default(false),
  badgePremium: z.boolean().default(false),
  internalNote: z.string().optional(),
  offersHome: z.boolean().default(true),
  offersOnline: z.boolean().default(true),
  offersGroup: z.boolean().default(false),
  pricePerHour: z.coerce.number().min(0).default(10000),
  pricePerSession: z.coerce.number().min(0).default(10000),
  pricePack4: z.coerce.number().min(0).default(38000),
  pricePack8: z.coerce.number().min(0).default(72000),
  commissionRate: z.coerce.number().min(0).max(100).default(20),
  pricingTier: z.string().default("STANDARD"),
});

type FormValues = z.infer<typeof schema>;

type Subject = { id: string; name: string };
type Level = { id: string; name: string };
type Commune = { id: string; name: string };

const DAYS = [
  { key: "mon", label: "Lundi" },
  { key: "tue", label: "Mardi" },
  { key: "wed", label: "Mercredi" },
  { key: "thu", label: "Jeudi" },
  { key: "fri", label: "Vendredi" },
  { key: "sat", label: "Samedi" },
  { key: "sun", label: "Dimanche" },
];
const SLOTS = [
  { key: "morning", label: "Matin" },
  { key: "afternoon", label: "Après-midi" },
  { key: "evening", label: "Soir" },
];

export function TeacherForm({
  mode,
  teacherId,
  initial,
  subjects,
  levels,
  communes,
}: {
  mode: "create" | "edit";
  teacherId?: string;
  initial?: any;
  subjects: Subject[];
  levels: Level[];
  communes: Commune[];
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  // Selections
  const [selectedSubjects, setSelectedSubjects] = useState<Record<string, boolean>>({});
  const [primarySubject, setPrimarySubject] = useState<string | null>(null);
  const [selectedLevels, setSelectedLevels] = useState<Record<string, boolean>>({});
  const [selectedZones, setSelectedZones] = useState<Record<string, boolean>>({});
  const [availability, setAvailability] = useState<Record<string, Record<string, boolean>>>(() => {
    const init: any = {};
    for (const d of DAYS) {
      init[d.key] = { morning: false, afternoon: false, evening: false };
    }
    return init;
  });

  const { register, handleSubmit, control, watch, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: initial
      ? {
          ...initial,
          experienceYears: initial.experienceYears ?? 0,
          rating: initial.rating ?? 0,
          ratingCount: initial.ratingCount ?? 0,
          pricePerHour: initial.pricePerHour ?? 10000,
          pricePerSession: initial.pricePerSession ?? 10000,
          pricePack4: initial.pricePack4 ?? 38000,
          pricePack8: initial.pricePack8 ?? 72000,
          commissionRate: initial.commissionRate ?? 20,
        }
      : {
          profileType: "ENSEIGNANT",
          status: "ACTIVE",
          pricingTier: "STANDARD",
          badgeVerified: true,
          badgeNew: true,
          offersHome: true,
          offersOnline: true,
          commissionRate: 20,
          pricePerHour: 10000,
          pricePerSession: 10000,
          pricePack4: 38000,
          pricePack8: 72000,
          experienceYears: 0,
          rating: 0,
          ratingCount: 0,
        } as any,
  });

  // Initialize selections from initial (edit mode)
  useEffect(() => {
    if (!initial) return;
    const sSub: Record<string, boolean> = {};
    let primary: string | null = null;
    for (const s of initial.subjects ?? []) {
      const sid = s.subjectId || s.id;
      sSub[sid] = true;
      if (s.isPrimary) primary = sid;
    }
    setSelectedSubjects(sSub);
    setPrimarySubject(primary);
    const sLvl: Record<string, boolean> = {};
    for (const l of initial.levels ?? []) sLvl[l.levelId || l.id] = true;
    setSelectedLevels(sLvl);
    const sZ: Record<string, boolean> = {};
    for (const z of initial.zones ?? []) sZ[z.communeId || z.id] = true;
    setSelectedZones(sZ);
    if (initial.availability && typeof initial.availability === "object") {
      setAvailability({ ...availability, ...initial.availability });
    }
  }, [initial]);

  const rating = watch("rating");
  const commissionRate = watch("commissionRate");
  const pricePerSession = watch("pricePerSession");
  const pricePack4 = watch("pricePack4");
  const pricePack8 = watch("pricePack8");

  const onSubmit = async (values: FormValues) => {
    if (Object.values(selectedSubjects).every((v) => !v)) {
      toast.error("Sélectionnez au moins une matière");
      return;
    }
    if (!primarySubject) {
      toast.error("Définissez une matière principale");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        ...values,
        subjects: Object.entries(selectedSubjects)
          .filter(([, v]) => v)
          .map(([id]) => ({ subjectId: id, isPrimary: id === primarySubject })),
        levels: Object.entries(selectedLevels).filter(([, v]) => v).map(([id]) => ({ levelId: id })),
        zones: Object.entries(selectedZones).filter(([, v]) => v).map(([id]) => ({ communeId: id })),
        availability,
      };

      const url = mode === "create" ? "/api/admin/teachers" : `/api/admin/teachers/${teacherId}`;
      const method = mode === "create" ? "POST" : "PATCH";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur");
      toast.success(mode === "create" ? "Professeur créé" : "Professeur mis à jour");
      if (mode === "create" && data.id) {
        router.push(`/admin/professeurs/${data.id}`);
      } else {
        router.push(`/admin/professeurs/${teacherId}`);
        router.refresh();
      }
    } catch (e: any) {
      toast.error(e.message || "Erreur lors de l'enregistrement");
    } finally {
      setSaving(false);
    }
  };

  const net = (price: number) => Math.round(price * (1 - (commissionRate ?? 0) / 100));

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      <Tabs defaultValue="infos" className="w-full">
        <TabsList className="flex w-full flex-wrap h-auto justify-start gap-1 bg-muted/50 p-1">
          <TabsTrigger value="infos">Informations</TabsTrigger>
          <TabsTrigger value="pro">Pro</TabsTrigger>
          <TabsTrigger value="matieres">Matières & Niveaux</TabsTrigger>
          <TabsTrigger value="dispo">Disponibilités</TabsTrigger>
          <TabsTrigger value="zones">Zones</TabsTrigger>
          <TabsTrigger value="tarifs">Tarifs</TabsTrigger>
          <TabsTrigger value="eval">Évaluation</TabsTrigger>
        </TabsList>

        {/* INFOS */}
        <TabsContent value="infos">
          <Card>
            <CardHeader><CardTitle className="text-base">Informations personnelles</CardTitle></CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <Field label="Nom complet" error={errors.fullName?.message} required>
                <Input {...register("fullName")} placeholder="Traoré Issa" />
              </Field>
              <Field label="Nom professionnel">
                <Input {...register("professionalName")} placeholder="M. Traoré" />
              </Field>
              <Field label="Photo (URL)">
                <Input {...register("photoUrl")} placeholder="https://..." />
              </Field>
              <Field label="Téléphone" error={errors.phone?.message} required>
                <Input {...register("phone")} placeholder="+225 07 00 00 00 00" />
              </Field>
              <Field label="Email">
                <Input type="email" {...register("email")} placeholder="prof@monprof.ci" />
              </Field>
              <Field label="Commune">
                <Input {...register("commune")} placeholder="Cocody" />
              </Field>
              <Field label="Quartier">
                <Input {...register("quartier")} placeholder="Riviera Palmeraie" />
              </Field>
              <Field label="Adresse approx. (indice)">
                <Input {...register("addressHint")} placeholder="Près de la pharmacie..." />
              </Field>
              <Field label="Statut">
                <Controller control={control} name="status" render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ACTIVE">Actif</SelectItem>
                      <SelectItem value="INACTIVE">Inactif</SelectItem>
                      <SelectItem value="SUSPENDED">Suspendu</SelectItem>
                      <SelectItem value="PENDING">En attente</SelectItem>
                    </SelectContent>
                  </Select>
                )} />
              </Field>
              <Field label="Mis en avant">
                <Controller control={control} name="featured" render={({ field }) => (
                  <Switch checked={field.value} onCheckedChange={field.onChange} />
                )} />
              </Field>
            </CardContent>
          </Card>
        </TabsContent>

        {/* PRO */}
        <TabsContent value="pro">
          <Card>
            <CardHeader><CardTitle className="text-base">Informations professionnelles</CardTitle></CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <Field label="Titre professionnel" error={errors.jobTitle?.message} required>
                <Input {...register("jobTitle")} placeholder="Professeur de Mathématiques" />
              </Field>
              <Field label="Années d'expérience">
                <Input type="number" min={0} {...register("experienceYears")} />
              </Field>
              <Field label="Diplôme principal">
                <Input {...register("diploma")} placeholder="Master Mathématiques" />
              </Field>
              <Field label="CV (URL)">
                <Input {...register("cvUrl")} placeholder="https://..." />
              </Field>
              <Field label="Type de profil">
                <Controller control={control} name="profileType" render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ENSEIGNANT">Enseignant</SelectItem>
                      <SelectItem value="ETUDIANT">Étudiant</SelectItem>
                      <SelectItem value="REPETITEUR">Répétiteur</SelectItem>
                      <SelectItem value="FORMATEUR">Formateur</SelectItem>
                      <SelectItem value="PROFESSIONNEL">Professionnel</SelectItem>
                    </SelectContent>
                  </Select>
                )} />
              </Field>
              <div className="sm:col-span-2">
                <Field label="Bio" error={errors.bio?.message} required>
                  <Textarea rows={5} {...register("bio")} placeholder="Présentation pédagogique..." />
                </Field>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* MATIÈRES & NIVEAUX */}
        <TabsContent value="matieres">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Matières enseignées</CardTitle>
              <p className="text-sm text-muted-foreground">Cochez les matières, puis choisissez la matière principale.</p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                {subjects.map((s) => {
                  const checked = !!selectedSubjects[s.id];
                  return (
                    <label key={s.id} className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors ${checked ? "border-primary bg-primary/5" : "border-border bg-white hover:bg-muted"}`}>
                      <Checkbox
                        checked={checked}
                        onCheckedChange={(v) => {
                          setSelectedSubjects((prev) => ({ ...prev, [s.id]: !!v }));
                          if (!v && primarySubject === s.id) setPrimarySubject(null);
                        }}
                      />
                      <span className="flex-1 truncate">{s.name}</span>
                      {checked && (
                        <button
                          type="button"
                          onClick={(e) => { e.preventDefault(); setPrimarySubject(s.id); }}
                          className={`rounded-md px-1.5 py-0.5 text-[10px] font-medium ${primarySubject === s.id ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-primary/10 hover:text-primary"}`}
                        >
                          {primarySubject === s.id ? "Principale" : "Définir principale"}
                        </button>
                      )}
                    </label>
                  );
                })}
              </div>
              <div className="border-t border-border pt-4">
                <p className="mb-2 text-sm font-medium text-foreground">Niveaux enseignés</p>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
                  {levels.map((l) => {
                    const checked = !!selectedLevels[l.id];
                    return (
                      <label key={l.id} className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm ${checked ? "border-primary bg-primary/5" : "border-border bg-white hover:bg-muted"}`}>
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(v) => setSelectedLevels((prev) => ({ ...prev, [l.id]: !!v }))}
                        />
                        <span className="truncate">{l.name}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* DISPONIBILITÉS */}
        <TabsContent value="dispo">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Disponibilités</CardTitle>
              <p className="text-sm text-muted-foreground">Cochez les créneaux disponibles.</p>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full min-w-[520px] text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="py-2 text-left font-medium text-muted-foreground">Jour</th>
                    {SLOTS.map((s) => (
                      <th key={s.key} className="px-4 py-2 text-center font-medium text-muted-foreground">{s.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {DAYS.map((d) => (
                    <tr key={d.key} className="border-b border-border last:border-0">
                      <td className="py-2 font-medium text-foreground">{d.label}</td>
                      {SLOTS.map((s) => (
                        <td key={s.key} className="px-4 py-2 text-center">
                          <Checkbox
                            checked={!!availability[d.key]?.[s.key]}
                            onCheckedChange={(v) =>
                              setAvailability((prev) => ({
                                ...prev,
                                [d.key]: { ...prev[d.key], [s.key]: !!v },
                              }))
                            }
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ZONES */}
        <TabsContent value="zones">
          <Card>
            <CardHeader><CardTitle className="text-base">Zones d'intervention</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                {communes.map((c) => {
                  const checked = !!selectedZones[c.id];
                  return (
                    <label key={c.id} className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm ${checked ? "border-primary bg-primary/5" : "border-border bg-white hover:bg-muted"}`}>
                      <Checkbox
                        checked={checked}
                        onCheckedChange={(v) => setSelectedZones((prev) => ({ ...prev, [c.id]: !!v }))}
                      />
                      <span className="truncate">{c.name}</span>
                    </label>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TARIFS */}
        <TabsContent value="tarifs">
          <Card>
            <CardHeader><CardTitle className="text-base">Tarification (FCFA)</CardTitle></CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <Field label="Tarif / heure">
                <Input type="number" min={0} step={500} {...register("pricePerHour")} />
              </Field>
              <Field label="Tarif / séance">
                <Input type="number" min={0} step={500} {...register("pricePerSession")} />
              </Field>
              <Field label="Pack 4 séances">
                <Input type="number" min={0} step={500} {...register("pricePack4")} />
              </Field>
              <Field label="Pack 8 séances">
                <Input type="number" min={0} step={500} {...register("pricePack8")} />
              </Field>
              <Field label="Commission plateforme (%)">
                <Input type="number" min={0} max={100} {...register("commissionRate")} />
              </Field>
              <Field label="Tier tarifaire">
                <Controller control={control} name="pricingTier" render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="STANDARD">Standard</SelectItem>
                      <SelectItem value="RECOMMENDED">Recommandé</SelectItem>
                      <SelectItem value="PREMIUM">Premium</SelectItem>
                      <SelectItem value="PROMOTIONAL">Promotionnel</SelectItem>
                    </SelectContent>
                  </Select>
                )} />
              </Field>

              <div className="sm:col-span-2 grid gap-3 rounded-lg border border-border bg-muted/30 p-4">
                <p className="text-sm font-medium text-foreground">Net professeur (après commission {commissionRate ?? 0}%)</p>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-md bg-white p-2">
                    <p className="text-xs text-muted-foreground">Séance</p>
                    <p className="text-sm font-semibold">{net(pricePerSession ?? 0).toLocaleString("fr-FR")} F</p>
                  </div>
                  <div className="rounded-md bg-white p-2">
                    <p className="text-xs text-muted-foreground">Pack 4</p>
                    <p className="text-sm font-semibold">{net(pricePack4 ?? 0).toLocaleString("fr-FR")} F</p>
                  </div>
                  <div className="rounded-md bg-white p-2">
                    <p className="text-xs text-muted-foreground">Pack 8</p>
                    <p className="text-sm font-semibold">{net(pricePack8 ?? 0).toLocaleString("fr-FR")} F</p>
                  </div>
                </div>
              </div>

              <div className="sm:col-span-2 grid gap-3 sm:grid-cols-3">
                <FormatSwitch control={control} name="offersHome" label="À domicile" />
                <FormatSwitch control={control} name="offersOnline" label="En ligne" />
                <FormatSwitch control={control} name="offersGroup" label="Groupe" />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ÉVALUATION */}
        <TabsContent value="eval">
          <Card>
            <CardHeader><CardTitle className="text-base">Évaluation interne & badges</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Note interne: {Number(rating ?? 0).toFixed(1)} / 5</Label>
                <Controller control={control} name="rating" render={({ field }) => (
                  <Slider
                    value={[Number(field.value) || 0]}
                    onValueChange={(v) => field.onChange(v[0])}
                    min={0} max={5} step={0.1}
                    className="mt-2"
                  />
                )} />
              </div>
              <Field label="Nombre d'avis (interne)">
                <Input type="number" min={0} {...register("ratingCount")} />
              </Field>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                <BadgeToggle control={control} name="badgeVerified" label="Vérifié" />
                <BadgeToggle control={control} name="badgeRecommended" label="Recommandé" />
                <BadgeToggle control={control} name="badgeNew" label="Nouveau" />
                <BadgeToggle control={control} name="badgePopular" label="Populaire" />
                <BadgeToggle control={control} name="badgePremium" label="Premium" />
              </div>
              <Field label="Commentaire interne (admin)">
                <Textarea rows={3} {...register("internalNote")} placeholder="Notes, observations..." />
              </Field>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <div className="sticky bottom-0 flex items-center justify-end gap-2 rounded-xl border border-border bg-white p-3 shadow-sm">
        <Button type="button" variant="ghost" onClick={() => router.back()}>
          <X className="mr-1.5 h-4 w-4" /> Annuler
        </Button>
        <Button type="submit" disabled={saving}>
          {saving ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Save className="mr-1.5 h-4 w-4" />}
          {mode === "create" ? "Créer le professeur" : "Enregistrer"}
        </Button>
      </div>
    </form>
  );
}

function Field({ label, error, required, children }: { label: string; error?: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-foreground">
        {label} {required && <span className="text-red-500">*</span>}
      </Label>
      {children}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}

function FormatSwitch({ control, name, label }: { control: any; name: "offersHome" | "offersOnline" | "offersGroup"; label: string }) {
  return (
    <Controller control={control} name={name} render={({ field }) => (
      <label className="flex cursor-pointer items-center justify-between gap-2 rounded-lg border border-border px-3 py-2">
        <span className="text-sm font-medium">{label}</span>
        <Switch checked={!!field.value} onCheckedChange={field.onChange} />
      </label>
    )} />
  );
}

function BadgeToggle({ control, name, label }: { control: any; name: any; label: string }) {
  return (
    <Controller control={control} name={name} render={({ field }) => (
      <label className={`flex cursor-pointer items-center justify-between gap-2 rounded-lg border px-3 py-2 ${field.value ? "border-primary bg-primary/5" : "border-border bg-white"}`}>
        <span className="text-sm font-medium">{label}</span>
        <Switch checked={!!field.value} onCheckedChange={field.onChange} />
      </label>
    )} />
  );
}
