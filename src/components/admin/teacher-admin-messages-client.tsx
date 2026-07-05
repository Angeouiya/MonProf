"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCheck, Loader2, Lock, MailCheck, Reply, SendHorizontal } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type BookingOption = {
  id: string;
  reference: string;
  subjectName: string;
  levelName: string;
};

export type TeacherAdminMessageItem = {
  id: string;
  teacherId: string;
  bookingId: string | null;
  sender: "TEACHER" | "ADMIN";
  subject: string;
  message: string;
  priority: string;
  status: string;
  readByAdminAt: string | null;
  readByTeacherAt: string | null;
  resolvedAt: string | null;
  createdAt: string;
  booking: BookingOption | null;
  admin: { name: string } | null;
};

const priorities = [
  { value: "NORMAL", label: "Normale" },
  { value: "IMPORTANT", label: "Importante" },
  { value: "URGENT", label: "Urgente" },
  { value: "CRITICAL", label: "Critique" },
];

const statusLabel: Record<string, string> = {
  OPEN: "Ouvert",
  WAITING_ADMIN: "Réponse admin attendue",
  WAITING_TEACHER: "Réponse professeur attendue",
  RESOLVED: "Résolu",
  CLOSED: "Clôturé",
};

export function TeacherAdminMessagesClient({
  teacherId,
  teacherName,
  messages,
  bookings,
  focusMessageId,
}: {
  teacherId: string;
  teacherName: string;
  messages: TeacherAdminMessageItem[];
  bookings: BookingOption[];
  focusMessageId?: string | null;
}) {
  const router = useRouter();
  const initialSelection = useMemo(() => (
    messages.find((item) => item.id === focusMessageId)
    ?? messages.find((item) => item.sender === "TEACHER" && item.status === "WAITING_ADMIN")
    ?? messages[0]
    ?? null
  ), [focusMessageId, messages]);
  const [selectedId, setSelectedId] = useState(initialSelection?.id ?? "");
  const selected = messages.find((item) => item.id === selectedId) ?? null;
  const [subject, setSubject] = useState(selected ? `Re: ${selected.subject.replace(/^Re:\s*/i, "")}` : "Message administration");
  const [message, setMessage] = useState("");
  const [bookingId, setBookingId] = useState(selected?.bookingId ?? "");
  const [priority, setPriority] = useState(selected?.priority ?? "IMPORTANT");
  const [loading, setLoading] = useState<string | null>(null);

  const unreadAdminCount = messages.filter((item) => item.sender === "TEACHER" && !item.readByAdminAt).length;
  const openCount = messages.filter((item) => !["RESOLVED", "CLOSED"].includes(item.status)).length;

  function choose(item: TeacherAdminMessageItem) {
    setSelectedId(item.id);
    setSubject(`Re: ${item.subject.replace(/^Re:\s*/i, "")}`);
    setBookingId(item.bookingId ?? "");
    setPriority(item.priority);
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (loading) return;
    if (!subject.trim() || !message.trim()) {
      toast.error("Ajoutez un sujet et une réponse.");
      return;
    }

    setLoading("send");
    try {
      const res = await fetch("/api/admin/teacher-admin-messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teacherId,
          bookingId: bookingId || selected?.bookingId || null,
          replyToId: selected?.id ?? null,
          subject,
          message,
          priority,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Réponse impossible à envoyer.");

      toast.success("Message envoyé au professeur.");
      setMessage("");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erreur réseau.");
    } finally {
      setLoading(null);
    }
  }

  async function patch(id: string, action: "read" | "resolve" | "close" | "reopen") {
    setLoading(`${action}-${id}`);
    try {
      const res = await fetch("/api/admin/teacher-admin-messages", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action, status: action === "reopen" ? "WAITING_ADMIN" : undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Action impossible.");
      toast.success("Historique mis à jour.");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erreur réseau.");
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[0.95fr_1.2fr]">
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Metric label="Messages ouverts" value={openCount} />
          <Metric label="Non lus admin" value={unreadAdminCount} />
        </div>

        <div className="rounded-[1.15rem] border border-[#E3E8F2] bg-white p-4">
          <h3 className="text-base font-semibold text-[#111827]">Répondre à {teacherName}</h3>
          <p className="mt-1 text-sm font-medium leading-6 text-[#64748B]">
            Le professeur recevra la réponse dans son espace et dans ses notifications.
          </p>

          <form onSubmit={submit} className="mt-4 grid gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="admin-teacher-message-linked">Message ciblé</Label>
              <select
                id="admin-teacher-message-linked"
                value={selectedId}
                onChange={(event) => {
                  const item = messages.find((messageItem) => messageItem.id === event.target.value);
                  if (item) choose(item);
                  else setSelectedId("");
                }}
                className="min-h-11 w-full rounded-lg border border-[#D7DEE9] bg-white px-3 text-sm font-semibold text-[#111827] outline-none focus:border-[#111B4D]"
              >
                <option value="">Nouveau message non lié</option>
                {messages.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.sender === "TEACHER" ? "Prof" : "Admin"} - {item.subject}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="admin-teacher-message-booking">Réservation liée</Label>
              <select
                id="admin-teacher-message-booking"
                value={bookingId}
                onChange={(event) => setBookingId(event.target.value)}
                className="min-h-11 w-full rounded-lg border border-[#D7DEE9] bg-white px-3 text-sm font-semibold text-[#111827] outline-none focus:border-[#111B4D]"
              >
                <option value="">Aucune réservation spécifique</option>
                {bookings.map((booking) => (
                  <option key={booking.id} value={booking.id}>
                    {booking.reference} - {booking.subjectName} - {booking.levelName}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid gap-3 md:grid-cols-[1fr_180px]">
              <div className="space-y-1.5">
                <Label htmlFor="admin-teacher-message-subject">Sujet</Label>
                <Input
                  id="admin-teacher-message-subject"
                  value={subject}
                  onChange={(event) => setSubject(event.target.value)}
                  maxLength={140}
                  className="min-h-11 rounded-lg border-[#D7DEE9] bg-white"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="admin-teacher-message-priority">Priorité</Label>
                <select
                  id="admin-teacher-message-priority"
                  value={priority}
                  onChange={(event) => setPriority(event.target.value)}
                  className="min-h-11 w-full rounded-lg border border-[#D7DEE9] bg-white px-3 text-sm font-semibold text-[#111827] outline-none focus:border-[#111B4D]"
                >
                  {priorities.map((item) => (
                    <option key={item.value} value={item.value}>{item.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="admin-teacher-message-body">Réponse admin</Label>
              <Textarea
                id="admin-teacher-message-body"
                rows={5}
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                maxLength={2500}
                placeholder="Réponse claire à transmettre au professeur..."
                className="rounded-lg border-[#D7DEE9] bg-white"
              />
              <p className="text-xs font-semibold text-[#64748B]">{message.trim().length}/2500 caractères</p>
            </div>

            <Button type="submit" disabled={!!loading} className="min-h-11 rounded-lg bg-[#111B4D] text-white hover:bg-[#1E2A78]">
              {loading === "send" ? <Loader2 className="h-4 w-4 animate-spin" /> : <SendHorizontal className="h-4 w-4" />}
              Envoyer au professeur
            </Button>
          </form>
        </div>
      </div>

      <div className="rounded-[1.15rem] border border-[#E3E8F2] bg-white p-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-base font-semibold text-[#111827]">Historique des échanges</h3>
            <p className="text-sm font-medium text-[#64748B]">Messages libres professeur/admin, avec statut et traçabilité.</p>
          </div>
          <Badge variant="outline" className="w-fit border-[#D7DEE9] bg-white text-[#111B4D]">
            {messages.length} message{messages.length > 1 ? "s" : ""}
          </Badge>
        </div>

        {messages.length === 0 ? (
          <div className="mt-4 rounded-lg border border-dashed border-[#D7DEE9] bg-white p-6 text-center text-sm font-semibold text-[#64748B]">
            Aucun message libre avec ce professeur pour le moment.
          </div>
        ) : (
          <div className="mt-4 grid gap-3">
            {messages.map((item) => (
              <article
                key={item.id}
                className={cn(
                  "rounded-[1.15rem] border bg-white p-4",
                  item.sender === "TEACHER" && !item.readByAdminAt ? "border-[#111B4D]" : "border-[#E3E8F2]",
                )}
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline" className="border-[#D7DEE9] bg-white text-[#111B4D]">
                        {item.sender === "TEACHER" ? "Professeur" : item.admin?.name || "Admin"}
                      </Badge>
                      <Badge variant="outline" className="border-[#D7DEE9] bg-white text-[#111B4D]">
                        {statusLabel[item.status] ?? item.status}
                      </Badge>
                      <Badge variant="outline" className="border-[#D7DEE9] bg-white text-[#111B4D]">
                        {priorities.find((priorityItem) => priorityItem.value === item.priority)?.label ?? item.priority}
                      </Badge>
                    </div>
                    <h4 className="mt-3 text-base font-semibold text-[#111827]">{item.subject}</h4>
                    {item.booking && (
                      <p className="mt-1 text-xs font-bold text-[#111B4D]">
                        {item.booking.reference} - {item.booking.subjectName} - {item.booking.levelName}
                      </p>
                    )}
                    <p className="mt-3 whitespace-pre-line text-sm font-medium leading-6 text-[#475569]">{item.message}</p>
                  </div>
                  <p className="shrink-0 text-xs font-semibold text-[#64748B]">
                    {new Date(item.createdAt).toLocaleString("fr-FR")}
                  </p>
                </div>

                <div className="mt-4 flex flex-wrap gap-2 border-t border-[#EEF2F7] pt-3">
                  <Button type="button" variant="outline" size="sm" className="rounded-lg bg-white" onClick={() => choose(item)}>
                    <Reply className="h-3.5 w-3.5" />
                    Répondre
                  </Button>
                  {item.sender === "TEACHER" && !item.readByAdminAt && (
                    <Button type="button" variant="outline" size="sm" className="rounded-lg bg-white" disabled={loading === `read-${item.id}`} onClick={() => patch(item.id, "read")}>
                      {loading === `read-${item.id}` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <MailCheck className="h-3.5 w-3.5" />}
                      Lu
                    </Button>
                  )}
                  {!["RESOLVED", "CLOSED"].includes(item.status) && (
                    <Button type="button" variant="outline" size="sm" className="rounded-lg bg-white" disabled={loading === `resolve-${item.id}`} onClick={() => patch(item.id, "resolve")}>
                      {loading === `resolve-${item.id}` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCheck className="h-3.5 w-3.5" />}
                      Résolu
                    </Button>
                  )}
                  {item.status !== "CLOSED" && (
                    <Button type="button" variant="outline" size="sm" className="rounded-lg bg-white" disabled={loading === `close-${item.id}`} onClick={() => patch(item.id, "close")}>
                      {loading === `close-${item.id}` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Lock className="h-3.5 w-3.5" />}
                      Clôturer
                    </Button>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-[1.15rem] border border-[#E3E8F2] bg-white p-4">
      <p className="text-xs font-bold uppercase tracking-wide text-[#64748B]">{label}</p>
      <p className="mt-2 text-2xl font-semibold tracking-normal text-[#111B4D]">{value}</p>
    </div>
  );
}
