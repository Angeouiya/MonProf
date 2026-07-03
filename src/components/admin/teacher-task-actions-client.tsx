"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CheckCircle2, ClipboardCopy, ExternalLink, Loader2, MessageCircle, PhoneCall, Send, TimerOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatDateTime } from "@/lib/format";
import { buildWhatsAppUrl } from "@/lib/phone";

type TeacherTaskAction = {
  id: string;
  bookingId?: string | null;
  title: string;
  description: string;
  priority: string;
  status: string;
  dueAt?: string | Date | null;
};

const taskStatuses = [
  { value: "TODO", label: "À faire" },
  { value: "SENT_TO_TEACHER", label: "Envoyée au professeur" },
  { value: "SEEN_BY_TEACHER", label: "Vue" },
  { value: "CONFIRMED", label: "Confirmée" },
  { value: "IN_PROGRESS", label: "En cours" },
  { value: "DONE", label: "Terminée" },
  { value: "LATE", label: "En retard" },
  { value: "NOT_DONE", label: "Non réalisée" },
  { value: "CANCELLED", label: "Annulée" },
] as const;

const taskPriorityLabels: Record<string, string> = {
  NORMAL: "Normale",
  IMPORTANT: "Importante",
  URGENT: "Urgente",
  CRITICAL: "Critique",
};

function statusLabel(status: string) {
  return taskStatuses.find((item) => item.value === status)?.label ?? status;
}

export function TeacherTaskActionsClient({
  task,
  teacherName,
  teacherPhone,
}: {
  task: TeacherTaskAction;
  teacherName: string;
  teacherPhone?: string | null;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const noteTooLong = note.trim().length > 500;
  const taskMessage = useMemo(() => [
    `Tâche professeur - ${teacherName}`,
    `Titre : ${task.title}`,
    `Priorité : ${taskPriorityLabels[task.priority] ?? task.priority}`,
    `Statut : ${statusLabel(task.status)}`,
    `Échéance : ${task.dueAt ? formatDateTime(task.dueAt) : "Sans échéance"}`,
    "",
    task.description,
    note.trim() ? "" : null,
    note.trim() ? `Note admin : ${note.trim()}` : null,
  ].filter(Boolean).join("\n"), [note, task.description, task.dueAt, task.priority, task.status, task.title, teacherName]);
  const whatsAppUrl = buildWhatsAppUrl(teacherPhone, taskMessage);

  const copySummary = async () => {
    await navigator.clipboard.writeText(taskMessage);
    toast.success("Résumé de tâche copié.");
  };

  const updateStatus = async (status: string, notifyTeacher = false) => {
    if (noteTooLong) {
      toast.error("La note de suivi ne doit pas dépasser 500 caractères.");
      return;
    }
    setLoading(status);
    try {
      const res = await fetch("/api/admin/teacher-tasks", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId: task.id, status, notifyTeacher, note: note.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Mise à jour impossible.");
      toast.success(notifyTeacher ? "Tâche mise à jour et envoyée au professeur." : "Statut de tâche mis à jour.");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Mise à jour impossible.");
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="mt-4 space-y-3">
      <div>
        <Textarea
          value={note}
          onChange={(event) => setNote(event.target.value)}
          maxLength={560}
          placeholder="Note de suivi admin optionnelle avant changement de statut ou relance..."
          className="min-h-20 rounded-2xl text-sm"
        />
        <p className={noteTooLong ? "mt-1 text-xs font-medium text-red-700" : "mt-1 text-xs text-muted-foreground"}>
          {note.trim().length}/500 caractères. Cette note est ajoutée au message professeur et au journal admin.
        </p>
      </div>

      <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
        <Select value={task.status} onValueChange={(value) => updateStatus(value)}>
          <SelectTrigger className="h-10 rounded-2xl">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {taskStatuses.map((item) => (
              <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          type="button"
          variant="outline"
          className="h-10 rounded-2xl"
          disabled={Boolean(loading)}
          onClick={() => updateStatus("SENT_TO_TEACHER", true)}
        >
          {loading === "SENT_TO_TEACHER" ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Send className="mr-1.5 h-4 w-4" />}
          Notifier
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" variant="outline" onClick={copySummary}>
          <ClipboardCopy className="mr-1.5 h-3.5 w-3.5" />
          Copier
        </Button>
        {whatsAppUrl ? (
          <Button asChild size="sm" variant="outline" className="border-blue-100 text-blue-800 hover:bg-blue-50">
            <a href={whatsAppUrl} target="_blank" rel="noreferrer">
              <MessageCircle className="mr-1.5 h-3.5 w-3.5" />
              WhatsApp
            </a>
          </Button>
        ) : (
          <Button type="button" size="sm" variant="outline" disabled>
            <PhoneCall className="mr-1.5 h-3.5 w-3.5" />
            Téléphone absent
          </Button>
        )}
        <Button type="button" size="sm" variant="outline" disabled={Boolean(loading)} onClick={() => updateStatus("DONE")}>
          {loading === "DONE" ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />}
          Terminée
        </Button>
        <Button type="button" size="sm" variant="outline" disabled={Boolean(loading)} onClick={() => updateStatus("LATE")}>
          {loading === "LATE" ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <TimerOff className="mr-1.5 h-3.5 w-3.5" />}
          Retard
        </Button>
        {task.bookingId && (
          <Button asChild size="sm" variant="outline">
            <Link href={`/admin/reservations/${task.bookingId}`}>
              Réservation <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
            </Link>
          </Button>
        )}
      </div>
    </div>
  );
}
