"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Loader2, Save } from "lucide-react";

export function AdminTeacherNotesClient({
  teacherId,
  internalNote,
  operationalComment,
  qualityScore,
}: {
  teacherId: string;
  internalNote: string | null;
  operationalComment: string | null;
  qualityScore: number;
}) {
  const router = useRouter();
  const [note, setNote] = useState(internalNote ?? "");
  const [comment, setComment] = useState(operationalComment ?? "");
  const [score, setScore] = useState(String(qualityScore));
  const [loading, setLoading] = useState(false);

  async function save() {
    const numericScore = Math.max(0, Math.min(100, Number(score) || 0));
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/teachers/${teacherId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          internalNote: note.trim() || null,
          operationalComment: comment.trim() || null,
          qualityScore: numericScore,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Impossible d'enregistrer la note admin");
      toast.success("Notes admin enregistrées");
      router.refresh();
    } catch (error: any) {
      toast.error(error.message || "Erreur réseau");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-[1fr_140px]">
        <div className="space-y-1.5">
          <Label htmlFor="internalNote">Note interne admin</Label>
          <Textarea
            id="internalNote"
            rows={5}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Observation pédagogique, fiabilité, points de vigilance, recommandation interne..."
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="qualityScore">Score qualité</Label>
          <Input
            id="qualityScore"
            type="number"
            min={0}
            max={100}
            value={score}
            onChange={(event) => setScore(event.target.value)}
          />
          <p className="text-xs text-muted-foreground">Score interne sur 100.</p>
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="operationalComment">Commentaire opérationnel</Label>
        <Textarea
          id="operationalComment"
          rows={3}
          value={comment}
          onChange={(event) => setComment(event.target.value)}
          placeholder="Disponibilité réelle, attitude, suivi, recommandations pour l'équipe admin..."
        />
      </div>
      <Button onClick={save} disabled={loading}>
        {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
        Enregistrer les notes admin
      </Button>
    </div>
  );
}
