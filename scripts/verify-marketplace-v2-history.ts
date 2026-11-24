import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { isMarketplaceArchived, marketplaceClientRequestWhere } from "../src/lib/marketplace-client-history";

const active = marketplaceClientRequestWhere("client-test", "active");
const archived = marketplaceClientRequestWhere("client-test", "archived");
assert.deepEqual(active, {
  clientId: "client-test",
  status: { notIn: ["COMPLETED", "CANCELLED", "EXPIRED"] },
  OR: [{ seriesId: null }, { seriesPosition: 0 }, { status: { not: "OFFERED" } }],
});
assert.deepEqual(archived, { clientId: "client-test", status: { in: ["COMPLETED", "CANCELLED", "EXPIRED"] } });
for (const status of ["COMPLETED", "CANCELLED", "EXPIRED"]) assert.equal(isMarketplaceArchived(status), true);
for (const status of ["SEARCHING", "OFFERED", "ACCEPTED", "IN_PROGRESS", "AWAITING_CLIENT", "DISPUTED"]) {
  assert.equal(isMarketplaceArchived(status), false);
}

const source = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const historyPage = source("src/app/client/historique/page.tsx");
const activePage = source("src/app/client/demandes/page.tsx");
const layout = source("src/components/layouts/client-layout.tsx");
assert.match(historyPage, /marketplaceClientRequestWhere\(client\.id, "archived"\)/);
assert.match(activePage, /marketplaceClientRequestWhere\(client\.id, "active"\)/);
assert.match(historyPage, /Montant annoncé/);
assert.doesNotMatch(historyPage, /hasVerifiedClientPayment|providerPaymentStatus|paydunyaVerifiedAt/);
assert.match(historyPage, /href="\/client\/cours"/);
assert.match(layout, /href: "\/client\/historique", label: "Historique"/);

console.log("OK Marketplace V2 : historique paginé séparé des demandes actives et des anciens paiements Jèko.");
