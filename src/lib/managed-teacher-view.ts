import { managedSplit } from "@/lib/managed-courses-core";

export const MANAGED_TEACHER_NET_TERMS_VERSION =
  "managed-teacher-net-2026-11-25-v1";
export function managedTeacherNetTerms(amount: number) {
  if (!Number.isSafeInteger(amount) || amount < 0)
    throw new Error("Rémunération invalide.");
  return `J’accepte les horaires proposés et la rémunération de ${amount.toLocaleString("fr-FR")} F CFA pour les séances de cette mission. Ce montant est celui qui m’est attribué. Il devient payable après réalisation et validation des séances et réception du règlement du parent. Je m’engage à la ponctualité, à la qualité pédagogique, à la confidentialité, au respect de la vie privée de la famille et à la sécurité de l’élève. Je préviens Compétence de tout empêchement et ne sous-traite pas la mission sans autorisation.`;
}

// This allowlist is the professor-facing boundary. Never spread a dossier,
// offer, session or admin ledger note into a browser response.
export function managedTeacherOfferView(offer: {
  id: string;
  dossierId: string;
  status: string;
  commissionRateBps: number;
  dossier: {
    reference: string;
    subjectName: string;
    className: string;
    courseFormat: string;
    commune: string | null;
    quartier: string | null;
    parentName: string;
    phone: string;
    addressHint: string | null;
    objective: string | null;
    onHold: boolean;
  };
  sessions: {
    id: string;
    sequence: number;
    scheduledDate: Date;
    scheduledTime: string;
    durationMinutes: number;
    status: string;
    amount: number;
    commissionRateBps: number | null;
    creditedTeacherAmount: number;
  }[];
}) {
  const accepted = [
    "ACCEPTED",
    "CANCEL_REQUESTED",
    "PARTIAL_CANCELLED",
  ].includes(offer.status);
  const sessions = offer.sessions.map((session) => ({
    id: session.id,
    sequence: session.sequence,
    scheduledDate: session.scheduledDate,
    scheduledTime: session.scheduledTime,
    durationMinutes: session.durationMinutes,
    status: session.status,
    creditedTeacherAmount: session.creditedTeacherAmount,
    remuneration: managedSplit(
      session.amount,
      session.commissionRateBps ?? offer.commissionRateBps,
    ).teacher,
  }));
  return {
    id: offer.id,
    dossierId: offer.dossierId,
    status: offer.status,
    remuneration: sessions
      .filter((session) => session.status !== "CANCELLED")
      .reduce((sum, session) => sum + session.remuneration, 0),
    sessions,
    dossier: {
      reference: offer.dossier.reference,
      subjectName: offer.dossier.subjectName,
      className: offer.dossier.className,
      courseFormat: offer.dossier.courseFormat,
      commune: offer.dossier.commune,
      quartier: offer.dossier.quartier,
      objective: offer.dossier.objective,
      onHold: offer.dossier.onHold,
      parentName: accepted ? offer.dossier.parentName : null,
      phone: accepted ? offer.dossier.phone : null,
      addressHint: accepted ? offer.dossier.addressHint : null,
    },
  };
}
