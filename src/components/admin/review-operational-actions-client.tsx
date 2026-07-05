"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ClipboardCopy, Loader2, ShieldAlert, ClipboardList } from "lucide-react";
import { Button } from "@/components/ui/button";
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

type ReviewOperationalActionsProps = {
  reviewId: string;
  teacherId: string;
  teacherName: string;
  bookingId: string;
  bookingReference: string;
  clientName: string;
  rating: number;
  comment?: string | null;
  compact?: boolean;
};

function priorityFromRating(rating: number) {
  if (rating <= 2) return "CRITICAL";
  if (rating === 3) return "URGENT";
  return "IMPORTANT";
}

function warningLevelFromRating(rating: number) {
  if (rating <= 2) return "OFFICIAL_WARNING";
  return "SIMPLE_REMINDER";
}

export function ReviewOperationalActionsClient({
  reviewId,
  teacherId,
  teacherName,
  bookingId,
  bookingReference,
  clientName,
  rating,
  comment,
  compact = false,
}: ReviewOperationalActionsProps) {
  const router = useRouter();
  const [loading, setLoading] = useState<"task" | "warning" | null>(null);
  const summary = [
    `Suivi avis client - ${teacherName}`,
    `Réservation : ${bookingReference}`,
    `Client : ${clientName}`,
    `Note : ${rating}/5`,
    `Commentaire : ${comment || "Aucun commentaire"}`,
    "",
    "Action admin recommandée : vérifier la qualité du cours, contacter le client si nécessaire, puis décider d'un suivi, avertissement ou remplacement.",
  ].join("\n");

  async function updateReviewTreatment(adminStatus: string, adminNote: string) {
    const res = await fetch(`/api/admin/reviews/${reviewId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ adminStatus, adminNote }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Mise à jour du suivi avis impossible.");
  }

  async function createTask() {
    setLoading("task");
    try {
      const res = await fetch("/api/admin/teacher-tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teacherId,
          bookingId,
          type: "ADMIN_ACTION",
          title: `Suivi qualité avis ${rating}/5 - ${bookingReference}`,
          description: `Avis de ${clientName} pour ${teacherName}. Note ${rating}/5. ${comment ? `Commentaire: ${comment}` : "Aucun commentaire."}`,
          priority: priorityFromRating(rating),
          dueAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Création de tâche impossible.");
      await updateReviewTreatment(
        "TO_REVIEW",
        `Tâche de suivi qualité créée pour ${bookingReference}. Note client ${rating}/5. ${comment ? `Commentaire: ${comment}` : "Aucun commentaire."}`,
      );
      toast.success("Tâche de suivi qualité créée.");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Création de tâche impossible.");
    } finally {
      setLoading(null);
    }
  }

  async function sendWarning() {
    setLoading("warning");
    try {
      const res = await fetch("/api/admin/teacher-warnings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teacherId,
          bookingId,
          level: warningLevelFromRating(rating),
          reason: "CLIENT_COMPLAINT",
          description: `Avis client ${rating}/5 sur ${bookingReference}. ${comment ? `Commentaire client: ${comment}` : "Aucun commentaire client."}`,
          requestedAction: "Répondre au service client avec les explications et mesures correctives prévues.",
          responseDueAt: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
          adminOnly: false,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Avertissement impossible.");
      await updateReviewTreatment(
        "WARNING_SENT",
        `Avertissement professeur créé depuis l'avis client ${rating}/5 sur ${bookingReference}. ${comment ? `Commentaire: ${comment}` : "Aucun commentaire."}`,
      );
      toast.success("Avertissement professeur enregistré.");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Avertissement impossible.");
    } finally {
      setLoading(null);
    }
  }

  async function copySummary() {
    await navigator.clipboard.writeText(summary);
    toast.success("Synthèse avis copiée.");
  }

  return (
    <div className={compact ? "flex flex-wrap justify-end gap-1.5" : "flex flex-col gap-2 sm:flex-row sm:flex-wrap"}>
      <Button type="button" variant="outline" size={compact ? "sm" : "default"} onClick={createTask} disabled={!!loading}>
        {loading === "task" ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <ClipboardList className="mr-1.5 h-4 w-4" />}
        Suivi qualité
      </Button>
      <Button type="button" variant="outline" size={compact ? "sm" : "default"} onClick={copySummary}>
        <ClipboardCopy className="mr-1.5 h-4 w-4" />
        Copier
      </Button>
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size={compact ? "sm" : "default"}
            disabled={!!loading}
            className="border-amber-200 text-amber-800 hover:bg-amber-50"
          >
            {loading === "warning" ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <ShieldAlert className="mr-1.5 h-4 w-4" />}
            Avertir
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Envoyer un avertissement au professeur ?</AlertDialogTitle>
            <AlertDialogDescription>
              Un avertissement sera enregistré, envoyé dans l'historique professeur et impactera son score qualité. Utilisez cette action seulement si l'avis révèle un vrai problème opérationnel.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={sendWarning} className="bg-amber-600 text-white hover:bg-amber-700">
              Confirmer l'avertissement
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
