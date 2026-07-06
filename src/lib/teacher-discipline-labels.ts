export const teacherWarningLevelLabels: Record<string, string> = {
  SIMPLE_REMINDER: "Niveau 1 - Rappel simple",
  OFFICIAL_WARNING: "Niveau 2 - Avertissement officiel",
  FINAL_WARNING: "Niveau 3 - Dernier avertissement",
  SUSPENSION_WARNING: "Niveau 4 - Suspension",
};

export const teacherWarningReasonLabels: Record<string, string> = {
  LATE_TO_COURSE: "Retard au cours",
  UNJUSTIFIED_ABSENCE: "Absence non justifiée",
  POOR_COURSE_QUALITY: "Mauvaise qualité de cours",
  BAD_CLIENT_COMMUNICATION: "Mauvaise communication avec le client",
  SCHEDULE_NOT_RESPECTED: "Non-respect des horaires",
  REPEATED_CANCELLATION: "Annulation répétée",
  DIRECT_CONTACT_OUTSIDE_PLATFORM: "Contact direct hors plateforme",
  UNPROFESSIONAL_BEHAVIOR: "Comportement non professionnel",
  CLIENT_COMPLAINT: "Plainte client",
  UNJUSTIFIED_REFUSAL: "Refus injustifié de mission",
  LACK_OF_AVAILABILITY: "Manque de disponibilité",
  ADMIN_INSTRUCTIONS_NOT_RESPECTED: "Non-respect des consignes du service client",
  OTHER: "Autre motif",
};

export const teacherSanctionTypeLabels: Record<string, string> = {
  LIGHT: "Sanction légère",
  MEDIUM: "Sanction moyenne",
  FINANCIAL: "Sanction financière",
  STRONG: "Sanction forte",
};

export const teacherSanctionStatusLabels: Record<string, string> = {
  PENDING_VALIDATION: "En attente de validation",
  APPLIED: "Sanction appliquée",
  CANCELLED: "Sanction annulée",
};

export function teacherWarningLevelLabel(level: string) {
  return teacherWarningLevelLabels[level] ?? level;
}

export function teacherWarningReasonLabel(reason: string) {
  return teacherWarningReasonLabels[reason] ?? reason;
}

export function teacherSanctionTypeLabel(type: string) {
  return teacherSanctionTypeLabels[type] ?? type;
}

export function teacherSanctionStatusLabel(status: string) {
  return teacherSanctionStatusLabels[status] ?? status;
}
