type TeacherDisplayRatingInput = {
  rating?: number | null;
  ratingCount?: number | null;
  adminRating?: number | null;
  adminRatingPublic?: boolean | null;
};

export type TeacherDisplayRating = {
  hasRating: boolean;
  average: number;
  count: number;
  countLabel: string;
  sourceLabel: string;
};

export function getTeacherDisplayRating(teacher: TeacherDisplayRatingInput): TeacherDisplayRating {
  const clientCount = Math.max(0, Math.round(Number(teacher.ratingCount ?? 0)));
  const clientRating = clampRating(Number(teacher.rating ?? 0));
  const adminRating = clampRating(Number(teacher.adminRating ?? 0));
  const includeAdminRating = Boolean(teacher.adminRatingPublic && adminRating > 0);

  if (clientCount > 0 && clientRating > 0) {
    const weightedTotal = (clientRating * clientCount) + (includeAdminRating ? adminRating : 0);
    const totalCount = clientCount + (includeAdminRating ? 1 : 0);
    const average = roundRating(weightedTotal / totalCount);
    const clientLabel = `${clientCount} avis`;
    const sourceLabel = includeAdminRating ? `${clientLabel} + Compétence` : clientLabel;

    return {
      hasRating: true,
      average,
      count: totalCount,
      countLabel: sourceLabel,
      sourceLabel,
    };
  }

  if (includeAdminRating) {
    return {
      hasRating: true,
      average: roundRating(adminRating),
      count: 1,
      countLabel: "Compétence",
      sourceLabel: "Compétence",
    };
  }

  return {
    hasRating: false,
    average: 0,
    count: 0,
    countLabel: "Aucun avis",
    sourceLabel: "Nouveau · aucun avis",
  };
}

function clampRating(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(5, value));
}

function roundRating(value: number) {
  return Math.round(value * 10) / 10;
}
