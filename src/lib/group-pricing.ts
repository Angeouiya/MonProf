export const SMALL_GROUP_MIN_PARTICIPANTS = 2;
export const SMALL_GROUP_MAX_PARTICIPANTS = 12;
export const LARGE_GROUP_MIN_PARTICIPANTS = 13;
export const SMALL_GROUP_EXTRA_RATE = 0.5;
export const LARGE_GROUP_EXTRA_RATE = 0.4;

export function normalizeParticipantCount(value: unknown, fallback = 1) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(1, Math.round(parsed));
}

export function groupPricingDetails(participantsCount: unknown) {
  const count = normalizeParticipantCount(participantsCount);
  const smallGroupExtraParticipants = Math.min(
    Math.max(0, count - 1),
    SMALL_GROUP_MAX_PARTICIPANTS - 1,
  );
  const largeGroupExtraParticipants = Math.max(0, count - SMALL_GROUP_MAX_PARTICIPANTS);
  const multiplier = 1
    + smallGroupExtraParticipants * SMALL_GROUP_EXTRA_RATE
    + largeGroupExtraParticipants * LARGE_GROUP_EXTRA_RATE;

  return {
    participantsCount: count,
    smallGroupExtraParticipants,
    largeGroupExtraParticipants,
    multiplier,
    isLargeGroup: count >= LARGE_GROUP_MIN_PARTICIPANTS,
  };
}

export function groupPricingMultiplier(participantsCount: unknown) {
  return groupPricingDetails(participantsCount).multiplier;
}
