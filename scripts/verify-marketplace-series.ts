import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { scheduleSlotsConflict } from "../src/lib/schedule-conflict-core";
import { marketplaceClientRequestWhere } from "../src/lib/marketplace-client-history";

const source = (path: string) => readFileSync(path, "utf8");
const missions = source("src/lib/marketplace-missions.ts");
const search = source("src/lib/marketplace-series-search.ts");
const ui = source("src/components/marketplace/client-marketplace-search.tsx");
const migration = source("prisma/migrations/20261104130000_marketplace_series/migration.sql");

const offeredWhere = marketplaceClientRequestWhere("client-1", "active");
assert.deepEqual(offeredWhere.OR, [{ seriesId: null }, { seriesPosition: 0 }, { status: { not: "OFFERED" } }]);
assert.match(migration, /CREATE TABLE "MarketplaceSeries"/);
assert.match(migration, /MarketplaceSeries_clientId_clientKey_key/);
assert.match(migration, /MarketplaceRequest_seriesId_seriesPosition_key/);
assert.match(migration, /ENABLE ROW LEVEL SECURITY/);
assert.match(migration, /REVOKE ALL.*anon, authenticated/);

const date = new Date("2026-12-01T00:00:00.000Z");
const first = { scheduledDate: date, scheduledTime: "18:00", durationMinutes: 120, courseFormat: "HOME", commune: "Cocody", quartier: "Angré" };
assert.equal(scheduleSlotsConflict({ ...first, scheduledTime: "19:00" }, first)?.kind, "OVERLAP");
assert.equal(scheduleSlotsConflict({ ...first, scheduledTime: "17:00", durationMinutes: 60 }, first)?.kind, "TRAVEL_BUFFER");
assert.equal(scheduleSlotsConflict({ ...first, scheduledDate: new Date("2026-12-02T00:00:00.000Z") }, first), null);
assert.match(missions, /scheduleSlotsConflict\(proposedSlots\[index\], proposedSlots\[other\]/);
assert.match(missions, /scheduleSlotsConflict\(slots\[index\], slots\[other\], platformSettings\.scheduleBuffers\)/);
assert.match(missions, /lockSeriesRequests\(tx, seriesId\)/);
assert.match(missions, /ORDER BY "id" FOR UPDATE/);
assert.match(missions, /lockTeacherSchedule\(tx, teacherId\)/);
assert.match(missions, /assertTeacherScheduleAvailable\(tx, \{ teacherId, slots, scheduleBuffers: platformSettings\.scheduleBuffers \}\)/);
assert.match(missions, /available: \{ gte: commissionTotal \}/);
assert.match(missions, /idempotencyKey: `marketplace-reserve:\$\{request\.id\}:\$\{teacherId\}`/);
assert.match(missions, /requests\.some\(\(item\) => item\.status !== "OFFERED"/);
assert.match(missions, /P2002/);
assert.match(missions, /singleRequests \+ seriesRequests >= 5/);
assert.match(missions, /where: \{ seriesId, status: "OFFERED" \}/);
assert.match(search, /findMarketplaceCandidates\(input, 70\)/);
assert.match(search, /available\.get\(candidate\.teacherId\).*candidate\.commissionAmount/);
assert.match(search, /totalClientPrice: courseAmount \+ transportFee/);
assert.match(ui, /Tarif normal de chaque séance, sans remise de pack/);
assert.match(ui, /"\/api\/marketplace\/search-series"/);
assert.match(ui, /"\/api\/marketplace\/series"/);

console.log("Marketplace series: verrous, prix individuels, intégrité et UI vérifiés.");
