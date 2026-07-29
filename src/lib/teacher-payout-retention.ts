export type TeacherPayoutSessionRetentionSnapshot = {
  retainedAmountBefore: number;
  retainedAmountAfter: number;
  remainingAfterRetention: number;
};

/**
 * Fige les deux valeurs nécessaires à une matérialisation atomique :
 * la retenue actuellement persistée et celle calculée après application
 * des ajustements. Le montant "avant" sert de condition CAS en base.
 */
export function buildTeacherPayoutSessionRetentionSnapshot(input: {
  grossRemaining: number;
  persistedRetainedAmount: number;
  additionalRetainedAmount: number;
}): TeacherPayoutSessionRetentionSnapshot {
  const grossRemaining = Math.max(0, input.grossRemaining);
  const retainedAmountBefore = Math.max(0, input.persistedRetainedAmount);
  const retainedAmountAfter = Math.min(
    grossRemaining,
    retainedAmountBefore + Math.max(0, input.additionalRetainedAmount),
  );

  return {
    retainedAmountBefore,
    retainedAmountAfter,
    remainingAfterRetention: Math.max(0, grossRemaining - retainedAmountAfter),
  };
}
