"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Bell,
  ClipboardCopy,
  Loader2,
  Mail,
  MessageCircle,
  MessageSquareText,
  Send,
  Smartphone,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ProfessorImage } from "@/components/shared/professor-image";
import { formatDate, formatDateTime, formatFCFA } from "@/lib/format";
import { buildWhatsAppUrl } from "@/lib/phone";
import { notificationDeliveryStatusLabel, priorityLabel } from "@/lib/platform-labels";

type BookingCommunicationContext = {
  id: string;
  reference: string;
  subjectName: string;
  levelName: string;
  courseFormat: string;
  totalPrice: number;
  paymentStatus: string;
  status: string;
  preferredTime: string;
  scheduledDate?: string | null;
  scheduledTime?: string | null;
  client: {
    id: string;
    name: string;
    phone?: string | null;
    email: string;
  };
  teacher: {
    id: string;
    fullName: string;
    professionalName?: string | null;
    photoUrl?: string | null;
    badgeVerified?: boolean;
  };
};

type ClientCommunicationHistoryItem = {
  id: string;
  type: string;
  channel: string;
  subject: string;
  content: string;
  priority: string;
  status: string;
  createdAt: string;
  sentBy?: { name: string } | null;
};

const messageTypes = [
  { value: "INFORMATION", label: "Information" },
  { value: "REMINDER", label: "Rappel" },
  { value: "WARNING", label: "Avertissement" },
  { value: "TEACHER_CHANGE", label: "Changement professeur" },
  { value: "RESCHEDULE", label: "Report" },
  { value: "PAYMENT", label: "Paiement" },
  { value: "DISPUTE", label: "Litige" },
  { value: "COURSE_CONFIRMATION", label: "Confirmation cours" },
] as const;

const channels = [
  { value: "INTERNAL", label: "Dashboard client", icon: Bell },
  { value: "WHATSAPP", label: "WhatsApp", icon: MessageCircle },
  { value: "SMS", label: "SMS", icon: Smartphone },
  { value: "EMAIL", label: "Email", icon: Mail },
] as const;

const priorities = [
  { value: "NORMAL", label: "Normale" },
  { value: "IMPORTANT", label: "Importante" },
  { value: "URGENT", label: "Urgente" },
  { value: "CRITICAL", label: "Critique" },
] as const;

function channelLabel(channel: string) {
  return channels.find((item) => item.value === channel)?.label ?? channel;
}

function typeLabel(type: string) {
  return messageTypes.find((item) => item.value === type)?.label ?? type;
}

function priorityClass(priority: string) {
  if (priority === "CRITICAL") return "border-red-200 bg-red-50 text-red-700";
  if (priority === "URGENT") return "border-orange-200 bg-orange-50 text-orange-700";
  if (priority === "IMPORTANT") return "border-amber-200 bg-amber-50 text-amber-800";
  return "border-blue-200 bg-blue-50 text-blue-700";
}

function buildSubject(type: string, booking: BookingCommunicationContext) {
  const map: Record<string, string> = {
    INFORMATION: `Information - réservation ${booking.reference}`,
    REMINDER: `Rappel - cours ${booking.subjectName}`,
    WARNING: `Avertissement - réservation ${booking.reference}`,
    TEACHER_CHANGE: `Changement de professeur - ${booking.reference}`,
    RESCHEDULE: `Report de cours - ${booking.reference}`,
    PAYMENT: `Paiement sécurisé - ${booking.reference}`,
    DISPUTE: `Suivi de litige - ${booking.reference}`,
    COURSE_CONFIRMATION: `Confirmation du cours - ${booking.reference}`,
  };
  return map[type] ?? `Message - ${booking.reference}`;
}

function buildMessage(type: string, booking: BookingCommunicationContext) {
  const teacherName = booking.teacher.professionalName || booking.teacher.fullName;
  const dateLabel = booking.scheduledDate ? formatDate(booking.scheduledDate) : "à confirmer";
  const timeLabel = booking.scheduledTime || booking.preferredTime || "à confirmer";
  const formatLabel = booking.courseFormat === "ONLINE" ? "en ligne" : "à domicile";
  const common = [
    `Réservation : ${booking.reference}`,
    `Matière : ${booking.subjectName}`,
    `Niveau : ${booking.levelName}`,
    `Professeur : ${teacherName}`,
    `Date : ${dateLabel}`,
    `Heure : ${timeLabel}`,
    `Format : ${formatLabel}`,
  ];

  if (type === "REMINDER") {
    return [
      `Bonjour ${booking.client.name},`,
      "",
      "Petit rappel concernant votre cours prévu sur Compétence.",
      "",
      ...common,
      "",
      "Votre paiement reste sécurisé jusqu'à la confirmation du cours.",
    ].join("\n");
  }
  if (type === "TEACHER_CHANGE") {
    return [
      `Bonjour ${booking.client.name},`,
      "",
      `Nous vous informons qu'une mise à jour est en cours concernant le professeur de votre réservation ${booking.reference}.`,
      "",
      ...common,
      "",
      "Votre réservation reste suivie par l'administration et votre paiement reste sécurisé.",
    ].join("\n");
  }
  if (type === "PAYMENT") {
    return [
      `Bonjour ${booking.client.name},`,
      "",
      `Votre paiement de ${formatFCFA(booking.totalPrice)} pour la réservation ${booking.reference} est bien suivi par Compétence.`,
      "",
      "Les fonds restent sécurisés jusqu'à la confirmation du cours.",
      "",
      ...common,
    ].join("\n");
  }
  if (type === "COURSE_CONFIRMATION") {
    return [
      `Bonjour ${booking.client.name},`,
      "",
      "Merci de confirmer après le cours si la séance a bien été réalisée.",
      "",
      ...common,
      "",
      "Votre confirmation permet à l'administration de finaliser le suivi et le paiement du professeur.",
    ].join("\n");
  }
  if (type === "DISPUTE") {
    return [
      `Bonjour ${booking.client.name},`,
      "",
      `Nous suivons votre dossier lié à la réservation ${booking.reference}.`,
      "",
      ...common,
      "",
      "L'administration vous recontactera avec une décision ou une demande d'information complémentaire.",
    ].join("\n");
  }
  if (type === "RESCHEDULE") {
    return [
      `Bonjour ${booking.client.name},`,
      "",
      `Un report est en cours d'organisation pour votre réservation ${booking.reference}.`,
      "",
      ...common,
      "",
      "Nous vous confirmerons le nouveau créneau dès validation.",
    ].join("\n");
  }
  if (type === "WARNING") {
    return [
      `Bonjour ${booking.client.name},`,
      "",
      `Nous avons besoin de votre retour concernant la réservation ${booking.reference}.`,
      "",
      ...common,
      "",
      "Merci de répondre rapidement afin que l'administration puisse traiter le dossier correctement.",
    ].join("\n");
  }
  return [
    `Bonjour ${booking.client.name},`,
    "",
    `Nous vous contactons au sujet de votre réservation ${booking.reference}.`,
    "",
    ...common,
    "",
    "L'équipe Compétence reste disponible pour vous accompagner.",
  ].join("\n");
}

export function ClientCommunicationClient({
  booking,
  communications,
}: {
  booking: BookingCommunicationContext;
  communications: ClientCommunicationHistoryItem[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [type, setType] = useState("INFORMATION");
  const [channel, setChannel] = useState("INTERNAL");
  const [priority, setPriority] = useState("IMPORTANT");
  const [subject, setSubject] = useState("");
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);

  const generatedSubject = useMemo(() => buildSubject(type, booking), [type, booking]);
  const generatedContent = useMemo(() => buildMessage(type, booking), [type, booking]);
  const effectiveSubject = subject.trim() || generatedSubject;
  const effectiveContent = content.trim() || generatedContent;
  const whatsAppUrl = buildWhatsAppUrl(booking.client.phone, effectiveContent);
  const subjectTooLong = effectiveSubject.length > 180;
  const contentTooLong = effectiveContent.length > 4000;

  const useTemplate = () => {
    setSubject(generatedSubject);
    setContent(generatedContent);
  };

  const copyMessage = async () => {
    await navigator.clipboard.writeText(effectiveContent);
    toast.success("Message client copié.");
  };

  const copyHistoryMessage = async (message: string) => {
    await navigator.clipboard.writeText(message);
    toast.success("Message historique copié.");
  };

  const sendMessage = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/client-communications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: booking.client.id,
          bookingId: booking.id,
          type,
          channel,
          priority,
          subject: effectiveSubject,
          content: effectiveContent,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Envoi impossible.");
      toast.success("Message client envoyé et historisé.");
      setOpen(false);
      setSubject("");
      setContent("");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Envoi impossible.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="border-violet-100">
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <CardTitle className="text-base">Communication client</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            Envoyer, copier et historiser les messages liés à cette réservation.
          </p>
        </div>
        <Button onClick={() => setOpen(true)}>
          <MessageSquareText className="mr-1.5 h-4 w-4" />
          Envoyer un message
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col gap-3 rounded-lg border border-violet-100 bg-violet-50/40 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <ProfessorImage
              photoUrl={booking.teacher.photoUrl}
              name={booking.teacher.professionalName || booking.teacher.fullName}
              size="sm"
              shape="circle"
              verified={Boolean(booking.teacher.badgeVerified)}
            />
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-foreground">
                {booking.subjectName} avec {booking.teacher.professionalName || booking.teacher.fullName}
              </p>
              <p className="text-xs text-muted-foreground">
                Client: {booking.client.name} · {booking.client.phone || "Téléphone non renseigné"}
              </p>
            </div>
          </div>
          <Badge variant="outline" className="w-fit border-blue-200 bg-blue-50 text-blue-800">
            {communications.length} message(s)
          </Badge>
        </div>

        {communications.length === 0 ? (
          <p className="rounded-lg border border-dashed border-violet-100 p-4 text-sm text-muted-foreground">
            Aucun message client historisé pour cette réservation.
          </p>
        ) : (
          <div className="space-y-3">
            {communications.map((item) => {
              const historyWhatsAppUrl = buildWhatsAppUrl(booking.client.phone, item.content);
              return (
                <div key={item.id} className="rounded-lg border border-violet-100 bg-white p-4">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-bold text-foreground">{item.subject}</p>
                        <Badge variant="outline">{typeLabel(item.type)}</Badge>
                        <Badge variant="outline" className={priorityClass(item.priority)}>{priorityLabel(item.priority)}</Badge>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {channelLabel(item.channel)} · {formatDateTime(item.createdAt)}
                        {item.sentBy?.name ? ` · envoyé par ${item.sentBy.name}` : ""}
                      </p>
                    </div>
                    <Badge variant="outline" className="w-fit border-blue-200 bg-blue-50 text-blue-700">
                      {notificationDeliveryStatusLabel(item.status)}
                    </Badge>
                  </div>
                  <p className="mt-3 whitespace-pre-line rounded-lg border border-violet-100 bg-violet-50/35 p-3 text-sm text-foreground">
                    {item.content}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button type="button" size="sm" variant="outline" onClick={() => copyHistoryMessage(item.content)} className="rounded-xl bg-white">
                      <ClipboardCopy className="mr-1.5 h-3.5 w-3.5" />
                      Copier
                    </Button>
                    {historyWhatsAppUrl ? (
                      <Button asChild size="sm" variant="outline" className="rounded-xl border-blue-100 bg-white text-blue-800 hover:bg-blue-50">
                        <a href={historyWhatsAppUrl} target="_blank" rel="noreferrer">
                          <MessageCircle className="mr-1.5 h-3.5 w-3.5" />
                          WhatsApp
                        </a>
                      </Button>
                    ) : (
                      <Button type="button" size="sm" variant="outline" disabled className="rounded-xl">
                        <MessageCircle className="mr-1.5 h-3.5 w-3.5" />
                        WhatsApp indisponible
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Envoyer un message au client</DialogTitle>
            <DialogDescription>
              Le message sera enregistré dans l'historique admin et dans les notifications du client.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label>Type</Label>
                <Select value={type} onValueChange={setType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {messageTypes.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Canal</Label>
                <Select value={channel} onValueChange={setChannel}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {channels.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Priorité</Label>
                <Select value={priority} onValueChange={setPriority}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {priorities.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Objet</Label>
              <Input value={subject || generatedSubject} onChange={(event) => setSubject(event.target.value)} />
              <p className={subjectTooLong ? "text-xs font-medium text-red-700" : "text-xs text-muted-foreground"}>
                {effectiveSubject.length}/180 caractères
              </p>
            </div>

            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Label>Contenu</Label>
                <Button type="button" variant="outline" size="sm" onClick={useTemplate}>
                  Utiliser le modèle
                </Button>
              </div>
              <Textarea
                value={content || generatedContent}
                onChange={(event) => setContent(event.target.value)}
                className="min-h-64 font-mono text-sm leading-relaxed"
              />
              <p className={contentTooLong ? "text-xs font-medium text-red-700" : "text-xs text-muted-foreground"}>
                {effectiveContent.length}/4000 caractères
              </p>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:justify-between">
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button type="button" variant="outline" onClick={copyMessage}>
                <ClipboardCopy className="mr-1.5 h-4 w-4" />
                Copier
              </Button>
              <Button type="button" variant="outline" disabled={!whatsAppUrl} asChild={Boolean(whatsAppUrl)}>
                {whatsAppUrl ? (
                  <a href={whatsAppUrl} target="_blank" rel="noreferrer">
                    <MessageCircle className="mr-1.5 h-4 w-4" />
                    WhatsApp
                  </a>
                ) : (
                  <span className="inline-flex items-center">
                    <MessageCircle className="mr-1.5 h-4 w-4" />
                    WhatsApp indisponible
                  </span>
                )}
              </Button>
            </div>
            <Button onClick={sendMessage} disabled={loading || !effectiveSubject || !effectiveContent || subjectTooLong || contentTooLong}>
              {loading ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Send className="mr-1.5 h-4 w-4" />}
              Envoyer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
