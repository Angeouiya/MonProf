import type { Prisma, ReviewAdminStatus } from "@prisma/client";

export const REVIEW_REPUTATION_CLOSED_STATUS_VALUES = ["RESOLVED", "DISMISSED"] as const satisfies readonly ReviewAdminStatus[];
export const REVIEW_REPUTATION_CLOSED_STATUSES = new Set<string>(REVIEW_REPUTATION_CLOSED_STATUS_VALUES);

export const REVIEW_REPUTATION_COMMENT_TERMS = [
  "arnaque",
  "escroquerie",
  "fraude",
  "faux profil",
  "faux professeur",
  "imposteur",
  "jamais venu",
  "absence",
  "absent",
  "cours non assuré",
  "cours non fait",
  "cours pas fait",
  "pas venu",
  "n'est pas venu",
  "ne s'est pas présenté",
  "retard énorme",
  "insulte",
  "insulté",
  "menace",
  "menacé",
  "agressif",
  "agression",
  "irrespectueux",
  "comportement inadmissible",
  "comportement inacceptable",
  "paiement direct",
  "payer directement",
  "hors plateforme",
  "contourner la plateforme",
  "remboursement",
  "rembourser",
  "plainte",
  "vol",
] as const;

type ReviewReputationInput = {
  rating: number;
  comment?: string | null;
  adminStatus?: string | null;
};

export type ReviewReputationRisk = {
  isReputationRisk: boolean;
  level: "NONE" | "CRITICAL";
  label: string;
  adminStatus: "NEW" | "TO_REVIEW" | "ESCALATED";
  priority: "NORMAL" | "URGENT" | "CRITICAL";
  reasons: string[];
  matchedTerms: string[];
  shouldObserveTeacher: boolean;
};

export function detectReviewReputationRisk(input: ReviewReputationInput): ReviewReputationRisk {
  const rating = Math.round(Number(input.rating));
  const matchedTerms = findReputationTerms(input.comment);
  const reasons: string[] = [];

  if (rating <= 2) {
    reasons.push(`note critique ${rating}/5`);
  }
  if (rating === 3 && matchedTerms.length > 0) {
    reasons.push(`commentaire sensible avec note ${rating}/5`);
  }

  const isReputationRisk = reasons.length > 0;

  return {
    isReputationRisk,
    level: isReputationRisk ? "CRITICAL" : "NONE",
    label: isReputationRisk ? "Risque réputation" : "Avis standard",
    adminStatus: isReputationRisk ? "ESCALATED" : rating <= 3 ? "TO_REVIEW" : "NEW",
    priority: isReputationRisk ? "CRITICAL" : rating <= 3 ? "URGENT" : "NORMAL",
    reasons,
    matchedTerms,
    shouldObserveTeacher: isReputationRisk,
  };
}

export function isOpenReputationReview(input: ReviewReputationInput) {
  if (input.adminStatus && REVIEW_REPUTATION_CLOSED_STATUSES.has(input.adminStatus)) {
    return false;
  }
  return detectReviewReputationRisk(input).isReputationRisk;
}

export function getReviewReputationPrismaWhere(): Prisma.ReviewWhereInput {
  return {
    AND: [
      { adminStatus: { notIn: [...REVIEW_REPUTATION_CLOSED_STATUS_VALUES] } },
      {
        OR: [
          { rating: { lte: 2 } },
          {
            AND: [
              { rating: 3 },
              {
                OR: REVIEW_REPUTATION_COMMENT_TERMS.map((term) => ({
                  comment: { contains: term, mode: "insensitive" as const },
                })),
              },
            ],
          },
        ],
      },
    ],
  };
}

function findReputationTerms(comment?: string | null) {
  const normalized = normalizeReviewText(comment);
  if (!normalized) return [];

  return REVIEW_REPUTATION_COMMENT_TERMS.filter((term) => (
    normalized.includes(normalizeReviewText(term))
  ));
}

function normalizeReviewText(value?: string | null) {
  return (value ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}
