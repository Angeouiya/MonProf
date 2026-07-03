import type { Booking, TeacherWarning, TeacherSanction, TeacherReplacement } from "@prisma/client";

const realizedStatuses = new Set([
  "COURSE_DONE",
  "PENDING_CLIENT_VALIDATION",
  "VALIDATED_BY_CLIENT",
  "PAYMENT_TO_RELEASE",
  "TEACHER_PAID",
]);

export function computeTeacherQualityScore({
  rating,
  bookings,
  warnings,
  sanctions,
  replacements,
}: {
  rating: number;
  bookings: Pick<Booking, "status" | "paymentStatus">[];
  warnings: Pick<TeacherWarning, "level">[];
  sanctions: Pick<TeacherSanction, "status" | "type">[];
  replacements: Pick<TeacherReplacement, "status">[];
}) {
  const total = bookings.length;
  const realized = bookings.filter((b) => realizedStatuses.has(b.status)).length;
  const cancelled = bookings.filter((b) => b.status === "CANCELLED").length;
  const disputed = bookings.filter((b) => b.status === "DISPUTED" || b.paymentStatus === "DISPUTED").length;
  const completionRate = total ? realized / total : 1;
  const ratingScore = Math.round((Math.min(Math.max(rating, 0), 5) / 5) * 35);
  const completionScore = Math.round(completionRate * 25);
  const disputePenalty = disputed * 8;
  const cancellationPenalty = cancelled * 5;
  const warningPenalty = warnings.reduce((sum, warning) => {
    const penalty = warning.level === "FINAL_WARNING" ? 12 : warning.level === "SUSPENSION_WARNING" ? 18 : warning.level === "OFFICIAL_WARNING" ? 8 : 4;
    return sum + penalty;
  }, 0);
  const sanctionPenalty = sanctions.reduce((sum, sanction) => {
    if (sanction.status === "CANCELLED") return sum;
    const penalty = sanction.type === "STRONG" ? 20 : sanction.type === "FINANCIAL" ? 14 : sanction.type === "MEDIUM" ? 12 : 6;
    return sum + penalty;
  }, 0);
  const replacementPenalty = replacements.filter((r) => r.status !== "CANCELLED").length * 5;
  const base = 40 + ratingScore + completionScore;
  return Math.max(0, Math.min(100, base - disputePenalty - cancellationPenalty - warningPenalty - sanctionPenalty - replacementPenalty));
}

export function qualityScoreLabel(score: number) {
  if (score >= 90) return "Excellent";
  if (score >= 75) return "Bon";
  if (score >= 60) return "À surveiller";
  if (score >= 40) return "En observation";
  return "Risque élevé";
}

export function qualityScoreTone(score: number) {
  if (score >= 90) return "blue";
  if (score >= 75) return "violet";
  if (score >= 60) return "amber";
  if (score >= 40) return "orange";
  return "red";
}

export function teacherDisplayName(teacher: { professionalName?: string | null; fullName: string }) {
  return teacher.professionalName || teacher.fullName;
}
