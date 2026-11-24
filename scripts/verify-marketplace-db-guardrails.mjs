import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const schema = readFileSync("prisma/schema.prisma", "utf8");
const migration = readFileSync("prisma/migrations/20261104150000_marketplace_scale_rls/migration.sql", "utf8");
const worker = readFileSync("cloudflare-worker.ts", "utf8");

for (const table of [
  "MarketplaceRequest", "MarketplaceOffer", "MarketplaceReview",
  "TeacherWallet", "TeacherWalletEntry", "TeacherWalletTopUp",
]) {
  assert.match(migration, new RegExp(`ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY;`));
}
for (const index of [
  "TeacherSubject_subjectId_teacherId_idx", "TeacherLevel_levelId_teacherId_idx",
  "TeacherZone_communeId_teacherId_idx", "Booking_teacherId_scheduledDate_idx",
  "MarketplaceRequest_status_createdAt_id_idx",
]) {
  assert.ok(migration.includes(`CREATE INDEX CONCURRENTLY IF NOT EXISTS "${index}"`));
}
assert.match(schema, /model TeacherSubject \{[\s\S]*?@@index\(\[subjectId, teacherId\]\)/);
assert.match(schema, /model TeacherLevel \{[\s\S]*?@@index\(\[levelId, teacherId\]\)/);
assert.match(schema, /model TeacherZone \{[\s\S]*?@@index\(\[communeId, teacherId\]\)/);
assert.match(worker, /pathname\.startsWith\("\/api\/marketplace\/search"\)/);
assert.match(worker, /pathname\.startsWith\("\/api\/marketplace\/series"\)/);
console.log("Marketplace V2 : RLS, index inverses et quota edge vérifiés statiquement.");
