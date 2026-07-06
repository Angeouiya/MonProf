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

const MIN_DESCRIPTION_LENGTH = 40;

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
  const defaultBookingId = bookings[0]?.id ?? "";
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
  const trimmedDescription = description.trim();
  const descriptionReady = trimmedDescription.length >= MIN_DESCRIPTION_LENGTH;
  const canSubmit = Boolean(bookingId) && descriptionReady && !loading;
  const draftActive = Boolean(
    bookingQuery.trim() ||
    trimmedDescription ||
    reason !== DISPUTE_REASONS[0] ||
    bookingId !== defaultBookingId,
  );
  const readiness = [
    { label: "Réservation sélectionnée", ok: Boolean(bookingId) },
    { label: "Motif précisé", ok: Boolean(reason) },
    { label: `${MIN_DESCRIPTION_LENGTH} caractères minimum`, ok: descriptionReady },
  ];

  function resetDraft() {
    setBookingId(defaultBookingId);
    setBookingQuery("");
    setReason(DISPUTE_REASONS[0]);
    setDescription("");
  }

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
    if (!descriptionReady) {
      toast.error(`Ajoutez au moins ${MIN_DESCRIPTION_LENGTH} caractères pour aider le service client.`);
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
      resetDraft();
      router.refresh();
    } catch {
      toast.error("Erreur réseau");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="client-dispute-form space-y-3" data-client-dispute-form>
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
              data-client-dispute-search
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
          <span className={cn("text-xs font-semibold", descriptionReady ? "text-[#111B4D]" : "text-[#64748B]")}>
            {formatCount(trimmedDescription.length, "caractère")}
          </span>
        </div>
        <Textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={4}
          placeholder="Décrivez le problème : heure, échange avec le professeur, impact sur le cours..."
          className="rounded-lg border-[#DDE6F7] bg-white leading-6"
          data-client-dispute-description
        />
      </div>

      <div data-client-dispute-readiness className="grid gap-2 rounded-lg border border-[#E3E8F2] bg-white p-2.5 text-xs font-semibold leading-5 text-[#64748B] min-[720px]:grid-cols-3">
        {readiness.map((item) => (
          <p key={item.label} className={item.ok ? "text-[#111B4D]" : ""} data-client-dispute-rule={item.ok ? "ok" : "pending"}>
            <ShieldCheck className={item.ok ? "mr-1 inline h-3.5 w-3.5 text-[#111B4D]" : "mr-1 inline h-3.5 w-3.5 text-[#94A3B8]"} />
            {item.label}
          </p>
        ))}
      </div>

      {draftActive && (
        <div
          data-client-dispute-draft
          className="sticky bottom-20 z-30 rounded-lg border border-[#111B4D] bg-white p-3 shadow-[0_16px_40px_rgba(17,27,77,0.10)] lg:bottom-4"
        >
          <div className="flex flex-col gap-3 min-[640px]:flex-row min-[640px]:items-center min-[640px]:justify-between">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-[#111827]">Signalement en préparation</p>
              <p className="mt-0.5 text-xs font-medium leading-5 text-[#64748B]">
                Vérifiez la réservation et donnez assez de contexte avant l'envoi.
              </p>
            </div>
            <div className="grid gap-2 min-[420px]:grid-cols-2 min-[640px]:flex min-[640px]:shrink-0">
              <Button
                type="button"
                variant="outline"
                onClick={resetDraft}
                disabled={loading}
                className="min-h-11 rounded-lg border-[#CAD7F2] bg-white text-[#111B4D] hover:border-[#111B4D] hover:bg-white"
              >
                Effacer
              </Button>
              <Button
                type="submit"
                disabled={!canSubmit}
                className="min-h-11 rounded-lg bg-[#111B4D] text-white hover:bg-[#1A2565]"
                data-client-dispute-sticky-submit
              >
                {loading ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Send className="mr-1.5 h-4 w-4" />}
                Envoyer
              </Button>
            </div>
          </div>
        </div>
      )}

      <Button type="submit" disabled={!canSubmit} className="min-h-11 w-full rounded-lg bg-[#111B4D] text-white hover:bg-[#1A2565] min-[640px]:w-auto" data-client-dispute-submit>
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
