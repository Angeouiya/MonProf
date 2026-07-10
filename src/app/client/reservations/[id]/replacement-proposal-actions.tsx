"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2, RefreshCw, ShieldCheck, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ProfessorImage } from "@/components/shared/professor-image";
import { ImportantActionConfirm } from "@/components/shared/important-action-confirm";

type ReplacementProposal = {
  id: string;
  status: string;
  reason: string;
  details?: string | null;
  financialImpact: number;
  clientMessage?: string | null;
  createdAt: string;
  appliedAt?: string | null;
  oldTeacher: {
    id: string;
    fullName: string;
    professionalName?: string | null;
    photoUrl?: string | null;
  };
  newTeacher: {
    id: string;
    fullName: string;
    professionalName?: string | null;
    photoUrl?: string | null;
    jobTitle?: string | null;
    commune?: string | null;
    rating: number;
    qualityScore: number;
    badgeVerified: boolean;
  };
};

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Proposition préparée",
  CLIENT_NOTIFIED: "Votre réponse attendue",
  APPLIED: "Accepté",
  CANCELLED: "Refusé",
  TEACHERS_NOTIFIED: "Professeurs notifiés",
};

export function ReplacementProposalActions({
  bookingId,
  proposals,
}: {
  bookingId: string;
  proposals: ReplacementProposal[];
}) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [response, setResponse] = useState("");
  const pendingProposal = proposals.find((proposal) => ["DRAFT", "CLIENT_NOTIFIED"].includes(proposal.status));

  async function respond(action: "accept_replacement_proposal" | "reject_replacement_proposal" | "cancel_after_teacher_unavailable") {
    if (!pendingProposal) return false;
    setLoading(action);
    try {
      const res = await fetch(`/api/bookings/${bookingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          replacementId: pendingProposal.id,
          clientResponse: response.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Action impossible");
        return false;
      }
      toast.success(
        action === "accept_replacement_proposal"
          ? "Nouveau professeur accepté. La mission lui est transmise."
          : action === "cancel_after_teacher_unavailable"
            ? "Réservation annulée sans pénalité."
            : "Refus transmis au service client.",
      );
      setResponse("");
      router.refresh();
      return true;
    } catch {
      toast.error("Erreur réseau");
      return false;
    } finally {
      setLoading(null);
    }
  }

  if (!pendingProposal && proposals.length === 0) return null;
  const mainProposal = pendingProposal ?? proposals[0];
  const oldTeacherName = mainProposal.oldTeacher.professionalName || mainProposal.oldTeacher.fullName;
  const newTeacherName = mainProposal.newTeacher.professionalName || mainProposal.newTeacher.fullName;

  return (
    <section className="overflow-hidden rounded-lg border border-[#111B4D] bg-white p-4">
      <div className="flex items-start gap-3 border-b border-[#E6EAF3] pb-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#111B4D] text-white">
          <RefreshCw className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[#64748B]">Remplacement professeur</p>
          <h2 className="mt-0.5 text-base font-semibold leading-tight text-[#111827]">
            {pendingProposal ? "Nouveau professeur proposé" : "Historique du remplacement"}
          </h2>
          <p className="mt-1 text-xs font-semibold text-[#111B4D]">
            {STATUS_LABELS[mainProposal.status] ?? mainProposal.status}
          </p>
        </div>
      </div>

      <div className="mt-4 space-y-3">
        <div className="rounded-lg border border-[#DDE6F7] bg-white p-3">
          <div className="flex items-center gap-3">
            <ProfessorImage
              photoUrl={mainProposal.newTeacher.photoUrl}
              name={newTeacherName}
              size="md"
              shape="circle"
              verified={mainProposal.newTeacher.badgeVerified}
            />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold leading-tight text-[#111827]">{newTeacherName}</p>
              <p className="mt-1 text-xs font-semibold leading-5 text-[#64748B]">
                {mainProposal.newTeacher.jobTitle || "Professeur"}{mainProposal.newTeacher.commune ? ` · ${mainProposal.newTeacher.commune}` : ""}
              </p>
              <p className="mt-1 text-xs font-semibold leading-5 text-[#111B4D]">
                Note {mainProposal.newTeacher.rating.toFixed(1)}/5 · Score qualité {mainProposal.newTeacher.qualityScore}/100
              </p>
            </div>
          </div>
          <div className="mt-3 grid gap-2 min-[460px]:grid-cols-2">
            <Mini label="Professeur initial" value={oldTeacherName} />
            <Mini label="Coût pour vous" value="Aucun supplément" />
          </div>
          {mainProposal.clientMessage && (
            <p className="mt-3 whitespace-pre-line text-sm font-medium leading-6 text-[#64748B]">
              {mainProposal.clientMessage}
            </p>
          )}
        </div>

        {pendingProposal && (
          <>
            <div className="flex items-start gap-2 rounded-lg border border-[#DDE6F7] bg-white px-3 py-2 text-xs font-semibold leading-5 text-[#64748B]">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#111B4D]" />
              <span>Votre paiement reste sécurisé. Le professeur change seulement si vous acceptez cette proposition.</span>
            </div>
            <Textarea
              rows={3}
              value={response}
              onChange={(event) => setResponse(event.target.value)}
              maxLength={700}
              placeholder="Message optionnel pour le service client."
              className="rounded-lg border-[#DDE6F7] bg-white"
            />
            <div className="grid gap-2 min-[460px]:grid-cols-2">
              <Button
                disabled={!!loading}
                onClick={() => respond("accept_replacement_proposal")}
                className="min-h-11 rounded-lg bg-[#111B4D] text-white hover:bg-[#1E2A78]"
              >
                {loading === "accept_replacement_proposal" ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                Accepter ce professeur
              </Button>
              <ImportantActionConfirm
                trigger={(
                  <Button
                    variant="outline"
                    disabled={!!loading}
                    className="min-h-11 rounded-lg border-[#D7DEE9] bg-white text-[#111B4D]"
                  >
                    {loading === "cancel_after_teacher_unavailable" ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
                    Annuler sans pénalité
                  </Button>
                )}
                title="Annuler cette réservation ?"
                description="Le professeur initial a déclaré son indisponibilité. Vous pouvez donc annuler sans aucune pénalité d'annulation."
                badge="Indisponibilité professeur"
                notices={[
                  "Le professeur proposé ne sera pas affecté.",
                  "Aucune pénalité client ne sera appliquée.",
                  "Les éventuels frais techniques PayDunya ne constituent pas une pénalité et restent traités selon les conditions de paiement affichées.",
                  "Le montant remboursable sera enregistré et vos coordonnées de remboursement pourront être renseignées dans la réservation.",
                ]}
                confirmLabel="Confirmer l'annulation"
                cancelLabel="Garder la réservation"
                danger
                onConfirm={() => respond("cancel_after_teacher_unavailable")}
              />
            </div>
          </>
        )}
      </div>
    </section>
  );
}

function Mini({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-lg border border-[#E3E8F2] bg-white px-3 py-2">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-[#64748B]">{label}</p>
      <p className="mt-1 break-words text-sm font-semibold leading-tight text-[#111B4D]">{value}</p>
    </div>
  );
}
