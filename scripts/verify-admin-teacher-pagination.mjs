import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const page = readFileSync("src/app/admin/professeurs/page.tsx", "utf8");
assert.match(page, /const TEACHERS_PER_PAGE = 30/);
assert.match(page, /db\.teacher\.findMany\(\{[\s\S]*?skip: \(page - 1\) \* TEACHERS_PER_PAGE,[\s\S]*?take: TEACHERS_PER_PAGE/);
assert.match(page, /db\.teacher\.count\(\{ where \}\)/);
assert.match(page, /orderBy: \[\{ featured: "desc" \}, \{ createdAt: "desc" \}, \{ id: "desc" \}]/);
assert.match(page, /for \(const key of \["q", "status", "subject", "commune", "badge", "photo"\] as const\)/);
assert.match(page, /<nav aria-label="Pages des professeurs"/);
assert.doesNotMatch(page, /totalGenerated|grossToPay|<Money amount=\{(?:blocked|toPay)/, "La liste ne doit pas présenter de montants tronqués aux 200 derniers cours");
assert.match(page, /select: \{ status: true, paymentStatus: true \}/);
console.log("Liste admin professeurs : page bornée, total indépendant et filtres conservés.");
