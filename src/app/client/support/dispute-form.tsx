"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ProfessorImage } from "@/components/shared/professor-image";
import { AlertTriangle, CheckCircle2, FileText, ShieldCheck } from "lucide-react";

const DISPUTE_REASONS = [
  "Professeur absent",
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
    <form onSubmit={submit} className="space-y-4">
      <div className="grid grid-cols-3 gap-2">
        <FormSignal
          icon={ShieldCheck}
          title="Protégé"
          text="Le paiement reste bloqué pendant l'analyse du dossier."
        />
        <FormSignal
          icon={FileText}
          title="Trace"
          text="Votre message est rattaché à la réservation et au professeur."
        />
        <FormSignal
          icon={CheckCircle2}
          title="Suivi"
          text="Le support traite la demande avec une trace claire."
        />
      </div>

      <div className="rounded-2xl border border-[#DDE6F7] bg-white p-3 text-xs font-semibold leading-5 text-[#111B4D] shadow-sm">
        <div className="flex items-start gap-2">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            L'ouverture d'un litige bloque le paiement au professeur en attendant la résolution par notre support.
            Ne l'utilisez qu'en cas de problème réel (professeur absent, cours non dispensé, etc.).
          </span>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="bookingId" className="text-sm font-black text-[#111827]">Réservation concernée *</Label>
        <Select value={bookingId} onValueChange={setBookingId}>
          <SelectTrigger id="bookingId" className="mt-1.5 min-h-11 w-full max-w-full min-w-0 rounded-2xl border-[#DDE6F7] bg-white"><SelectValue placeholder="Sélectionner..." /></SelectTrigger>
          <SelectContent>
            {bookings.map((b) => (
              <SelectItem key={b.id} value={b.id}>
                {b.reference} — {b.subjectName} {b.levelName} ({b.teacherName})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {selectedBooking && (
          <div className="mt-3 flex items-center gap-3 rounded-2xl border border-[#DDE6F7] bg-white p-3 shadow-sm">
            <ProfessorImage
              photoUrl={selectedBooking.teacherPhotoUrl}
              name={selectedBooking.teacherName}
              size="md"
              shape="circle"
              verified={Boolean(selectedBooking.teacherBadgeVerified)}
            />
            <div className="min-w-0">
              <p className="truncate text-sm font-black text-[#111827]">{selectedBooking.teacherName}</p>
              <p className="truncate text-xs font-semibold text-[#64748B]">
                {selectedBooking.reference} · {selectedBooking.subjectName} · {selectedBooking.levelName}
              </p>
            </div>
          </div>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="reason" className="text-sm font-black text-[#111827]">Raison *</Label>
        <Select value={reason} onValueChange={setReason}>
          <SelectTrigger id="reason" className="mt-1.5 min-h-11 w-full max-w-full min-w-0 rounded-2xl border-[#DDE6F7] bg-white"><SelectValue /></SelectTrigger>
          <SelectContent>
            {DISPUTE_REASONS.map((r) => (
              <SelectItem key={r} value={r}>{r}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-3">
          <Label htmlFor="description" className="text-sm font-black text-[#111827]">Description *</Label>
          <span className="text-xs font-semibold text-[#64748B]">{formatCount(description.trim().length, "caractère")}</span>
        </div>
        <Textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={5}
          placeholder="Expliquez précisément ce qui s'est passé : date, heure, échange avec le professeur, impact sur le cours..."
          className="rounded-2xl border-[#DDE6F7] bg-white leading-6"
        />
        <p className="text-xs font-medium leading-5 text-[#64748B]">
          Plus votre description est précise, plus l'administration peut trancher rapidement et protéger le paiement.
        </p>
      </div>

      <Button type="submit" disabled={loading} className="min-h-11 w-full rounded-2xl sm:w-auto">
        {loading ? "Ouverture..." : "Ouvrir le litige"}
      </Button>
    </form>
  );
}

function formatCount(count: number, singular: string, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}

function FormSignal({
  icon: Icon,
  title,
  text,
}: {
  icon: typeof ShieldCheck;
  title: string;
  text: string;
}) {
  return (
    <div className="min-w-0 rounded-2xl border border-[#DDE6F7] bg-white p-2 shadow-sm min-[520px]:p-3">
      <div className="flex min-w-0 flex-col items-center gap-1 text-center min-[520px]:flex-row min-[520px]:text-left">
        <Icon className="h-4 w-4 text-[#111B4D]" />
        <p className="min-w-0 truncate text-[11px] font-black text-[#111827] min-[520px]:text-xs">{title}</p>
      </div>
      <p className="mt-1 hidden text-xs font-medium leading-5 text-[#64748B] min-[520px]:block">{text}</p>
    </div>
  );
}
