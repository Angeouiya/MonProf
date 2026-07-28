export type PasswordEmailCandidate = {
  id: string;
  kind: string;
  createdAt: Date;
};

/**
 * Classe les resets avant les confirmations, puis conserve un ordre FIFO
 * stable. La sélection SQL fournit au plus `limit` candidats de chaque classe,
 * ce qui suffit pour construire exactement les `limit` prochaines têtes.
 */
export function selectPasswordEmailCandidateBatch<T extends PasswordEmailCandidate>(
  candidates: readonly T[],
  limit: number,
) {
  const boundedLimit = Math.max(0, Math.floor(limit));
  if (boundedLimit === 0) return [] as T[];

  const resets = candidates
    .filter((candidate) => candidate.kind === "PASSWORD_RESET")
    .sort(comparePasswordEmailCandidates);
  const otherEmails = candidates
    .filter((candidate) => candidate.kind !== "PASSWORD_RESET")
    .sort(comparePasswordEmailCandidates);

  if (resets.length === 0) return otherEmails.slice(0, boundedLimit);
  if (otherEmails.length === 0 || boundedLimit === 1) {
    return resets.slice(0, boundedLimit);
  }

  // Les resets restent majoritaires et passent en premier, mais 20 % du lot
  // (au moins une place) reste disponible pour les confirmations. Ainsi, un
  // flux continu de resets ne laisse pas expirer tous les autres emails.
  const reservedOtherSlots = Math.min(
    otherEmails.length,
    Math.max(1, Math.floor(boundedLimit / 5)),
  );
  const selectedResets = resets.slice(0, boundedLimit - reservedOtherSlots);
  const selectedOtherEmails = otherEmails.slice(0, reservedOtherSlots);
  let remainingSlots = boundedLimit - selectedResets.length - selectedOtherEmails.length;

  if (remainingSlots > 0) {
    const additionalResets = resets.slice(
      selectedResets.length,
      selectedResets.length + remainingSlots,
    );
    selectedResets.push(...additionalResets);
    remainingSlots -= additionalResets.length;
  }
  if (remainingSlots > 0) {
    selectedOtherEmails.push(
      ...otherEmails.slice(
        selectedOtherEmails.length,
        selectedOtherEmails.length + remainingSlots,
      ),
    );
  }

  return [...selectedResets, ...selectedOtherEmails];
}

function comparePasswordEmailCandidates(
  left: PasswordEmailCandidate,
  right: PasswordEmailCandidate,
) {
  const priorityDifference = candidatePriority(left) - candidatePriority(right);
  if (priorityDifference !== 0) return priorityDifference;

  const createdAtDifference = left.createdAt.getTime() - right.createdAt.getTime();
  if (createdAtDifference !== 0) return createdAtDifference;
  return left.id < right.id ? -1 : left.id > right.id ? 1 : 0;
}

function candidatePriority(candidate: PasswordEmailCandidate) {
  return candidate.kind === "PASSWORD_RESET" ? 0 : 1;
}
