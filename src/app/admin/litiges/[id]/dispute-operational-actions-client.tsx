"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ClipboardCopy, ClipboardList, Loader2, MessageSquare, RefreshCw, ShieldAlert, UserCog, Wallet } from "lucide-react";
import { formatFCFA } from "@/lib/format";

type DisputeOperationalBooking = {
  id: string;
  reference: string;
  subjectName: string;
  levelName: string;
  totalPrice: number;
  teacherNetAmount: number;
  paymentStatus: string;
  teacher: {
    id: string;
    fullName: string;
    professionalName: string | null;
    phone?: string | null;
  };
  client: {
    id: string;
    name: string;
    phone?: string | null;
  };
};

export function DisputeOperationalActionsClient({
  disputeId,
  reason,
  description,
  booking,
}: {
  disputeId: string;
  reason: string;
  description?: string | null;
  booking: DisputeOperationalBooking;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const teacherName = booking.teacher.professionalName || booking.teacher.fullName;
  const summary = [
    `Litige MonProf CI - ${booking.reference}`,
    `Client : ${booking.client.name}`,
    booking.client.phone ? `Contact client : ${booking.client.phone}` : "",
    `Professeur : ${teacherName}`,
    booking.teacher.phone ? `Contact professeur : ${booking.teacher.phone}` : "",
    `Cours : ${booking.subjectName} - ${booking.levelName}`,
    `Montant client : ${formatFCFA(booking.totalPrice)}`,
    `Net professeur concerné : ${formatFCFA(booking.teacherNetAmount)}`,
    `Statut fonds : ${booking.paymentStatus}`,
    `Motif : ${reason}`,
    `Description : ${description || "Aucune description"}`,
    "",
    "Décision admin attendue : contacter les parties, documenter les preuves, puis décider remboursement, paiement professeur, retenue, sanction ou remplacement.",
  ].filter(Boolean).join("\n");

  async function copySummary() {
    await navigator.clipboard.writeText(summary);
    toast.success("Synthèse litige copiée.");
  }

  async function notifyTeacher() {
    setLoading("notify_teacher");
    try {
      const res = await fetch("/api/admin/teacher-notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teacherId: booking.teacher.id,
          bookingId: booking.id,
          channel: "WHATSAPP",
          title: `Réponse requise litige ${booking.reference}`,
          message: [
            `Bonjour ${teacherName},`,
            "",
            `Un litige est ouvert sur la réservation ${booking.reference}.`,
            `Cours : ${booking.subjectName} - ${booking.levelName}`,
            `Motif : ${reason}`,
            "",
            "Merci de répondre rapidement à l'administration avec votre version des faits et tout élément utile.",
          ].join("\n"),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Notification impossible.");
      toast.success("Professeur notifié et historique mis à jour.");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Notification impossible.");
    } finally {
      setLoading(null);
    }
  }

  async function createTeacherTask() {
    setLoading("task");
    try {
      const res = await fetch("/api/admin/teacher-tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teacherId: booking.teacher.id,
          bookingId: booking.id,
          type: "ANSWER_DISPUTE",
          priority: "CRITICAL",
          title: `Répondre au litige ${booking.reference}`,
          description: `Le professeur doit répondre au litige : ${reason}. ${description || ""}`,
          dueAt: new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Tâche impossible.");
      toast.success("Tâche litige créée pour le professeur.");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Tâche impossible.");
    } finally {
      setLoading(null);
    }
  }

  async function messageClient() {
    setLoading("client");
    try {
      const res = await fetch("/api/admin/client-communications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: booking.client.id,
          bookingId: booking.id,
          type: "DISPUTE",
          channel: "WHATSAPP",
          subject: `Suivi litige ${booking.reference}`,
          content: [
            `Bonjour ${booking.client.name},`,
            "",
            `Nous avons bien pris en charge votre litige concernant la réservation ${booking.reference}.`,
            `Cours : ${booking.subjectName} - ${booking.levelName}`,
            "",
            "L'administration vérifie les éléments avec le professeur. Votre paiement reste sécurisé pendant le traitement.",
            "Nous revenons vers vous dès qu'une décision est prise.",
          ].join("\n"),
          priority: "URGENT",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Message client impossible.");
      toast.success("Message client enregistré et notifié.");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Message client impossible.");
    } finally {
      setLoading(null);
    }
  }

  async function warnTeacher() {
    setLoading("warning");
    try {
      const res = await fetch("/api/admin/teacher-warnings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teacherId: booking.teacher.id,
          bookingId: booking.id,
          level: "OFFICIAL_WARNING",
          reason: "CLIENT_COMPLAINT",
          description: `Litige client sur ${booking.reference}. Motif : ${reason}. ${description || ""}`,
          requestedAction: "Répondre à l'administration avec les explications et mesures correctives prévues.",
          responseDueAt: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
          adminOnly: false,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Avertissement impossible.");
      toast.success("Avertissement professeur enregistré.");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Avertissement impossible.");
    } finally {
      setLoading(null);
    }
  }

  async function financialSanction() {
    setLoading("sanction");
    try {
      const amount = Math.max(1000, Math.round(booking.teacherNetAmount * 0.25));
      const res = await fetch("/api/admin/teacher-sanctions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teacherId: booking.teacher.id,
          bookingId: booking.id,
          type: "FINANCIAL",
          reason: `Retenue proposée suite au litige ${booking.reference}`,
          description: `Retenue financière en attente de validation manuelle. Motif litige : ${reason}. ${description || ""}`,
          amount,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Sanction impossible.");
      toast.success("Sanction financière créée en attente de validation.");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Sanction impossible.");
    } finally {
      setLoading(null);
    }
  }

  return (
    <Card className="border-red-100 bg-red-50/20 shadow-sm">
      <CardHeader>
        <CardTitle className="text-base">Décisions opérationnelles liées au litige</CardTitle>
        <p className="mt-1 text-sm text-muted-foreground">
          Actions rapides pour documenter le litige, contacter les parties, préparer une sanction ou remplacer le professeur.
        </p>
      </CardHeader>
      <CardContent className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        <Button type="button" variant="outline" onClick={copySummary}>
          <ClipboardCopy className="mr-1.5 h-4 w-4" />
          Copier synthèse
        </Button>
        <Button type="button" variant="outline" onClick={notifyTeacher} disabled={!!loading}>
          {loading === "notify_teacher" ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <MessageSquare className="mr-1.5 h-4 w-4" />}
          Relancer professeur
        </Button>
        <Button type="button" variant="outline" onClick={createTeacherTask} disabled={!!loading}>
          {loading === "task" ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <ClipboardList className="mr-1.5 h-4 w-4" />}
          Tâche réponse litige
        </Button>
        <Button type="button" variant="outline" onClick={messageClient} disabled={!!loading}>
          {loading === "client" ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <MessageSquare className="mr-1.5 h-4 w-4" />}
          Informer client
        </Button>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button type="button" variant="outline" className="border-amber-200 text-amber-800 hover:bg-amber-50" disabled={!!loading}>
              {loading === "warning" ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <ShieldAlert className="mr-1.5 h-4 w-4" />}
              Avertir professeur
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Envoyer un avertissement au professeur ?</AlertDialogTitle>
              <AlertDialogDescription>
                L'avertissement sera enregistré dans la fiche professeur et envoyé dans son historique de notifications.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Annuler</AlertDialogCancel>
              <AlertDialogAction onClick={warnTeacher} className="bg-amber-600 text-white hover:bg-amber-700">Confirmer</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button type="button" variant="outline" className="border-red-200 text-red-700 hover:bg-red-50" disabled={!!loading}>
              {loading === "sanction" ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <ShieldAlert className="mr-1.5 h-4 w-4" />}
              Retenue à valider
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Créer une sanction financière en attente ?</AlertDialogTitle>
              <AlertDialogDescription>
                La retenue sera proposée mais ne sera pas appliquée automatiquement. Elle devra être validée manuellement dans la fiche professeur.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Annuler</AlertDialogCancel>
              <AlertDialogAction onClick={financialSanction} className="bg-red-700 text-white hover:bg-red-800">Créer la retenue</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        <Button asChild variant="outline">
          <Link href={`/admin/reservations/${booking.id}?action=replace`}>
            <UserCog className="mr-1.5 h-4 w-4" />
            Remplacer professeur
          </Link>
        </Button>
        <Button asChild variant="outline">
          <Link href={`/admin/professeurs/${booking.teacher.id}?tab=paiements&bookingId=${booking.id}`}>
            <Wallet className="mr-1.5 h-4 w-4" />
            Comptabilité prof
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
