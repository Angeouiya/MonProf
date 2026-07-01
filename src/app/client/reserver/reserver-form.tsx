"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { formatFCFA, avatarFromName } from "@/lib/format";
import { PackType } from "@prisma/client";
import {
  ArrowLeft, ArrowRight, Lock, Home, Video, User, Users,
  Sparkles, ShieldCheck, CreditCard, Smartphone,
} from "lucide-react";

type Teacher = {
  id: string;
  fullName: string;
  professionalName: string | null;
  photoUrl: string | null;
  jobTitle: string;
  commune: string | null;
  rating: number;
  ratingCount: number;
  pricePerSession: number;
  pricePack4: number;
  pricePack8: number;
  commissionRate: number;
  offersHome: boolean;
  offersOnline: boolean;
  subjects: { name: string; isPrimary: boolean }[];
  levels: string[];
};

const STEPS = ["Besoin", "Format", "Disponibilité", "Récapitulatif", "Paiement"];
const DAYS = [
  { id: "lundi", label: "Lundi" },
  { id: "mardi", label: "Mardi" },
  { id: "mercredi", label: "Mercredi" },
  { id: "jeudi", label: "Jeudi" },
  { id: "vendredi", label: "Vendredi" },
  { id: "samedi", label: "Samedi" },
  { id: "dimanche", label: "Dimanche" },
];
const TIME_SLOTS = ["Matin (8h-12h)", "Après-midi (12h-17h)", "Soir (17h-21h)"];
const OBJECTIVES = [
  { value: "Devoir / soutien", label: "Devoir / soutien" },
  { value: "Remise à niveau", label: "Remise à niveau" },
  { value: "Préparation examen", label: "Préparation examen (BEPC, BAC)" },
  { value: "Concours", label: "Concours / école" },
  { value: "Perfectionnement", label: "Perfectionnement" },
];
const PACK_OPTIONS = [
  { value: "SINGLE", label: "1 séance", count: 1 },
  { value: "PACK_4", label: "Pack 4 séances", count: 4 },
  { value: "PACK_8", label: "Pack 8 séances", count: 8 },
  { value: "PACK_12", label: "Pack 12 séances (-15%)", count: 12 },
  { value: "EXAM_PREP", label: "Prépa examen (10 séances)", count: 10 },
];
const PAYMENT_METHODS = [
  { value: "WAVE", label: "Wave", color: "#1DC9FF", textColor: "#003CFF" },
  { value: "ORANGE_MONEY", label: "Orange Money", color: "#FF7900", textColor: "#FFFFFF" },
  { value: "MTN_MONEY", label: "MTN Money", color: "#FFCC00", textColor: "#000000" },
  { value: "MOOV_MONEY", label: "Moov Money", color: "#005BAF", textColor: "#FFFFFF" },
  { value: "CARD", label: "Carte bancaire", color: "#10A37F", textColor: "#FFFFFF" },
];

function calcUnitPrice(packType: PackType, t: Teacher): number {
  switch (packType) {
    case "SINGLE": return t.pricePerSession;
    case "PACK_4": return t.pricePack4;
    case "PACK_8": return t.pricePack8;
    case "PACK_12": return Math.round(t.pricePerSession * 12 * 0.85);
    case "EXAM_PREP": return Math.round(t.pricePerSession * 10);
    default: return t.pricePerSession;
  }
}

export function ReserverForm({
  teacher, subjects, levels, communes,
}: {
  teacher: Teacher;
  subjects: { id: string; name: string; slug: string }[];
  levels: { id: string; name: string; slug: string }[];
  communes: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const displayName = teacher.professionalName || teacher.fullName;

  // Form state
  const [form, setForm] = useState({
    levelName: teacher.levels[0] ?? "",
    subjectName: teacher.subjects[0]?.name ?? "",
    objective: OBJECTIVES[0].value,
    courseFormat: teacher.offersHome ? "HOME" : (teacher.offersOnline ? "ONLINE" : "HOME"),
    groupType: "INDIVIDUAL",
    commune: "",
    quartier: "",
    addressHint: "",
    onlineLink: "",
    preferredDays: [] as string[],
    preferredTime: "",
    packType: "SINGLE" as PackType,
    message: "",
    paymentMethod: "WAVE",
    phoneNumber: "",
  });

  const update = (k: string, v: any) => setForm((f) => ({ ...f, [k]: v }));

  const pack = form.packType as PackType;
  const unitPrice = calcUnitPrice(pack, teacher);
  const totalPrice = pack === "SINGLE" ? unitPrice * 1 : unitPrice;
  const commissionAmount = Math.round((totalPrice * teacher.commissionRate) / 100);
  const teacherNetAmount = totalPrice - commissionAmount;

  function validateStep(s: number): string | null {
    if (s === 0) {
      if (!form.levelName) return "Veuillez sélectionner le niveau de l'élève.";
      if (!form.subjectName) return "Veuillez sélectionner la matière.";
    }
    if (s === 1) {
      if (!form.courseFormat) return "Veuillez choisir un format de cours.";
    }
    if (s === 2) {
      if (form.courseFormat === "HOME") {
        if (!form.commune) return "Veuillez sélectionner votre commune.";
        if (!form.quartier.trim()) return "Veuillez indiquer votre quartier.";
      }
      if (form.preferredDays.length === 0) return "Sélectionnez au moins un jour souhaité.";
      if (!form.preferredTime) return "Veuillez indiquer un créneau horaire souhaité.";
    }
    if (s === 4) {
      if (!form.paymentMethod) return "Veuillez choisir un moyen de paiement.";
      if (!form.phoneNumber.trim() || form.phoneNumber.trim().length < 8) {
        return "Veuillez saisir un numéro de téléphone ou de carte valide.";
      }
    }
    return null;
  }

  function next() {
    const err = validateStep(step);
    if (err) {
      toast.error(err);
      return;
    }
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function back() {
    setStep((s) => Math.max(s - 1, 0));
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function submit() {
    const err = validateStep(4);
    if (err) {
      toast.error(err);
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teacherId: teacher.id,
          subjectName: form.subjectName,
          levelName: form.levelName,
          objective: form.objective,
          courseFormat: form.courseFormat,
          groupType: form.groupType,
          commune: form.commune,
          quartier: form.quartier,
          addressHint: form.addressHint,
          onlineLink: form.onlineLink,
          preferredDays: form.preferredDays,
          preferredTime: form.preferredTime,
          sessionsCount: 1,
          packType: form.packType,
          message: form.message,
          paymentMethod: form.paymentMethod,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Erreur lors de la réservation");
        return;
      }
      toast.success("Paiement réussi ! L'admin valide votre réservation prochainement.");
      router.push(`/client/reservations/${data.booking.id}?paid=1`);
    } catch (e: any) {
      toast.error("Erreur réseau, veuillez réessayer.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Progress bar */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <span className="text-sm font-medium text-foreground">
            Étape {step + 1} / {STEPS.length} — {STEPS[step]}
          </span>
          <span className="text-xs text-muted-foreground">{Math.round(((step + 1) / STEPS.length) * 100)}%</span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full bg-primary transition-all duration-300"
            style={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
          />
        </div>
        <div className="mt-2 hidden grid-cols-5 gap-1 text-[11px] text-muted-foreground sm:grid">
          {STEPS.map((s, i) => (
            <span key={s} className={i <= step ? "font-medium text-primary" : ""}>
              {i + 1}. {s}
            </span>
          ))}
        </div>
      </div>

      <Card>
        <CardContent className="p-4 sm:p-6">
          {/* Step 1 — Besoin */}
          {step === 0 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-lg font-semibold text-foreground">Besoin du cours</h2>
                <p className="text-sm text-muted-foreground">Décrivez le besoin pédagogique de l'élève.</p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="levelName">Niveau de l'élève *</Label>
                  <select
                    id="levelName"
                    value={form.levelName}
                    onChange={(e) => update("levelName", e.target.value)}
                    className="mt-1.5 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value="">Sélectionner...</option>
                    {levels.map((l) => (
                      <option key={l.id} value={l.name} disabled={!teacher.levels.includes(l.name) ? false : false}>
                        {l.name}{teacher.levels.includes(l.name) ? "" : ""}
                      </option>
                    ))}
                  </select>
                  {teacher.levels.length > 0 && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Niveaux du professeur : {teacher.levels.join(", ")}
                    </p>
                  )}
                </div>
                <div>
                  <Label htmlFor="subjectName">Matière *</Label>
                  <select
                    id="subjectName"
                    value={form.subjectName}
                    onChange={(e) => update("subjectName", e.target.value)}
                    className="mt-1.5 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value="">Sélectionner...</option>
                    {subjects.map((s) => (
                      <option key={s.id} value={s.name}>{s.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <Label>Objectif *</Label>
                <RadioGroup
                  value={form.objective}
                  onValueChange={(v) => update("objective", v)}
                  className="mt-2 grid gap-2 sm:grid-cols-2"
                >
                  {OBJECTIVES.map((o) => (
                    <label
                      key={o.value}
                      className={`flex cursor-pointer items-center gap-2 rounded-lg border p-3 text-sm transition ${
                        form.objective === o.value
                          ? "border-primary bg-primary/5 text-foreground"
                          : "border-border hover:bg-muted/50"
                      }`}
                    >
                      <RadioGroupItem value={o.value} />
                      <span>{o.label}</span>
                    </label>
                  ))}
                </RadioGroup>
              </div>
            </div>
          )}

          {/* Step 2 — Format */}
          {step === 1 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-lg font-semibold text-foreground">Format du cours</h2>
                <p className="text-sm text-muted-foreground">Choisissez le mode et le type de cours.</p>
              </div>
              <div>
                <Label>Mode de cours *</Label>
                <div className="mt-2 grid gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    disabled={!teacher.offersHome}
                    onClick={() => update("courseFormat", "HOME")}
                    className={`flex items-start gap-3 rounded-xl border p-4 text-left transition ${
                      form.courseFormat === "HOME"
                        ? "border-primary bg-primary/5"
                        : "border-border hover:bg-muted/50"
                    } ${!teacher.offersHome ? "cursor-not-allowed opacity-40" : ""}`}
                  >
                    <Home className={`mt-0.5 h-5 w-5 ${form.courseFormat === "HOME" ? "text-primary" : "text-muted-foreground"}`} />
                    <div>
                      <p className="text-sm font-medium text-foreground">À domicile</p>
                      <p className="text-xs text-muted-foreground">Le professeur se déplace chez vous.</p>
                    </div>
                  </button>
                  <button
                    type="button"
                    disabled={!teacher.offersOnline}
                    onClick={() => update("courseFormat", "ONLINE")}
                    className={`flex items-start gap-3 rounded-xl border p-4 text-left transition ${
                      form.courseFormat === "ONLINE"
                        ? "border-primary bg-primary/5"
                        : "border-border hover:bg-muted/50"
                    } ${!teacher.offersOnline ? "cursor-not-allowed opacity-40" : ""}`}
                  >
                    <Video className={`mt-0.5 h-5 w-5 ${form.courseFormat === "ONLINE" ? "text-primary" : "text-muted-foreground"}`} />
                    <div>
                      <p className="text-sm font-medium text-foreground">En ligne</p>
                      <p className="text-xs text-muted-foreground">Cours via Meet, Zoom ou WhatsApp.</p>
                    </div>
                  </button>
                </div>
              </div>
              <div>
                <Label>Type de cours *</Label>
                <RadioGroup
                  value={form.groupType}
                  onValueChange={(v) => update("groupType", v)}
                  className="mt-2 grid gap-3 sm:grid-cols-2"
                >
                  <label className={`flex cursor-pointer items-center gap-3 rounded-xl border p-4 transition ${
                    form.groupType === "INDIVIDUAL" ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50"
                  }`}>
                    <RadioGroupItem value="INDIVIDUAL" />
                    <User className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium text-foreground">Cours individuel</p>
                      <p className="text-xs text-muted-foreground">Un seul élève.</p>
                    </div>
                  </label>
                  <label className={`flex cursor-pointer items-center gap-3 rounded-xl border p-4 transition ${
                    form.groupType === "SMALL_GROUP" ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50"
                  }`}>
                    <RadioGroupItem value="SMALL_GROUP" />
                    <Users className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium text-foreground">Petit groupe</p>
                      <p className="text-xs text-muted-foreground">Plusieurs élèves (à valider).</p>
                    </div>
                  </label>
                </RadioGroup>
              </div>
            </div>
          )}

          {/* Step 3 — Lieu & dispo */}
          {step === 2 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-lg font-semibold text-foreground">Lieu et disponibilité</h2>
                <p className="text-sm text-muted-foreground">Indiquez où et quand vous souhaitez le cours.</p>
              </div>

              {form.courseFormat === "HOME" ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="commune">Commune *</Label>
                    <select
                      id="commune"
                      value={form.commune}
                      onChange={(e) => update("commune", e.target.value)}
                      className="mt-1.5 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                    >
                      <option value="">Sélectionner...</option>
                      {communes.map((c) => (
                        <option key={c.id} value={c.name}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <Label htmlFor="quartier">Quartier *</Label>
                    <Input
                      id="quartier"
                      value={form.quartier}
                      onChange={(e) => update("quartier", e.target.value)}
                      placeholder="Ex: Riviera Palmeraie"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <Label htmlFor="addressHint">Adresse approximative (optionnel)</Label>
                    <Textarea
                      id="addressHint"
                      value={form.addressHint}
                      onChange={(e) => update("addressHint", e.target.value)}
                      placeholder="Repère, point de rencontre... (l'adresse exacte sera communiquée après validation)"
                      rows={2}
                    />
                  </div>
                </div>
              ) : (
                <div>
                  <Label htmlFor="onlineLink">Lien préféré (optionnel)</Label>
                  <Input
                    id="onlineLink"
                    value={form.onlineLink}
                    onChange={(e) => update("onlineLink", e.target.value)}
                    placeholder="Ex: Meet, Zoom — l'admin ajoutera le lien définitif"
                  />
                  <p className="mt-1 text-xs text-muted-foreground">
                    Le lien de connexion définitif sera communiqué après validation de la réservation.
                  </p>
                </div>
              )}

              <Separator />

              <div>
                <Label>Jours souhaités *</Label>
                <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {DAYS.map((d) => {
                    const checked = form.preferredDays.includes(d.id);
                    return (
                      <label
                        key={d.id}
                        className={`flex cursor-pointer items-center gap-2 rounded-lg border p-2.5 text-sm transition ${
                          checked ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50"
                        }`}
                      >
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(c) => {
                            if (c) update("preferredDays", [...form.preferredDays, d.id]);
                            else update("preferredDays", form.preferredDays.filter((x) => x !== d.id));
                          }}
                        />
                        <span>{d.label}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div>
                <Label>Créneau horaire souhaité *</Label>
                <RadioGroup
                  value={form.preferredTime}
                  onValueChange={(v) => update("preferredTime", v)}
                  className="mt-2 grid gap-2 sm:grid-cols-3"
                >
                  {TIME_SLOTS.map((t) => (
                    <label
                      key={t}
                      className={`flex cursor-pointer items-center gap-2 rounded-lg border p-3 text-sm transition ${
                        form.preferredTime === t ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50"
                      }`}
                    >
                      <RadioGroupItem value={t} />
                      <span>{t}</span>
                    </label>
                  ))}
                </RadioGroup>
              </div>

              <div>
                <Label>Formule *</Label>
                <RadioGroup
                  value={form.packType}
                  onValueChange={(v) => update("packType", v as PackType)}
                  className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3"
                >
                  {PACK_OPTIONS.map((p) => {
                    const u = calcUnitPrice(p.value as PackType, teacher);
                    return (
                      <label
                        key={p.value}
                        className={`flex cursor-pointer items-center justify-between gap-2 rounded-lg border p-3 text-sm transition ${
                          form.packType === p.value ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50"
                        }`}
                      >
                        <span className="flex items-center gap-2">
                          <RadioGroupItem value={p.value} />
                          <span>
                            <span className="block font-medium text-foreground">{p.label}</span>
                            <span className="block text-xs text-muted-foreground">{formatFCFA(u)}</span>
                          </span>
                        </span>
                      </label>
                    );
                  })}
                </RadioGroup>
              </div>

              <div>
                <Label htmlFor="message">Message complémentaire (optionnel)</Label>
                <Textarea
                  id="message"
                  value={form.message}
                  onChange={(e) => update("message", e.target.value)}
                  placeholder="Précisez vos attentes, le chapitre à traiter, etc."
                  rows={3}
                />
              </div>
            </div>
          )}

          {/* Step 4 — Récapitulatif */}
          {step === 3 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-lg font-semibold text-foreground">Récapitulatif</h2>
                <p className="text-sm text-muted-foreground">Vérifiez les détails avant de payer.</p>
              </div>

              {/* Carte prof */}
              <div className="flex items-center gap-3 rounded-xl border border-border bg-muted/30 p-3">
                <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-full bg-muted">
                  {teacher.photoUrl ? (
                    <Image src={teacher.photoUrl} alt={displayName} fill className="object-cover" />
                  ) : (
                    <img src={avatarFromName(displayName)} alt={displayName} className="h-full w-full object-cover" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-foreground">{displayName}</p>
                  <p className="text-sm text-muted-foreground">{teacher.jobTitle}</p>
                  <p className="text-xs text-muted-foreground">
                    Note {teacher.rating.toFixed(1)}/5 ({teacher.ratingCount} avis) • {teacher.commune ?? "Abidjan"}
                  </p>
                </div>
              </div>

              {/* Récap */}
              <div className="overflow-hidden rounded-xl border border-border">
                <dl className="divide-y divide-border text-sm">
                  <Row label="Matière" value={form.subjectName} />
                  <Row label="Niveau" value={form.levelName} />
                  <Row label="Objectif" value={form.objective} />
                  <Row label="Format" value={form.courseFormat === "HOME" ? "À domicile" : "En ligne"} />
                  <Row label="Type" value={form.groupType === "INDIVIDUAL" ? "Individuel" : "Petit groupe"} />
                  {form.courseFormat === "HOME" ? (
                    <>
                      <Row label="Commune" value={form.commune || "—"} />
                      <Row label="Quartier" value={form.quartier || "—"} />
                      {form.addressHint && <Row label="Adresse" value={form.addressHint} />}
                    </>
                  ) : (
                    form.onlineLink && <Row label="Lien" value={form.onlineLink} />
                  )}
                  <Row label="Jours" value={form.preferredDays.join(", ") || "—"} />
                  <Row label="Créneau" value={form.preferredTime || "—"} />
                  <Row label="Formule" value={PACK_OPTIONS.find((p) => p.value === form.packType)?.label ?? form.packType} />
                </dl>
              </div>

              {/* Montants */}
              <div className="rounded-xl bg-primary/5 p-4">
                <div className="space-y-1.5 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Prix unitaire</span>
                    <span className="font-medium tabular-nums text-foreground">{formatFCFA(unitPrice)}</span>
                  </div>
                  <div className="flex justify-between text-base font-semibold">
                    <span className="text-foreground">Total à payer</span>
                    <span className="tabular-nums text-primary">{formatFCFA(totalPrice)}</span>
                  </div>
                  <Separator className="my-2" />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Commission MonProf ({teacher.commissionRate}%)</span>
                    <span className="tabular-nums">{formatFCFA(commissionAmount)}</span>
                  </div>
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Net professeur (après cours)</span>
                    <span className="tabular-nums">{formatFCFA(teacherNetAmount)}</span>
                  </div>
                </div>
                <div className="mt-3 flex items-start gap-2 rounded-md bg-white p-2.5 text-xs text-muted-foreground">
                  <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <span>
                    Le professeur recevra <strong className="text-foreground">{formatFCFA(teacherNetAmount)}</strong> après
                    confirmation du cours. Votre paiement est sécurisé et gardé bloqué jusqu'alors.
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Step 5 — Paiement */}
          {step === 4 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-lg font-semibold text-foreground">Paiement</h2>
                <p className="text-sm text-muted-foreground">Choisissez votre moyen de paiement (simulation).</p>
              </div>

              <div>
                <Label>Moyen de paiement *</Label>
                <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {PAYMENT_METHODS.map((m) => (
                    <button
                      key={m.value}
                      type="button"
                      onClick={() => update("paymentMethod", m.value)}
                      className={`flex flex-col items-center justify-center gap-1 rounded-xl border-2 p-4 text-center transition ${
                        form.paymentMethod === m.value
                          ? "border-primary bg-primary/5"
                          : "border-border hover:bg-muted/50"
                      }`}
                    >
                      <span
                        className="flex h-10 w-10 items-center justify-center rounded-full text-xs font-bold"
                        style={{ backgroundColor: m.color, color: m.textColor }}
                      >
                        {m.label.slice(0, 2).toUpperCase()}
                      </span>
                      <span className="text-xs font-medium text-foreground">{m.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <Label htmlFor="phoneNumber">
                  {form.paymentMethod === "CARD" ? "Numéro de carte" : "Numéro de téléphone"} *
                </Label>
                <Input
                  id="phoneNumber"
                  value={form.phoneNumber}
                  onChange={(e) => update("phoneNumber", e.target.value)}
                  placeholder={form.paymentMethod === "CARD" ? "4242 4242 4242 4242" : "07 00 00 00 00"}
                  inputMode={form.paymentMethod === "CARD" ? "numeric" : "tel"}
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  Mode démo — aucun paiement réel ne sera effectué.
                </p>
              </div>

              <div className="rounded-xl border border-border bg-muted/30 p-4">
                <div className="flex items-center justify-between text-base font-semibold">
                  <span className="text-foreground">Total à payer</span>
                  <span className="tabular-nums text-primary">{formatFCFA(totalPrice)}</span>
                </div>
                <div className="mt-2 flex items-start gap-2 text-xs text-muted-foreground">
                  <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                  <span>
                    Votre paiement est sécurisé. Il sera gardé bloqué jusqu'à la confirmation du cours par vos soins,
                    puis libéré au professeur après déduction de la commission.
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Navigation */}
          <div className="mt-6 flex items-center justify-between gap-3 border-t border-border pt-4">
            {step > 0 ? (
              <Button type="button" variant="outline" onClick={back} disabled={submitting}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Retour
              </Button>
            ) : (
              <span />
            )}
            {step < STEPS.length - 1 ? (
              <Button type="button" onClick={next}>
                Continuer
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            ) : (
              <Button type="button" onClick={submit} disabled={submitting} className="min-w-44">
                {submitting ? (
                  <><span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" /> Traitement...</>
                ) : (
                  <><CreditCard className="mr-2 h-4 w-4" /> Payer {formatFCFA(totalPrice)}</>
                )}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 px-4 py-2.5">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium text-foreground">{value}</dd>
    </div>
  );
}
