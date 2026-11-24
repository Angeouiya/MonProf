export const MARKETPLACE_CANDIDATE_PAGE_SIZE = 70;
export const MARKETPLACE_MAX_SCANNED_PER_POOL = 280;

// Une page pleine peut être entièrement occupée. On poursuit donc après la
// vérification horaire, mais jamais au-delà du budget de travail de la requête.
export async function scanPagedMarketplaceCandidates<T extends { id: string }>(input: {
  loadPage: (skip: number, take: number) => Promise<T[]>;
  inspectPage: (page: T[]) => Promise<void>;
  hasEnough: () => boolean;
  pageSize?: number;
  maxScanned?: number;
}): Promise<string[]> {
  const pageSize = input.pageSize ?? MARKETPLACE_CANDIDATE_PAGE_SIZE;
  const maxScanned = input.maxScanned ?? MARKETPLACE_MAX_SCANNED_PER_POOL;
  if (!Number.isSafeInteger(pageSize) || pageSize < 1 || !Number.isSafeInteger(maxScanned) || maxScanned < 1) {
    throw new Error("Budget de recherche professeur invalide.");
  }
  const scannedIds: string[] = [];
  for (let offset = 0; offset < maxScanned && !input.hasEnough();) {
    const take = Math.min(pageSize, maxScanned - offset);
    const page = await input.loadPage(offset, take);
    scannedIds.push(...page.map((teacher) => teacher.id));
    await input.inspectPage(page);
    offset += page.length;
    if (page.length < take) break;
  }
  return scannedIds;
}
