"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Loader2, Save } from "lucide-react";
import { cn } from "@/lib/utils";

export function AdminTeacherNotesClient({
  teacherId,
  internalNote,
  operationalComment,
  qualityScore,
  adminRating,
  adminRatingNote,
  adminRatingPublic,
}: {
  teacherId: string;
  internalNote: string | null;
  operationalComment: string | null;
  qualityScore: number;
  adminRating: number;
  adminRatingNote: string | null;
  adminRatingPublic: boolean;
}) {
  const router = useRouter();
  const [note, setNote] = useState(internalNote ?? "");
  const [comment, setComment] = useState(operationalComment ?? "");
  const [score, setScore] = useState(String(qualityScore));
  const [rating, setRating] = useState(Math.max(0, Math.min(5, Math.round(adminRating || 0))));
  const [ratingNote, setRatingNote] = useState(adminRatingNote ?? "");
  const [ratingPublic, setRatingPublic] = useState(adminRatingPublic);
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
          adminRating: rating,
          adminRatingNote: ratingNote.trim() || null,
          adminRatingPublic: ratingPublic,
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
      <div className="rounded-lg border border-[#E3E8F2] bg-white p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <Label>Note service client / interne</Label>
            <p className="mt-1 text-xs font-medium leading-5 text-muted-foreground">
              Cette note est donnée par l'administration. Elle peut servir de note publique au démarrage, avant les vrais avis clients.
            </p>
          </div>
          <label className="flex min-h-10 items-center gap-2 rounded-lg border border-[#DDE6F7] bg-white px-3 text-xs font-semibold text-[#111B4D]">
            <input
              type="checkbox"
              checked={ratingPublic}
              onChange={(event) => setRatingPublic(event.target.checked)}
              className="h-4 w-4 rounded border-[#CAD7F2]"
            />
            Visible publiquement
          </label>
        </div>
        <div className="mt-3 grid grid-cols-5 gap-2">
          {[1, 2, 3, 4, 5].map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setRating(value)}
              className={cn(
                "min-h-11 rounded-lg border px-2 text-sm font-semibold transition",
                rating === value
                  ? "border-[#111B4D] bg-[#111B4D] text-white"
                  : "border-[#DDE6F7] bg-white text-[#111B4D] hover:border-[#111B4D]",
              )}
              aria-pressed={rating === value}
            >
              {value}/5
            </button>
          ))}
        </div>
        <div className="mt-3 space-y-1.5">
          <Label htmlFor="adminRatingNote">Commentaire de notation admin</Label>
          <Textarea
            id="adminRatingNote"
            rows={3}
            value={ratingNote}
            onChange={(event) => setRatingNote(event.target.value)}
            placeholder="Ex : très fiable, bonne pédagogie, recommandé pour les classes d'examen..."
          />
        </div>
      </div>

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
