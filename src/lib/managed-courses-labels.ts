const labels: Record<string, string> = {
  NEW: "À attribuer", OFFERED: "Réponse professeur attendue", ACTIVE: "Accompagnement en cours", COMPLETED: "Accompagnement terminé",
  ACCEPTED: "Mission acceptée", DECLINED: "Proposition refusée", REVOKED: "Proposition retirée", CANCEL_REQUESTED: "Empêchement signalé", PARTIAL_CANCELLED: "Attribution partiellement libérée",
  PLANNED: "Prévue", DONE: "Effectuée · à vérifier", VALIDATED: "Effectuée et validée", CANCELLED: "Annulée",
  EARNED: "Rémunération acquise", PAYMENT: "Règlement enregistré", EARNED_REVERSAL: "Correction de rémunération", PAYMENT_REVERSAL: "Correction de règlement",
};
export const managedStatusLabel = (status: string) => labels[status] || status;
