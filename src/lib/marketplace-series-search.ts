import { db } from "@/lib/db";
import { parseMarketplaceSearchInput } from "@/lib/marketplace-input";
import { findMarketplaceCandidates, type MarketplaceCandidate, type MarketplaceSearchInput } from "@/lib/marketplace-search";
import { scheduleSlotsConflict } from "@/lib/schedule-conflict-core";
import { getPlatformRuntimeSettings } from "@/lib/platform-settings";

export type MarketplaceSeriesCandidate = MarketplaceCandidate & {
  sessions: { date: string; time: string; durationMinutes: number; courseAmount: number; transportFee: number; totalClientPrice: number }[];
};

export async function parseMarketplaceSeriesInput(raw: unknown): Promise<MarketplaceSearchInput[]> {
  if (!raw || typeof raw !== "object") throw new Error("Demande de suivi invalide.");
  const value = raw as Record<string, unknown>;
  if (!Array.isArray(value.sessions) || value.sessions.length < 2 || value.sessions.length > 6) {
    throw new Error("Choisissez entre 2 et 6 dates de cours.");
  }
  const dates = new Set<string>();
  const inputs: MarketplaceSearchInput[] = [];
  for (const item of value.sessions) {
    if (!item || typeof item !== "object") throw new Error("Un horaire du suivi est invalide.");
    const session = item as Record<string, unknown>;
    const input = await parseMarketplaceSearchInput({
      ...value,
      date: session.date,
      time: session.time,
      durationMinutes: session.durationMinutes,
    });
    const date = input.scheduledDate.toISOString().slice(0, 10);
    if (dates.has(date)) throw new Error("Choisissez une seule séance par date pour ce suivi.");
    dates.add(date);
    inputs.push(input);
  }
  inputs.sort((a, b) => a.scheduledDate.getTime() - b.scheduledDate.getTime());
  const platformSettings = await getPlatformRuntimeSettings();
  for (let index = 0; index < inputs.length; index++) {
    for (let other = index + 1; other < inputs.length; other++) {
      if (scheduleSlotsConflict(inputs[index], inputs[other], platformSettings.scheduleBuffers)) {
        throw new Error("Deux séances du suivi se chevauchent ou ne laissent pas assez de temps de déplacement.");
      }
    }
  }
  return inputs;
}

export async function findMarketplaceSeriesCandidates(inputs: MarketplaceSearchInput[]): Promise<MarketplaceSeriesCandidate[]> {
  if (inputs.length < 2 || inputs.length > 6) throw new Error("Choisissez entre 2 et 6 dates de cours.");
  const lists = await Promise.all(inputs.map((input) => findMarketplaceCandidates(input, 70)));
  if (lists.some((list) => list.length === 0)) return [];
  const byTeacher = lists.map((list) => new Map(list.map((candidate) => [candidate.teacherId, candidate])));
  const candidates: MarketplaceSeriesCandidate[] = [];
  for (const first of lists[0]) {
    const sessions = byTeacher.map((list) => list.get(first.teacherId));
    if (sessions.some((candidate) => !candidate)) continue;
    const every = sessions as MarketplaceCandidate[];
    const courseAmount = every.reduce((sum, item) => sum + item.courseAmount, 0);
    const transportFee = every.reduce((sum, item) => sum + item.transportFee, 0);
    const commissionAmount = every.reduce((sum, item) => sum + item.commissionAmount, 0);
    candidates.push({
      ...first,
      courseAmount,
      transportFee,
      totalClientPrice: courseAmount + transportFee,
      commissionAmount,
      transportOriginLabel: "Déplacement estimé séparément pour chaque date",
      score: Math.round(every.reduce((sum, item) => sum + item.score, 0) / every.length),
      sessions: every.map((candidate, index) => ({
        date: inputs[index].scheduledDate.toISOString().slice(0, 10),
        time: inputs[index].scheduledTime,
        durationMinutes: inputs[index].durationMinutes,
        courseAmount: candidate.courseAmount,
        transportFee: candidate.transportFee,
        totalClientPrice: candidate.totalClientPrice,
      })),
    });
  }
  if (!candidates.length) return [];
  const wallets = await db.teacherWallet.findMany({
    where: { teacherId: { in: candidates.map((candidate) => candidate.teacherId) } },
    select: { teacherId: true, available: true },
  });
  const available = new Map(wallets.map((wallet) => [wallet.teacherId, wallet.available]));
  return candidates
    .filter((candidate) => (available.get(candidate.teacherId) ?? 0) >= candidate.commissionAmount)
    .sort((a, b) => b.score - a.score || a.teacherId.localeCompare(b.teacherId))
    .slice(0, 12);
}
