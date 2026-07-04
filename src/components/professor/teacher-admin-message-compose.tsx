"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, SendHorizontal } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type BookingOption = {
  id: string;
  reference: string;
  subjectName: string;
  levelName: string;
};

const priorities = [
  { value: "NORMAL", label: "Normale" },
  { value: "IMPORTANT", label: "Importante" },
  { value: "URGENT", label: "Urgente" },
  { value: "CRITICAL", label: "Critique" },
];

export function TeacherAdminMessageCompose({ bookings }: { bookings: BookingOption[] }) {
  const router = useRouter();
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [bookingId, setBookingId] = useState("");
  const [priority, setPriority] = useState("IMPORTANT");
  const [loading, setLoading] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (loading) return;
    if (!subject.trim() || !message.trim()) {
      toast.error("Ajoutez un sujet et un message.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/professor/admin-messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject,
          message,
          bookingId: bookingId || null,
          priority,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Message impossible à envoyer.");

      toast.success("Message envoyé à l'administration.");
      setSubject("");
      setMessage("");
      setBookingId("");
      setPriority("IMPORTANT");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erreur réseau.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-4">
      <div className="grid gap-3 md:grid-cols-[1fr_220px]">
        <div className="space-y-1.5">
          <Label htmlFor="teacher-admin-subject">Sujet</Label>
          <Input
            id="teacher-admin-subject"
            value={subject}
            onChange={(event) => setSubject(event.target.value)}
            maxLength={140}
            placeholder="Ex : précision sur une mission, paiement, indisponibilité..."
            className="min-h-12 rounded-2xl border-[#D7DEE9] bg-white"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="teacher-admin-priority">Priorité</Label>
          <select
            id="teacher-admin-priority"
            value={priority}
            onChange={(event) => setPriority(event.target.value)}
            className="min-h-12 w-full rounded-2xl border border-[#D7DEE9] bg-white px-3 text-sm font-semibold text-[#111827] shadow-sm outline-none focus:border-[#111B4D]"
          >
            {priorities.map((item) => (
              <option key={item.value} value={item.value}>{item.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="teacher-admin-booking">Mission liée</Label>
        <select
          id="teacher-admin-booking"
          value={bookingId}
          onChange={(event) => setBookingId(event.target.value)}
          className="min-h-12 w-full rounded-2xl border border-[#D7DEE9] bg-white px-3 text-sm font-semibold text-[#111827] shadow-sm outline-none focus:border-[#111B4D]"
        >
          <option value="">Aucune mission spécifique</option>
          {bookings.map((booking) => (
            <option key={booking.id} value={booking.id}>
              {booking.reference} - {booking.subjectName} - {booking.levelName}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="teacher-admin-message">Message à l'administration</Label>
        <Textarea
          id="teacher-admin-message"
          rows={5}
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          maxLength={2500}
          placeholder="Expliquez clairement la situation. L'administration verra ce message dans votre fiche professeur."
          className="rounded-2xl border-[#D7DEE9] bg-white"
        />
        <p className="text-xs font-semibold text-[#64748B]">{message.trim().length}/2500 caractères</p>
      </div>

      <Button type="submit" disabled={loading} className="min-h-12 rounded-2xl bg-[#111B4D] text-white hover:bg-[#1E2A78] sm:w-fit">
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <SendHorizontal className="h-4 w-4" />}
        Envoyer à l'administration
      </Button>
    </form>
  );
}
