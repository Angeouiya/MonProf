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
import { ReviewRatingSelector } from "@/components/shared/review-rating-selector";
import { AlertTriangle, CheckCircle2, MessageSquare, AlertCircle, RefreshCw, Ban, ShieldCheck, ExternalLink } from "lucide-react";
import type { Booking, Review, Transaction } from "@prisma/client";
import { CANCELLATION_REASONS, PAID_CLIENT_TRANSACTION_STATUSES, cancellationPolicySummary, cancellationWindowLabel, getCancellationPolicy } from "@/lib/cancellation-policy";
import { formatFCFA } from "@/lib/format";
import { isReviewableBookingStatus } from "@/lib/review-policy";
import { hasVerifiedPayDunyaClientPayment } from "@/lib/payment-security";

type BookingActionsProps = {
  booking: Booking & {
    reviews: Review[];
    transactions?: Transaction[];
    disputes: { id: string; reason: string; description: string; status: string; createdAt: Date }[];
  };
};

const DISPUTE_REASONS = [
  "Professeur absent",
  "Cours non conforme",
  "Problème de paiement",
  "Autre",
];
const MAX_REVIEW_COMMENT_LENGTH = 900;
const MIN_LOW_RATING_COMMENT_LENGTH = 20;
const DISPUTE_STATUS_LABELS: Record<string, string> = {
  OPEN: "Ouvert",
  INVESTIGATING: "En traitement",
  RESOLVED: "Résolu",
  REFUNDED: "Remboursement prévu",
  REJECTED: "Clôturé sans suite",
};

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
  const [cancelReason, setCancelReason] = useState<(typeof CANCELLATION_REASONS)[number]>(CANCELLATION_REASONS[0]);
  const [cancelDesc, setCancelDesc] = useState("");

  // Review form
  const [rating, setRating] = useState(5);
  const [reviewComment, setReviewComment] = useState("");
  const cleanReviewCommentLength = reviewComment.trim().length;
  const reviewCommentTooLong = cleanReviewCommentLength > MAX_REVIEW_COMMENT_LENGTH;
  const reviewLowRatingNeedsComment = rating <= 3 && cleanReviewCommentLength < MIN_LOW_RATING_COMMENT_LENGTH;

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
      toast.success("Cours confirmé. L'administration finalise le dossier.");
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
    if (!cancelReason) {
      toast.error("Veuillez sélectionner un motif d'annulation");
      return;
    }
    const ok = await callAction("cancel", { reason: cancelReason, description: cancelDesc });
    if (ok) {
      toast.success("Réservation annulée.");
      setCancelOpen(false);
      setCancelDesc("");
      router.refresh();
    }
  }

  async function onSubmitReview() {
    if (reviewCommentTooLong) {
      toast.error(`Commentaire trop long (${MAX_REVIEW_COMMENT_LENGTH} caractères maximum).`);
      return;
    }
    if (reviewLowRatingNeedsComment) {
      toast.error(`Pour une note de ${rating}/5, ajoutez au moins ${MIN_LOW_RATING_COMMENT_LENGTH} caractères afin que l'administration puisse traiter votre retour.`);
      return;
    }
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
  const paymentVerified = hasVerifiedPayDunyaClientPayment(booking);
  const paidAmount = paymentVerified ? booking.transactions
    ?.filter((transaction) => transaction.type === "CLIENT_PAYMENT" && PAID_CLIENT_TRANSACTION_STATUSES.includes(transaction.status as (typeof PAID_CLIENT_TRANSACTION_STATUSES)[number]))
    .reduce((sum, transaction) => sum + transaction.amount, 0) : 0;
  const cancellationPolicy = getCancellationPolicy({ ...booking, paidAmount });
  const canReview = isReviewableBookingStatus(status);
  const canCancel = ["PAID", "PENDING_ADMIN_VALIDATION", "CONFIRMED", "ASSIGNED"].includes(status);
  const canResumePayDunya = !booking.isQuoteOnly && status === "PENDING_PAYMENT" && booking.paymentStatus === "FAILED";
  const actionSummary = getActionSummary({
    status,
    paymentStatus: booking.paymentStatus,
    isQuoteOnly: booking.isQuoteOnly,
    hasReview,
    hasDispute,
    canReview,
    canCancel,
    paymentVerified,
  });

  async function onResumePayDunya() {
    setLoading("paydunya_checkout");
    try {
      const res = await fetch(`/api/bookings/${booking.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "paydunya_checkout" }),
      });
      const data = await res.json();
      if (!res.ok || !data.payment?.checkoutUrl) {
        toast.error(data.error || "Impossible d'ouvrir PayDunya pour le moment.");
        return;
      }
      toast.success("Ouverture de PayDunya...");
      window.location.assign(data.payment.checkoutUrl);
    } catch {
      toast.error("Erreur réseau");
    } finally {
      setLoading(null);
    }
  }

  async function onVerifyPayDunya() {
    setLoading("paydunya_verify");
    try {
      const res = await fetch(`/api/bookings/${booking.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "paydunya_verify" }),
      });
      const data = await res.json();
      const message = data.payment?.message || data.error || "Vérification PayDunya terminée.";
      if (!res.ok) {
        toast.error(message);
        router.refresh();
        return;
      }
      if (data.payment?.verified) {
        toast.success(message);
      } else {
        toast(message);
      }
      router.refresh();
    } catch {
      toast.error("Erreur réseau");
    } finally {
      setLoading(null);
    }
  }

  return (
    <Card className="rounded-[1.35rem]">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-black text-[#111827]">Actions du dossier</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className={`rounded-3xl border p-3 shadow-sm ${actionSummary.className}`}>
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white shadow-sm">
              {actionSummary.icon}
            </span>
            <div className="min-w-0">
              <p className="text-xs font-black uppercase tracking-wide text-[#64748B]">Situation actuelle</p>
              <p className="mt-0.5 text-sm font-black leading-tight">{actionSummary.title}</p>
              <p className="mt-1 text-xs font-semibold leading-5 text-[#64748B]">{actionSummary.description}</p>
            </div>
          </div>
        </div>

        {canResumePayDunya && (
          <>
            <div className="rounded-2xl border border-[#DDE6F7] bg-white p-3 text-sm text-[#111B4D] shadow-sm">
              <div className="flex items-center gap-2 font-black">
                <ShieldCheck className="h-4 w-4" />
                Paiement PayDunya à finaliser
              </div>
              <p className="mt-1 text-xs font-semibold leading-5 text-[#64748B]">
                Le moyen et les informations de paiement seront demandés uniquement sur PayDunya. MonProf CI valide uniquement après contrôle serveur du token, du montant et du statut PayDunya.
              </p>
            </div>
            <Button
              variant="outline"
              className="min-h-11 w-full rounded-2xl"
              onClick={onVerifyPayDunya}
              disabled={loading === "paydunya_verify"}
            >
              <ShieldCheck className="mr-2 h-4 w-4" />
              {loading === "paydunya_verify" ? "Vérification..." : "Vérifier le paiement PayDunya"}
            </Button>
            <Button
              className="min-h-11 w-full rounded-2xl"
              onClick={onResumePayDunya}
              disabled={loading === "paydunya_checkout"}
            >
              <ExternalLink className="mr-2 h-4 w-4" />
              {loading === "paydunya_checkout" ? "Ouverture..." : "Payer via PayDunya"}
            </Button>
          </>
        )}

        {/* DISPUTED */}
        {status === "DISPUTED" && (
          <div className="rounded-2xl border border-[#E3E8F2] bg-white p-3 text-sm text-[#111B4D] shadow-sm">
            <div className="flex items-center gap-2 font-black">
              <AlertTriangle className="h-4 w-4" />
              Litige en cours
            </div>
            <p className="mt-1 text-xs">
              Notre support traite votre litige. Vous serez recontacté sous 24-48h.
            </p>
            {hasDispute && (
              <div className="mt-2 rounded-2xl border border-[#E3E8F2] bg-white p-3 text-xs shadow-sm">
                <p><strong>Raison :</strong> {booking.disputes[0].reason}</p>
                <p className="mt-1 text-[#64748B]">{booking.disputes[0].description}</p>
                <p className="mt-1 text-[#64748B]">
                  Statut : {DISPUTE_STATUS_LABELS[booking.disputes[0].status] ?? "En traitement"}
                </p>
              </div>
            )}
          </div>
        )}

        {/* PENDING_CLIENT_VALIDATION */}
        {status === "PENDING_CLIENT_VALIDATION" && (
          <>
            <div className="rounded-2xl border border-[#E3E8F2] bg-white p-3 text-sm text-[#111B4D] shadow-sm">
              <div className="flex items-center gap-2 font-black">
                <AlertCircle className="h-4 w-4" />
                Action requise
              </div>
              <p className="mt-1 text-xs">
                Le cours a été effectué. Confirmez-le pour clôturer le dossier, ou signalez un problème.
              </p>
            </div>
            <Button
              className="min-h-11 w-full rounded-2xl"
              onClick={onConfirm}
              disabled={loading === "confirm"}
            >
              <CheckCircle2 className="mr-2 h-4 w-4" />
              {loading === "confirm" ? "Traitement..." : "Confirmer le cours"}
            </Button>
            <Button
              variant="outline"
              className="min-h-11 w-full rounded-2xl"
              onClick={() => setDisputeOpen(true)}
              disabled={!!loading}
            >
              <AlertTriangle className="mr-2 h-4 w-4" />
              Signaler un problème
            </Button>
            <Dialog open={rescheduleOpen} onOpenChange={setRescheduleOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="min-h-11 w-full rounded-2xl" disabled={!!loading}>
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
                  <Button variant="outline" onClick={() => setRescheduleOpen(false)} className="rounded-2xl">Annuler</Button>
                  <Button onClick={onSubmitReschedule} disabled={loading === "reschedule"} className="rounded-2xl">
                    Envoyer la demande
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </>
        )}

        {/* Avis après validation client */}
        {canReview && (
          hasReview ? (
            <div className="rounded-2xl border border-[#E3E8F2] bg-white p-3 text-sm text-[#111B4D] shadow-sm">
              <div className="flex items-center gap-2 font-black">
                <MessageSquare className="h-4 w-4" />
                Avis déposé
              </div>
              <p className="mt-1 text-xs">Merci pour votre retour ! Note : {booking.reviews[0].rating}/5</p>
            </div>
          ) : (
            <Button className="min-h-11 w-full rounded-2xl" onClick={() => setReviewOpen(true)} disabled={!!loading}>
              <MessageSquare className="mr-2 h-4 w-4" />
              Laisser un avis
            </Button>
          )
        )}

        {/* CANCELLED / REFUNDED */}
        {(status === "CANCELLED" || status === "REFUNDED") && (
          <div className="rounded-2xl border border-slate-200 bg-white p-3 text-sm text-slate-700 shadow-sm">
            <div className="flex items-center gap-2 font-black">
              <Ban className="h-4 w-4" />
              Réservation {status === "REFUNDED" ? "remboursée" : "annulée"}
            </div>
            {booking.cancellationReason && (
              <div className="mt-2 space-y-1 text-xs text-[#64748B]">
                <p>Motif : {booking.cancellationReason}</p>
                <p>Règle : {cancellationWindowLabel(booking.cancellationWindow)}</p>
                <p>Frais : {formatFCFA(booking.cancellationFeeAmount)} · Remboursement : {formatFCFA(booking.cancellationRefundAmount)}</p>
              </div>
            )}
          </div>
        )}

        {/* Annulation possible pour les statuts avant cours */}
        {canCancel && (
          <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="min-h-11 w-full rounded-2xl border-[#E3E8F2] bg-white text-[#111B4D] hover:border-[#111B4D] hover:bg-white hover:text-[#111B4D]" disabled={!!loading}>
                <Ban className="mr-2 h-4 w-4" />
                Annuler la réservation
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Annuler la réservation ?</DialogTitle>
                <DialogDescription>
                  Vérifiez les règles avant de confirmer. Le montant remboursable dépend du délai avant le cours.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="rounded-2xl border border-[#DDE6F7] bg-white p-3 text-sm">
                  <p className="font-black text-[#111B4D]">{cancellationPolicy.label}</p>
                  <p className="mt-1 text-xs leading-relaxed text-[#64748B]">{cancellationPolicy.description}</p>
                  <div className="mt-3 grid gap-2 text-xs sm:grid-cols-3">
                    <div className="rounded-xl bg-white p-2">
                      <p className="text-[#64748B]">Base de calcul</p>
                      <p className="font-bold text-[#111827]">{formatFCFA(cancellationPolicy.baseAmount)}</p>
                    </div>
                    <div className="rounded-xl bg-white p-2">
                      <p className="text-[#64748B]">Frais estimés</p>
                      <p className="font-bold text-[#111827]">{formatFCFA(cancellationPolicy.feeAmount)}</p>
                    </div>
                    <div className="rounded-xl bg-white p-2">
                      <p className="text-[#64748B]">Remboursement estimé</p>
                      <p className="font-bold text-[#111827]">{formatFCFA(cancellationPolicy.refundAmount)}</p>
                    </div>
                  </div>
                  <p className="mt-2 text-xs font-semibold text-[#64748B]">{cancellationPolicySummary(cancellationPolicy)}</p>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="cancelReason">Motif d'annulation</Label>
                  <Select value={cancelReason} onValueChange={(value) => setCancelReason(value as (typeof CANCELLATION_REASONS)[number])}>
                    <SelectTrigger id="cancelReason"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CANCELLATION_REASONS.map((item) => (
                        <SelectItem key={item} value={item}>{item}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="cancelDesc">Message complémentaire (optionnel)</Label>
                  <Textarea
                    id="cancelDesc"
                    rows={3}
                    value={cancelDesc}
                    onChange={(event) => setCancelDesc(event.target.value)}
                    placeholder="Précisez votre situation pour aider l'équipe support."
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setCancelOpen(false)} className="rounded-2xl">Retour</Button>
                <Button onClick={onCancel} disabled={loading === "cancel"} className="rounded-2xl">
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
              <Button variant="outline" onClick={() => setDisputeOpen(false)} className="rounded-2xl">Annuler</Button>
              <Button onClick={onSubmitDispute} disabled={loading === "open_dispute"} className="rounded-2xl">
                Ouvrir le litige
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Dialog: Avis */}
        <Dialog open={reviewOpen} onOpenChange={setReviewOpen}>
          <DialogContent className="max-h-[calc(100vh-2rem)] overflow-y-auto sm:max-w-2xl">
            <DialogHeader>
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#111B4D] text-white shadow-sm">
                <MessageSquare className="h-5 w-5" />
              </div>
              <DialogTitle className="text-xl font-black text-[#111827]">Laisser un avis</DialogTitle>
              <DialogDescription className="leading-6">
                Votre retour aide les autres clients et permet à l'administration de suivre la qualité du cours.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="rounded-2xl border border-[#DDE6F7] bg-white p-3">
                <div className="flex items-center gap-2 text-xs font-black text-[#111827]">
                  <ShieldCheck className="h-4 w-4 text-[#111B4D]" />
                  Suivi qualité
                </div>
                <p className="mt-1 text-xs font-medium leading-5 text-[#64748B]">
                  Les notes faibles déclenchent une lecture admin plus attentive.
                </p>
              </div>
              <div className="rounded-2xl border border-[#DDE6F7] bg-white p-3">
                <div className="flex items-center gap-2 text-xs font-black text-[#111827]">
                  <CheckCircle2 className="h-4 w-4 text-[#111B4D]" />
                  Avis relié au cours
                </div>
                <p className="mt-1 text-xs font-medium leading-5 text-[#64748B]">
                  Votre avis reste rattaché à cette réservation précise.
                </p>
              </div>
            </div>
            <div className="space-y-4">
              <div>
                <Label className="text-sm font-black text-[#111827]">Évaluation qualité</Label>
                <div className="mt-2">
                  <ReviewRatingSelector value={rating} onChange={setRating} />
                </div>
              </div>
              <div>
                <Label htmlFor="comment" className="text-sm font-black text-[#111827]">Commentaire (optionnel)</Label>
                <Textarea
                  id="comment"
                  value={reviewComment}
                  onChange={(e) => setReviewComment(e.target.value)}
                  rows={5}
                  maxLength={MAX_REVIEW_COMMENT_LENGTH + 50}
                  placeholder="Décrivez le déroulement du cours, la pédagogie, la ponctualité, la communication..."
                  className="mt-1.5 rounded-2xl border-[#DDE6F7] bg-white leading-6"
                />
                <div className="mt-1 flex flex-col gap-1 text-xs min-[460px]:flex-row min-[460px]:items-center min-[460px]:justify-between">
                  <p className={reviewCommentTooLong || reviewLowRatingNeedsComment ? "font-medium text-[#111B4D]" : "text-[#64748B]"}>
                    {cleanReviewCommentLength}/{MAX_REVIEW_COMMENT_LENGTH} caractères
                  </p>
                  <p className="text-[#64748B]">Avis lié à cette réservation.</p>
                </div>
                {rating <= 3 && (
                  <p className="mt-2 rounded-2xl border border-[#E3E8F2] bg-white px-3 py-2 text-xs font-medium text-[#111B4D]">
                    Les notes de 1 à 3 nécessitent un commentaire précis. L'administration pourra ainsi vérifier le cours et suivre le professeur correctement.
                  </p>
                )}
              </div>
            </div>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setReviewOpen(false)} className="rounded-2xl">Annuler</Button>
              <Button onClick={onSubmitReview} disabled={loading === "review" || reviewCommentTooLong || reviewLowRatingNeedsComment} className="rounded-2xl">
                Publier l'avis
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}

function getActionSummary({
  status,
  paymentStatus,
  isQuoteOnly,
  hasReview,
  hasDispute,
  canReview,
  canCancel,
  paymentVerified,
}: {
  status: string;
  paymentStatus: string;
  isQuoteOnly: boolean;
  hasReview: boolean;
  hasDispute: boolean;
  canReview: boolean;
  canCancel: boolean;
  paymentVerified: boolean;
}) {
  if (status === "DISPUTED" || paymentStatus === "DISPUTED" || hasDispute) {
    return {
      title: "Support MonProf CI en cours",
      description: "Le dossier est suivi par l'administration. Votre paiement reste protégé pendant l'analyse.",
      icon: <AlertTriangle className="h-5 w-5 text-[#111B4D]" />,
      className: "border-[#E3E8F2] bg-white text-[#111B4D]",
    };
  }
  if (status === "PENDING_CLIENT_VALIDATION") {
    return {
      title: "Votre confirmation est attendue",
      description: "Confirmez si le cours s'est bien passé, ou signalez un problème pour garder le paiement bloqué.",
      icon: <AlertCircle className="h-5 w-5 text-[#111B4D]" />,
      className: "border-[#E3E8F2] bg-white text-[#111B4D]",
    };
  }
  if (canReview && !hasReview) {
    return {
      title: "Avis qualité disponible",
      description: "Vous pouvez noter le cours. Le retour aide les autres clients et le suivi admin du professeur.",
      icon: <MessageSquare className="h-5 w-5 text-[#111B4D]" />,
      className: "border-[#CAD7F2] bg-white text-[#111B4D]",
    };
  }
  if (status === "CANCELLED" || status === "REFUNDED") {
    return {
      title: status === "REFUNDED" ? "Réservation remboursée" : "Réservation annulée",
      description: "Les règles appliquées et les montants restent visibles dans l'historique du dossier.",
      icon: <Ban className="h-5 w-5 text-slate-700" />,
      className: "border-slate-200 bg-white text-slate-800",
    };
  }
  if (isQuoteOnly) {
    return {
      title: "Devis en préparation",
      description: "Aucun paiement n'est encaissé avant le montant final validé par l'administration.",
      icon: <ShieldCheck className="h-5 w-5 text-[#111B4D]" />,
      className: "border-[#CAD7F2] bg-white text-[#111B4D]",
    };
  }
  if (status === "PENDING_PAYMENT" && paymentStatus === "FAILED") {
    return {
      title: "Paiement PayDunya à finaliser",
      description: "Ouvrez PayDunya pour sélectionner le moyen de paiement et compléter les informations nécessaires sur la page sécurisée PayDunya.",
      icon: <ShieldCheck className="h-5 w-5 text-[#111B4D]" />,
      className: "border-[#CAD7F2] bg-white text-[#111B4D]",
    };
  }
  if (!paymentVerified && ["RECEIVED", "BLOCKED", "VALIDATED", "TO_PAY_TEACHER", "TEACHER_PAID"].includes(paymentStatus)) {
    return {
      title: "Paiement en vérification",
      description: "Le dossier attend une preuve PayDunya serveur avant toute confirmation financière visible côté client.",
      icon: <ShieldCheck className="h-5 w-5 text-[#111B4D]" />,
      className: "border-[#CAD7F2] bg-white text-[#111B4D]",
    };
  }
  if (canCancel) {
    return {
      title: "Réservation active",
      description: "Le professeur et l'administration disposent des informations nécessaires. Vous pouvez encore demander l'annulation selon les règles.",
      icon: <CheckCircle2 className="h-5 w-5 text-[#111B4D]" />,
      className: "border-[#CAD7F2] bg-white text-[#111B4D]",
    };
  }
  return {
    title: "Dossier suivi",
    description: "Toutes les informations importantes restent consultables dans cette réservation.",
    icon: <ShieldCheck className="h-5 w-5 text-[#111B4D]" />,
    className: "border-[#CAD7F2] bg-white text-[#111B4D]",
  };
}
