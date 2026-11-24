import type { MarketplaceRequestStatus, Prisma } from "@prisma/client";

export const MARKETPLACE_ARCHIVED_STATUSES = ["COMPLETED", "CANCELLED", "EXPIRED"] as const satisfies readonly MarketplaceRequestStatus[];

export function isMarketplaceArchived(status: string): boolean {
  return MARKETPLACE_ARCHIVED_STATUSES.some((archived) => archived === status);
}

export function marketplaceClientRequestWhere(clientId: string, scope: "active" | "archived"): Prisma.MarketplaceRequestWhereInput {
  return {
    clientId,
    status: scope === "archived"
      ? { in: [...MARKETPLACE_ARCHIVED_STATUSES] }
      : { notIn: [...MARKETPLACE_ARCHIVED_STATUSES] },
    // Une recherche multi-dates est une seule offre tant que le professeur
    // n'a pas accepté. Les séances deviennent indépendantes ensuite.
    ...(scope === "active" ? {
      // Explicit NULL branch: SQL NOT(seriesPosition > 0) would otherwise
      // evaluate to UNKNOWN and hide historical single-session requests.
      OR: [{ seriesId: null }, { seriesPosition: 0 }, { status: { not: "OFFERED" as const } }],
    } : {}),
  };
}
