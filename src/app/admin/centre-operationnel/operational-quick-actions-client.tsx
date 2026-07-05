"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Bell, ClipboardList, ExternalLink, Link2, Loader2, UserCog, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";

type OperationalActionBooking = {
  id: string;
  reference: string;
  subjectName: string;
  levelName?: string | null;
};

function buildTeacherMessage(teacherName: string, booking?: OperationalActionBooking | null) {
  if (!booking) {
    return `Bonjour ${teacherName}, le service client Compétence vous contacte concernant vos missions en cours. Merci de répondre rapidement.`;
  }
  return [
    `Bonjour ${teacherName},`,
    "",
    "Merci de confirmer rapidement votre disponibilité pour la mission suivante :",
    "",
    `Réservation : ${booking.reference}`,
    `Cours : ${booking.subjectName}${booking.levelName ? ` - ${booking.levelName}` : ""}`,
    "",
    "Répondez rapidement au service client si une information manque ou si vous êtes indisponible.",
  ].join("\n");
}

export function OperationalTeacherActionsClient({
  teacherId,
  teacherName,
  booking,
  compact = false,
}: {
  teacherId: string;
  teacherName: string;
  booking?: OperationalActionBooking | null;
  compact?: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const size = compact ? "sm" : "default";
  const message = buildTeacherMessage(teacherName, booking);

  async function notifyTeacher() {
    setLoading("notify");
    try {
      const res = await fetch("/api/admin/teacher-notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teacherId,
          bookingId: booking?.id ?? null,
          channel: "WHATSAPP",
          title: booking ? `Relance opérationnelle ${booking.reference}` : "Relance opérationnelle",
          message,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Relance impossible.");
      await navigator.clipboard.writeText(message);
      toast.success("Relance historisée et message copié.");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Relance impossible.");
    } finally {
      setLoading(null);
    }
  }

  async function createMissionLink() {
    if (!booking) return;
    setLoading("mission");
    try {
      const res = await fetch("/api/admin/teacher-mission-links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teacherId,
          bookingId: booking.id,
          expiresInHours: 48,
          instructions: "Merci de confirmer rapidement votre disponibilité. Si vous êtes indisponible, signalez-le immédiatement au service client.",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Lien mission impossible.");
      await navigator.clipboard.writeText(data.message || `Lien mission sécurisé : ${data.absoluteUrl || data.url}`);
      toast.success("Lien mission créé et copié.");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Lien mission impossible.");
    } finally {
      setLoading(null);
    }
  }

  async function createTask() {
    setLoading("task");
    try {
      const dueAt = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
      const res = await fetch("/api/admin/teacher-tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teacherId,
          bookingId: booking?.id ?? null,
          type: booking ? "CONFIRM_AVAILABILITY" : "ADMIN_ACTION",
          priority: booking ? "URGENT" : "IMPORTANT",
          title: booking ? `Suivi mission ${booking.reference}` : "Suivi professeur",
          description: booking
            ? `Confirmer la disponibilité et sécuriser la mission ${booking.reference} (${booking.subjectName}).`
            : "Contacter le professeur et mettre à jour son statut opérationnel.",
          dueAt,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Création de tâche impossible.");
      toast.success("Tâche opérationnelle créée.");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Création de tâche impossible.");
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="grid gap-2 sm:flex sm:flex-wrap sm:justify-end">
      <Button type="button" size={size} variant="outline" onClick={notifyTeacher} disabled={!!loading}>
        {loading === "notify" ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Bell className="mr-1.5 h-4 w-4" />}
        Relancer
      </Button>
      {booking && (
        <Button type="button" size={size} variant="outline" onClick={createMissionLink} disabled={!!loading}>
          {loading === "mission" ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Link2 className="mr-1.5 h-4 w-4" />}
          Lien
        </Button>
      )}
      <Button type="button" size={size} variant="outline" onClick={createTask} disabled={!!loading}>
        {loading === "task" ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <ClipboardList className="mr-1.5 h-4 w-4" />}
        Tâche
      </Button>
      {booking && (
        <Button asChild size={size} variant="outline">
          <Link href={`/admin/reservations/${booking.id}?action=replace`}>
            <UserCog className="mr-1.5 h-4 w-4" />
            Remplacer
          </Link>
        </Button>
      )}
      <Button asChild size={size} variant="secondary">
        <Link href={booking ? `/admin/reservations/${booking.id}` : `/admin/professeurs/${teacherId}?tab=operationnel`}>
          <ExternalLink className="mr-1.5 h-4 w-4" />
          Ouvrir
        </Link>
      </Button>
    </div>
  );
}

export function OperationalPaymentActionsClient({
  teacherId,
  bookingId,
  paymentStatus,
}: {
  teacherId: string;
  bookingId: string;
  paymentStatus: string;
}) {
  const href = paymentStatus === "TO_PAY_TEACHER"
    ? `/admin/professeurs/${teacherId}?tab=paiements&bookingId=${bookingId}`
    : `/admin/reservations/${bookingId}`;

  return (
    <Button asChild size="sm" variant="outline">
      <Link href={href}>
        <Wallet className="mr-1.5 h-4 w-4" />
        {paymentStatus === "TO_PAY_TEACHER" ? "Comptabilité" : "Vérifier"}
      </Link>
    </Button>
  );
}
