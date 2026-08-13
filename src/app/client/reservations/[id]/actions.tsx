"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { ReviewRatingSelector } from "@/components/shared/review-rating-selector";
import { ImportantActionConfirm, ImportantActionNotice } from "@/components/shared/important-action-confirm";
import { AlertTriangle, CheckCircle2, MessageSquare, AlertCircle, RefreshCw, Ban, ShieldCheck, ExternalLink, Trash2, ChevronDown } from "lucide-react";
import type { Booking, Review, Transaction } from "@prisma/client";
import { CANCELLATION_REASONS, PAID_CLIENT_TRANSACTION_STATUSES, cancellationPolicySummary, cancellationWindowLabel, getCancellationPolicy } from "@/lib/cancellation-policy";
import { RESCHEDULE_POLICY_WINDOWS, getReschedulePolicy, reschedulePolicySummary } from "@/lib/reschedule-policy";
import { formatFCFA } from "@/lib/format";
import { isAllowedJekoRedirectUrl } from "@/lib/jeko-checkout-url";
import { isReviewableBookingStatus } from "@/lib/review-policy";
import { hasVerifiedPayDunyaClientPayment } from "@/lib/payment-security";
import { activePaymentMethodOptions, paymentMethodLabel } from "@/lib/payment-methods";

type BookingActionsProps = {
  booking: Booking & {
    reviews: Review[];
    transactions?: Transaction[];
    disputes: { id: string; reason: string; description: string; status: string; createdAt: Date }[];
    clientRefundRequests?: {
      id: string;
      reference: string;
      amount: number;
      paymentServiceFeeNonRefunded: number;
      method: string;
      paymentPhone: string;
      accountName?: string | null;
      status: string;
      createdAt: Date;
    }[];
    rescheduleRequests?: {
      id: string;
      status: string;
      paymentProvider?: "PAYDUNYA" | "JEKO" | null;
      paydunyaStatus?: string | null;
      paydunyaCheckoutUrl?: string | null;
      totalToPay: number;
      createdAt: Date;
    }[];
    sessions?: {
      id: string;
      sequence: number;
      teacherId: string;
      scheduledDate: Date | string | null;
      scheduledTime: string | null;
      status: string;
      courseAmount: number;
      teacher?: {
        fullName: string;
        professionalName: string | null;
      } | null;
    }[];
  };
};

type ClientRescheduleSession = NonNullable<BookingActionsProps["booking"]["sessions"]>[number];

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

export function BookingPrimaryAction({ booking }: BookingActionsProps) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const status = booking.status;
  const paymentVerified = hasVerifiedPayDunyaClientPayment(booking);
  const providerIsJeko = booking.paymentProvider !== "PAYDUNYA";
  const providerLabel = providerIsJeko
    ? "Jèko"
    : booking.paymentProvider === "PAYDUNYA" || booking.paydunyaVerifiedAt
      ? "PayDunya (historique)"
      : "Paiement sécurisé";
  const paymentActionKey = providerIsJeko ? "jeko_checkout" : "paydunya_checkout";
  const verificationActionKey = providerIsJeko ? "jeko_verify" : "paydunya_verify";
  const canResumePayment = !booking.isQuoteOnly && status === "PENDING_PAYMENT" && booking.paymentStatus === "FAILED";

  async function callAction(action: string) {
    setLoading(action);
    try {
      const res = await fetch(`/api/bookings/${booking.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Action impossible");
        return null;
      }
      return data;
    } catch {
      toast.error("Erreur réseau");
      return null;
    } finally {
      setLoading(null);
    }
  }

  async function onResumePayment() {
    setLoading(paymentActionKey);
    try {
      const res = await fetch(providerIsJeko
        ? `/api/bookings/${booking.id}/jeko-payment`
        : `/api/bookings/${booking.id}`, {
        method: providerIsJeko ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(providerIsJeko
          ? { paymentMethod: toJekoPaymentMethod(booking.paymentMethod) }
          : { action: "paydunya_checkout" }),
      });
      const data = await res.json();
      const checkoutUrl = data.payment?.checkoutUrl;
      if (!res.ok || !checkoutUrl || (providerIsJeko && !isAllowedJekoRedirectUrl(checkoutUrl))) {
        toast.error(data.payment?.message || data.error || `Impossible d'ouvrir ${providerLabel} pour le moment.`);
        return;
      }
      toast.success(`Ouverture de ${providerLabel}...`);
      window.location.assign(checkoutUrl);
    } catch {
      toast.error("Erreur réseau");
    } finally {
      setLoading(null);
    }
  }

  async function onVerifyPayment() {
    let data;
    if (providerIsJeko) {
      setLoading(verificationActionKey);
      try {
        const res = await fetch(`/api/bookings/${booking.id}/jeko-payment`, { cache: "no-store" });
        data = await res.json();
        if (!res.ok) toast.error(data.error || "Vérification Jèko impossible.");
      } catch {
        toast.error("Erreur réseau");
      } finally {
        setLoading(null);
      }
    } else {
      data = await callAction("paydunya_verify");
    }
    if (!data) {
      router.refresh();
      return;
    }
    const message = data.payment?.message || `Vérification ${providerLabel} terminée.`;
    if (data.payment?.verified || data.payment?.status === "success") {
      toast.success(message);
    } else {
      toast(message);
    }
    router.refresh();
  }

  async function onDeleteDraft() {
    const data = await callAction("delete_draft");
    if (!data) return;
    const redirectTarget = new URL(data.redirect || "/client/reservations?tab=brouillons", window.location.origin);
    redirectTarget.searchParams.set("draftDeleted", "1");
    router.replace(`${redirectTarget.pathname}${redirectTarget.search}`);
    router.refresh();
  }

  async function onConfirmCourse() {
    const data = await callAction("confirm");
    if (!data) return;
    toast.success("Cours confirmé. Le service client finalise le dossier.");
    router.refresh();
  }

  if (canResumePayment) {
    return (
      <div className="mt-4 grid gap-2">
        <ImportantActionConfirm
          title={`Ouvrir ${providerLabel} ?`}
          description={`Vous allez quitter Compétence pour finaliser le paiement sur ${providerLabel}. Le montant est relu depuis votre dossier et ne peut pas être modifié par le navigateur.`}
          badge="Paiement sécurisé"
          notices={[
            `Aucune réservation n'est confirmée sans paiement ${providerLabel} vérifié côté serveur.`,
            "Le montant affiché inclut les frais de service Compétence et les frais de paiement Jèko séparés.",
            "Après paiement, revenez sur ce dossier pour suivre la validation du service client.",
          ]}
          confirmLabel={loading === paymentActionKey ? "Ouverture..." : `Payer via ${providerLabel}`}
          cancelLabel="Rester ici"
          onConfirm={onResumePayment}
          trigger={
            <Button className="min-h-11 w-full rounded-lg bg-[#111B4D] text-white hover:bg-[#1E2A78]" disabled={loading === paymentActionKey}>
              <ExternalLink className="mr-2 h-4 w-4" />
              {loading === paymentActionKey ? "Ouverture..." : `Payer via ${providerLabel}`}
            </Button>
          }
        />
        <Button
          variant="outline"
          className="min-h-11 w-full rounded-lg border-[#CAD7F2] bg-white text-[#111B4D] hover:border-[#111B4D] hover:bg-white"
          onClick={onVerifyPayment}
          disabled={loading === verificationActionKey}
        >
          <ShieldCheck className="mr-2 h-4 w-4" />
          {loading === verificationActionKey ? "Vérification..." : "Vérifier le paiement"}
        </Button>
        <ImportantActionConfirm
          title="Supprimer ce brouillon ?"
          description="Le brouillon disparaîtra immédiatement de votre espace. Aucun cours ne sera réservé et le professeur ne sera pas notifié."
          badge="Suppression définitive"
          notices={[
            "Vous pouvez supprimer un brouillon à tout moment.",
            "Cette action ne confirme aucun cours.",
            "Vous devrez recommencer une nouvelle réservation si vous changez d'avis.",
          ]}
          confirmLabel={loading === "delete_draft" ? "Suppression..." : "Supprimer le brouillon"}
          cancelLabel="Conserver le brouillon"
          onConfirm={onDeleteDraft}
          trigger={
            <Button
              variant="outline"
              className="min-h-11 w-full rounded-lg border-red-300 bg-white text-red-700 hover:border-red-600 hover:bg-white"
              disabled={loading === "delete_draft"}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              {loading === "delete_draft" ? "Suppression..." : "Supprimer le brouillon"}
            </Button>
          }
        />
      </div>
    );
  }

  if (status === "PENDING_CLIENT_VALIDATION" && paymentVerified) {
    return (
      <div className="mt-4 grid gap-2">
        <ImportantActionConfirm
          title="Confirmer le cours ?"
          description="Confirmez uniquement si le cours a bien eu lieu. Cette action déclenche la suite du traitement par le service client pour le paiement professeur."
          badge="Confirmation cours"
          notices={[
            "Votre confirmation est enregistrée dans le dossier.",
            "En cas de problème, utilisez plutôt les actions détaillées du dossier.",
          ]}
          confirmLabel={loading === "confirm" ? "Confirmation..." : "Confirmer le cours"}
          cancelLabel="Revoir le dossier"
          onConfirm={onConfirmCourse}
          trigger={
            <Button className="min-h-11 w-full rounded-lg bg-[#111B4D] text-white hover:bg-[#1E2A78]" disabled={loading === "confirm"}>
              <CheckCircle2 className="mr-2 h-4 w-4" />
              {loading === "confirm" ? "Confirmation..." : "Confirmer le cours"}
            </Button>
          }
        />
        <Button asChild variant="outline" className="min-h-11 w-full rounded-lg border-[#CAD7F2] bg-white text-[#111B4D] hover:border-[#111B4D] hover:bg-white">
          <a href="#actions">Signaler un problème</a>
        </Button>
      </div>
    );
  }

  return (
    <div className="mt-4">
      <Button asChild variant="outline" className="min-h-11 w-full rounded-lg border-[#CAD7F2] bg-white text-[#111B4D] hover:border-[#111B4D] hover:bg-white">
        <a href="#actions">Voir les actions du dossier</a>
      </Button>
    </div>
  );
}

export function BookingActions({ booking }: BookingActionsProps) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [disputeOpen, setDisputeOpen] = useState(false);
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [refundOpen, setRefundOpen] = useState(false);

  // Dispute form
  const [disputeReason, setDisputeReason] = useState(DISPUTE_REASONS[0]);
  const [disputeDesc, setDisputeDesc] = useState("");

  // Reschedule form
  const [rescheduleMsg, setRescheduleMsg] = useState("");
  const [rescheduleDate, setRescheduleDate] = useState("");
  const [rescheduleTime, setRescheduleTime] = useState("");
  const [rescheduleAcknowledged, setRescheduleAcknowledged] = useState(false);
  const rescheduleSessions = useMemo(
    () => (booking.sessions ?? []).filter(isClientRescheduleEligibleSession),
    [booking.sessions],
  );
  const [rescheduleSessionId, setRescheduleSessionId] = useState(() => (
    findDefaultRescheduleSessionId(booking, rescheduleSessions)
  ));
  const selectedRescheduleSession = rescheduleSessions.find((item) => item.id === rescheduleSessionId)
    ?? rescheduleSessions[0]
    ?? null;
  const [cancelReason, setCancelReason] = useState<(typeof CANCELLATION_REASONS)[number]>(CANCELLATION_REASONS[0]);
  const [cancelDesc, setCancelDesc] = useState("");
  const [cancelAcknowledged, setCancelAcknowledged] = useState(false);
  const [refundMethod, setRefundMethod] = useState(activePaymentMethodOptions[0]?.value ?? "WAVE");
  const [refundPhone, setRefundPhone] = useState("");
  const [refundPhoneConfirm, setRefundPhoneConfirm] = useState("");
  const [refundAccountName, setRefundAccountName] = useState("");
  const [refundNote, setRefundNote] = useState("");

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
      return data || true;
    } catch {
      toast.error("Erreur réseau");
      return false;
    } finally {
      setLoading(null);
    }
  }

  async function onSubmitDispute() {
    if (!disputeDesc.trim()) {
      toast.error("Veuillez décrire le problème");
      return;
    }
    const ok = await callAction("open_dispute", { reason: disputeReason, description: disputeDesc });
    if (ok) {
      toast.success("Litige ouvert. Le service client vous recontacte.");
      setDisputeOpen(false);
      setDisputeDesc("");
      router.refresh();
    }
  }

  async function onSubmitReschedule() {
    if ((booking.sessions?.length ?? 0) > 0 && !selectedRescheduleSession) {
      toast.error("Aucune séance planifiée ne peut être déplacée depuis ce dossier.");
      return;
    }
    if (!rescheduleDate || !rescheduleTime) {
      toast.error("Choisissez une nouvelle date et une heure de début.");
      return;
    }
    if (!rescheduleMsg.trim() || rescheduleMsg.trim().length < 5) {
      toast.error("Veuillez indiquer le motif du changement.");
      return;
    }
    if (!rescheduleAcknowledged) {
      toast.error("Veuillez confirmer que vous avez compris les frais éventuels.");
      return;
    }
    const data = await callAction("request_reschedule", {
      bookingSessionId: selectedRescheduleSession?.id,
      rescheduleDate,
      rescheduleTime,
      rescheduleMessage: rescheduleMsg,
    });
    if (data) {
      if (typeof data === "object" && data.payment?.checkoutUrl) {
        const paymentProvider = data.payment.provider === "PAYDUNYA" ? "PayDunya" : "Jèko";
        if (paymentProvider === "Jèko" && !isAllowedJekoRedirectUrl(data.payment.checkoutUrl)) {
          toast.error("Jèko n'a pas renvoyé de lien de paiement sécurisé.");
          return;
        }
        toast.success(`Ouverture de ${paymentProvider} pour le supplément...`);
        window.location.assign(data.payment.checkoutUrl);
        return;
      }
      toast.success("Demande de modification envoyée au professeur.");
      setRescheduleOpen(false);
      setRescheduleMsg("");
      setRescheduleDate("");
      setRescheduleTime("");
      setRescheduleAcknowledged(false);
      router.refresh();
    }
  }

  async function onResumeReschedulePayment() {
    if (!pendingRescheduleRequest) return;
    const data = await callAction("reschedule_fee_checkout", {
      rescheduleRequestId: pendingRescheduleRequest.id,
    });
    if (!data || typeof data !== "object") return;
    const checkoutUrl = data.payment?.checkoutUrl;
    if (!checkoutUrl) {
      if (data.payment?.verified) {
        toast.success(data.payment.message || "Supplément confirmé.");
        router.refresh();
      } else {
        toast.error(data.payment?.message || "Le lien de paiement n'est pas encore disponible.");
      }
      return;
    }
    const paymentProvider = data.payment.provider === "PAYDUNYA" ? "PayDunya" : "Jèko";
    if (paymentProvider === "Jèko" && !isAllowedJekoRedirectUrl(checkoutUrl)) {
      toast.error("Jèko n'a pas renvoyé de lien de paiement sécurisé.");
      return;
    }
    toast.success(`Ouverture de ${paymentProvider}...`);
    window.location.assign(checkoutUrl);
  }

  async function onCancel() {
    if (!cancelReason) {
      toast.error("Veuillez sélectionner un motif d'annulation");
      return;
    }
    if (!cancelAcknowledged) {
      toast.error("Veuillez confirmer que vous avez compris les règles d'annulation.");
      return;
    }
    const ok = await callAction("cancel", { reason: cancelReason, description: cancelDesc });
    if (ok) {
      toast.success("Réservation annulée.");
      setCancelOpen(false);
      setCancelDesc("");
      setCancelAcknowledged(false);
      router.refresh();
    }
  }

  async function onRequestReplacementInsteadOfCancel() {
    if (!cancelReason) {
      toast.error("Sélectionnez un motif pour aider le moteur de remplacement.");
      return;
    }
    const data = await callAction("request_replacement_instead_of_cancel", {
      reason: cancelReason,
      description: cancelDesc,
    });
    if (data) {
      toast.success(
        typeof data === "object" && data.replacementProposed
          ? "Un autre professeur compatible vous est proposé."
          : "Votre demande est enregistrée. Le service client reprend la recherche.",
      );
      setCancelOpen(false);
      setCancelDesc("");
      setCancelAcknowledged(false);
      router.refresh();
    }
  }

  async function onSubmitRefundDetails() {
    if (!refundPhone.trim() || !refundPhoneConfirm.trim()) {
      toast.error("Saisissez et confirmez le numéro de remboursement.");
      return;
    }
    if (refundPhone.replace(/\D/g, "") !== refundPhoneConfirm.replace(/\D/g, "")) {
      toast.error("Les deux numéros ne correspondent pas.");
      return;
    }
    if (refundAccountName.trim().length < 2) {
      toast.error("Indiquez le nom du titulaire du compte.");
      return;
    }
    const ok = await callAction("submit_refund_details", {
      method: refundMethod,
      paymentPhone: refundPhone,
      confirmPaymentPhone: refundPhoneConfirm,
      accountName: refundAccountName,
      note: refundNote,
    });
    if (ok) {
      toast.success("Coordonnées de remboursement transmises.");
      setRefundOpen(false);
      router.refresh();
    }
  }

  async function onSubmitReview() {
    if (reviewCommentTooLong) {
      toast.error(`Commentaire trop long (${MAX_REVIEW_COMMENT_LENGTH} caractères maximum).`);
      return;
    }
    if (reviewLowRatingNeedsComment) {
      toast.error(`Pour une note de ${rating}/5, ajoutez au moins ${MIN_LOW_RATING_COMMENT_LENGTH} caractères afin que le service client puisse traiter votre retour.`);
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
  const latestRefundRequest = booking.clientRefundRequests?.[0] ?? null;
  const paymentVerified = hasVerifiedPayDunyaClientPayment(booking);
  const paidAmount = paymentVerified ? booking.transactions
    ?.filter((transaction) => transaction.type === "CLIENT_PAYMENT" && PAID_CLIENT_TRANSACTION_STATUSES.includes(transaction.status as (typeof PAID_CLIENT_TRANSACTION_STATUSES)[number]))
    .reduce((sum, transaction) => sum + transaction.amount, 0) : 0;
  const paymentProviderFeeAmount = readPaymentProviderFeeAmount(booking.pricingSnapshot);
  const cancellationPolicy = getCancellationPolicy({ ...booking, paidAmount, paymentProviderFeeAmount });
  const reschedulePolicy = useMemo(() => getReschedulePolicy(selectedRescheduleSession
    ? {
        unitPrice: selectedRescheduleSession.courseAmount,
        courseAmount: selectedRescheduleSession.courseAmount,
        totalClientPays: selectedRescheduleSession.courseAmount,
        totalPrice: selectedRescheduleSession.courseAmount,
        sessionsCount: 1,
        paymentServiceFeeAmount: 0,
        scheduledDate: selectedRescheduleSession.scheduledDate,
        scheduledTime: selectedRescheduleSession.scheduledTime,
      }
    : booking), [booking, selectedRescheduleSession]);
  const pendingRescheduleRequest = booking.rescheduleRequests?.find((request) => (
    request.status === "PAYMENT_PENDING"
    || request.status === "PAYMENT_FAILED"
    || request.status === "AWAITING_TEACHER"
  ));
  const isJekoReschedule = pendingRescheduleRequest?.paymentProvider === "JEKO";
  const isHistoricalReschedulePayDunya = Boolean(pendingRescheduleRequest && !isJekoReschedule);
  const reschedulePaymentProviderLabel = isJekoReschedule ? "Jèko" : "PayDunya (historique)";
  const canReview = isReviewableBookingStatus(status);
  const canCancel = ["PAID", "PENDING_ADMIN_VALIDATION", "CONFIRMED", "ASSIGNED"].includes(status);
  const canRequestReschedule = canCancel && paymentVerified && !pendingRescheduleRequest;
  const providerIsJeko = booking.paymentProvider !== "PAYDUNYA";
  const providerLabel = providerIsJeko
    ? "Jèko"
    : booking.paymentProvider === "PAYDUNYA" || booking.paydunyaVerifiedAt
      ? "PayDunya (historique)"
      : "Paiement sécurisé";
  const canResumePayment = !booking.isQuoteOnly && status === "PENDING_PAYMENT" && booking.paymentStatus === "FAILED";
  const foregroundNotice = getForegroundNotice({
    status,
    canCancel,
    canResumePayDunya: canResumePayment,
    cancellationRefundAmount: booking.cancellationRefundAmount,
    hasRefundRequest: Boolean(latestRefundRequest),
    hasDispute,
    paymentProviderLabel: providerLabel,
  });
  const actionSummary = getActionSummary({
    status,
    paymentStatus: booking.paymentStatus,
    isQuoteOnly: booking.isQuoteOnly,
    hasReview,
    hasDispute,
    canReview,
    canCancel,
    paymentVerified,
    paymentProviderLabel: providerLabel,
  });
  const shouldOpenActions = Boolean(foregroundNotice)
    || status === "PENDING_CLIENT_VALIDATION"
    || (["CANCELLED", "REFUNDED"].includes(status) && booking.cancellationRefundAmount > 0);

  return (
    <details id="actions" className="group scroll-mt-24 overflow-hidden rounded-lg border border-[#E3E8F2] bg-white" open={shouldOpenActions || undefined} data-client-booking-options>
      <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 px-3 py-3 marker:hidden sm:px-4">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[#64748B]">Options</p>
          <h2 className="mt-0.5 text-base font-semibold leading-tight text-[#111827]">Gérer la réservation</h2>
          <p className="mt-0.5 line-clamp-1 text-xs font-medium text-[#64748B]">{actionSummary.title}</p>
        </div>
        <span className="flex items-center gap-2 text-[#111B4D]">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#111B4D] text-white [&>svg]:text-white">{actionSummary.icon}</span>
          <ChevronDown className="h-4 w-4 shrink-0 transition-transform group-open:rotate-180" />
        </span>
      </summary>
      <div className="space-y-3 border-t border-[#E6EAF3] p-3 sm:p-4">

        {foregroundNotice && (
          <ImportantActionNotice
            title={foregroundNotice.title}
            description={foregroundNotice.description}
          />
        )}

        {/* DISPUTED */}
        {status === "DISPUTED" && (
          <div className="rounded-lg border border-[#E3E8F2] bg-white p-3 text-sm text-[#111B4D]">
            <div className="flex items-center gap-2 font-semibold">
              <AlertTriangle className="h-4 w-4" />
              Litige en cours
            </div>
            <p className="mt-1 text-xs">
              Le service client traite votre litige. Vous serez recontacté sous 24-48h.
            </p>
            {hasDispute && (
              <div className="mt-2 rounded-lg border border-[#E3E8F2] bg-white p-3 text-xs">
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
            <Button
              variant="outline"
              className="min-h-11 w-full rounded-lg"
              onClick={() => setDisputeOpen(true)}
              disabled={!!loading}
            >
              <AlertTriangle className="mr-2 h-4 w-4" />
              Signaler un problème
            </Button>
        )}

        {/* Avis après validation client */}
        {canReview && (
          hasReview ? (
            <div className="rounded-lg border border-[#E3E8F2] bg-white p-3 text-sm text-[#111B4D]">
              <div className="flex items-center gap-2 font-semibold">
                <MessageSquare className="h-4 w-4" />
                Avis déposé
              </div>
              <p className="mt-1 text-xs">Merci pour votre retour ! Note : {booking.reviews[0].rating}/5</p>
            </div>
          ) : (
            <Button className="min-h-11 w-full rounded-lg" onClick={() => setReviewOpen(true)} disabled={!!loading}>
              <MessageSquare className="mr-2 h-4 w-4" />
              Laisser un avis
            </Button>
          )
        )}

        {/* CANCELLED / REFUNDED */}
        {(status === "CANCELLED" || status === "REFUNDED") && (
          <div className="rounded-lg border border-[#E3E8F2] bg-white p-3 text-sm text-[#111B4D]">
            <div className="flex items-center gap-2 font-semibold">
              <Ban className="h-4 w-4" />
              Réservation {status === "REFUNDED" ? "remboursée" : "annulée"}
            </div>
            {booking.cancellationReason && (
              <div className="mt-2 space-y-1 text-xs text-[#64748B]">
                <p>Motif : {booking.cancellationReason}</p>
                <p>Règle : {cancellationWindowLabel(booking.cancellationWindow)}</p>
                <p>Frais : {formatFCFA(booking.cancellationFeeAmount)} · Remboursement : {formatFCFA(booking.cancellationRefundAmount)}</p>
                {"paymentServiceFeeAmount" in booking && (
                  <p>Frais service non remboursés : {formatFCFA((booking as any).paymentServiceFeeAmount ?? 0)}</p>
                )}
              </div>
            )}
            {booking.cancellationRefundAmount > 0 && (
              <div className="mt-3 rounded-lg border border-[#DDE6F7] bg-white p-3">
                <p className="font-semibold text-[#111827]">Coordonnées de remboursement</p>
                {latestRefundRequest ? (
                  <div className="mt-2 text-xs leading-5 text-[#64748B]">
                    <p className="font-semibold text-[#111B4D]">{latestRefundRequest.reference} · {refundStatusLabel(latestRefundRequest.status)}</p>
                    <p>{paymentMethodLabel(latestRefundRequest.method)} · {latestRefundRequest.paymentPhone}</p>
                    {latestRefundRequest.accountName && <p>Titulaire : {latestRefundRequest.accountName}</p>}
                  </div>
                ) : (
                  <p className="mt-1 text-xs leading-5 text-[#64748B]">
                    Renseignez le numéro sur lequel le service client pourra effectuer le dépôt.
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {["CANCELLED", "REFUNDED"].includes(status) && booking.cancellationRefundAmount > 0 && (
          <Dialog open={refundOpen} onOpenChange={setRefundOpen}>
            <DialogTrigger asChild>
              <Button className="min-h-11 w-full rounded-lg" disabled={!!loading}>
                <RefreshCw className="mr-2 h-4 w-4" />
                {latestRefundRequest ? "Modifier le numéro de remboursement" : "Renseigner le remboursement"}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Coordonnées de remboursement</DialogTitle>
                <DialogDescription>
                  Le remboursement prévu est de {formatFCFA(booking.cancellationRefundAmount)}. Vérifiez bien le numéro avant d'envoyer.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="rounded-lg border border-[#DDE6F7] bg-white p-3 text-sm">
                  <p className="font-semibold text-[#111B4D]">Montant à déposer</p>
                  <p className="mt-1 text-2xl font-semibold text-[#111827]">{formatFCFA(booking.cancellationRefundAmount)}</p>
                  {"paymentServiceFeeAmount" in booking && (
                    <p className="mt-1 text-xs leading-5 text-[#64748B]">
                      Frais de service paiement non remboursés : {formatFCFA((booking as any).paymentServiceFeeAmount ?? 0)}.
                    </p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="refundMethod">Moyen de remboursement</Label>
                  <Select value={refundMethod} onValueChange={(value) => setRefundMethod(value as typeof refundMethod)}>
                    <SelectTrigger id="refundMethod"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {activePaymentMethodOptions.map((item) => (
                        <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-3 min-[560px]:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="refundPhone">Numéro de dépôt</Label>
                    <Input
                      id="refundPhone"
                      value={refundPhone}
                      onChange={(event) => setRefundPhone(event.target.value)}
                      inputMode="tel"
                      placeholder="Ex: 07 00 00 00 00"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="refundPhoneConfirm">Confirmer le numéro</Label>
                    <Input
                      id="refundPhoneConfirm"
                      value={refundPhoneConfirm}
                      onChange={(event) => setRefundPhoneConfirm(event.target.value)}
                      inputMode="tel"
                      placeholder="Ressaisir le même numéro"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="refundAccountName">Nom du titulaire</Label>
                  <Input
                    id="refundAccountName"
                    value={refundAccountName}
                    onChange={(event) => setRefundAccountName(event.target.value)}
                    placeholder="Nom affiché sur le compte mobile money"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="refundNote">Note optionnelle</Label>
                  <Textarea
                    id="refundNote"
                    rows={3}
                    value={refundNote}
                    onChange={(event) => setRefundNote(event.target.value)}
                    placeholder="Ex: veuillez rembourser sur le numéro de ma mère..."
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setRefundOpen(false)} className="rounded-lg">Retour</Button>
                <Button onClick={onSubmitRefundDetails} disabled={loading === "submit_refund_details"} className="rounded-lg">
                  Envoyer au service client
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}

        {pendingRescheduleRequest && (
          <div className="rounded-lg border border-[#E3E8F2] bg-white p-3 text-sm text-[#111B4D]">
            <div className="flex items-center gap-2 font-semibold">
              <RefreshCw className="h-4 w-4" />
              Modification de créneau en cours
            </div>
            <p className="mt-1 text-xs leading-5 text-[#64748B]">
              {["PAYMENT_PENDING", "PAYMENT_FAILED"].includes(pendingRescheduleRequest.status)
                ? `Un supplément de ${formatFCFA(pendingRescheduleRequest.totalToPay)} est en attente de paiement ${reschedulePaymentProviderLabel}.`
                : "Votre demande est transmise au professeur. Vous serez notifié dès sa réponse."}
            </p>
            {["PAYMENT_PENDING", "PAYMENT_FAILED"].includes(pendingRescheduleRequest.status) && isHistoricalReschedulePayDunya && pendingRescheduleRequest.paydunyaCheckoutUrl && (
              <Button asChild className="mt-3 min-h-11 w-full rounded-lg">
                <a href={pendingRescheduleRequest.paydunyaCheckoutUrl}>
                  Payer via PayDunya (historique)
                </a>
              </Button>
            )}
            {["PAYMENT_PENDING", "PAYMENT_FAILED"].includes(pendingRescheduleRequest.status) && !isHistoricalReschedulePayDunya && (
              <Button
                type="button"
                onClick={onResumeReschedulePayment}
                disabled={loading === "reschedule_fee_checkout"}
                className="mt-3 min-h-11 w-full rounded-lg"
              >
                {loading === "reschedule_fee_checkout" ? <RefreshCw className="h-4 w-4 animate-spin" /> : <ExternalLink className="h-4 w-4" />}
                Payer via Jèko
              </Button>
            )}
          </div>
        )}

        {canRequestReschedule && (
          <Dialog
            open={rescheduleOpen}
            onOpenChange={(nextOpen) => {
              setRescheduleOpen(nextOpen);
              if (!nextOpen) setRescheduleAcknowledged(false);
            }}
          >
            <DialogTrigger asChild>
              <Button variant="outline" className="min-h-11 w-full rounded-lg border-[#E3E8F2] bg-white text-[#111B4D] hover:border-[#111B4D] hover:bg-white hover:text-[#111B4D]" disabled={!!loading}>
                <RefreshCw className="mr-2 h-4 w-4" />
                Modifier le créneau
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
              <DialogHeader>
                <DialogTitle>Modifier le créneau du cours</DialogTitle>
                <DialogDescription>
                  Choisissez la séance à déplacer, puis une nouvelle date et une heure de début. Une séance reste fixée sur 2h, et le report peut être payant selon le délai avant le cours initial.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                {rescheduleSessions.length > 0 && (
                  <div className="space-y-1.5">
                    <Label htmlFor="rescheduleSession">Séance à déplacer</Label>
                    <Select value={selectedRescheduleSession?.id ?? ""} onValueChange={setRescheduleSessionId}>
                      <SelectTrigger id="rescheduleSession" className="min-h-11">
                        <SelectValue placeholder="Choisissez une séance" />
                      </SelectTrigger>
                      <SelectContent>
                        {rescheduleSessions.map((item) => (
                          <SelectItem key={item.id} value={item.id}>
                            {rescheduleSessionLabel(item)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs font-medium leading-5 text-[#64748B]">
                      La demande sera envoyée au professeur actuellement affecté à cette séance, y compris en cas de remplacement.
                    </p>
                  </div>
                )}
                <div className="rounded-lg border border-[#DDE6F7] bg-white p-3 text-sm">
                  <div className="flex flex-col gap-2 min-[560px]:flex-row min-[560px]:items-start min-[560px]:justify-between">
                    <div>
                      <p className="font-semibold text-[#111B4D]">{reschedulePolicy.label}</p>
                      <p className="mt-1 text-xs font-semibold text-[#64748B]">{reschedulePolicySummary(reschedulePolicy)}</p>
                    </div>
                    <span className="inline-flex w-fit rounded-full border border-[#E3E8F2] bg-white px-3 py-1 text-xs font-semibold text-[#111B4D]">
                      Règle appliquée
                    </span>
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-[#64748B]">{reschedulePolicy.description}</p>
                  <div className="mt-3 grid gap-2 text-xs min-[520px]:grid-cols-2 lg:grid-cols-4">
                    <div className="rounded-lg border border-[#E3E8F2] bg-white p-2">
                      <p className="text-[#64748B]">Base séance</p>
                      <p className="font-semibold text-[#111827]">{formatFCFA(reschedulePolicy.baseAmount)}</p>
                    </div>
                    <div className="rounded-lg border border-[#E3E8F2] bg-white p-2">
                      <p className="text-[#64748B]">Frais</p>
                      <p className="font-semibold text-[#111827]">{formatFCFA(reschedulePolicy.feeAmount)}</p>
                    </div>
                    <div className="rounded-lg border border-[#E3E8F2] bg-white p-2">
                      <p className="text-[#64748B]">Frais service Compétence</p>
                      <p className="font-semibold text-[#111827]">{formatFCFA(reschedulePolicy.paymentServiceFeeAmount)}</p>
                    </div>
                    <div className="rounded-lg border border-[#E3E8F2] bg-white p-2">
                      <p className="text-[#64748B]">Total à payer</p>
                      <p className="font-semibold text-[#111827]">{formatFCFA(reschedulePolicy.totalToPay)}</p>
                    </div>
                  </div>
                  {reschedulePolicy.feeAmount > 0 && (
                    <p className="mt-3 text-xs font-semibold leading-5 text-[#64748B]">
                      Après paiement Jèko vérifié côté serveur, la demande part au professeur. Le créneau change seulement quand le professeur confirme.
                    </p>
                  )}
                  <p className="mt-2 text-xs font-semibold leading-5 text-[#64748B]">
                    La règle est calculée sur le créneau initial. Le nouveau créneau peut être demandé dès aujourd'hui s'il commence au moins 2h après votre demande.
                  </p>
                </div>

                <div data-client-reschedule-fee-grid className="rounded-lg border border-[#E3E8F2] bg-white p-3">
                  <div className="flex flex-col gap-1 min-[560px]:flex-row min-[560px]:items-end min-[560px]:justify-between">
                    <div>
                      <p className="text-sm font-semibold text-[#111827]">Grille des frais éventuels</p>
                      <p className="mt-1 text-xs font-medium leading-5 text-[#64748B]">
                        Calcul automatique sur une séance de 2h : {formatFCFA(reschedulePolicy.baseAmount)}.
                      </p>
                    </div>
                    <p className="text-xs font-semibold text-[#111B4D]">
                      Total actuel : {formatFCFA(reschedulePolicy.totalToPay)}
                    </p>
                  </div>
                  <div className="mt-3 grid gap-2 min-[520px]:grid-cols-2">
                    {RESCHEDULE_POLICY_WINDOWS.map((item) => {
                      const active = item.code === reschedulePolicy.code;
                      return (
                        <div
                          key={item.code}
                          className={`rounded-lg border bg-white p-3 text-xs ${active ? "border-[#111B4D]" : "border-[#E3E8F2]"}`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <p className="font-semibold text-[#111827]">{item.title}</p>
                            <span className="shrink-0 rounded-full border border-[#E3E8F2] bg-white px-2 py-0.5 font-semibold text-[#111B4D]">
                              {item.clientLabel}
                            </span>
                          </div>
                          <p className="mt-2 font-medium leading-5 text-[#64748B]">{item.description}</p>
                        </div>
                      );
                    })}
                  </div>
                  <p className="mt-3 text-xs font-medium leading-5 text-[#64748B]">
                    Le moyen et le numéro de paiement restent saisis sur la page sécurisée Jèko. Le professeur n'est notifié qu'après confirmation serveur si un supplément est dû.
                  </p>
                </div>

                <div className="grid gap-3 min-[560px]:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="rescheduleDate">Nouvelle date</Label>
                    <Input
                      id="rescheduleDate"
                      type="date"
                      value={rescheduleDate}
                      min={minimumRescheduleDateInput()}
                      onChange={(event) => setRescheduleDate(event.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="rescheduleTime">Heure de début</Label>
                    <Input
                      id="rescheduleTime"
                      type="time"
                      value={rescheduleTime}
                      onChange={(event) => setRescheduleTime(event.target.value)}
                    />
                    <p className="text-xs font-medium text-[#64748B]">La fin est automatiquement 2h après.</p>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="reschedule">Motif du changement</Label>
                  <Textarea
                    id="reschedule"
                    value={rescheduleMsg}
                    onChange={(e) => setRescheduleMsg(e.target.value)}
                    rows={3}
                    placeholder="Ex: empêchement professionnel, conflit d'agenda, urgence familiale..."
                  />
                </div>
                <label htmlFor="rescheduleAcknowledged" className="flex cursor-pointer items-start gap-3 rounded-lg border border-[#DDE6F7] bg-white p-3 text-sm">
                  <Checkbox
                    id="rescheduleAcknowledged"
                    checked={rescheduleAcknowledged}
                    onCheckedChange={(checked) => setRescheduleAcknowledged(checked === true)}
                    className="mt-0.5"
                  />
                  <span className="leading-5 text-[#475569]">
                    Je comprends que le supplément est calculé selon le délai avant le cours, que les frais de service Compétence de 3 % sont affichés avant paiement, et que le nouveau créneau doit être confirmé par le professeur.
                  </span>
                </label>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setRescheduleOpen(false)} className="rounded-lg">Retour</Button>
                <Button onClick={onSubmitReschedule} disabled={loading === "request_reschedule" || !rescheduleAcknowledged} className="rounded-lg">
                  {reschedulePolicy.totalToPay > 0 ? "Payer le supplément" : "Envoyer au professeur"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}

        {/* Annulation possible pour les statuts avant cours */}
        {canCancel && (
          <Dialog
            open={cancelOpen}
            onOpenChange={(nextOpen) => {
              setCancelOpen(nextOpen);
              if (!nextOpen) setCancelAcknowledged(false);
            }}
          >
            <DialogTrigger asChild>
              <Button variant="outline" className="min-h-11 w-full rounded-lg border-[#E3E8F2] bg-white text-[#111B4D] hover:border-[#111B4D] hover:bg-white hover:text-[#111B4D]" disabled={!!loading}>
                <Ban className="mr-2 h-4 w-4" />
                Annuler la réservation
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
              <DialogHeader>
                <DialogTitle>Annuler la réservation ?</DialogTitle>
                <DialogDescription>
                  Lisez les règles avant de confirmer. L'annulation est transmise au service client et au professeur.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="rounded-lg border border-[#DDE6F7] bg-white p-3 text-sm">
                  <div className="flex flex-col gap-2 min-[560px]:flex-row min-[560px]:items-start min-[560px]:justify-between">
                    <div>
                      <p className="font-semibold text-[#111B4D]">{cancellationPolicy.label}</p>
                      <p className="mt-1 text-xs font-semibold text-[#64748B]">{cancellationPolicySummary(cancellationPolicy)}</p>
                    </div>
                    <span className="inline-flex w-fit rounded-full border border-[#E3E8F2] bg-white px-3 py-1 text-xs font-semibold text-[#111B4D]">
                      Avant confirmation
                    </span>
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-[#64748B]">{cancellationPolicy.description}</p>
                  <div className="mt-3 grid gap-2 text-xs min-[520px]:grid-cols-2 lg:grid-cols-4">
                    <div className="rounded-lg border border-[#E3E8F2] bg-white p-2">
                      <p className="text-[#64748B]">Base de calcul</p>
                      <p className="font-semibold text-[#111827]">{formatFCFA(cancellationPolicy.baseAmount)}</p>
                    </div>
                    <div className="rounded-lg border border-[#E3E8F2] bg-white p-2">
                      <p className="text-[#64748B]">Frais d'annulation</p>
                      <p className="font-semibold text-[#111827]">{formatFCFA(cancellationPolicy.feeAmount)}</p>
                    </div>
                    <div className="rounded-lg border border-[#E3E8F2] bg-white p-2">
                      <p className="text-[#64748B]">Frais service</p>
                      <p className="font-semibold text-[#111827]">{formatFCFA(cancellationPolicy.serviceFeeAmount)}</p>
                    </div>
                    <div className="rounded-lg border border-[#E3E8F2] bg-white p-2">
                      <p className="text-[#64748B]">Remboursement estimé</p>
                      <p className="font-semibold text-[#111827]">{formatFCFA(cancellationPolicy.refundAmount)}</p>
                    </div>
                  </div>
                </div>

                <div className="rounded-lg border border-[#111B4D] bg-white p-3 text-sm">
                  <div className="flex flex-col gap-3 min-[560px]:flex-row min-[560px]:items-center min-[560px]:justify-between">
                    <div>
                      <p className="font-semibold text-[#111827]">Vous voulez surtout changer de professeur ?</p>
                      <p className="mt-1 text-xs font-semibold leading-5 text-[#64748B]">
                        Gardez la réservation active : Compétence cherche automatiquement un autre professeur compatible avant de passer en annulation.
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={onRequestReplacementInsteadOfCancel}
                      disabled={loading === "request_replacement_instead_of_cancel"}
                      className="min-h-11 shrink-0 rounded-lg border-[#111B4D] bg-white text-[#111B4D] hover:bg-white"
                    >
                      {loading === "request_replacement_instead_of_cancel" ? "Recherche..." : "Changer de professeur"}
                      <RefreshCw className="ml-2 h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div className="rounded-lg border border-[#E3E8F2] bg-white p-3 text-xs font-medium leading-5 text-[#475569]">
                  <p className="text-sm font-semibold text-[#111827]">Ce qui se passe après votre annulation</p>
                  <ul className="mt-2 space-y-2">
                    <li>La réservation est arrêtée et le service client reçoit une notification pour contrôler le dossier.</li>
                    <li>Le professeur est informé qu'il ne doit pas se présenter sans nouvelle instruction.</li>
                    <li>Les frais de service Compétence ne sont pas remboursés : {formatFCFA(cancellationPolicy.serviceFeeAmount)}.</li>
                    {cancellationPolicy.paymentProviderFeeAmount > 0 && (
                      <li>Les frais de paiement Jèko du moyen choisi sont traités séparément : {formatFCFA(cancellationPolicy.paymentProviderFeeAmount)}.</li>
                    )}
                    {cancellationPolicy.refundAmount > 0 ? (
                      <li>Après annulation, vous devrez renseigner le moyen, le numéro et le titulaire du compte de remboursement.</li>
                    ) : (
                      <li>Aucun remboursement automatique n'est prévu selon la règle affichée. Le dossier peut être réexaminé par le service client.</li>
                    )}
                    <li>Des annulations répétées ou tardives peuvent être revues par le service client pour protéger les professeurs et les clients.</li>
                  </ul>
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
                    placeholder="Précisez votre situation pour aider le service client."
                  />
                </div>
                <label htmlFor="cancelAcknowledged" className="flex cursor-pointer items-start gap-3 rounded-lg border border-[#DDE6F7] bg-white p-3 text-sm">
                  <Checkbox
                    id="cancelAcknowledged"
                    checked={cancelAcknowledged}
                    onCheckedChange={(checked) => setCancelAcknowledged(checked === true)}
                    className="mt-0.5"
                  />
                  <span className="leading-5 text-[#475569]">
                    Je comprends les règles d'annulation, les frais éventuels, le remboursement estimé et le fait que les frais de service Compétence ne sont pas remboursés.
                  </span>
                </label>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setCancelOpen(false)} className="rounded-lg">Retour</Button>
                <Button onClick={onCancel} disabled={loading === "cancel" || !cancelAcknowledged} className="rounded-lg">
                  {loading === "cancel" ? "Annulation..." : "Confirmer l'annulation"}
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
              <Button variant="outline" onClick={() => setDisputeOpen(false)} className="rounded-lg">Annuler</Button>
              <Button onClick={onSubmitDispute} disabled={loading === "open_dispute"} className="rounded-lg">
                Ouvrir le litige
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Dialog: Avis */}
        <Dialog open={reviewOpen} onOpenChange={setReviewOpen}>
          <DialogContent className="max-h-[calc(100vh-2rem)] overflow-y-auto sm:max-w-2xl">
            <DialogHeader>
              <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-[#111B4D] text-white">
                <MessageSquare className="h-5 w-5" />
              </div>
              <DialogTitle className="text-xl font-semibold text-[#111827]">Laisser un avis</DialogTitle>
              <DialogDescription className="leading-6">
                Votre retour aide les autres clients et permet au service client de suivre la qualité du cours.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-2 min-[560px]:grid-cols-2">
              <div className="rounded-lg border border-[#DDE6F7] bg-white p-3">
                <div className="flex items-center gap-2 text-xs font-semibold text-[#111827]">
                  <ShieldCheck className="h-4 w-4 text-[#111B4D]" />
                  Suivi qualité
                </div>
                <p className="mt-1 text-xs font-medium leading-5 text-[#64748B]">
                  Les notes faibles déclenchent une lecture du service client plus attentive.
                </p>
              </div>
              <div className="rounded-lg border border-[#DDE6F7] bg-white p-3">
                <div className="flex items-center gap-2 text-xs font-semibold text-[#111827]">
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
                <Label className="text-sm font-semibold text-[#111827]">Évaluation qualité</Label>
                <div className="mt-2">
                  <ReviewRatingSelector value={rating} onChange={setRating} />
                </div>
              </div>
              <div>
                <Label htmlFor="comment" className="text-sm font-semibold text-[#111827]">Commentaire (optionnel)</Label>
                <Textarea
                  id="comment"
                  value={reviewComment}
                  onChange={(e) => setReviewComment(e.target.value)}
                  rows={5}
                  maxLength={MAX_REVIEW_COMMENT_LENGTH + 50}
                  placeholder="Décrivez le déroulement du cours, la pédagogie, la ponctualité, la communication..."
                  className="mt-1.5 rounded-lg border-[#DDE6F7] bg-white leading-6"
                />
                <div className="mt-1 flex flex-col gap-1 text-xs min-[460px]:flex-row min-[460px]:items-center min-[460px]:justify-between">
                  <p className={reviewCommentTooLong || reviewLowRatingNeedsComment ? "font-medium text-[#111B4D]" : "text-[#64748B]"}>
                    {cleanReviewCommentLength}/{MAX_REVIEW_COMMENT_LENGTH} caractères
                  </p>
                  <p className="text-[#64748B]">Avis lié à cette réservation.</p>
                </div>
                {rating <= 3 && (
                  <p className="mt-2 rounded-lg border border-[#E3E8F2] bg-white px-3 py-2 text-xs font-medium text-[#111B4D]">
                    Les notes de 1 à 3 nécessitent un commentaire précis. Le service client pourra ainsi vérifier le cours et suivre le professeur correctement.
                  </p>
                )}
              </div>
            </div>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setReviewOpen(false)} className="rounded-lg">Annuler</Button>
              <Button onClick={onSubmitReview} disabled={loading === "review" || reviewCommentTooLong || reviewLowRatingNeedsComment} className="rounded-lg">
                Publier l'avis
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </details>
  );
}

function readPaymentProviderFeeAmount(snapshot?: string | null) {
  if (!snapshot) return 0;
  try {
    const parsed = JSON.parse(snapshot) as { paymentProviderFeeAmount?: unknown };
    const amount = Number(parsed.paymentProviderFeeAmount ?? 0);
    return Number.isFinite(amount) ? Math.max(0, Math.round(amount)) : 0;
  } catch {
    return 0;
  }
}

function refundStatusLabel(status: string) {
  const labels: Record<string, string> = {
    PENDING: "En attente service client",
    APPROVED: "Validé",
    PAID: "Payé",
    REJECTED: "Refusé",
    CANCELLED: "Annulé",
  };
  return labels[status] ?? status;
}

function minimumRescheduleDateInput() {
  const date = new Date();
  return formatDateInput(date);
}

function isClientRescheduleEligibleSession(session: ClientRescheduleSession) {
  return Boolean(session.scheduledDate && session.scheduledTime)
    && ["PLANNED", "TEACHER_CONFIRMED"].includes(session.status);
}

function findDefaultRescheduleSessionId(
  booking: Pick<Booking, "scheduledDate" | "startDate" | "scheduledTime" | "preferredTime">,
  sessions: ClientRescheduleSession[],
) {
  if (sessions.length === 0) return "";
  const bookingDate = booking.scheduledDate ?? booking.startDate;
  const bookingTime = booking.scheduledTime || booking.preferredTime;
  const exact = sessions.find((session) => (
    toDateKey(session.scheduledDate) === toDateKey(bookingDate)
    && session.scheduledTime === bookingTime
  ));
  return exact?.id ?? sessions[0].id;
}

function rescheduleSessionLabel(session: ClientRescheduleSession) {
  const teacherName = session.teacher?.professionalName || session.teacher?.fullName || "Professeur affecté";
  return `Séance ${session.sequence} · ${formatRescheduleSessionDate(session.scheduledDate)} · ${session.scheduledTime ?? "horaire à confirmer"} · ${teacherName}`;
}

function formatRescheduleSessionDate(value: Date | string | null) {
  if (!value) return "date à confirmer";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "date à confirmer";
  return date.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function toDateKey(value: Date | string | null | undefined) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
}

function formatDateInput(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function toJekoPaymentMethod(method: string | null | undefined) {
  const methods: Record<string, "wave" | "orange" | "mtn" | "moov" | "djamo"> = {
    WAVE: "wave",
    ORANGE_MONEY: "orange",
    MTN_MONEY: "mtn",
    MOOV_MONEY: "moov",
    DJAMO: "djamo",
  };
  return (method && methods[method]) || "wave";
}

function getForegroundNotice({
  status,
  canCancel,
  canResumePayDunya,
  cancellationRefundAmount,
  hasRefundRequest,
  hasDispute,
  paymentProviderLabel,
}: {
  status: string;
  canCancel: boolean;
  canResumePayDunya: boolean;
  cancellationRefundAmount: number;
  hasRefundRequest: boolean;
  hasDispute: boolean;
  paymentProviderLabel: string;
}) {
  if (canResumePayDunya) {
    return {
      title: "Action à terminer : paiement",
      description: `Ce dossier n'est pas une réservation active tant que ${paymentProviderLabel} n'a pas confirmé le paiement côté serveur. Continuez le paiement pour éviter l'expiration du brouillon.`,
    };
  }
  if (status === "PENDING_CLIENT_VALIDATION") {
    return {
      title: "Action à terminer : confirmation du cours",
      description: "Confirmez le cours si tout s'est bien passé. En cas de problème, ouvrez un litige afin que le paiement reste protégé.",
    };
  }
  if ((status === "CANCELLED" || status === "REFUNDED") && cancellationRefundAmount > 0 && !hasRefundRequest) {
    return {
      title: "Action à terminer : numéro de remboursement",
      description: "Renseignez le moyen, le numéro et le titulaire du compte afin que le service client puisse effectuer le dépôt.",
    };
  }
  if (hasDispute || status === "DISPUTED") {
    return {
      title: "Dossier sensible : suivi service client",
      description: "Le service client traite le dossier. Gardez vos informations et justificatifs prêts pour faciliter la décision.",
    };
  }
  if (canCancel) {
    return {
      title: "Annulation possible avec règles",
      description: "Avant toute annulation, consultez les frais, le remboursement estimé et les conséquences sur la réservation.",
    };
  }
  return null;
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
  paymentProviderLabel,
}: {
  status: string;
  paymentStatus: string;
  isQuoteOnly: boolean;
  hasReview: boolean;
  hasDispute: boolean;
  canReview: boolean;
  canCancel: boolean;
  paymentVerified: boolean;
  paymentProviderLabel: string;
}) {
  if (status === "DISPUTED" || paymentStatus === "DISPUTED" || hasDispute) {
    return {
      title: "Service client Compétence en cours",
      description: "Le dossier est suivi par le service client. Votre paiement reste protégé pendant l'analyse.",
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
      description: "Vous pouvez noter le cours. Le retour aide les autres clients et le suivi service client du professeur.",
      icon: <MessageSquare className="h-5 w-5 text-[#111B4D]" />,
      className: "border-[#CAD7F2] bg-white text-[#111B4D]",
    };
  }
  if (status === "CANCELLED" || status === "REFUNDED") {
    return {
      title: status === "REFUNDED" ? "Réservation remboursée" : "Réservation annulée",
      description: "Les règles appliquées et les montants restent visibles dans l'historique du dossier.",
      icon: <Ban className="h-5 w-5 text-[#111B4D]" />,
      className: "border-[#E3E8F2] bg-white text-[#111B4D]",
    };
  }
  if (isQuoteOnly) {
    return {
      title: "Calcul à reprendre",
      description: `Aucun paiement n'est encaissé tant que le calcul automatique n'est pas prêt pour ${paymentProviderLabel}.`,
      icon: <ShieldCheck className="h-5 w-5 text-[#111B4D]" />,
      className: "border-[#CAD7F2] bg-white text-[#111B4D]",
    };
  }
  if (status === "PENDING_PAYMENT" && paymentStatus === "FAILED") {
    return {
      title: "Brouillon non réservé",
      description: `Ouvrez ${paymentProviderLabel} pour compléter le paiement. Le professeur n'est pas notifié avant confirmation serveur.`,
      icon: <ShieldCheck className="h-5 w-5 text-[#111B4D]" />,
      className: "border-[#CAD7F2] bg-white text-[#111B4D]",
    };
  }
  if (!paymentVerified && ["RECEIVED", "BLOCKED", "VALIDATED", "TO_PAY_TEACHER", "TEACHER_PAID"].includes(paymentStatus)) {
    return {
      title: "Paiement en vérification",
      description: `Le dossier attend une preuve ${paymentProviderLabel} serveur avant toute confirmation financière visible côté client.`,
      icon: <ShieldCheck className="h-5 w-5 text-[#111B4D]" />,
      className: "border-[#CAD7F2] bg-white text-[#111B4D]",
    };
  }
  if (canCancel) {
    return {
      title: "Réservation active",
      description: "Le professeur et le service client disposent des informations nécessaires. Vous pouvez encore demander l'annulation selon les règles.",
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
