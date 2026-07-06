"use client";

import { useCallback, useState, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  CheckCircle2, UserCheck, ClipboardCheck, Banknote, Ban, RefreshCw, ShieldAlert, Loader2, Bell, MessageSquare, UserCog, Link2,
} from "lucide-react";
import { formatFCFA } from "@/lib/format";
import { ProfessorImage } from "@/components/shared/professor-image";
import { getTeacherRemainingAmount } from "@/lib/teacher-payments";
import { CANCELLATION_REASONS, PAID_CLIENT_TRANSACTION_STATUSES, cancellationPolicySummary, getCancellationPenaltySplit, getCancellationPolicy } from "@/lib/cancellation-policy";

type Booking = {
  id: string;
  reference: string;
  status: string;
  paymentStatus: string;
  totalPrice: number;
  totalClientPays?: number;
  paymentServiceFeeAmount?: number;
  cancellationRefundAmount?: number;
  commissionAmount: number;
  teacherNetAmount: number;
  teacherPaidAmount: number;
  teacherPaymentAdjustments?: { amount: number; status: string; bookingId?: string | null }[];
  transactions?: { amount: number; type: string; status: string }[];
  clientRefundRequests?: {
    id: string;
    reference: string;
    amount: number;
    method: string;
    paymentPhone: string;
    accountName?: string | null;
    status: string;
    externalReference?: string | null;
  }[];
  teacher: { id: string; fullName: string; professionalName: string | null; photoUrl: string | null; phone: string; badgeVerified: boolean };
  client: { name: string; phone: string | null };
  subjectName: string;
  levelName: string;
  courseFormat: string;
  commune?: string | null;
  quartier?: string | null;
  addressHint?: string | null;
  onlineLink?: string | null;
  preferredTime: string;
  scheduledDate?: string | Date | null;
  scheduledTime?: string | null;
};

type ReplacementSuggestion = {
  id: string;
  fullName: string;
  professionalName: string | null;
  jobTitle: string;
  photoUrl: string | null;
  badges?: { verified?: boolean; recommended?: boolean; premium?: boolean };
  commune: string | null;
  quartier: string | null;
  rating: number;
  qualityScore: number;
  pricePerSession: number;
  teacherCourseShare: number;
  transportFee: number;
  transportRouteLabel?: string | null;
  transportRuleLabel?: string | null;
  netAmount: number;
  financialImpact: number;
  subjects: string[];
  levels: string[];
  zones: string[];
  matchReasons: string[];
  riskFlags: string[];
  compatibility: {
    score: number;
    sameSubject: boolean;
    sameLevel: boolean;
    sameCommune: boolean;
    availabilityCompatible: boolean;
    priceCompatible: boolean;
    noRecentIssue: boolean;
    activeConflict: boolean;
    recentDisputeCount: number;
  };
};

function normalizePaymentPhone(value: string) {
  return value.replace(/[^\d+]/g, "").trim();
}

export function BookingActionsClient({ booking }: { booking: Booking }) {
  const router = useRouter();
  const sp = useSearchParams();
  const [loading, setLoading] = useState<string | null>(null);
  const [assignOpen, setAssignOpen] = useState(false);
  const [disputeOpen, setDisputeOpen] = useState(false);
  const [notifyOpen, setNotifyOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [payTeacherOpen, setPayTeacherOpen] = useState(false);
  const [changeTeacherOpen, setChangeTeacherOpen] = useState(sp.get("action") === "replace");
  const [newTeacherId, setNewTeacherId] = useState("");
  const [availableTeachers, setAvailableTeachers] = useState<ReplacementSuggestion[]>([]);
  const [replacementLoading, setReplacementLoading] = useState(false);
  const [replacementReason, setReplacementReason] = useState("UNAVAILABLE");
  const [replacementDetails, setReplacementDetails] = useState("Professeur indisponible, remplacement décidé par le service client.");
  const [clientMessage, setClientMessage] = useState("");
  const [oldTeacherMessage, setOldTeacherMessage] = useState("");
  const [newTeacherMessage, setNewTeacherMessage] = useState("");
  const [channel, setChannel] = useState("SMS");
  const [message, setMessage] = useState("");
  const [disputeReason, setDisputeReason] = useState("");
  const [disputeDesc, setDisputeDesc] = useState("");
  const [cancelActor, setCancelActor] = useState<"ADMIN" | "TEACHER" | "CLIENT">("ADMIN");
  const [cancelReason, setCancelReason] = useState<(typeof CANCELLATION_REASONS)[number]>("Autre");
  const [cancelDesc, setCancelDesc] = useState("Annulation décidée par le service client.");
  const [payTeacherMethod, setPayTeacherMethod] = useState("WAVE");
  const [payTeacherPhone, setPayTeacherPhone] = useState(booking.teacher.phone ?? "");
  const [refundExternalReference, setRefundExternalReference] = useState("");
  const didAutoPay = useRef(false);
  const didAutoReplace = useRef(false);
  const paidAmount = booking.transactions
    ?.filter((transaction) => transaction.type === "CLIENT_PAYMENT" && PAID_CLIENT_TRANSACTION_STATUSES.includes(transaction.status as (typeof PAID_CLIENT_TRANSACTION_STATUSES)[number]))
    .reduce((sum, transaction) => sum + transaction.amount, 0);
  const cancellationPolicy = getCancellationPolicy({ ...booking, paidAmount }, new Date(), cancelActor);
  const cancellationPenaltySplit = getCancellationPenaltySplit(cancellationPolicy, cancelActor);
  const normalizedPayTeacherPhone = normalizePaymentPhone(payTeacherPhone);
  const payTeacherPhoneInvalid = normalizedPayTeacherPhone.length < 8 || normalizedPayTeacherPhone.length > 20;
  const latestRefundRequest = booking.clientRefundRequests?.[0] ?? null;
  const refundableAmount = booking.cancellationRefundAmount || Math.max(0, (booking.totalClientPays || booking.totalPrice) - (booking.paymentServiceFeeAmount || 0));
  const refundDetailsMissing = refundableAmount > 0 && !latestRefundRequest;
  const refundReferenceInvalid = refundExternalReference.trim().length < 3;

  const doAction = async (action: string, extra?: Record<string, any>) => {
    setLoading(action);
    try {
      const res = await fetch(`/api/admin/bookings/${booking.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...extra }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur");
      toast.success("Action effectuée");
      setAssignOpen(false);
      setDisputeOpen(false);
      setNotifyOpen(false);
      setCancelOpen(false);
      setPayTeacherOpen(false);
      router.refresh();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(null);
    }
  };

  // Auto-trigger pay teacher if ?action=pay from URL (dashboard)
  useEffect(() => {
    if (didAutoPay.current) return;
    const action = sp.get("action");
    if (action === "pay" && booking.paymentStatus === "TO_PAY_TEACHER") {
      didAutoPay.current = true;
      queueMicrotask(() => setPayTeacherOpen(true));
    }
  }, [booking.paymentStatus, sp]);

  const sendAssign = () => {
    if (!message.trim()) { toast.error("Message requis"); return; }
    doAction("assign", { channel, message });
  };
  const sendNotify = () => {
    if (!message.trim()) { toast.error("Message requis"); return; }
    doAction("send_teacher_info", { channel, message });
  };
  const openDispute = () => {
    if (!disputeReason.trim()) { toast.error("Raison requise"); return; }
    doAction("dispute", { reason: disputeReason, description: disputeDesc });
  };

  const loadReplacementSuggestions = useCallback(async () => {
    if (availableTeachers.length > 0 || replacementLoading) return;
    setReplacementLoading(true);
    try {
      const res = await fetch(`/api/admin/replacement-suggestions?bookingId=${booking.id}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Suggestions indisponibles.");
      setAvailableTeachers(data.items || []);
    } catch {
      toast.error("Suggestions de remplacement indisponibles.");
    } finally {
      setReplacementLoading(false);
    }
  }, [availableTeachers.length, booking.id, replacementLoading]);

  useEffect(() => {
    if (didAutoReplace.current) return;
    if (sp.get("action") !== "replace") return;
    didAutoReplace.current = true;
    const timer = window.setTimeout(() => {
      void loadReplacementSuggestions();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [sp, loadReplacementSuggestions]);

  const sendMissionLink = async () => {
    setLoading("mission_link");
    try {
      const res = await fetch("/api/admin/teacher-mission-links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teacherId: booking.teacher.id,
          bookingId: booking.id,
          expiresInHours: 48,
          instructions: "Merci de confirmer votre disponibilité. En cas d'indisponibilité, signalez-le immédiatement pour permettre un remplacement.",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Création du lien impossible");
      const absoluteUrl = data.absoluteUrl || `${window.location.origin}${data.url}`;
      const missionMessage = data.message || `Lien mission sécurisé : ${absoluteUrl}`;
      await navigator.clipboard?.writeText(missionMessage).catch(() => undefined);
      toast.success("Lien mission créé, message complet copié et historique enregistré");
      router.refresh();
    } catch (error: any) {
      toast.error(error.message || "Erreur réseau");
    } finally {
      setLoading(null);
    }
  };

  const { status, paymentStatus } = booking;
  const teacherRemainingAmount = getTeacherRemainingAmount(booking, booking.teacherPaymentAdjustments ?? []);
  const selectedReplacement = availableTeachers.find((teacher) => teacher.id === newTeacherId);
  const replacementLockedReason = getReplacementLockedReason(booking);
  const fillReplacementMessages = () => {
    if (!selectedReplacement) {
      toast.error("Sélectionnez d'abord un professeur remplaçant.");
      return;
    }
    const oldTeacherName = booking.teacher.professionalName || booking.teacher.fullName;
    const newTeacherName = selectedReplacement.professionalName || selectedReplacement.fullName;
    const dateLabel = booking.scheduledDate ? new Date(booking.scheduledDate).toLocaleDateString("fr-FR") : "À confirmer";
    const timeLabel = booking.scheduledTime || booking.preferredTime || "À confirmer";
    const formatLabel = booking.courseFormat === "ONLINE" ? "En ligne" : "À domicile";
    const locationLabel = booking.courseFormat === "ONLINE"
      ? booking.onlineLink || "Lien en ligne à confirmer"
      : [booking.commune, booking.quartier, booking.addressHint].filter(Boolean).join(" / ") || "Adresse à confirmer";
    setClientMessage([
      `Bonjour ${booking.client.name},`,
      "",
      `Nous vous informons que votre professeur initialement prévu, ${oldTeacherName}, a été remplacé pour votre cours de ${booking.subjectName}.`,
      "",
      `Nouveau professeur : ${newTeacherName}`,
      `Matière : ${booking.subjectName}`,
      `Niveau : ${booking.levelName}`,
      `Date : ${dateLabel}`,
      `Heure : ${timeLabel}`,
      `Format : ${formatLabel}`,
      `Lieu : ${locationLabel}`,
      "",
      "Votre paiement reste sécurisé et votre réservation reste confirmée.",
      "Merci de votre compréhension.",
    ].join("\n"));
    setOldTeacherMessage([
      `Bonjour ${oldTeacherName},`,
      "",
      "Vous avez été retiré de la réservation suivante :",
      "",
      `Client : ${booking.client.name}`,
      `Cours : ${booking.subjectName}`,
      `Niveau : ${booking.levelName}`,
      `Date : ${dateLabel}`,
      `Heure : ${timeLabel}`,
      `Format : ${formatLabel}`,
      `Lieu : ${locationLabel}`,
      "",
      `Motif : ${replacementDetails}`,
      "",
      "Merci de contacter le service client si nécessaire.",
    ].join("\n"));
    setNewTeacherMessage([
      `Bonjour ${newTeacherName},`,
      "",
      "Un cours vous a été attribué en remplacement.",
      "",
      `Client : ${booking.client.name}`,
      `Contact : ${booking.client.phone ?? "à confirmer par le service client"}`,
      `Cours : ${booking.subjectName}`,
      `Niveau : ${booking.levelName}`,
      `Date : ${dateLabel}`,
      `Heure : ${timeLabel}`,
      `Lieu : ${locationLabel}`,
      `Format : ${formatLabel}`,
      selectedReplacement.transportRouteLabel ? `Trajet déplacement : ${selectedReplacement.transportRouteLabel}` : "",
      `Part cours professeur : ${formatFCFA(selectedReplacement.teacherCourseShare)}`,
      `Frais déplacement : ${formatFCFA(selectedReplacement.transportFee)}`,
      `Montant net à recevoir : ${formatFCFA(selectedReplacement.netAmount)}`,
      "",
      "Un lien mission sécurisé sera généré après confirmation du remplacement.",
      "Merci de confirmer rapidement votre disponibilité.",
    ].filter(Boolean).join("\n"));
  };
  const actions: React.ReactNode[] = [];

  if (status === "PENDING_ADMIN_VALIDATION" || status === "PAID") {
    actions.push(
      <Button key="validate" onClick={() => doAction("validate")} disabled={!!loading}>
        {loading === "validate" ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-1.5 h-4 w-4" />}
        Valider la réservation
      </Button>
    );
  }
  if (status === "CONFIRMED" || status === "ASSIGNED") {
    actions.push(
      <Button key="assign" onClick={() => { setMessage(`Bonjour ${booking.teacher.professionalName || booking.teacher.fullName}, vous avez été affecté à la réservation ${booking.reference}. Matière: ${booking.subjectName}, niveau ${booking.levelName}. Contact client: ${booking.client.phone ?? "—"}.`); setAssignOpen(true); }}>
        <UserCheck className="mr-1.5 h-4 w-4" /> Affecter au professeur
      </Button>
    );
  }
  if (status === "ASSIGNED" || status === "IN_PROGRESS" || status === "CONFIRMED") {
    actions.push(
      <Button key="done" variant="outline" onClick={() => doAction("mark_done")} disabled={!!loading}>
        {loading === "mark_done" ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <ClipboardCheck className="mr-1.5 h-4 w-4" />}
        Marquer cours effectué
      </Button>
    );
    actions.push(
      <Button key="change_teacher" variant="outline" onClick={() => { setChangeTeacherOpen(true); void loadReplacementSuggestions(); }} disabled={!!loading}>
        <UserCog className="mr-1.5 h-4 w-4" /> Remplacer le professeur
      </Button>
    );
  }
  if (paymentStatus === "TO_PAY_TEACHER") {
    actions.push(
      <AlertDialog key="pay" open={payTeacherOpen} onOpenChange={setPayTeacherOpen}>
        <AlertDialogTrigger asChild>
          <Button variant="default" disabled={!!loading}>
            {loading === "pay_teacher" ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Banknote className="mr-1.5 h-4 w-4" />}
            Payer le professeur ({formatFCFA(teacherRemainingAmount)} restant)
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Payer le professeur ?</AlertDialogTitle>
            <AlertDialogDescription>
              Vous allez libérer le paiement de <strong>{formatFCFA(teacherRemainingAmount)}</strong> (reste net) à {booking.teacher.professionalName || booking.teacher.fullName}.
              Saisissez le moyen et le numéro exact du dépôt. Un reçu comptable sera créé automatiquement.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="grid gap-3 py-2 sm:grid-cols-2">
            <div>
              <Label className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Méthode</Label>
              <Select value={payTeacherMethod} onValueChange={setPayTeacherMethod}>
                <SelectTrigger className="mt-1 w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="WAVE">Wave</SelectItem>
                  <SelectItem value="ORANGE_MONEY">Orange Money</SelectItem>
                  <SelectItem value="MTN_MONEY">MTN Money</SelectItem>
                  <SelectItem value="MOOV_MONEY">Moov Money</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Numéro de paiement</Label>
              <Input
                inputMode="tel"
                value={payTeacherPhone}
                onChange={(event) => setPayTeacherPhone(event.target.value)}
                placeholder="Ex : +225 07 00 00 00 00"
                className="mt-1"
              />
              <p className={payTeacherPhoneInvalid ? "mt-1 text-xs font-medium text-red-700" : "mt-1 text-xs text-muted-foreground"}>
                Ce numéro figurera sur le reçu du professeur.
              </p>
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              disabled={payTeacherPhoneInvalid || loading === "pay_teacher"}
              onClick={(event) => {
                event.preventDefault();
                if (payTeacherPhoneInvalid) {
                  toast.error("Saisissez le numéro exact du paiement Mobile Money.");
                  return;
                }
                doAction("pay_teacher", { method: payTeacherMethod, paymentPhone: normalizedPayTeacherPhone });
              }}
            >
              Confirmer le paiement
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    );
  }

  // Notifier le prof
  actions.push(
    <Button key="notify" variant="outline" onClick={() => { setMessage(""); setNotifyOpen(true); }}>
      <Bell className="mr-1.5 h-4 w-4" /> Notifier le prof
    </Button>
  );

  actions.push(
    <Button key="mission_link" variant="outline" onClick={sendMissionLink} disabled={!!loading}>
      {loading === "mission_link" ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Link2 className="mr-1.5 h-4 w-4" />}
      Envoyer lien mission
    </Button>
  );

  // Destructives
  const destructives: React.ReactNode[] = [];
  if (!["CANCELLED", "REFUNDED", "TEACHER_PAID"].includes(status)) {
    destructives.push(
      <Dialog key="cancel" open={cancelOpen} onOpenChange={setCancelOpen}>
        <Button variant="outline" className="border-red-200 text-red-700 hover:bg-red-50" disabled={!!loading} onClick={() => setCancelOpen(true)}>
          <Ban className="mr-1.5 h-4 w-4" /> Annuler
        </Button>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Annuler la réservation</DialogTitle>
            <DialogDescription>
              Choisissez l'origine de l'annulation. Le système calcule les frais et le remboursement à enregistrer.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Origine</Label>
                <Select value={cancelActor} onValueChange={(value) => setCancelActor(value as "ADMIN" | "TEACHER" | "CLIENT")}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ADMIN">Décision administrative</SelectItem>
                    <SelectItem value="TEACHER">Faute / indisponibilité professeur</SelectItem>
                    <SelectItem value="CLIENT">Demande client avec règle de délai</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Motif</Label>
                <Select value={cancelReason} onValueChange={(value) => setCancelReason(value as (typeof CANCELLATION_REASONS)[number])}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CANCELLATION_REASONS.map((reason) => (
                      <SelectItem key={reason} value={reason}>{reason}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="rounded-lg border border-orange-100 bg-orange-50/65 p-4">
              <p className="font-semibold text-orange-950">{cancellationPolicy.label}</p>
              <p className="mt-1 text-sm text-orange-950/72">{cancellationPolicy.description}</p>
              <div className="mt-3 grid gap-2 sm:grid-cols-4">
                <div className="rounded-lg border border-white bg-white px-3 py-2">
                  <p className="text-[11px] font-medium text-muted-foreground">Base de calcul</p>
                  <p className="mt-1 text-sm font-black text-foreground">{formatFCFA(cancellationPolicy.baseAmount)}</p>
                </div>
                <div className="rounded-lg border border-white bg-white px-3 py-2">
                  <p className="text-[11px] font-medium text-muted-foreground">Frais retenus</p>
                  <p className="mt-1 text-sm font-black text-foreground">{formatFCFA(cancellationPolicy.feeAmount)}</p>
                </div>
                <div className="rounded-lg border border-white bg-white px-3 py-2">
                  <p className="text-[11px] font-medium text-muted-foreground">Frais service</p>
                  <p className="mt-1 text-sm font-black text-foreground">{formatFCFA(cancellationPolicy.serviceFeeAmount)}</p>
                </div>
                <div className="rounded-lg border border-white bg-white px-3 py-2">
                  <p className="text-[11px] font-medium text-muted-foreground">Remboursement</p>
                  <p className="mt-1 text-sm font-black text-foreground">{formatFCFA(cancellationPolicy.refundAmount)}</p>
                </div>
              </div>
              <div className="mt-3 rounded-lg border border-white bg-white p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-[#111B4D]">Répartition de la pénalité</p>
                <p className="mt-1 text-sm text-muted-foreground">{cancellationPenaltySplit.description}</p>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <div className="rounded-lg border border-[#E3E8F2] bg-white px-3 py-2">
                    <p className="text-[11px] font-medium text-muted-foreground">Part professeur</p>
                    <p className="mt-1 text-sm font-black text-foreground">
                      {formatFCFA(cancellationPenaltySplit.teacherAmount)} · {cancellationPenaltySplit.teacherRate}%
                    </p>
                  </div>
                  <div className="rounded-lg border border-[#E3E8F2] bg-white px-3 py-2">
                    <p className="text-[11px] font-medium text-muted-foreground">Part plateforme</p>
                    <p className="mt-1 text-sm font-black text-foreground">
                      {formatFCFA(cancellationPenaltySplit.platformAmount)} · {cancellationPenaltySplit.platformRate}%
                    </p>
                  </div>
                </div>
              </div>
              <p className="mt-2 text-xs font-semibold text-orange-900">{cancellationPolicySummary(cancellationPolicy)}</p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="adminCancelDesc">Détail admin</Label>
              <Textarea
                id="adminCancelDesc"
                value={cancelDesc}
                onChange={(event) => setCancelDesc(event.target.value)}
                rows={4}
                placeholder="Contexte, échange client/professeur, décision de remboursement ou report..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelOpen(false)}>Retour</Button>
            <Button
              variant="destructive"
              disabled={loading === "cancel"}
              onClick={() => doAction("cancel", { cancellationActor: cancelActor, reason: cancelReason, description: cancelDesc })}
            >
              {loading === "cancel" && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
              Confirmer l'annulation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }
  if (["RECEIVED", "BLOCKED", "VALIDATED", "TO_PAY_TEACHER", "DISPUTED", "REFUND_PENDING", "PARTIAL_REFUND_PENDING", "PARTIALLY_REFUNDED", "RETAINED"].includes(paymentStatus)) {
    destructives.push(
      <AlertDialog key="refund">
        <AlertDialogTrigger asChild>
          <Button variant="outline" className="border-red-200 text-red-700 hover:bg-red-50" disabled={!!loading || refundDetailsMissing || refundableAmount <= 0}>
            <RefreshCw className="mr-1.5 h-4 w-4" />
            {refundDetailsMissing ? "Numéro client attendu" : "Rembourser"}
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Rembourser le client ?</AlertDialogTitle>
            <AlertDialogDescription>
              Le client sera remboursé de <strong>{formatFCFA(refundableAmount)}</strong>.
              Les frais de service paiement ne sont pas inclus dans ce dépôt.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-3 py-2">
            {latestRefundRequest ? (
              <div className="rounded-lg border border-[#E3E8F2] bg-white p-3 text-sm">
                <p className="font-semibold text-[#111827]">{latestRefundRequest.reference} · {latestRefundRequest.status}</p>
                <p className="mt-1 text-[#64748B]">
                  {latestRefundRequest.method} · {latestRefundRequest.paymentPhone}
                  {latestRefundRequest.accountName ? ` · ${latestRefundRequest.accountName}` : ""}
                </p>
              </div>
            ) : (
              <div className="rounded-lg border border-[#E3E8F2] bg-white p-3 text-sm text-[#64748B]">
                Le client doit d'abord renseigner le moyen, le numéro et le titulaire du compte de remboursement.
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="refundExternalReference">Référence du dépôt</Label>
              <Input
                id="refundExternalReference"
                value={refundExternalReference}
                onChange={(event) => setRefundExternalReference(event.target.value)}
                placeholder="Ex: Wave TX-9344, reçu Orange Money..."
              />
              <p className="text-xs text-muted-foreground">Cette référence sera visible dans l'historique et la facture de remboursement.</p>
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Retour</AlertDialogCancel>
            <AlertDialogAction
              disabled={refundDetailsMissing || refundReferenceInvalid || loading === "refund"}
              onClick={(event) => {
                event.preventDefault();
                if (refundDetailsMissing) {
                  toast.error("Le client doit d'abord renseigner ses coordonnées de remboursement.");
                  return;
                }
                if (refundReferenceInvalid) {
                  toast.error("Saisissez la référence du dépôt.");
                  return;
                }
                doAction("refund", { externalReference: refundExternalReference.trim() });
              }}
              className="bg-red-600 hover:bg-red-700"
            >
              Remboursement effectué
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    );
  }
  if (!["DISPUTED", "REFUNDED", "CANCELLED"].includes(status)) {
    destructives.push(
      <Button key="dispute" variant="outline" className="border-amber-200 text-amber-700 hover:bg-amber-50" onClick={() => { setDisputeReason(""); setDisputeDesc(""); setDisputeOpen(true); }}>
        <ShieldAlert className="mr-1.5 h-4 w-4" /> Ouvrir un litige
      </Button>
    );
  }

  return (
    <>
      <Card>
        <CardHeader><CardTitle className="text-base">Actions administrateur</CardTitle></CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {actions}
          {destructives.length > 0 && (
            <>
              <div className="hidden h-6 w-px bg-border sm:block" />
              {destructives}
            </>
          )}
        </CardContent>
      </Card>

      {/* Assign dialog */}
      <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Affecter au professeur</DialogTitle>
            <DialogDescription>Le message sera préparé pour le canal choisi et enregistré dans l'historique du professeur.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Canal</Label>
              <Select value={channel} onValueChange={setChannel}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="SMS">SMS</SelectItem>
                  <SelectItem value="WHATSAPP">WhatsApp</SelectItem>
                  <SelectItem value="EMAIL">Email</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Message au professeur</Label>
              <Textarea rows={5} value={message} onChange={(e) => setMessage(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setAssignOpen(false)}>Annuler</Button>
            <Button onClick={sendAssign} disabled={loading === "assign"}>
              {loading === "assign" ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <UserCheck className="mr-1.5 h-4 w-4" />}
              Affecter et notifier
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Notify dialog */}
      <Dialog open={notifyOpen} onOpenChange={setNotifyOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Notifier le professeur</DialogTitle>
            <DialogDescription>Message ponctuel historisé pour le professeur avec le canal choisi.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Canal</Label>
              <Select value={channel} onValueChange={setChannel}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="SMS">SMS</SelectItem>
                  <SelectItem value="WHATSAPP">WhatsApp</SelectItem>
                  <SelectItem value="EMAIL">Email</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Message</Label>
              <Textarea rows={5} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Bonjour..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setNotifyOpen(false)}>Annuler</Button>
            <Button onClick={sendNotify} disabled={loading === "send_teacher_info"}>
              {loading === "send_teacher_info" ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <MessageSquare className="mr-1.5 h-4 w-4" />}
              Envoyer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dispute dialog */}
      <Dialog open={disputeOpen} onOpenChange={setDisputeOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ouvrir un litige</DialogTitle>
            <DialogDescription>La réservation passe en DISPUTED et les fonds sont gelés jusqu'à résolution.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Raison</Label>
              <Textarea rows={2} value={disputeReason} onChange={(e) => setDisputeReason(e.target.value)} placeholder="Ex: Professeur absent, cours non conforme..." />
            </div>
            <div>
              <Label>Description (optionnel)</Label>
              <Textarea rows={4} value={disputeDesc} onChange={(e) => setDisputeDesc(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDisputeOpen(false)}>Annuler</Button>
            <Button onClick={openDispute} disabled={loading === "dispute"} className="bg-amber-600 hover:bg-amber-700">
              {loading === "dispute" ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <ShieldAlert className="mr-1.5 h-4 w-4" />}
              Ouvrir le litige
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog : Changer de professeur */}
      <Dialog open={changeTeacherOpen} onOpenChange={(o) => {
        setChangeTeacherOpen(o);
        if (!o) setNewTeacherId("");
      }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Remplacer le professeur</DialogTitle>
            <DialogDescription>
              Sélectionnez un nouveau professeur, précisez le motif et validez les messages envoyés au client et aux professeurs.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            {replacementLockedReason && (
              <div className="rounded-lg border border-red-100 bg-red-50/80 p-4 text-sm text-red-900">
                <p className="font-black">Remplacement bloqué</p>
                <p className="mt-1">{replacementLockedReason}</p>
              </div>
            )}
            <Label>Professeur actuel</Label>
            <div className="flex items-center gap-3 rounded-lg border border-violet-100 bg-violet-50/50 px-3 py-2 text-sm text-muted-foreground">
              <ProfessorImage
                photoUrl={booking.teacher.photoUrl}
                name={booking.teacher.professionalName || booking.teacher.fullName}
                size="sm"
                shape="circle"
                verified={booking.teacher.badgeVerified}
              />
              <span>{booking.teacher.professionalName || booking.teacher.fullName}</span>
            </div>
            <Label htmlFor="newTeacher">Nouveau professeur *</Label>
            <Select value={newTeacherId} onValueChange={setNewTeacherId}>
              <SelectTrigger id="newTeacher"><SelectValue placeholder={replacementLoading ? "Chargement des suggestions..." : "Sélectionner un professeur compatible..."} /></SelectTrigger>
              <SelectContent className="max-h-60">
                {availableTeachers.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    <span className="flex min-w-0 items-center gap-2">
                      <ProfessorImage
                        photoUrl={t.photoUrl}
                        name={t.professionalName || t.fullName}
                        size="sm"
                        shape="circle"
                        verified={Boolean(t.badges?.verified)}
                      />
                      <span className="min-w-0">
                        <span className="block truncate">{t.professionalName || t.fullName}</span>
                        <span className="block truncate text-xs font-normal text-muted-foreground">
                          Score {t.compatibility.score}/100 · {t.jobTitle}
                        </span>
                      </span>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {!replacementLoading && availableTeachers.length === 0 && (
              <div className="rounded-lg border border-amber-100 bg-amber-50/70 p-4 text-sm text-amber-950">
                Aucun professeur compatible trouvé pour cette matière, ce niveau et ce format. Activez un professeur correspondant ou modifiez la réservation avant remplacement.
              </div>
            )}
            <div className="grid gap-2 sm:grid-cols-2">
              {availableTeachers.slice(0, 4).map((teacher) => (
                <button
                  key={teacher.id}
                  type="button"
                  onClick={() => setNewTeacherId(teacher.id)}
                  className={`rounded-lg border p-3 text-left transition hover: ${
                    newTeacherId === teacher.id ? "border-violet-300 bg-violet-50" : "border-violet-100 bg-white"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <ProfessorImage photoUrl={teacher.photoUrl} name={teacher.professionalName || teacher.fullName} size="sm" shape="circle" verified={Boolean(teacher.badges?.verified)} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className="truncate text-sm font-bold text-foreground">{teacher.professionalName || teacher.fullName}</p>
                        <Badge className="shrink-0 bg-violet-50 text-violet-800 border-violet-100">
                          {teacher.compatibility.score}/100
                        </Badge>
                      </div>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        {teacher.commune || "Abidjan"} · Score qualité {teacher.qualityScore} · {teacher.compatibility.activeConflict ? "Conflit à vérifier" : "Planning compatible"}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-1">
                        {teacher.matchReasons.slice(0, 4).map((reason) => (
                          <Badge key={reason} variant="outline" className="border-blue-100 bg-blue-50 text-blue-800">{reason}</Badge>
                        ))}
                        {teacher.riskFlags.slice(0, 2).map((risk) => (
                          <Badge key={risk} variant="outline" className="border-amber-100 bg-amber-50 text-amber-800">{risk}</Badge>
                        ))}
                      </div>
                      <p className="mt-2 text-xs text-muted-foreground">
                        Part cours {formatFCFA(teacher.teacherCourseShare)} · Dépl. {formatFCFA(teacher.transportFee)} · Net {formatFCFA(teacher.netAmount)}
                      </p>
                      {teacher.transportRouteLabel && (
                        <p className="mt-1 text-xs font-medium text-violet-700">{teacher.transportRouteLabel}</p>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
            {selectedReplacement && (
              <div className="rounded-lg border border-violet-100 bg-white p-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-semibold text-foreground">Résumé du remplacement</span>
                  <Badge variant="outline" className={selectedReplacement.financialImpact > 0 ? "border-amber-200 bg-amber-50 text-amber-800" : "border-blue-200 bg-blue-50 text-blue-800"}>
                    Impact net {selectedReplacement.financialImpact >= 0 ? "+" : ""}{formatFCFA(selectedReplacement.financialImpact)}
                  </Badge>
                </div>
                <p className="mt-2 text-muted-foreground">
                  {selectedReplacement.professionalName || selectedReplacement.fullName} couvre {selectedReplacement.subjects.slice(0, 3).join(", ")} et intervient à {selectedReplacement.zones.slice(0, 3).join(", ") || selectedReplacement.commune || "Abidjan"}.
                </p>
                <div className="mt-3 grid gap-2 text-xs sm:grid-cols-3">
                  <div className="rounded-lg border border-blue-100 bg-blue-50/70 px-3 py-2">
                    <p className="font-bold text-blue-950">Disponibilité</p>
                    <p className="mt-0.5 text-blue-900/75">{selectedReplacement.compatibility.availabilityCompatible ? "Compatible avec la demande" : "À vérifier avant affectation"}</p>
                  </div>
                  <div className="rounded-lg border border-violet-100 bg-violet-50/70 px-3 py-2">
                    <p className="font-bold text-violet-950">Planning</p>
                    <p className="mt-0.5 text-violet-900/75">{selectedReplacement.compatibility.activeConflict ? "Conflit actif détecté" : "Aucun conflit évident"}</p>
                  </div>
                  <div className="rounded-lg border border-amber-100 bg-amber-50/70 px-3 py-2">
                    <p className="font-bold text-amber-950">Litiges récents</p>
                    <p className="mt-0.5 text-amber-900/75">{selectedReplacement.compatibility.recentDisputeCount}</p>
                  </div>
                  <div className="rounded-lg border border-violet-100 bg-violet-50/70 px-3 py-2">
                    <p className="font-bold text-violet-950">Part cours</p>
                    <p className="mt-0.5 text-violet-900/75">{formatFCFA(selectedReplacement.teacherCourseShare)}</p>
                  </div>
                  <div className="rounded-lg border border-blue-100 bg-blue-50/70 px-3 py-2">
                    <p className="font-bold text-blue-950">Déplacement</p>
                    <p className="mt-0.5 text-blue-900/75">{formatFCFA(selectedReplacement.transportFee)}</p>
                  </div>
                  <div className="rounded-lg border border-violet-100 bg-white px-3 py-2">
                    <p className="font-bold text-violet-950">Net remplaçant</p>
                    <p className="mt-0.5 text-violet-900/75">{formatFCFA(selectedReplacement.netAmount)}</p>
                  </div>
                </div>
                {selectedReplacement.transportRouteLabel && (
                  <p className="mt-2 rounded-lg border border-violet-100 bg-violet-50/50 px-3 py-2 text-xs font-medium text-violet-950/75">
                    Trajet : {selectedReplacement.transportRouteLabel}. {selectedReplacement.transportRuleLabel}
                  </p>
                )}
                <div className="mt-3 flex flex-wrap gap-1">
                  {selectedReplacement.matchReasons.map((reason) => (
                    <Badge key={reason} variant="outline" className="border-blue-100 bg-blue-50 text-blue-800">{reason}</Badge>
                  ))}
                  {selectedReplacement.riskFlags.map((risk) => (
                    <Badge key={risk} variant="outline" className="border-amber-100 bg-amber-50 text-amber-800">{risk}</Badge>
                  ))}
                </div>
              </div>
            )}
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Motif</Label>
                <Select value={replacementReason} onValueChange={setReplacementReason}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="UNAVAILABLE">Indisponibilité</SelectItem>
                    <SelectItem value="LATE">Retard</SelectItem>
                    <SelectItem value="ABSENT">Absence</SelectItem>
                    <SelectItem value="CLIENT_REQUEST">Demande du client</SelectItem>
                    <SelectItem value="QUALITY_ISSUE">Problème de qualité</SelectItem>
                    <SelectItem value="ASSIGNMENT_ERROR">Erreur d'affectation</SelectItem>
                    <SelectItem value="TEACHER_SUSPENDED">Professeur suspendu</SelectItem>
                    <SelectItem value="BETTER_MATCH">Meilleur profil disponible</SelectItem>
                    <SelectItem value="OTHER">Autre</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Détail interne</Label>
                <Textarea rows={2} value={replacementDetails} onChange={(event) => setReplacementDetails(event.target.value)} />
              </div>
            </div>
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Label>Message client</Label>
                <Button type="button" variant="outline" size="sm" disabled={!selectedReplacement} onClick={fillReplacementMessages}>
                  Préremplir les messages
                </Button>
              </div>
              <Textarea rows={3} value={clientMessage} onChange={(event) => setClientMessage(event.target.value)} placeholder="Laisser vide pour utiliser le modèle automatique." />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Message ancien professeur</Label>
                <Textarea rows={3} value={oldTeacherMessage} onChange={(event) => setOldTeacherMessage(event.target.value)} placeholder="Modèle automatique si vide." />
              </div>
              <div className="space-y-1.5">
                <Label>Message nouveau professeur</Label>
                <Textarea rows={3} value={newTeacherMessage} onChange={(event) => setNewTeacherMessage(event.target.value)} placeholder="Modèle automatique si vide." />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setChangeTeacherOpen(false)}>Annuler</Button>
            <Button
              onClick={async () => {
                if (replacementLockedReason) { toast.error(replacementLockedReason); return; }
                if (!newTeacherId) { toast.error("Sélectionnez un professeur"); return; }
                setLoading("change_teacher");
                try {
                  const res = await fetch(`/api/admin/bookings/${booking.id}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      action: "change_teacher",
                      newTeacherId,
                      reason: replacementReason,
                      details: replacementDetails,
                      clientMessage: clientMessage || undefined,
                      oldTeacherMessage: oldTeacherMessage || undefined,
                      newTeacherMessage: newTeacherMessage || undefined,
                    }),
                  });
                  if (!res.ok) { const d = await res.json(); toast.error(d.error || "Erreur"); return; }
                  toast.success("Professeur changé avec succès");
                  setChangeTeacherOpen(false);
                  router.refresh();
                } catch { toast.error("Erreur réseau"); }
                finally { setLoading(null); }
              }}
              disabled={Boolean(replacementLockedReason) || !newTeacherId || loading === "change_teacher"}
            >
              {loading === "change_teacher" ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <UserCog className="mr-1.5 h-4 w-4" />}
              Confirmer le changement
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function getReplacementLockedReason(booking: Booking) {
  const replaceableStatuses = ["PAID", "PENDING_ADMIN_VALIDATION", "CONFIRMED", "ASSIGNED", "IN_PROGRESS", "DISPUTED"];
  const replaceablePaymentStatuses = ["RECEIVED", "BLOCKED", "VALIDATED", "DISPUTED"];
  if (!replaceableStatuses.includes(booking.status)) {
    return "Cette réservation n'est plus remplaçable à ce stade. Utilisez plutôt litige, remboursement, retenue ou correction comptable.";
  }
  if (!replaceablePaymentStatuses.includes(booking.paymentStatus)) {
    return "Le statut de paiement actuel ne permet plus un remplacement direct. Vérifiez d'abord la comptabilité de la réservation.";
  }
  if ((booking.teacherPaidAmount || 0) > 0) {
    return "Un versement professeur est déjà enregistré. Il faut traiter la comptabilité avant de changer le professeur.";
  }
  return "";
}
