"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CalendarClock, CheckCircle2, CircleDollarSign, RefreshCw, ShieldAlert, UserRoundCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ProfessorImage } from "@/components/shared/professor-image";
import { formatFCFA, formatDate } from "@/lib/format";

export type SessionLedgerItem = {
  id: string;
  sequence: number;
  status: string;
  scheduledDate?: string | Date | null;
  scheduledTime?: string | null;
  proposedDate?: string | Date | null;
  proposedTime?: string | null;
  unavailableReason?: string | null;
  teacherNetAmount: number;
  releasedAmount: number;
  paidAmount: number;
  retainedAmount: number;
  transportFee: number;
  teacher: { id: string; fullName: string; professionalName?: string | null; photoUrl?: string | null };
  proposedTeacher?: { id: string; fullName: string; professionalName?: string | null; photoUrl?: string | null } | null;
};

const STATUS_LABELS: Record<string, string> = {
  PLANNED: "Planifiée",
  TEACHER_CONFIRMED: "Professeur confirmé",
  IN_PROGRESS: "En cours",
  AWAITING_CLIENT_CONFIRMATION: "Confirmation client",
  RELEASED: "Fonds libérés",
  PARTIALLY_PAID: "Paiement partiel",
  PAID: "Payée",
  RESCHEDULE_PROPOSED: "Nouveau créneau proposé",
  REPLACEMENT_PROPOSED: "Remplaçant proposé",
  NEEDS_REPLACEMENT: "Remplacement requis",
  DISPUTED: "En litige",
  CANCELLED: "Annulée",
  REFUNDED: "Remboursée",
};

export function BookingSessionLedger({
  bookingId,
  sessions,
  audience,
}: {
  bookingId: string;
  sessions: SessionLedgerItem[];
  audience: "client" | "professor" | "admin";
}) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [dialog, setDialog] = useState<{ session: SessionLedgerItem; mode: "reschedule" | "unavailable" | "dispute" } | null>(null);
  const [reason, setReason] = useState("");
  const [proposedDate, setProposedDate] = useState("");
  const [proposedTime, setProposedTime] = useState("");

  async function act(sessionId: string, action: string, extra?: Record<string, unknown>) {
    const key = sessionId + ":" + action;
    setLoading(key);
    try {
      const response = await fetch("/api/bookings/" + bookingId + "/sessions/" + sessionId, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...extra }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Action impossible");
      toast.success("Séance mise à jour.");
      setDialog(null);
      setReason("");
      setProposedDate("");
      setProposedTime("");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erreur réseau");
    } finally {
      setLoading(null);
    }
  }

  const released = sessions.reduce((sum, session) => sum + session.releasedAmount, 0);
  const paid = sessions.reduce((sum, session) => sum + session.paidAmount, 0);
  const blocked = sessions.reduce((sum, session) => sum + (session.releasedAmount > 0 ? 0 : session.teacherNetAmount), 0);

  return (
    <section id="seances" data-booking-session-ledger className="rounded-lg border border-[#D8DEE9] bg-white p-3 min-[640px]:p-5">
      <div className="flex flex-col gap-3 min-[680px]:flex-row min-[680px]:items-end min-[680px]:justify-between">
        <div>
          <p className="text-base font-semibold text-[#111827]">Suivi des séances du pack</p>
          <p className="mt-1 text-sm leading-6 text-[#64748B]">Chaque séance possède son planning, son professeur et son propre décompte financier.</p>
        </div>
        {audience !== "client" && (
          <div className="grid grid-cols-3 gap-2 text-xs">
            <SessionAmount label="Bloqué" value={blocked} />
            <SessionAmount label="Libéré" value={released} />
            <SessionAmount label="Payé" value={paid} />
          </div>
        )}
      </div>

      <div className="mt-4 grid gap-3">
        {sessions.map((session) => {
          const teacherName = session.teacher.professionalName || session.teacher.fullName;
          const pending = (action: string) => loading === session.id + ":" + action;
          const remaining = Math.max(0, session.releasedAmount - session.paidAmount - session.retainedAmount);
          return (
            <article key={session.id} data-booking-session-card className="rounded-lg border border-[#E3E8F2] bg-white p-3 min-[640px]:p-4">
              <div className="grid gap-3 min-[760px]:grid-cols-[minmax(0,1fr)_auto] min-[760px]:items-start">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex h-7 min-w-7 items-center justify-center rounded-full bg-[#111B4D] px-2 text-xs font-semibold text-white">{session.sequence}</span>
                    <p className="font-semibold text-[#111827]">Séance {session.sequence}/{sessions.length}</p>
                    <span className="rounded-full border border-[#CAD3E2] bg-white px-2 py-1 text-[11px] font-semibold text-[#111B4D]">{STATUS_LABELS[session.status] || session.status}</span>
                  </div>
                  <div className="mt-3 flex min-w-0 items-center gap-3">
                    <ProfessorImage photoUrl={session.teacher.photoUrl} name={teacherName} size="sm" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-[#111827]">{teacherName}</p>
                      <p className="mt-0.5 text-xs text-[#64748B]">{session.scheduledDate ? formatDate(new Date(session.scheduledDate)) : "Date à planifier"} · {session.scheduledTime || "Horaire à confirmer"}</p>
                    </div>
                  </div>
                  {session.proposedTeacher && (
                    <p className="mt-2 text-xs font-semibold text-[#111B4D]">Remplaçant proposé : {session.proposedTeacher.professionalName || session.proposedTeacher.fullName}</p>
                  )}
                  {session.proposedDate && (
                    <p className="mt-2 text-xs font-semibold text-[#111B4D]">Nouveau créneau : {formatDate(new Date(session.proposedDate))} · {session.proposedTime}</p>
                  )}
                  {session.unavailableReason && <p className="mt-2 text-xs leading-5 text-[#64748B]">{session.unavailableReason}</p>}
                </div>

                {audience !== "client" && (
                  <div className="grid grid-cols-2 gap-2 min-[480px]:grid-cols-4 min-[760px]:w-[360px]">
                    <SessionAmount label="Net" value={session.teacherNetAmount} />
                    <SessionAmount label="Libéré" value={session.releasedAmount} />
                    <SessionAmount label="Payé" value={session.paidAmount} />
                    <SessionAmount label="À payer" value={remaining} />
                  </div>
                )}
              </div>

              <div className="mt-3 flex flex-wrap gap-2 border-t border-[#EEF2F7] pt-3">
                {audience === "client" && session.status === "AWAITING_CLIENT_CONFIRMATION" && (
                  <>
                    <Button size="sm" onClick={() => act(session.id, "confirm")} disabled={pending("confirm")} className="bg-[#111B4D] text-white">
                      <CheckCircle2 className="h-4 w-4" /> Confirmer
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setDialog({ session, mode: "dispute" })}>
                      <ShieldAlert className="h-4 w-4" /> Signaler
                    </Button>
                  </>
                )}
                {audience === "client" && session.status === "RESCHEDULE_PROPOSED" && (
                  <>
                    <Button size="sm" onClick={() => act(session.id, "accept_reschedule")} disabled={pending("accept_reschedule")} className="bg-[#111B4D] text-white">Accepter le créneau</Button>
                    <Button size="sm" variant="outline" onClick={() => act(session.id, "reject_reschedule")} disabled={pending("reject_reschedule")}>Refuser</Button>
                  </>
                )}
                {audience === "client" && session.status === "REPLACEMENT_PROPOSED" && (
                  <>
                    <Button size="sm" onClick={() => act(session.id, "accept_replacement")} disabled={pending("accept_replacement")} className="bg-[#111B4D] text-white">
                      <UserRoundCheck className="h-4 w-4" /> Accepter le professeur
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => act(session.id, "reject_replacement")} disabled={pending("reject_replacement")}>Refuser</Button>
                  </>
                )}
                {audience !== "client" && ["PLANNED", "TEACHER_CONFIRMED", "IN_PROGRESS"].includes(session.status) && (
                  <>
                    <Button size="sm" onClick={() => act(session.id, "mark_done")} disabled={pending("mark_done")} className="bg-[#111B4D] text-white">
                      <CheckCircle2 className="h-4 w-4" /> Séance effectuée
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setDialog({ session, mode: "reschedule" })}>
                      <CalendarClock className="h-4 w-4" /> Déplacer
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setDialog({ session, mode: "unavailable" })}>
                      <RefreshCw className="h-4 w-4" /> Indisponible
                    </Button>
                  </>
                )}
                {["RELEASED", "PARTIALLY_PAID", "PAID"].includes(session.status) && (
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#111B4D]">
                    <CircleDollarSign className="h-4 w-4" />
                    {session.status === "PAID" ? "Séance soldée" : formatFCFA(remaining) + " payable"}
                  </span>
                )}
              </div>
            </article>
          );
        })}
      </div>

      <Dialog open={Boolean(dialog)} onOpenChange={(open) => !open && setDialog(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{dialog?.mode === "reschedule" ? "Proposer un nouveau créneau" : dialog?.mode === "unavailable" ? "Déclarer une indisponibilité" : "Signaler un problème"}</DialogTitle>
            <DialogDescription>Cette action concerne uniquement la séance sélectionnée. Les autres séances du pack restent inchangées.</DialogDescription>
          </DialogHeader>
          {dialog?.mode === "reschedule" && (
            <div className="grid gap-3 min-[480px]:grid-cols-2">
              <div className="space-y-1.5"><Label>Date</Label><Input type="date" value={proposedDate} onChange={(event) => setProposedDate(event.target.value)} /></div>
              <div className="space-y-1.5"><Label>Début</Label><Input type="time" value={proposedTime} onChange={(event) => setProposedTime(event.target.value)} /></div>
            </div>
          )}
          <div className="space-y-1.5">
            <Label>Motif détaillé</Label>
            <Textarea value={reason} onChange={(event) => setReason(event.target.value)} maxLength={700} rows={4} placeholder="Expliquez clairement la situation." />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(null)}>Annuler</Button>
            <Button
              onClick={() => dialog && act(
                dialog.session.id,
                dialog.mode === "dispute" ? "open_dispute" : dialog.mode,
                dialog.mode === "reschedule" ? { reason, proposedDate, proposedTime } : { reason },
              )}
              className="bg-[#111B4D] text-white"
            >
              Envoyer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}

function SessionAmount({ label, value }: { label: string; value: number }) {
  return (
    <div className="min-w-0 rounded-lg border border-[#E3E8F2] bg-white px-2.5 py-2">
      <p className="text-[9px] font-semibold uppercase text-[#64748B]">{label}</p>
      <p className="mt-1 break-words text-xs font-semibold text-[#111B4D]">{formatFCFA(value)}</p>
    </div>
  );
}
