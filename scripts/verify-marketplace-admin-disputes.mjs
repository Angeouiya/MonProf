import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const page = readFileSync("src/app/admin/marketplace/page.tsx", "utf8");
assert.match(page, /marketplaceRequest\.count\(\{ where: \{ status: "DISPUTED" \} \}\)/);
assert.match(page, /const disputeRows = await db\.marketplaceRequest\.findMany\(\{/);
assert.match(page, /status: "DISPUTED",[\s\S]*?createdAt: \{ lt: disputeCursor\.createdAt \}/);
assert.match(page, /take: 21/);
assert.match(page, /hasMoreDisputes = disputeRows\.length > 20/);
assert.match(page, /AdminMarketplaceDisputeActions requestId=\{dispute\.id\}/);
assert.match(page, /litigesApres=\$\{encodeURIComponent\(nextDisputeCursor\)\}/);
assert.doesNotMatch(page, /requests\.filter\(\(item\) => item\.status === "DISPUTED"\)/);
console.log("Admin V2 : litiges ouverts indépendants des 50 dernières missions vérifiés.");
