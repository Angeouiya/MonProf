"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, ClipboardCopy, Link2, Loader2, MessageCircle, PhoneCall, PhoneOff, RefreshCw, UserCog, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { buildWhatsAppUrl } from "@/lib/phone";
import { formatDateTime } from "@/lib/format";
import { courseFormatLabel } from "@/lib/platform-labels";

type NotificationQuickActionBooking = {
  id: string;
  reference: string;
  subjectName: string;
  levelName: string;
  courseFormat?: string | null;
  scheduledDate?: string | null;
  scheduledTime?: string | null;
  preferredTime?: string | null;
  clientName?: string | null;
  paymentStatus: string;
  bookingStatus?: string | null;
};

const bookingStatusLabels: Record<string, string> = {
  PENDING_PAYMENT: "Paiement en attente",
  PAID: "Payée",
  PENDING_ADMIN_VALIDATION: "Validation admin requise",
  CONFIRMED: "Confirmée",
  ASSIGNED: "Attribuée au professeur",
  IN_PROGRESS: "En cours",
  COURSE_DONE: "Cours effectué",
  PENDING_CLIENT_VALIDATION: "Validation client attendue",
  VALIDATED_BY_CLIENT: "Validée par le client",
  PAYMENT_TO_RELEASE: "Paiement à libérer",
  TEACHER_PAID: "Professeur payé",
  CANCELLED: "Annulée",
  DISPUTED: "En litige",
  REFUNDED: "Remboursée",
};

const paymentStatusLabels: Record<string, string> = {
  PENDING: "Paiement en attente",
  BLOCKED: "Fonds bloqués",
  VALIDATED: "Fonds validés",
  TO_PAY_TEACHER: "À payer au professeur",
  TEACHER_PAID: "Professeur payé",
  DISPUTED: "Paiement suspendu",
  REFUNDED: "Remboursé",
  FAILED: "Échec paiement",
};

export function NotificationQuickActionsClient({
  notification,
  teacherName,
  teacherPhone,
  booking,
  hasPrimaryLink = false,
}: {
  notification: {
    id: string;
    status: string;
    recipientType: string;
    teacherId?: string | null;
    bookingId?: string | null;
    type: string;
    message: string;
  };
  teacherName?: string | null;
  teacherPhone?: string | null;
  booking?: NotificationQuickActionBooking | null;
  hasPrimaryLink?: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const canRelaunchTeacher = Boolean(notification.teacherId);
  const canCreateMissionLink = Boolean(notification.teacherId && notification.bookingId);
  const canRegisterCall = Boolean(notification.teacherId && notification.bookingId && booking);
  const shouldSuggestReplacement = notification.type.includes("REPLAC") || notification.type.includes("TEACHER_NOT_CONFIRMED") || notification.type.includes("STATUS_RESTRICTED") || notification.status === "EXPIRED";
  const actionMessage = buildActionMessage({ teacherName, booking, message: notification.message });
  const whatsAppUrl = buildWhatsAppUrl(teacherPhone, actionMessage);

  async function runNotificationAction(action: "mark_treated" | "relaunch_teacher") {
    setLoading(action);
    try {
      const res = await fetch("/api/admin/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: notification.id, action, message: notification.message }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Action impossible.");
      toast.success(action === "relaunch_teacher" ? "Relance professeur envoyée." : "Notification traitée.");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Action impossible.");
    } finally {
      setLoading(null);
    }
  }

  async function relaunchTeacher() {
    if (!notification.teacherId) return;
    if (notification.recipientType === "TEACHER") {
      await runNotificationAction("relaunch_teacher");
      return;
    }

    setLoading("relaunch_teacher");
    try {
      const res = await fetch("/api/admin/teacher-notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teacherId: notification.teacherId,
          bookingId: notification.bookingId ?? null,
          channel: "WHATSAPP",
          title: booking ? `Relance ${booking.reference}` : "Relance opérationnelle",
          message: notification.message,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Relance impossible.");
      await navigator.clipboard.writeText(notification.message);
      toast.success("Relance professeur historisée et message copié.");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Relance impossible.");
    } finally {
      setLoading(null);
    }
  }

  async function createMissionLink() {
    if (!notification.teacherId || !notification.bookingId) return;
    setLoading("mission");
    try {
      const res = await fetch("/api/admin/teacher-mission-links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teacherId: notification.teacherId,
          bookingId: notification.bookingId,
          expiresInHours: 48,
          instructions: "Merci de confirmer rapidement votre disponibilité. Si vous êtes indisponible, signalez-le immédiatement à l'administration.",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Lien mission impossible.");
      await navigator.clipboard.writeText(data.message || `Lien mission sécurisé : ${data.absoluteUrl || data.url}`);
      toast.success("Lien mission créé, copié et historisé.");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Lien mission impossible.");
    } finally {
      setLoading(null);
    }
  }

  async function registerManualCall(outcome: "confirmed" | "unavailable") {
    if (!notification.teacherId || !notification.bookingId || !booking) return;
    const loadingKey = outcome === "confirmed" ? "call_confirmed" : "call_unavailable";
    setLoading(loadingKey);
    try {
      const message = buildManualCallMessage({
        teacherName,
        booking,
        outcome,
      });
      const res = await fetch("/api/admin/teacher-notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teacherId: notification.teacherId,
          bookingId: notification.bookingId,
          channel: "MANUAL_CALL",
          priority: outcome === "confirmed" ? "IMPORTANT" : "CRITICAL",
          title: outcome === "confirmed"
            ? `Appel confirmé - ${booking.reference}`
            : `Professeur indisponible - ${booking.reference}`,
          message,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Enregistrement de l'appel impossible.");
      await navigator.clipboard.writeText(message);
      toast.success(outcome === "confirmed"
        ? "Confirmation professeur enregistrée et compte rendu copié."
        : "Indisponibilité enregistrée, remplacement recommandé et compte rendu copié.");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Enregistrement de l'appel impossible.");
    } finally {
      setLoading(null);
    }
  }

  async function copyMessage() {
    await navigator.clipboard.writeText(actionMessage);
    toast.success("Message copié pour envoi externe.");
  }

  return (
    <div className="contents">
      <Button type="button" size="sm" variant="outline" onClick={copyMessage} className="w-full justify-center 2xl:w-auto">
        <ClipboardCopy className="mr-1.5 h-4 w-4" />
        Copier
      </Button>
      {whatsAppUrl && (
        <Button asChild size="sm" variant="outline" className="w-full justify-center 2xl:w-auto">
          <a href={whatsAppUrl} target="_blank" rel="noreferrer">
            <MessageCircle className="mr-1.5 h-4 w-4" />
            WhatsApp
          </a>
        </Button>
      )}
      {canRelaunchTeacher && (
        <Button type="button" size="sm" variant="outline" onClick={relaunchTeacher} disabled={!!loading} className="w-full justify-center 2xl:w-auto">
          {loading === "relaunch_teacher" ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-1.5 h-4 w-4" />}
          Relancer prof
        </Button>
      )}
      {canCreateMissionLink && (
        <Button type="button" size="sm" variant="outline" onClick={createMissionLink} disabled={!!loading} className="w-full justify-center 2xl:w-auto">
          {loading === "mission" ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Link2 className="mr-1.5 h-4 w-4" />}
          Lien mission
        </Button>
      )}
      {canRegisterCall && (
        <Button type="button" size="sm" variant="outline" onClick={() => registerManualCall("confirmed")} disabled={!!loading} className="w-full justify-center border-blue-100 text-blue-800 hover:bg-blue-50 2xl:w-auto">
          {loading === "call_confirmed" ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <PhoneCall className="mr-1.5 h-4 w-4" />}
          Appel confirmé
        </Button>
      )}
      {canRegisterCall && (
        <Button type="button" size="sm" variant="outline" onClick={() => registerManualCall("unavailable")} disabled={!!loading} className="w-full justify-center border-red-100 text-red-700 hover:bg-red-50 2xl:w-auto">
          {loading === "call_unavailable" ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <PhoneOff className="mr-1.5 h-4 w-4" />}
          Prof indispo
        </Button>
      )}
      {notification.bookingId && shouldSuggestReplacement && !hasPrimaryLink && (
        <Button asChild size="sm" variant="outline" className="w-full justify-center 2xl:w-auto">
          <Link href={`/admin/reservations/${notification.bookingId}?action=replace`}>
            <UserCog className="mr-1.5 h-4 w-4" />
            Remplacer
          </Link>
        </Button>
      )}
      {notification.teacherId && booking?.paymentStatus === "TO_PAY_TEACHER" && (
        <Button asChild size="sm" variant="outline" className="w-full justify-center 2xl:w-auto">
          <Link href={notification.bookingId ? `/admin/professeurs/${notification.teacherId}?tab=paiements&bookingId=${notification.bookingId}` : `/admin/professeurs/${notification.teacherId}?tab=paiements`}>
            <Wallet className="mr-1.5 h-4 w-4" />
            Comptabilité
          </Link>
        </Button>
      )}
      {notification.status !== "CONFIRMED" && (
        <Button type="button" size="sm" onClick={() => runNotificationAction("mark_treated")} disabled={!!loading} className="w-full justify-center 2xl:w-auto">
          {loading === "mark_treated" ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-1.5 h-4 w-4" />}
          Traité
        </Button>
      )}
      {teacherName && <span className="sr-only">Actions rapides pour {teacherName}</span>}
    </div>
  );
}

function buildActionMessage({
  teacherName,
  booking,
  message,
}: {
  teacherName?: string | null;
  booking?: NotificationQuickActionBooking | null;
  message: string;
}) {
  return [
    teacherName ? `Professeur : ${teacherName}` : "",
    booking ? `Réservation : ${booking.reference}` : "",
    booking ? `Cours : ${booking.subjectName} - ${booking.levelName}` : "",
    booking?.clientName ? `Client : ${booking.clientName}` : "",
    booking?.courseFormat ? `Format : ${courseFormatLabel(booking.courseFormat)}` : "",
    booking ? `Créneau : ${formatNotificationBookingDate(booking)}` : "",
    booking?.bookingStatus ? `Statut réservation : ${bookingStatusLabels[booking.bookingStatus] ?? booking.bookingStatus}` : "",
    booking ? `Statut fonds : ${paymentStatusLabels[booking.paymentStatus] ?? booking.paymentStatus}` : "",
    "",
    message,
    "",
    "Action admin recommandée : vérifier l'espace professeur, relancer si besoin, puis marquer la notification comme traitée après suivi.",
  ].filter(Boolean).join("\n");
}

function buildManualCallMessage({
  teacherName,
  booking,
  outcome,
}: {
  teacherName?: string | null;
  booking: NotificationQuickActionBooking;
  outcome: "confirmed" | "unavailable";
}) {
  const name = teacherName || "Professeur";
  const outcomeLabel = outcome === "confirmed" ? "Disponibilité confirmée" : "Indisponible";
  const decision = outcome === "confirmed"
    ? "Le professeur confirme sa disponibilité. La mission peut rester affectée à ce professeur."
    : "Le professeur indique être indisponible. Préparer un remplacement et avertir le client si nécessaire.";

  return [
    "Appel manuel enregistré depuis le centre de notifications MonProf CI.",
    `Réservation : ${booking.reference} - ${booking.subjectName} (${booking.levelName})`,
    `Professeur : ${name}`,
    booking.clientName ? `Client : ${booking.clientName}` : "",
    `Statut fonds : ${paymentStatusLabels[booking.paymentStatus] ?? booking.paymentStatus}`,
    `Résultat : ${outcomeLabel}`,
    "",
    `Compte rendu : ${decision}`,
  ].filter(Boolean).join("\n");
}

function formatNotificationBookingDate(booking: NotificationQuickActionBooking) {
  if (booking.scheduledDate) {
    return `${formatDateTime(booking.scheduledDate)}${booking.scheduledTime ? ` (${booking.scheduledTime})` : ""}`;
  }
  return booking.scheduledTime || booking.preferredTime || "À confirmer";
}
