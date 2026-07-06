"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ProfessorImage } from "@/components/shared/professor-image";
import { Loader2, Search, Send, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";

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
  const [bookingQuery, setBookingQuery] = useState("");
  const [reason, setReason] = useState(DISPUTE_REASONS[0]);
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const selectedBooking = useMemo(
    () => bookings.find((booking) => booking.id === bookingId) ?? bookings[0],
    [bookingId, bookings],
  );
  const filteredBookings = useMemo(() => {
    const normalizedQuery = normalize(bookingQuery);
    if (!normalizedQuery) return bookings;
    return bookings.filter((booking) => normalize([
      booking.reference,
      booking.subjectName,
      booking.levelName,
      booking.teacherName,
    ].join(" ")).includes(normalizedQuery));
  }, [bookingQuery, bookings]);

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
      toast.success("Litige ouvert. Le service client vous recontacte sous 24-48h.");
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
      <div className="rounded-lg border border-[#DDE6F7] bg-white p-3 text-sm font-medium leading-5 text-[#111B4D]">
        <div className="flex items-start gap-2">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            Le signalement protège votre paiement pendant l'analyse. Utilisez-le uniquement si le cours pose réellement problème.
          </span>
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1.1fr)_minmax(16rem,0.9fr)]">
        <div className="space-y-2">
          <Label htmlFor="bookingId" className="text-sm font-semibold text-[#111827]">Réservation *</Label>
          <label className="relative block">
            <span className="sr-only">Rechercher une réservation à signaler</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#64748B]" />
            <Input
              id="bookingId"
              value={bookingQuery}
              onChange={(event) => setBookingQuery(event.target.value)}
              placeholder="Référence, matière, professeur..."
              className="h-11 rounded-lg border-[#DDE6F7] bg-white pl-9"
            />
          </label>
          <div className="grid max-h-[18rem] gap-2 overflow-y-auto rounded-lg border border-[#E3E8F2] bg-white p-2" data-client-dispute-booking-list>
            {filteredBookings.length === 0 ? (
              <p className="rounded-lg border border-dashed border-[#DDE6F7] bg-white p-3 text-sm font-semibold text-[#64748B]">
                Aucune réservation trouvée.
              </p>
            ) : (
              filteredBookings.map((booking) => {
                const active = booking.id === bookingId;
                return (
                  <button
                    key={booking.id}
                    type="button"
                    onClick={() => setBookingId(booking.id)}
                    className={cn(
                      "flex min-w-0 items-center gap-3 rounded-lg border p-2 text-left transition-colors",
                      active ? "border-[#111B4D] bg-[#111B4D] text-white" : "border-[#E3E8F2] bg-white text-[#111827] hover:border-[#111B4D]",
                    )}
                    aria-pressed={active}
                  >
                    <ProfessorImage
                      photoUrl={booking.teacherPhotoUrl}
                      name={booking.teacherName}
                      size="sm"
                      shape="circle"
                      verified={Boolean(booking.teacherBadgeVerified)}
                    />
                    <span className="min-w-0 flex-1">
                      <span className={cn("block truncate text-sm font-semibold", active ? "text-white" : "text-[#111827]")}>{booking.reference}</span>
                      <span className={cn("block truncate text-xs font-medium", active ? "text-white/80" : "text-[#64748B]")}>
                        {booking.subjectName} · {booking.levelName} · {booking.teacherName}
                      </span>
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="reason" className="text-sm font-semibold text-[#111827]">Motif *</Label>
          <Select value={reason} onValueChange={setReason}>
            <SelectTrigger id="reason" className="mt-1.5 min-h-11 w-full max-w-full min-w-0 rounded-lg border-[#DDE6F7] bg-white"><SelectValue /></SelectTrigger>
            <SelectContent>
              {DISPUTE_REASONS.map((r) => (
                <SelectItem key={r} value={r}>{r}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {selectedBooking && (
        <div className="flex items-center gap-3 rounded-lg border border-[#DDE6F7] bg-white p-3" data-client-support-selected-booking>
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
          className="rounded-lg border-[#DDE6F7] bg-white leading-6"
        />
      </div>

      <Button type="submit" disabled={loading} className="min-h-11 w-full rounded-lg bg-[#111B4D] text-white hover:bg-[#1A2565] min-[640px]:w-auto">
        {loading ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Send className="mr-1.5 h-4 w-4" />}
        {loading ? "Envoi..." : "Envoyer le signalement"}
      </Button>
    </form>
  );
}

function formatCount(count: number, singular: string, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}

function normalize(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
