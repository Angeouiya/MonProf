"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { ClipboardCopy, ClipboardList, ExternalLink, Link2, Loader2, MessageCircle, PhoneCall, PhoneOff, Send, UserCog } from "lucide-react";
import { Button } from "@/components/ui/button";
import { buildWhatsAppUrl } from "@/lib/phone";
import { formatDate, formatFCFA } from "@/lib/format";

type TeacherCourseActionBooking = {
  id: string;
  reference: string;
  clientName: string;
  clientPhone?: string | null;
  subjectName: string;
  levelName: string;
  courseFormat: string;
  commune?: string | null;
  quartier?: string | null;
  addressHint?: string | null;
  onlineLink?: string | null;
  preferredDays: string;
  preferredTime: string;
  scheduledDate?: string | null;
  scheduledTime?: string | null;
  participantsCount: number;
  sessionsCount: number;
  teacherNetAmount: number;
  status: string;
  paymentStatus: string;
  paidAmount: number;
  remainingAmount: number;
};

const courseFormatLabels: Record<string, string> = {
  ONLINE: "En ligne",
  HOME: "À domicile",
  IN_PERSON: "À domicile",
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

function formatDays(raw: string) {
  try {
    const days = JSON.parse(raw);
    if (Array.isArray(days)) return days.join(", ");
  } catch {
    return raw;
  }
  return raw;
}

function formatCourseDate(booking: TeacherCourseActionBooking) {
  if (booking.scheduledDate) {
    return `${formatDate(booking.scheduledDate)} ${booking.scheduledTime || booking.preferredTime || ""}`.trim();
  }
  return `${formatDays(booking.preferredDays)} - ${booking.preferredTime || "horaire à confirmer"}`;
}

function buildMissionMessage(teacherName: string, booking: TeacherCourseActionBooking) {
  const formatLabel = courseFormatLabels[booking.courseFormat] ?? booking.courseFormat;
  const locationLabel = booking.courseFormat === "ONLINE"
    ? booking.onlineLink || "Lien en ligne à confirmer"
    : [booking.commune, booking.quartier, booking.addressHint].filter(Boolean).join(" / ") || "Adresse à confirmer";
  const groupLabel = booking.participantsCount > 1
    ? `Petit groupe (${booking.participantsCount} participants)`
    : "Cours individuel";

  return [
    `Bonjour ${teacherName},`,
    "",
    "Mission MonProf CI à traiter.",
    "",
    `Réservation : ${booking.reference}`,
    `Client : ${booking.clientName}`,
    `Contact client : ${booking.clientPhone || "à confirmer par l'administration"}`,
    `Matière : ${booking.subjectName}`,
    `Niveau : ${booking.levelName}`,
    `Date / heure : ${formatCourseDate(booking)}`,
    `Format : ${formatLabel}`,
    `Type : ${groupLabel}`,
    `Nombre de séance(s) de 2h : ${booking.sessionsCount}`,
    `Lieu : ${locationLabel}`,
    `Montant net prévu : ${formatFCFA(booking.teacherNetAmount)}`,
    `Statut réservation : ${bookingStatusLabels[booking.status] ?? booking.status}`,
    `Statut paiement : ${paymentStatusLabels[booking.paymentStatus] ?? booking.paymentStatus}`,
    `Déjà enregistré comme payé : ${formatFCFA(booking.paidAmount)}`,
    `Reste comptable lié à cette réservation : ${formatFCFA(booking.remainingAmount)}`,
    "",
    "Consignes :",
    "- Confirmez rapidement votre disponibilité.",
    "- Contactez le client uniquement pour organiser le cours prévu.",
    "- Prévenez immédiatement l'administration en cas de retard, indisponibilité, changement de lieu ou problème client.",
    "- Après le cours, attendez la validation client/admin avant toute demande de paiement.",
  ].join("\n");
}

function buildManualCallMessage(
  teacherName: string,
  booking: TeacherCourseActionBooking,
  outcome: "confirmed" | "unavailable",
) {
  const outcomeLabel = outcome === "confirmed" ? "Disponibilité confirmée" : "Indisponible";
  const adminDecision = outcome === "confirmed"
    ? "Le professeur confirme sa disponibilité. La mission peut rester affectée à ce professeur."
    : "Le professeur indique être indisponible. Préparer un remplacement et avertir le client si nécessaire.";

  return [
    "Appel manuel enregistré par l'administration MonProf CI.",
    `Réservation : ${booking.reference} - ${booking.subjectName} (${booking.levelName})`,
    `Professeur : ${teacherName}`,
    `Client : ${booking.clientName}`,
    `Créneau : ${formatCourseDate(booking)}`,
    `Résultat : ${outcomeLabel}`,
    "",
    `Compte rendu : ${adminDecision}`,
  ].join("\n");
}

export function TeacherCourseQuickActionsClient({
  teacherId,
  teacherName,
  teacherPhone,
  booking,
  compact = false,
}: {
  teacherId: string;
  teacherName: string;
  teacherPhone?: string | null;
  booking: TeacherCourseActionBooking;
  compact?: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const missionMessage = buildMissionMessage(teacherName, booking);
  const size = compact ? "sm" : "default";
  const whatsAppUrl = buildWhatsAppUrl(teacherPhone, missionMessage);

  async function copyMessage() {
    await navigator.clipboard.writeText(missionMessage);
    toast.success("Message mission copié.");
  }

  async function createMissionLink() {
    setLoading("mission");
    try {
      const res = await fetch("/api/admin/teacher-mission-links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teacherId,
          bookingId: booking.id,
          expiresInHours: 48,
          instructions: "Merci de confirmer rapidement votre disponibilité. Si vous êtes indisponible, signalez-le immédiatement à l'administration.",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Lien mission impossible.");
      await navigator.clipboard.writeText(data.message || `${missionMessage}\n\nLien mission sécurisé : ${data.absoluteUrl || data.url}`);
      toast.success("Lien sécurisé créé et message copié.");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Lien mission impossible.");
    } finally {
      setLoading(null);
    }
  }

  async function notifyTeacher() {
    setLoading("notify");
    try {
      const res = await fetch("/api/admin/teacher-notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teacherId,
          bookingId: booking.id,
          channel: "WHATSAPP",
          title: `Mission ${booking.reference}`,
          message: missionMessage,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Notification impossible.");
      await navigator.clipboard.writeText(missionMessage);
      toast.success("Notification historisée et message copié.");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Notification impossible.");
    } finally {
      setLoading(null);
    }
  }

  async function createFollowUpTask() {
    setLoading("task");
    try {
      const dueAt = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
      const res = await fetch("/api/admin/teacher-tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teacherId,
          bookingId: booking.id,
          type: "CONFIRM_AVAILABILITY",
          priority: booking.status === "ASSIGNED" || booking.status === "CONFIRMED" ? "URGENT" : "IMPORTANT",
          title: `Confirmer la mission ${booking.reference}`,
          description: `Confirmer la disponibilité pour ${booking.subjectName} (${booking.levelName}) avec ${booking.clientName}. Créneau : ${formatCourseDate(booking)}.`,
          dueAt,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Création de tâche impossible.");
      toast.success("Tâche de suivi créée.");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Création de tâche impossible.");
    } finally {
      setLoading(null);
    }
  }

  async function registerManualCall(outcome: "confirmed" | "unavailable") {
    const loadingKey = outcome === "confirmed" ? "call-confirmed" : "call-unavailable";
    setLoading(loadingKey);
    try {
      const message = buildManualCallMessage(teacherName, booking, outcome);
      const res = await fetch("/api/admin/teacher-notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teacherId,
          bookingId: booking.id,
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
        ? "Appel confirmé, mission mise à jour et compte rendu copié."
        : "Indisponibilité enregistrée, remplacement recommandé et compte rendu copié.");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Enregistrement de l'appel impossible.");
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="grid gap-2 sm:flex sm:flex-wrap">
      <Button type="button" size={size} variant="outline" onClick={copyMessage} className="justify-start">
        <ClipboardCopy className="mr-1.5 h-4 w-4" />
        Copier mission
      </Button>
      {whatsAppUrl ? (
        <Button asChild size={size} variant="outline" className="justify-start border-blue-100 text-blue-800 hover:bg-blue-50">
          <a href={whatsAppUrl} target="_blank" rel="noreferrer">
            <MessageCircle className="mr-1.5 h-4 w-4" />
            WhatsApp
          </a>
        </Button>
      ) : (
        <Button type="button" size={size} variant="outline" disabled className="justify-start">
          <MessageCircle className="mr-1.5 h-4 w-4" />
          WhatsApp
        </Button>
      )}
      <Button type="button" size={size} variant="outline" onClick={notifyTeacher} disabled={!!loading} className="justify-start">
        {loading === "notify" ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Send className="mr-1.5 h-4 w-4" />}
        Relancer prof
      </Button>
      <Button type="button" size={size} variant="outline" onClick={createMissionLink} disabled={!!loading} className="justify-start">
        {loading === "mission" ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Link2 className="mr-1.5 h-4 w-4" />}
        Lien privé
      </Button>
      <Button type="button" size={size} variant="outline" onClick={createFollowUpTask} disabled={!!loading} className="justify-start">
        {loading === "task" ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <ClipboardList className="mr-1.5 h-4 w-4" />}
        Tâche suivi
      </Button>
      <Button type="button" size={size} variant="outline" onClick={() => registerManualCall("confirmed")} disabled={!!loading} className="justify-start border-blue-100 text-blue-800 hover:bg-blue-50">
        {loading === "call-confirmed" ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <PhoneCall className="mr-1.5 h-4 w-4" />}
        Appel confirmé
      </Button>
      <Button type="button" size={size} variant="outline" onClick={() => registerManualCall("unavailable")} disabled={!!loading} className="justify-start border-red-100 text-red-700 hover:bg-red-50">
        {loading === "call-unavailable" ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <PhoneOff className="mr-1.5 h-4 w-4" />}
        Prof indisponible
      </Button>
      <Button asChild size={size} variant="outline" className="justify-start">
        <Link href={`/admin/reservations/${booking.id}?action=replace`}>
          <UserCog className="mr-1.5 h-4 w-4" />
          Remplacer
        </Link>
      </Button>
      <Button asChild size={size} variant="secondary" className="justify-start">
        <Link href={`/admin/reservations/${booking.id}`}>
          <ExternalLink className="mr-1.5 h-4 w-4" />
          Ouvrir
        </Link>
      </Button>
    </div>
  );
}
