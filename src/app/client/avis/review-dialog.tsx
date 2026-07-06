"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ReviewRatingSelector } from "@/components/shared/review-rating-selector";
import { CheckCircle2, MessageSquare, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";

const MAX_REVIEW_COMMENT_LENGTH = 900;
const MIN_LOW_RATING_COMMENT_LENGTH = 20;

export function ReviewDialog({
  bookingId,
  teacherName,
  triggerClassName,
}: {
  bookingId: string;
  teacherName: string;
  triggerClassName?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(false);
  const cleanCommentLength = comment.trim().length;
  const commentTooLong = cleanCommentLength > MAX_REVIEW_COMMENT_LENGTH;
  const lowRatingNeedsComment = rating <= 3 && cleanCommentLength < MIN_LOW_RATING_COMMENT_LENGTH;

  async function submit() {
    if (commentTooLong) {
      toast.error(`Commentaire trop long (${MAX_REVIEW_COMMENT_LENGTH} caractères maximum).`);
      return;
    }
    if (lowRatingNeedsComment) {
      toast.error(`Pour une note de ${rating}/5, ajoutez au moins ${MIN_LOW_RATING_COMMENT_LENGTH} caractères afin que le service client puisse traiter votre retour.`);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/client/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookingId, rating, comment }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Erreur");
        return;
      }
      toast.success("Merci pour votre avis !");
      setOpen(false);
      setComment("");
      setRating(5);
      router.refresh();
    } catch {
      toast.error("Erreur réseau");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className={cn("mt-3 min-h-11 w-full rounded-lg", triggerClassName)}>
          <MessageSquare className="mr-2 h-4 w-4" />
          Laisser un avis
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[calc(100vh-2rem)] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-[#111B4D] text-white">
            <MessageSquare className="h-5 w-5" />
          </div>
          <DialogTitle className="text-xl font-semibold text-[#111827]">Avis pour {teacherName}</DialogTitle>
          <DialogDescription className="leading-6">
            Votre retour aide les autres clients à choisir ce professeur.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-2 min-[560px]:grid-cols-2">
          <div className="rounded-lg border border-[#DDE6F7] bg-white p-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-[#111827]">
              <ShieldCheck className="h-4 w-4 text-[#111B4D]" />
              Suivi qualité
            </div>
            <p className="mt-1 text-xs font-medium leading-5 text-[#64748B]">
              Les avis faibles aident le service client à vérifier le cours.
            </p>
          </div>
          <div className="rounded-lg border border-[#DDE6F7] bg-white p-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-[#111827]">
              <CheckCircle2 className="h-4 w-4 text-[#111B4D]" />
              Historique clair
            </div>
            <p className="mt-1 text-xs font-medium leading-5 text-[#64748B]">
              Votre retour reste lié uniquement au cours concerné.
            </p>
          </div>
        </div>
        <div className="space-y-4">
          <div>
            <Label className="text-sm font-semibold text-[#111827]">Évaluation qualité</Label>
            <div className="mt-2">
              <ReviewRatingSelector value={rating} onChange={setRating} />
            </div>
          </div>
          <div>
            <Label htmlFor="comment" className="text-sm font-semibold text-[#111827]">Commentaire (optionnel)</Label>
            <Textarea
              id="comment"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={5}
              maxLength={MAX_REVIEW_COMMENT_LENGTH + 50}
              placeholder="Décrivez le déroulement du cours, la pédagogie, la ponctualité, la communication..."
              className="mt-1.5 rounded-lg border-[#DDE6F7] bg-white leading-6"
            />
            <div className="mt-1 flex flex-col gap-1 text-xs min-[460px]:flex-row min-[460px]:items-center min-[460px]:justify-between">
              <p className={commentTooLong || lowRatingNeedsComment ? "font-medium text-[#111B4D]" : "text-[#64748B]"}>
                {cleanCommentLength}/{MAX_REVIEW_COMMENT_LENGTH} caractères
              </p>
              <p className="text-[#64748B]">Votre avis reste lié au cours concerné.</p>
            </div>
            {rating <= 3 && (
              <p className="mt-2 rounded-lg border border-[#DDE6F7] bg-white px-3 py-2 text-xs font-medium text-[#111B4D]">
                Les notes de 1 à 3 nécessitent un commentaire précis. Le service client pourra ainsi vérifier le cours et suivre le professeur correctement.
              </p>
            )}
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => setOpen(false)} className="rounded-lg">Annuler</Button>
          <Button onClick={submit} disabled={loading || commentTooLong || lowRatingNeedsComment} className="rounded-lg">
            {loading ? "Envoi..." : "Publier l'avis"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
