"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertTriangle } from "lucide-react";

const DISPUTE_REASONS = [
  "Professeur absent",
  "Cours non conforme",
  "Problème de paiement",
  "Autre",
];

export function DisputeForm({
  bookings,
}: {
  bookings: { id: string; reference: string; subjectName: string; levelName: string; teacherName: string }[];
}) {
  const router = useRouter();
  const [bookingId, setBookingId] = useState(bookings[0]?.id ?? "");
  const [reason, setReason] = useState(DISPUTE_REASONS[0]);
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);

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
      <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
        <div className="flex items-start gap-2">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            L'ouverture d'un litige bloque le paiement au professeur en attendant la résolution par notre support.
            Ne l'utilisez qu'en cas de problème réel (professeur absent, cours non dispensé, etc.).
          </span>
        </div>
      </div>

      <div>
        <Label htmlFor="bookingId">Réservation concernée *</Label>
        <Select value={bookingId} onValueChange={setBookingId}>
          <SelectTrigger id="bookingId" className="mt-1.5"><SelectValue placeholder="Sélectionner..." /></SelectTrigger>
          <SelectContent>
            {bookings.map((b) => (
              <SelectItem key={b.id} value={b.id}>
                {b.reference} — {b.subjectName} {b.levelName} ({b.teacherName})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label htmlFor="reason">Raison *</Label>
        <Select value={reason} onValueChange={setReason}>
          <SelectTrigger id="reason" className="mt-1.5"><SelectValue /></SelectTrigger>
          <SelectContent>
            {DISPUTE_REASONS.map((r) => (
              <SelectItem key={r} value={r}>{r}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label htmlFor="description">Description *</Label>
        <Textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={4}
          placeholder="Décrivez précisément le problème rencontré..."
        />
      </div>

      <Button type="submit" disabled={loading} variant="destructive">
        {loading ? "Ouverture..." : "Ouvrir le litige"}
      </Button>
    </form>
  );
}
