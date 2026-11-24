import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createJiti } from "jiti";

const { scanPagedMarketplaceCandidates } = createJiti(import.meta.url)("../src/lib/marketplace-candidate-scan.ts");
const rows = Array.from({ length: 71 }, (_, index) => ({ id: `prof-${index + 1}`, occupied: index < 70 }));
const pageCalls = [];
const available = [];
const scanned = await scanPagedMarketplaceCandidates({
  loadPage: async (skip, take) => {
    pageCalls.push({ skip, take });
    return rows.slice(skip, skip + take);
  },
  inspectPage: async (page) => available.push(...page.filter((teacher) => !teacher.occupied)),
  hasEnough: () => available.length >= 1,
});
assert.deepEqual(pageCalls, [{ skip: 0, take: 70 }, { skip: 70, take: 70 }]);
assert.equal(available[0]?.id, "prof-71", "Un professeur disponible après 70 occupés ne doit pas disparaître");
assert.equal(new Set(scanned).size, scanned.length, "Aucun candidat ne doit être compté deux fois");

let scannedLimit = 0;
await scanPagedMarketplaceCandidates({
  loadPage: async (skip, take) => Array.from({ length: take }, (_, index) => ({ id: `p-${skip + index}` })),
  inspectPage: async (page) => { scannedLimit += page.length; },
  hasEnough: () => false,
});
assert.equal(scannedLimit, 280, "Le scan doit rester borné sous forte charge");

const search = readFileSync("src/lib/marketplace-search.ts", "utf8");
assert.match(search, /scanPagedMarketplaceCandidates\(\{/);
assert.match(search, /hasEnough: \(\) => result\.length >= targetCount/);
assert.match(search, /id: \{ notIn: scannedLocalIds \}/);
assert.match(search, /orderBy: \[\{ rating: "desc" \}, \{ ratingCount: "desc" \}, \{ id: "asc" \}\]/);
console.log("Recherche V2 : 71e professeur trouvé, ordre stable, pas de doublon, scan borné.");
