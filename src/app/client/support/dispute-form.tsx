"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ProfessorImage } from "@/components/shared/professor-image";
import { Loader2, Send, ShieldCheck } from "lucide-react";

const DISPUTE_REASONS = [
  "Professeur absent",
  "Professeur en retard",
  "Cours non effectué",
  "Cours non conforme",
  "Problème de paiement",
  "Autre",
];

export function DisputeForm({
  bookings,
}: {
  bookings: {
    id: string;
    reference: string;
    subjectName: string;
    levelName: string;
    teacherName: string;
    teacherPhotoUrl?: string | null;
    teacherBadgeVerified?: boolean;
  }[];
}) {
  const router = useRouter();
  const [bookingId, setBookingId] = useState(bookings[0]?.id ?? "");
  const [reason, setReason] = useState(DISPUTE_REASONS[0]);
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const selectedBooking = useMemo(
    () => bookings.find((booking) => booking.id === bookingId) ?? bookings[0],
    [bookingId, bookings],
  );

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!bookingId) {
      toast.error("Veuillez sélectionner une réservation");
      return;
    }
    if (!description.trim()) {
      toast.error("Veuillez décrire le problème");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/client/disputes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookingId, reason, description: description.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Erreur");
        return;
      }
      toast.success("Litige ouvert. Notre support vous recontacte sous 24-48h.");
      setDescription("");
      router.refresh();
    } catch {
      toast.error("Erreur réseau");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="client-dispute-form space-y-3">
      <div className="rounded-xl border border-[#DDE6F7] bg-white p-3 text-sm font-medium leading-5 text-[#111B4D]">
        <div className="flex items-start gap-2">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            Le signalement protège votre paiement pendant l'analyse. Utilisez-le uniquement si le cours pose réellement problème.
          </span>
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="bookingId" className="text-sm font-semibold text-[#111827]">Réservation *</Label>
          <Select value={bookingId} onValueChange={setBookingId}>
            <SelectTrigger id="bookingId" className="mt-1.5 min-h-11 w-full max-w-full min-w-0 rounded-xl border-[#DDE6F7] bg-white"><SelectValue placeholder="Sélectionner..." /></SelectTrigger>
            <SelectContent>
              {bookings.map((b) => (
                <SelectItem key={b.id} value={b.id}>
                  {b.reference} — {b.subjectName} {b.levelName} ({b.teacherName})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="reason" className="text-sm font-semibold text-[#111827]">Motif *</Label>
          <Select value={reason} onValueChange={setReason}>
            <SelectTrigger id="reason" className="mt-1.5 min-h-11 w-full max-w-full min-w-0 rounded-xl border-[#DDE6F7] bg-white"><SelectValue /></SelectTrigger>
            <SelectContent>
              {DISPUTE_REASONS.map((r) => (
                <SelectItem key={r} value={r}>{r}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {selectedBooking && (
        <div className="flex items-center gap-3 rounded-xl border border-[#DDE6F7] bg-white p-3" data-client-support-selected-booking>
          <ProfessorImage
            photoUrl={selectedBooking.teacherPhotoUrl}
            name={selectedBooking.teacherName}
            size="md"
            shape="circle"
            verified={Boolean(selectedBooking.teacherBadgeVerified)}
          />
          <div className="min-w-0">
            <p className="break-words text-sm font-semibold text-[#111827]">{selectedBooking.teacherName}</p>
            <p className="break-words text-xs font-medium leading-5 text-[#64748B]">
              {selectedBooking.reference} · {selectedBooking.subjectName} · {selectedBooking.levelName}
            </p>
          </div>
        </div>
      )}

      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-3">
          <Label htmlFor="description" className="text-sm font-semibold text-[#111827]">Message *</Label>
          <span className="text-xs font-semibold text-[#64748B]">{formatCount(description.trim().length, "caractère")}</span>
        </div>
        <Textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={4}
          placeholder="Décrivez le problème : heure, échange avec le professeur, impact sur le cours..."
          className="rounded-xl border-[#DDE6F7] bg-white leading-6"
        />
      </div>

      <Button type="submit" disabled={loading} className="min-h-11 w-full rounded-xl bg-[#111B4D] text-white hover:bg-[#1A2565] sm:w-auto">
        {loading ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Send className="mr-1.5 h-4 w-4" />}
        {loading ? "Envoi..." : "Envoyer le signalement"}
      </Button>
    </form>
  );
}

function formatCount(count: number, singular: string, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}
