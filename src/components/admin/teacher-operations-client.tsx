"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Bell, ClipboardCopy, ClipboardList, Loader2, MessageCircle, ShieldAlert, Siren, UserX } from "lucide-react";
import { buildWhatsAppUrl } from "@/lib/phone";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

type BookingOption = {
  id: string;
  reference: string;
  subjectName: string;
  levelName: string;
};

type TeacherOperationsClientProps = {
  teacherId: string;
  teacherName: string;
  teacherPhone?: string | null;
  bookings: BookingOption[];
  initialAction?: string;
  initialStatus?: string;
};

export function TeacherOperationsClient({ teacherId, teacherName, teacherPhone, bookings, initialAction, initialStatus }: TeacherOperationsClientProps) {
  const [taskOpen, setTaskOpen] = useState(initialAction === "task");
  const [notificationOpen, setNotificationOpen] = useState(initialAction === "notify");
  const [warningOpen, setWarningOpen] = useState(initialAction === "warning");
  const [sanctionOpen, setSanctionOpen] = useState(initialAction === "sanction");
  const initialStatusIntent = getInitialTeacherStatus(initialAction, initialStatus);
  const [statusOpen, setStatusOpen] = useState(Boolean(initialStatusIntent) || initialAction === "suspend" || initialAction === "status");
  const [loading, setLoading] = useState<string | null>(null);
  const router = useRouter();

  async function post(url: string, body: Record<string, unknown>, loadingKey: string, method = "POST") {
    setLoading(loadingKey);
    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Action impossible");
      toast.success("Action enregistrée");
      setTaskOpen(false);
      setNotificationOpen(false);
      setWarningOpen(false);
      setSanctionOpen(false);
      setStatusOpen(false);
      router.refresh();
    } catch (error: any) {
      toast.error(error.message || "Erreur réseau");
    } finally {
      setLoading(null);
    }
  }

  return (
    <>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={() => setTaskOpen(true)}>
          <ClipboardList className="mr-2 h-4 w-4" /> Créer tâche
        </Button>
        <Button variant="outline" onClick={() => setNotificationOpen(true)}>
          <Bell className="mr-2 h-4 w-4" /> Notifier
        </Button>
        <Button variant="outline" onClick={() => setWarningOpen(true)} className="border-amber-200 text-amber-800 hover:bg-amber-50">
          <Siren className="mr-2 h-4 w-4" /> Avertir
        </Button>
        <Button variant="outline" onClick={() => setSanctionOpen(true)} className="border-red-200 text-red-700 hover:bg-red-50">
          <ShieldAlert className="mr-2 h-4 w-4" /> Sanctionner
        </Button>
        <Button variant="outline" onClick={() => setStatusOpen(true)} disabled={!!loading} className="border-red-200 text-red-700 hover:bg-red-50">
          <UserX className="mr-2 h-4 w-4" />
          Statut / suspendre
        </Button>
      </div>

      <TeacherTaskModal
        open={taskOpen}
        onOpenChange={setTaskOpen}
        teacherId={teacherId}
        bookings={bookings}
        loading={loading === "task"}
        onSubmit={(body) => post("/api/admin/teacher-tasks", body, "task")}
      />
      <TeacherNotificationModal
        open={notificationOpen}
        onOpenChange={setNotificationOpen}
        teacherId={teacherId}
        teacherName={teacherName}
        teacherPhone={teacherPhone}
        bookings={bookings}
        loading={loading === "notification"}
        onSubmit={(body) => post("/api/admin/teacher-notifications", body, "notification")}
      />
      <TeacherWarningModal
        open={warningOpen}
        onOpenChange={setWarningOpen}
        teacherId={teacherId}
        bookings={bookings}
        loading={loading === "warning"}
        onSubmit={(body) => post("/api/admin/teacher-warnings", body, "warning")}
      />
      <TeacherSanctionModal
        open={sanctionOpen}
        onOpenChange={setSanctionOpen}
        teacherId={teacherId}
        bookings={bookings}
        loading={loading === "sanction"}
        onSubmit={(body) => post("/api/admin/teacher-sanctions", body, "sanction")}
      />
      <TeacherStatusModal
        open={statusOpen}
        onOpenChange={setStatusOpen}
        teacherName={teacherName}
        bookingsCount={bookings.length}
        initialStatus={initialStatusIntent}
        loading={loading === "status"}
        onSubmit={(body) => post(`/api/admin/teachers/${teacherId}`, body, "status", "PATCH")}
      />
    </>
  );
}

function BookingSelect({ bookings, value, onValueChange }: { bookings: BookingOption[]; value: string; onValueChange: (value: string) => void }) {
  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger><SelectValue placeholder="Réservation liée (optionnel)" /></SelectTrigger>
      <SelectContent>
        <SelectItem value="none">Aucune réservation</SelectItem>
        {bookings.map((booking) => (
          <SelectItem key={booking.id} value={booking.id}>
            {booking.reference} - {booking.subjectName} {booking.levelName}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function TeacherTaskModal({ open, onOpenChange, teacherId, bookings, loading, onSubmit }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  teacherId: string;
  bookings: BookingOption[];
  loading: boolean;
  onSubmit: (body: Record<string, unknown>) => void;
}) {
  const [bookingId, setBookingId] = useState("none");
  const [type, setType] = useState("CONFIRM_AVAILABILITY");
  const [priority, setPriority] = useState("IMPORTANT");
  const [title, setTitle] = useState("Confirmer la disponibilité");
  const [description, setDescription] = useState("Merci de confirmer rapidement votre disponibilité pour ce cours.");
  const [dueAt, setDueAt] = useState("");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Créer une tâche professeur</DialogTitle>
          <DialogDescription>La tâche sera visible dans la fiche opérationnelle et pourra être notifiée au professeur.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <BookingSelect bookings={bookings} value={bookingId} onValueChange={setBookingId} />
          <div className="grid gap-3 sm:grid-cols-2">
            <FieldSelect label="Type" value={type} onValueChange={setType} items={taskTypes} />
            <FieldSelect label="Priorité" value={priority} onValueChange={setPriority} items={priorities} />
          </div>
          <Field label="Titre" value={title} onChange={setTitle} />
          <TextField label="Description" value={description} onChange={setDescription} />
          <Field label="Échéance" type="datetime-local" value={dueAt} onChange={setDueAt} />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Annuler</Button>
          <Button disabled={loading} onClick={() => onSubmit({ teacherId, bookingId: bookingId === "none" ? null : bookingId, type, priority, title, description, dueAt })}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Créer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function TeacherNotificationModal({ open, onOpenChange, teacherId, teacherName, teacherPhone, bookings, loading, onSubmit }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  teacherId: string;
  teacherName: string;
  teacherPhone?: string | null;
  bookings: BookingOption[];
  loading: boolean;
  onSubmit: (body: Record<string, unknown>) => void;
}) {
  const [bookingId, setBookingId] = useState("none");
  const [channel, setChannel] = useState("WHATSAPP");
  const [message, setMessage] = useState("");
  const [callOutcome, setCallOutcome] = useState("REACHED");
  const [callDuration, setCallDuration] = useState("");
  const [callNote, setCallNote] = useState("");
  const selectedBooking = useMemo(() => bookings.find((b) => b.id === bookingId), [bookingId, bookings]);
  const defaultMessage = selectedBooking
    ? `Bonjour ${teacherName}, vous avez une nouvelle tâche liée au cours ${selectedBooking.subjectName} (${selectedBooking.levelName}). Merci de confirmer rapidement.`
    : `Bonjour ${teacherName}, le service client Compétence vous contacte concernant vos missions en cours. Merci de répondre rapidement.`;
  const isManualCall = channel === "MANUAL_CALL";
  const callOutcomeLabel = callOutcomes.find((item) => item.value === callOutcome)?.label ?? callOutcome;
  const callMessage = [
    `Appel manuel enregistré par le service client Compétence.`,
    selectedBooking ? `Réservation : ${selectedBooking.reference} - ${selectedBooking.subjectName} (${selectedBooking.levelName})` : "",
    `Professeur : ${teacherName}`,
    `Résultat : ${callOutcomeLabel}`,
    callDuration ? `Durée estimée : ${callDuration} minute(s)` : "",
    "",
    callNote.trim() ? `Compte rendu : ${callNote.trim()}` : message.trim() || defaultMessage,
  ].filter(Boolean).join("\n");
  const effectiveMessage = isManualCall ? callMessage : message || defaultMessage;
  const noteTooLong = callNote.trim().length > 700;
  const durationInvalid = callDuration.trim().length > 0 && (!Number.isFinite(Number(callDuration)) || Number(callDuration) < 0 || Number(callDuration) > 180);
  const canSubmit = !loading && !noteTooLong && !durationInvalid;
  const whatsAppUrl = !isManualCall ? buildWhatsAppUrl(teacherPhone, effectiveMessage) : "";

  const copyEffectiveMessage = async () => {
    await navigator.clipboard.writeText(effectiveMessage);
    toast.success(isManualCall ? "Compte rendu d'appel copié." : "Message professeur copié.");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Notifier le professeur</DialogTitle>
          <DialogDescription>SMS, WhatsApp, email, appel manuel, notification interne ou lien sécurisé. Chaque contact est historisé.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <BookingSelect bookings={bookings} value={bookingId} onValueChange={setBookingId} />
          <FieldSelect label="Canal" value={channel} onValueChange={setChannel} items={channels} />
          {isManualCall ? (
            <div className="rounded-lg border border-violet-100 bg-violet-50/45 p-4">
              <div className="grid gap-3 sm:grid-cols-[1fr_160px]">
                <FieldSelect label="Résultat de l'appel" value={callOutcome} onValueChange={setCallOutcome} items={callOutcomes} />
                <Field label="Durée estimée (min)" type="number" value={callDuration} onChange={setCallDuration} />
              </div>
              <div className="mt-3">
                <TextField label="Compte rendu d'appel" value={callNote} onChange={setCallNote} rows={4} />
                <p className={noteTooLong || durationInvalid ? "mt-1 text-xs font-medium text-red-700" : "mt-1 text-xs text-muted-foreground"}>
                  {callNote.trim().length}/700 caractères. {durationInvalid ? "Durée invalide." : "L'appel sera enregistré dans l'historique professeur."}
                </p>
              </div>
            </div>
          ) : (
            <TextField label="Message" value={message || defaultMessage} onChange={setMessage} rows={6} />
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Annuler</Button>
          <Button type="button" variant="outline" onClick={copyEffectiveMessage} disabled={!canSubmit}>
            <ClipboardCopy className="mr-2 h-4 w-4" />
            Copier
          </Button>
          {!isManualCall && (
            whatsAppUrl ? (
              <Button asChild type="button" variant="outline">
                <a href={whatsAppUrl} target="_blank" rel="noreferrer">
                  <MessageCircle className="mr-2 h-4 w-4" />
                  WhatsApp
                </a>
              </Button>
            ) : (
              <Button type="button" variant="outline" disabled>
                <MessageCircle className="mr-2 h-4 w-4" />
                WhatsApp indisponible
              </Button>
            )
          )}
          <Button disabled={!canSubmit} onClick={() => onSubmit({ teacherId, bookingId: bookingId === "none" ? null : bookingId, channel, title: isManualCall ? `Appel manuel - ${callOutcomeLabel}` : "Notification opérationnelle", message: effectiveMessage })}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isManualCall ? "Enregistrer l'appel" : "Envoyer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function TeacherWarningModal({ open, onOpenChange, teacherId, bookings, loading, onSubmit }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  teacherId: string;
  bookings: BookingOption[];
  loading: boolean;
  onSubmit: (body: Record<string, unknown>) => void;
}) {
  const [bookingId, setBookingId] = useState("none");
  const [level, setLevel] = useState("OFFICIAL_WARNING");
  const [reason, setReason] = useState("LATE_TO_COURSE");
  const [description, setDescription] = useState("");
  const [evidenceUrl, setEvidenceUrl] = useState("");
  const [requestedAction, setRequestedAction] = useState("Répondre au service client et confirmer les mesures correctives.");
  const [responseDueAt, setResponseDueAt] = useState("");
  const [visibility, setVisibility] = useState("send");
  const descriptionInvalid = description.trim().length > 0 && description.trim().length < 10;
  const descriptionTooLong = description.trim().length > 2000;
  const requestedActionTooLong = requestedAction.trim().length > 700;
  const evidenceTooLong = evidenceUrl.trim().length > 500;
  const canSubmitWarning = !loading && description.trim().length >= 10 && !descriptionTooLong && !requestedActionTooLong && !evidenceTooLong;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Envoyer un avertissement</DialogTitle>
          <DialogDescription>L’avertissement est enregistré, impacte le score qualité et peut être envoyé au professeur.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <BookingSelect bookings={bookings} value={bookingId} onValueChange={setBookingId} />
          <div className="grid gap-3 sm:grid-cols-2">
            <FieldSelect label="Niveau" value={level} onValueChange={setLevel} items={warningLevels} />
            <FieldSelect label="Motif" value={reason} onValueChange={setReason} items={warningReasons} />
          </div>
          <TextField label="Description détaillée" value={description} onChange={setDescription} />
          <p className={descriptionInvalid || descriptionTooLong ? "text-xs font-medium text-red-700" : "text-xs text-muted-foreground"}>
            {description.trim().length}/2000 caractères. Minimum 10 caractères.
          </p>
          <TextField label="Action demandée" value={requestedAction} onChange={setRequestedAction} />
          <p className={requestedActionTooLong ? "text-xs font-medium text-red-700" : "text-xs text-muted-foreground"}>
            {requestedAction.trim().length}/700 caractères.
          </p>
          <Field label="Preuve ou document (URL optionnelle)" value={evidenceUrl} onChange={setEvidenceUrl} />
          <p className={evidenceTooLong ? "text-xs font-medium text-red-700" : "text-xs text-muted-foreground"}>
            {evidenceUrl.trim().length}/500 caractères.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Délai de réponse" type="datetime-local" value={responseDueAt} onChange={setResponseDueAt} />
            <FieldSelect
              label="Visibilité"
              value={visibility}
              onValueChange={setVisibility}
              items={[
                { value: "send", label: "Envoyer au professeur" },
                { value: "admin", label: "Note interne service client seulement" },
              ]}
            />
          </div>
          {visibility === "admin" && (
            <div className="rounded-lg border border-amber-100 bg-amber-50/80 p-3 text-sm text-amber-900">
              L'avertissement impacte le score qualité, mais aucune notification professeur ne sera créée.
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Annuler</Button>
          <Button
            disabled={!canSubmitWarning}
            onClick={() => onSubmit({
              teacherId,
              bookingId: bookingId === "none" ? null : bookingId,
              level,
              reason,
              description: description.trim(),
              evidenceUrl: evidenceUrl.trim() || null,
              requestedAction: requestedAction.trim(),
              responseDueAt,
              adminOnly: visibility === "admin",
            })}
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Envoyer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function TeacherSanctionModal({ open, onOpenChange, teacherId, bookings, loading, onSubmit }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  teacherId: string;
  bookings: BookingOption[];
  loading: boolean;
  onSubmit: (body: Record<string, unknown>) => void;
}) {
  const [bookingId, setBookingId] = useState("none");
  const [type, setType] = useState("MEDIUM");
  const [reason, setReason] = useState("Non-respect des règles opérationnelles");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("0");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Appliquer une sanction</DialogTitle>
          <DialogDescription>Les sanctions financières restent en attente de validation manuelle.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <BookingSelect bookings={bookings} value={bookingId} onValueChange={setBookingId} />
          <FieldSelect label="Type" value={type} onValueChange={setType} items={sanctionTypes} />
          <Field label="Motif" value={reason} onChange={setReason} />
          <TextField label="Description" value={description} onChange={setDescription} />
          {type === "FINANCIAL" && <Field label="Montant retenu (FCFA)" type="number" value={amount} onChange={setAmount} />}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Annuler</Button>
          <Button disabled={loading} onClick={() => onSubmit({ teacherId, bookingId: bookingId === "none" ? null : bookingId, type, reason, description, amount: Number(amount) || 0 })}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Enregistrer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function TeacherStatusModal({ open, onOpenChange, teacherName, bookingsCount, initialStatus, loading, onSubmit }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  teacherName: string;
  bookingsCount: number;
  initialStatus?: string | null;
  loading: boolean;
  onSubmit: (body: Record<string, unknown>) => void;
}) {
  const normalizedInitialStatus = teacherStatuses.some((item) => item.value === initialStatus) ? initialStatus : "TEMPORARILY_SUSPENDED";
  const [status, setStatus] = useState(normalizedInitialStatus ?? "TEMPORARILY_SUSPENDED");
  const [reason, setReason] = useState(getDefaultStatusReason(normalizedInitialStatus ?? "TEMPORARILY_SUSPENDED"));
  const [notifyTeacher, setNotifyTeacher] = useState("yes");
  const restrictive = ["SUSPENDED", "TEMPORARILY_SUSPENDED", "PERMANENTLY_SUSPENDED", "BLACKLISTED", "INACTIVE"].includes(status);
  const selectedPolicy = teacherStatusPolicies[status] ?? teacherStatusPolicies.ACTIVE;
  const reasonLength = reason.trim().length;
  const reasonInvalid = reasonLength < 10 || reasonLength > 700;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Changer le statut de {teacherName}</DialogTitle>
          <DialogDescription>
            Le changement sera journalisé. En cas de statut bloquant, les réservations actives génèrent des tâches critiques de vérification/remplacement.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <FieldSelect label="Nouveau statut" value={status} onValueChange={setStatus} items={teacherStatuses} />
          <TextField label="Motif service client" value={reason} onChange={setReason} rows={4} />
          <p className={reasonInvalid ? "text-xs font-medium text-red-700" : "text-xs text-muted-foreground"}>
            {reasonLength}/700 caractères. Minimum 10 caractères pour conserver une décision exploitable.
          </p>
          <div className={`rounded-lg border p-4 text-sm ${selectedPolicy.className}`}>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="font-black">{selectedPolicy.title}</p>
                <p className="mt-1 opacity-80">{selectedPolicy.description}</p>
              </div>
              <span className="w-fit rounded-full border border-current/20 bg-white px-2.5 py-1 text-xs font-bold">
                {bookingsCount} réservation(s) suivie(s)
              </span>
            </div>
            <ul className="mt-3 grid gap-1.5 text-xs font-medium opacity-85 sm:grid-cols-2">
              {selectedPolicy.effects.map((effect) => (
                <li key={effect} className="flex gap-2">
                  <span aria-hidden="true">•</span>
                  <span>{effect}</span>
                </li>
              ))}
            </ul>
          </div>
          <FieldSelect
            label="Notification professeur"
            value={notifyTeacher}
            onValueChange={setNotifyTeacher}
            items={[
              { value: "yes", label: "Notifier et historiser" },
              { value: "no", label: "Ne pas notifier" },
            ]}
          />
          {restrictive && (
            <div className="rounded-lg border border-red-100 bg-red-50/80 p-3 text-sm font-medium text-red-800">
              Ce statut retire le professeur du flux normal. Vérifiez ses réservations actives et préparez un remplacement si nécessaire.
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Annuler</Button>
          <Button
            disabled={loading || reasonInvalid}
            className={restrictive ? "bg-red-700 hover:bg-red-800" : undefined}
            onClick={() => onSubmit({ status, statusChangeReason: reason, notifyTeacherOnStatusChange: notifyTeacher === "yes" })}
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Appliquer le statut
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (value: string) => void; type?: string }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Input type={type} value={value} onChange={(event) => onChange(event.target.value)} />
    </div>
  );
}

function TextField({ label, value, onChange, rows = 4 }: { label: string; value: string; onChange: (value: string) => void; rows?: number }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Textarea rows={rows} value={value} onChange={(event) => onChange(event.target.value)} />
    </div>
  );
}

function FieldSelect({ label, value, onValueChange, items }: { label: string; value: string; onValueChange: (value: string) => void; items: { value: string; label: string }[] }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Select value={value} onValueChange={onValueChange}>
        <SelectTrigger><SelectValue /></SelectTrigger>
        <SelectContent>
          {items.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );
}

const taskTypes = [
  { value: "CONTACT_CLIENT", label: "Contacter le client" },
  { value: "CONFIRM_AVAILABILITY", label: "Confirmer disponibilité" },
  { value: "GO_TO_COURSE", label: "Se rendre au cours" },
  { value: "SEND_ONLINE_LINK", label: "Envoyer lien en ligne" },
  { value: "TEACH_COURSE", label: "Faire le cours" },
  { value: "REPORT_COURSE_DONE", label: "Signaler cours terminé" },
  { value: "JUSTIFY_DELAY", label: "Justifier un retard" },
  { value: "ANSWER_DISPUTE", label: "Répondre à un litige" },
  { value: "SEND_DOCUMENT", label: "Envoyer un document" },
  { value: "CONTACT_ADMIN", label: "Contacter le service client" },
];

const priorities = [
  { value: "NORMAL", label: "Normale" },
  { value: "IMPORTANT", label: "Importante" },
  { value: "URGENT", label: "Urgente" },
  { value: "CRITICAL", label: "Critique" },
];

const channels = [
  { value: "SMS", label: "SMS" },
  { value: "WHATSAPP", label: "WhatsApp" },
  { value: "EMAIL", label: "Email" },
  { value: "MANUAL_CALL", label: "Appel manuel" },
  { value: "INTERNAL", label: "Notification interne" },
  { value: "PRIVATE_LINK", label: "Lien privé sécurisé" },
];

const callOutcomes = [
  { value: "REACHED", label: "Professeur joint" },
  { value: "NO_ANSWER", label: "Pas de réponse" },
  { value: "CALL_BACK", label: "Doit rappeler" },
  { value: "CONFIRMED", label: "Disponibilité confirmée" },
  { value: "UNAVAILABLE", label: "Indisponible" },
  { value: "WRONG_NUMBER", label: "Numéro incorrect" },
];

const warningLevels = [
  { value: "SIMPLE_REMINDER", label: "Niveau 1 - Rappel simple" },
  { value: "OFFICIAL_WARNING", label: "Niveau 2 - Avertissement officiel" },
  { value: "FINAL_WARNING", label: "Niveau 3 - Dernier avertissement" },
  { value: "SUSPENSION_WARNING", label: "Niveau 4 - Suspension" },
];

const warningReasons = [
  { value: "LATE_TO_COURSE", label: "Retard au cours" },
  { value: "UNJUSTIFIED_ABSENCE", label: "Absence non justifiée" },
  { value: "POOR_COURSE_QUALITY", label: "Mauvaise qualité de cours" },
  { value: "BAD_CLIENT_COMMUNICATION", label: "Mauvaise communication" },
  { value: "SCHEDULE_NOT_RESPECTED", label: "Horaires non respectés" },
  { value: "REPEATED_CANCELLATION", label: "Annulation répétée" },
  { value: "DIRECT_CONTACT_OUTSIDE_PLATFORM", label: "Contact hors plateforme" },
  { value: "UNPROFESSIONAL_BEHAVIOR", label: "Comportement non professionnel" },
  { value: "CLIENT_COMPLAINT", label: "Plainte client" },
  { value: "UNJUSTIFIED_REFUSAL", label: "Refus injustifié" },
  { value: "LACK_OF_AVAILABILITY", label: "Manque de disponibilité" },
  { value: "ADMIN_INSTRUCTIONS_NOT_RESPECTED", label: "Consignes non respectées" },
  { value: "OTHER", label: "Autre" },
];

const sanctionTypes = [
  { value: "LIGHT", label: "Sanction légère" },
  { value: "MEDIUM", label: "Sanction moyenne" },
  { value: "FINANCIAL", label: "Sanction financière" },
  { value: "STRONG", label: "Sanction forte" },
];

const teacherStatuses = [
  { value: "ACTIVE", label: "Actif" },
  { value: "INACTIVE", label: "Inactif" },
  { value: "PENDING", label: "En attente" },
  { value: "OBSERVATION", label: "En observation" },
  { value: "REPLACEABLE", label: "Remplaçable" },
  { value: "PRIORITY", label: "Prioritaire" },
  { value: "TEMPORARILY_SUSPENDED", label: "Suspendu temporairement" },
  { value: "PERMANENTLY_SUSPENDED", label: "Suspendu définitivement" },
  { value: "SUSPENDED", label: "Suspendu" },
  { value: "BLACKLISTED", label: "Blacklisté" },
];

function getInitialTeacherStatus(initialAction?: string, initialStatus?: string) {
  if (teacherStatuses.some((item) => item.value === initialStatus)) return initialStatus;
  if (initialAction === "block" || initialAction === "blacklist") return "BLACKLISTED";
  if (initialAction === "reactivate") return "ACTIVE";
  if (initialAction === "observe") return "OBSERVATION";
  if (initialAction === "replaceable") return "REPLACEABLE";
  if (initialAction === "suspend") return "TEMPORARILY_SUSPENDED";
  return null;
}

function getDefaultStatusReason(status: string) {
  const reasons: Record<string, string> = {
    ACTIVE: "Réactivation après contrôle du dossier professeur.",
    OBSERVATION: "Mise en observation qualité décidée par le service client.",
    REPLACEABLE: "Statut remplaçable appliqué pour anticiper les missions sensibles.",
    TEMPORARILY_SUSPENDED: "Suspension temporaire décidée pour contrôle opérationnel.",
    PERMANENTLY_SUSPENDED: "Suspension définitive décidée par le service client.",
    SUSPENDED: "Suspension décidée par le service client.",
    BLACKLISTED: "Blocage interne critique décidé par le service client.",
    INACTIVE: "Désactivation du profil professeur.",
    PENDING: "Profil remis en attente de vérification par le service client.",
  };
  return reasons[status] ?? "Décision opérationnelle du service client.";
}

const teacherStatusPolicies: Record<string, {
  title: string;
  description: string;
  effects: string[];
  className: string;
}> = {
  ACTIVE: {
    title: "Profil exploitable",
    description: "Le professeur peut apparaître côté client et recevoir de nouvelles missions.",
    effects: ["Visible publiquement si ses autres critères sont valides", "Peut recevoir de nouvelles réservations"],
    className: "border-blue-100 bg-blue-50/80 text-blue-950",
  },
  INACTIVE: {
    title: "Profil retiré du flux",
    description: "Le professeur est désactivé sans être marqué comme faute grave.",
    effects: ["Retiré des nouvelles attributions", "Réservations existantes à contrôler"],
    className: "border-slate-200 bg-slate-50 text-slate-800",
  },
  PENDING: {
    title: "Profil à valider",
    description: "Le professeur reste en attente de vérification par le service client.",
    effects: ["Non prioritaire pour les attributions", "Contrôle identité, matières, disponibilités et photo"],
    className: "border-amber-100 bg-amber-50/80 text-amber-950",
  },
  OBSERVATION: {
    title: "Surveillance qualité",
    description: "Le professeur reste utilisable mais doit être suivi avec attention.",
    effects: ["Notification service client de suivi", "À surveiller sur retards, avis, litiges et confirmations"],
    className: "border-amber-100 bg-amber-50/80 text-amber-950",
  },
  REPLACEABLE: {
    title: "Remplacement à anticiper",
    description: "Le professeur peut rester sur certains dossiers, mais le service client doit préparer des alternatives.",
    effects: ["Réservations à ouvrir avec prudence", "Remplaçants compatibles à vérifier avant le cours"],
    className: "border-violet-100 bg-violet-50/80 text-violet-950",
  },
  PRIORITY: {
    title: "Profil prioritaire",
    description: "Le professeur est considéré comme fiable et prioritaire dans l'exploitation.",
    effects: ["Peut être favorisé dans les suggestions", "À privilégier pour missions sensibles ou urgentes"],
    className: "border-blue-100 bg-blue-50/80 text-blue-950",
  },
  TEMPORARILY_SUSPENDED: {
    title: "Suspension temporaire",
    description: "Le professeur sort du flux normal jusqu'à décision du service client.",
    effects: ["Nouvelles attributions bloquées", "Tâches critiques créées pour vérifier/remplacer les cours actifs"],
    className: "border-red-100 bg-red-50/85 text-red-900",
  },
  PERMANENTLY_SUSPENDED: {
    title: "Suspension définitive",
    description: "Le professeur doit être retiré durablement du circuit opérationnel.",
    effects: ["Remplacement des missions à venir", "Historique conservé pour audit qualité"],
    className: "border-red-100 bg-red-50/85 text-red-900",
  },
  SUSPENDED: {
    title: "Suspension",
    description: "Le professeur ne doit plus recevoir de mission tant que le statut n'est pas rétabli.",
    effects: ["Profil retiré côté client", "Réservations actives signalées au service client"],
    className: "border-red-100 bg-red-50/85 text-red-900",
  },
  BLACKLISTED: {
    title: "Blacklist interne",
    description: "Décision critique : le professeur est retiré du circuit et doit être traité comme risque élevé.",
    effects: ["Blocage fort des attributions", "Contrôle immédiat des paiements, litiges et réservations"],
    className: "border-slate-900 bg-slate-950 text-white",
  },
};
