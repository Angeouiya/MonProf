import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";
import { assertLoadTarget, assertLoadProof } from "../load/target-policy.mjs";
for (const origin of [
  "https://competence.ci",
  "https://www.competence.ci",
  "https://WWW.COMPETENCE.CI:443",
  "https://competence.ci/path",
  "https://www.competence.ci?x=1",
  "https://someone@127.0.0.1:3326",
  "http://127.0.0.1:3326/path",
  "https://127.0.0.1:3326",
]) {
  assert.throws(
    () =>
      assertLoadTarget(origin, { local: true, distributed: true, runId: "qa" }),
    undefined,
    origin,
  );
}
assertLoadTarget("http://127.0.0.1:3326", { local: true, runId: "qa" });
assert.throws(() =>
  assertLoadTarget("http://127.0.0.1:3326", { distributed: true, runId: "qa" }),
);
const proof = {
  runId: "qa",
  dataset: "synthetic",
  productionDataPresent: false,
  writesBlocked: true,
  databaseReadOnly: true,
};
assertLoadProof(proof, "qa");
for (const change of [
  { runId: "other" },
  { productionDataPresent: true },
  { writesBlocked: false },
  { dataset: "production" },
  { databaseReadOnly: false },
])
  assert.throws(() => assertLoadProof({ ...proof, ...change }, "qa"));
const worker = readFileSync("src/lib/web-push.ts", "utf8");
assert.match(
  worker,
  /WHERE "status" IN \('PENDING', 'FAILED', 'PARTIAL', 'PROCESSING'\)/,
);
assert.match(worker, /FOR UPDATE SKIP LOCKED/);
const install = readFileSync("scripts/install-web-push-outbox.mjs", "utf8");
assert.equal(
  (install.match(/SET search_path = pg_catalog, competence/g) || []).length,
  2,
);
assert.match(install, /REVOKE EXECUTE ON FUNCTION competence/);
const migration = readFileSync(
  "prisma/migrations/20261125172113_capacity_security_hardening/migration.sql",
  "utf8",
);
assert.equal((migration.match(/ALTER FUNCTION competence\./g) || []).length, 7);
assert.doesNotMatch(
  migration,
  /DELETE FROM|TRUNCATE|DROP (?:TABLE|SCHEMA)|UPDATE competence\./i,
);
await import("./verify-public-subject-cache.mjs");
const config = ts.parseConfigFileTextToJson("wrangler.jsonc", readFileSync("wrangler.jsonc", "utf8"));
assert.equal(config.error, undefined);
for (const environment of ["production", "staging"]) {
  const consumers = config.config.env[environment].queues.consumers;
  assert.equal(consumers.length, 3);
  assert.ok(consumers.every(queue => queue.max_batch_size === 1 && Number.isInteger(queue.max_concurrency) && queue.max_concurrency <= 4));
  assert.ok(consumers.reduce((sum, queue) => sum + queue.max_concurrency, 0) <= 8, "Background fan-out must remain bounded");
}
console.log(
  "PASS capacity safety: live domains denied, isolated proof mandatory, no destructive migration, notification claims remain locked.",
);
