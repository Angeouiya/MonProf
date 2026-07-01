"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertTriangle, CheckCircle2, Star, AlertCircle, RefreshCw, Ban } from "lucide-react";
import type { Booking, Review } from "@prisma/client";

type BookingActionsProps = {
  booking: Booking & {
    reviews: Review[];
    disputes: { id: string; reason: string; description: string; status: string; createdAt: Date }[];
  };
};

const DISPUTE_REASONS = [
  "Professeur absent",
  "Cours non conforme",
  "Problème de paiement",
  "Autre",
];

export function BookingActions({ booking }: BookingActionsProps) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [disputeOpen, setDisputeOpen] = useState(false);
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);

  // Dispute form
  const [disputeReason, setDisputeReason] = useState(DISPUTE_REASONS[0]);
  const [disputeDesc, setDisputeDesc] = useState("");

  // Reschedule form
  const [rescheduleMsg, setRescheduleMsg] = useState("");

  // Review form
  const [rating, setRating] = useState(5);
  const [reviewComment, setReviewComment] = useState("");

  async function callAction(action: string, body?: any) {
    setLoading(action);
    try {
      const res = await fetch(`/api/bookings/${booking.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...body }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Erreur");
        return false;
      }
      return true;
    } catch {
      toast.error("Erreur réseau");
      return false;
    } finally {
      setLoading(null);
    }
  }

  async function onConfirm() {
    const ok = await callAction("confirm");
    if (ok) {
      toast.success("Cours confirmé. Le paiement sera libéré au professeur.");
      router.refresh();
    }
  }

  async function onSubmitDispute() {
    if (!disputeDesc.trim()) {
      toast.error("Veuillez décrire le problème");
      return;
    }
    const ok = await callAction("open_dispute", { reason: disputeReason, description: disputeDesc });
    if (ok) {
      toast.success("Litige ouvert. Notre support vous recontacte.");
      setDisputeOpen(false);
      setDisputeDesc("");
      router.refresh();
    }
  }

  async function onSubmitReschedule() {
    if (!rescheduleMsg.trim()) {
      toast.error("Veuillez indiquer le motif du report");
      return;
    }
    const ok = await callAction("reschedule", { rescheduleMessage: rescheduleMsg });
    if (ok) {
      toast.success("Demande de report envoyée à l'admin.");
      setRescheduleOpen(false);
      setRescheduleMsg("");
      router.refresh();
    }
  }

  async function onCancel() {
    const ok = await callAction("cancel");
    if (ok) {
      toast.success("Réservation annulée.");
      setCancelOpen(false);
      router.refresh();
    }
  }

  async function onSubmitReview() {
    setLoading("review");
    try {
      const res = await fetch("/api/client/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookingId: booking.id, rating, comment: reviewComment }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Erreur");
        return;
      }
      toast.success("Merci pour votre avis !");
      setReviewOpen(false);
      setReviewComment("");
      setRating(5);
      router.refresh();
    } catch {
      toast.error("Erreur réseau");
    } finally {
      setLoading(null);
    }
  }

  const status = booking.status;
  const hasReview = booking.reviews.length > 0;
  const hasDispute = booking.disputes.length > 0;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold">Actions</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {/* DISPUTED */}
        {status === "DISPUTED" && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            <div className="flex items-center gap-2 font-medium">
              <AlertTriangle className="h-4 w-4" />
              Litige en cours
            </div>
            <p className="mt-1 text-xs">
              Notre support traite votre litige. Vous serez recontacté sous 24-48h.
            </p>
            {hasDispute && (
              <div className="mt-2 rounded bg-white p-2 text-xs">
                <p><strong>Raison :</strong> {booking.disputes[0].reason}</p>
                <p className="mt-1 text-muted-foreground">{booking.disputes[0].description}</p>
                <p className="mt-1 text-muted-foreground">Statut : {booking.disputes[0].status}</p>
              </div>
            )}
          </div>
        )}

        {/* PENDING_CLIENT_VALIDATION */}
        {status === "PENDING_CLIENT_VALIDATION" && (
          <>
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              <div className="flex items-center gap-2 font-medium">
                <AlertCircle className="h-4 w-4" />
                Action requise
              </div>
              <p className="mt-1 text-xs">
                Le cours a été effectué. Confirmez-le pour libérer le paiement au professeur, ou signalez un problème.
              </p>
            </div>
            <Button
              className="w-full"
              onClick={onConfirm}
              disabled={loading === "confirm"}
            >
              <CheckCircle2 className="mr-2 h-4 w-4" />
              {loading === "confirm" ? "Traitement..." : "Confirmer le cours"}
            </Button>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => setDisputeOpen(true)}
              disabled={!!loading}
            >
              <AlertTriangle className="mr-2 h-4 w-4" />
              Signaler un problème
            </Button>
            <Dialog open={rescheduleOpen} onOpenChange={setRescheduleOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="w-full" disabled={!!loading}>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Demander un report
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Demande de report</DialogTitle>
                  <DialogDescription>
                    Expliquez pourquoi vous souhaitez reporter ce cours. L'admin reprogrammera avec le professeur.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-3">
                  <div>
                    <Label htmlFor="reschedule">Motif du report</Label>
                    <Textarea
                      id="reschedule"
                      value={rescheduleMsg}
                      onChange={(e) => setRescheduleMsg(e.target.value)}
                      rows={3}
                      placeholder="Ex: Empêchement, maladie, conflit d'agenda..."
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setRescheduleOpen(false)}>Annuler</Button>
                  <Button onClick={onSubmitReschedule} disabled={loading === "reschedule"}>
                    Envoyer la demande
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </>
        )}

        {/* TEACHER_PAID - avis */}
        {status === "TEACHER_PAID" && (
          hasReview ? (
            <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700">
              <div className="flex items-center gap-2 font-medium">
                <Star className="h-4 w-4 fill-current" />
                Avis déposé
              </div>
              <p className="mt-1 text-xs">Merci pour votre retour ! Note : {booking.reviews[0].rating}/5</p>
            </div>
          ) : (
            <Button className="w-full" onClick={() => setReviewOpen(true)} disabled={!!loading}>
              <Star className="mr-2 h-4 w-4" />
              Laisser un avis
            </Button>
          )
        )}

        {/* CANCELLED / REFUNDED */}
        {(status === "CANCELLED" || status === "REFUNDED") && (
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm text-gray-700">
            <div className="flex items-center gap-2 font-medium">
              <Ban className="h-4 w-4" />
              Réservation {status === "REFUNDED" ? "remboursée" : "annulée"}
            </div>
          </div>
        )}

        {/* Annulation possible pour les statuts avant cours */}
        {["PAID", "PENDING_ADMIN_VALIDATION", "CONFIRMED", "ASSIGNED"].includes(status) && (
          <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
            <DialogTrigger asChild>
              <Button variant="ghost" className="w-full text-destructive hover:bg-red-50 hover:text-destructive" disabled={!!loading}>
                <Ban className="mr-2 h-4 w-4" />
                Annuler la réservation
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Annuler la réservation ?</DialogTitle>
                <DialogDescription>
                  Cette action est irréversible. Le remboursement sera traité par notre équipe support.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="outline" onClick={() => setCancelOpen(false)}>Retour</Button>
                <Button variant="destructive" onClick={onCancel} disabled={loading === "cancel"}>
                  Confirmer l'annulation
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}

        {/* Dialog: Litige */}
        <Dialog open={disputeOpen} onOpenChange={setDisputeOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Ouvrir un litige</DialogTitle>
              <DialogDescription>
                Décrivez le problème rencontré. Votre paiement sera bloqué jusqu'à résolution.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label htmlFor="reason">Raison</Label>
                <Select value={disputeReason} onValueChange={setDisputeReason}>
                  <SelectTrigger id="reason"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {DISPUTE_REASONS.map((r) => (
                      <SelectItem key={r} value={r}>{r}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="desc">Description</Label>
                <Textarea
                  id="desc"
                  value={disputeDesc}
                  onChange={(e) => setDisputeDesc(e.target.value)}
                  rows={4}
                  placeholder="Décrivez précisément le problème..."
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDisputeOpen(false)}>Annuler</Button>
              <Button variant="destructive" onClick={onSubmitDispute} disabled={loading === "open_dispute"}>
                Ouvrir le litige
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Dialog: Avis */}
        <Dialog open={reviewOpen} onOpenChange={setReviewOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Laisser un avis</DialogTitle>
              <DialogDescription>
                Votre retour aide les autres clients à choisir ce professeur.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Note</Label>
                <div className="mt-2 flex gap-1">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setRating(n)}
                      className="rounded p-1"
                      aria-label={`${n} étoiles`}
                    >
                      <Star
                        className={`h-8 w-8 transition ${
                          n <= rating ? "fill-amber-400 text-amber-400" : "text-muted-foreground"
                        }`}
                      />
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <Label htmlFor="comment">Commentaire (optionnel)</Label>
                <Textarea
                  id="comment"
                  value={reviewComment}
                  onChange={(e) => setReviewComment(e.target.value)}
                  rows={4}
                  placeholder="Partagez votre expérience..."
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setReviewOpen(false)}>Annuler</Button>
              <Button onClick={onSubmitReview} disabled={loading === "review"}>
                Publier l'avis
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
