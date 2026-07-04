"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const LIMITS = {
  careerSummary: 900,
  skills: 1200,
  workHistory: 1400,
  certifications: 1000,
  teachingAchievements: 1000,
};

type TeacherProfessionalProfileFormProps = {
  careerSummary?: string | null;
  skills?: string | null;
  workHistory?: string | null;
  certifications?: string | null;
  teachingAchievements?: string | null;
  learnersCoached?: number | null;
};

export function TeacherProfessionalProfileForm({
  careerSummary,
  skills,
  workHistory,
  certifications,
  teachingAchievements,
  learnersCoached,
}: TeacherProfessionalProfileFormProps) {
  const router = useRouter();
  const [summary, setSummary] = useState(careerSummary ?? "");
  const [skillText, setSkillText] = useState(skills ?? "");
  const [historyText, setHistoryText] = useState(workHistory ?? "");
  const [certificationText, setCertificationText] = useState(certifications ?? "");
  const [achievementText, setAchievementText] = useState(teachingAchievements ?? "");
  const [coached, setCoached] = useState(String(learnersCoached ?? 0));
  const [saving, setSaving] = useState(false);

  const coachedNumber = Number(coached);
  const hasInvalidLength = (
    summary.length > LIMITS.careerSummary
    || skillText.length > LIMITS.skills
    || historyText.length > LIMITS.workHistory
    || certificationText.length > LIMITS.certifications
    || achievementText.length > LIMITS.teachingAchievements
  );
  const canSubmit = !saving
    && !hasInvalidLength
    && Number.isFinite(coachedNumber)
    && coachedNumber >= 0
    && coachedNumber <= 100000;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!canSubmit) {
      toast.error("Vérifiez les longueurs et le nombre d'apprenants encadrés.");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/professor/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "updateProfessionalProfile",
          careerSummary: summary,
          skills: skillText,
          workHistory: historyText,
          certifications: certificationText,
          teachingAchievements: achievementText,
          learnersCoached: Math.round(coachedNumber),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Mise à jour impossible.");
      toast.success("Profil professionnel mis à jour et transmis à l'administration.");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Mise à jour impossible.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-5 grid gap-4">
      <FieldCounter value={summary} limit={LIMITS.careerSummary}>
        <Label htmlFor="teacher-career-summary">Résumé professionnel</Label>
        <Textarea
          id="teacher-career-summary"
          value={summary}
          onChange={(event) => setSummary(event.target.value)}
          placeholder="Ex : répétiteur en mathématiques avec expérience en préparation BEPC, BAC et concours."
          className="mt-1.5 min-h-28 rounded-2xl border-[#DDE6F7] bg-white"
        />
      </FieldCounter>

      <div className="grid gap-4 lg:grid-cols-2">
        <FieldCounter value={skillText} limit={LIMITS.skills}>
          <Label htmlFor="teacher-skills">Compétences clés</Label>
          <Textarea
            id="teacher-skills"
            value={skillText}
            onChange={(event) => setSkillText(event.target.value)}
            placeholder="Une compétence par ligne : pédagogie active, préparation concours, soutien universitaire..."
            className="mt-1.5 min-h-32 rounded-2xl border-[#DDE6F7] bg-white"
          />
        </FieldCounter>

        <FieldCounter value={historyText} limit={LIMITS.workHistory}>
          <Label htmlFor="teacher-work-history">Parcours et expériences</Label>
          <Textarea
            id="teacher-work-history"
            value={historyText}
            onChange={(event) => setHistoryText(event.target.value)}
            placeholder="Une expérience par ligne : école, centre de formation, familles accompagnées..."
            className="mt-1.5 min-h-32 rounded-2xl border-[#DDE6F7] bg-white"
          />
        </FieldCounter>

        <FieldCounter value={certificationText} limit={LIMITS.certifications}>
          <Label htmlFor="teacher-certifications">Certifications et diplômes</Label>
          <Textarea
            id="teacher-certifications"
            value={certificationText}
            onChange={(event) => setCertificationText(event.target.value)}
            placeholder="Une certification ou diplôme par ligne."
            className="mt-1.5 min-h-28 rounded-2xl border-[#DDE6F7] bg-white"
          />
        </FieldCounter>

        <FieldCounter value={achievementText} limit={LIMITS.teachingAchievements}>
          <Label htmlFor="teacher-achievements">Résultats et encadrements</Label>
          <Textarea
            id="teacher-achievements"
            value={achievementText}
            onChange={(event) => setAchievementText(event.target.value)}
            placeholder="Ex : élèves suivis jusqu'au BAC, remise à niveau adulte, accompagnement projet professionnel..."
            className="mt-1.5 min-h-28 rounded-2xl border-[#DDE6F7] bg-white"
          />
        </FieldCounter>
      </div>

      <div className="grid gap-3 rounded-2xl border border-[#E3E8F2] bg-white p-3 sm:grid-cols-[minmax(0,1fr)_14rem] sm:items-end">
        <div>
          <Label htmlFor="teacher-learners-coached">Nombre d'apprenants encadrés</Label>
          <Input
            id="teacher-learners-coached"
            type="number"
            min={0}
            max={100000}
            inputMode="numeric"
            value={coached}
            onChange={(event) => setCoached(event.target.value)}
            className="mt-1.5 h-11 rounded-2xl border-[#DDE6F7] bg-white"
          />
          <p className="mt-1 text-xs font-semibold leading-5 text-[#64748B]">
            Indicateur visible côté client après contrôle global de la fiche.
          </p>
        </div>
        <Button type="submit" disabled={!canSubmit} className="min-h-11 rounded-2xl bg-[#111B4D] text-white hover:bg-[#1E2A78]">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Enregistrer
        </Button>
      </div>

      <p className="rounded-2xl border border-[#E3E8F2] bg-white p-3 text-xs font-semibold leading-5 text-[#64748B]">
        <CheckCircle2 className="mr-1 inline h-3.5 w-3.5 text-[#111B4D]" />
        Toute modification est historisée et envoyée à l'administration pour suivi de qualité.
      </p>
    </form>
  );
}

function FieldCounter({
  children,
  value,
  limit,
}: {
  children: React.ReactNode;
  value: string;
  limit: number;
}) {
  const tooLong = value.length > limit;
  return (
    <div>
      {children}
      <p className={tooLong ? "mt-1 text-xs font-semibold text-red-700" : "mt-1 text-xs font-semibold text-[#64748B]"}>
        {value.length}/{limit} caractères
      </p>
    </div>
  );
}
