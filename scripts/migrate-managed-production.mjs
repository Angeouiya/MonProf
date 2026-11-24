import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { linkedSql, MANAGED_PRODUCTION_REF } from "./lib/supabase-linked.mjs";
const apply = process.argv.includes("--apply");
if (process.argv.slice(2).some((arg) => arg !== "--apply")) throw new Error("Only --apply is supported. No target override is allowed.");
const sqlQuote = (value) => `'${value.replaceAll("'", "''")}'`;
const hash = (value) => createHash("sha256").update(value).digest("hex");
const [stateRow] = await linkedSql(readFileSync("scripts/sql/managed-production-state.sql", "utf8"));
const state = stateRow.state;
assert.equal(state.runtimeSchemaUsage, true);
const finished = new Map(state.migrations.filter((item) => item.finished_at && !item.rolled_back_at).map((item) => [item.migration_name, item]));
assert.equal(state.migrations.filter((item) => !item.finished_at && !item.rolled_back_at).length, 0, "An unfinished migration requires investigation before proceeding");
const source = readdirSync("prisma/migrations").filter((name) => /^\d{14}_/.test(name)).sort().map((name) => ({ name, raw: readFileSync(`prisma/migrations/${name}/migration.sql`) }));
for (const migration of source.filter((item) => finished.has(item.name))) {
  const recorded = finished.get(migration.name).checksum;
  assert.ok([hash(migration.raw), hash(migration.raw.toString().replaceAll("\r\n", "\n"))].includes(recorded), `Applied migration checksum differs: ${migration.name}`);
}
const pending = source.filter((item) => !finished.has(item.name));
assert.ok(pending.every((item) => item.name >= "20260901"), "Never replay an old baseline over existing data");
console.log(JSON.stringify({ mode: apply ? "apply" : "dry-run", projectRef: MANAGED_PRODUCTION_REF, schema: "competence", before: state.counts, pending: pending.map((item) => item.name), managedSecurity: state.managedSecurity, maintenanceRoleOptions: state.maintenanceRoleOptions }, null, 2));
if (!apply) process.exit(0);
const backup = JSON.parse(readFileSync("output/managed-qa/backups/latest-metadata.json", "utf8"));
const qa = JSON.parse(readFileSync("output/managed-qa/postgres-results.json", "utf8"));
assert.equal(backup.projectRef, MANAGED_PRODUCTION_REF); assert.equal(backup.schema, "competence");
assert.equal(backup.encryptionRoundTripVerified, true); assert.ok(existsSync(backup.filename));
assert.ok(Date.now() - new Date(backup.createdAt).getTime() < 2 * 3_600_000, "A fresh verified encrypted backup is required");
assert.equal(qa.passed, true); assert.equal(qa.historicalDataPreserved, true); assert.equal(qa.remoteDatabaseUsed, false);
assert.equal(qa.httpPassed, true, "Real HTTP guest intake and authorization tests must pass before production migration");
assert.ok(Date.now() - new Date(qa.testedAt).getTime() < 2 * 3_600_000, "Local migration/financial test report must be fresh");
for (const migration of pending) {
  assert.equal(qa.migrationHashes?.[migration.name], hash(migration.raw), `This exact migration was not tested locally: ${migration.name}`);
  assert.doesNotMatch(migration.raw.toString(), /\b(?:DROP\s+(?:TABLE|SCHEMA)|DROP\s+COLUMN|TRUNCATE|DELETE\s+FROM)\b/i, `Destructive migration refused: ${migration.name}`);
}
const audit = [];
mkdirSync("output/managed-qa", { recursive: true });
const [membership] = await linkedSql("SELECT m.inherit_option, m.set_option, m.admin_option FROM pg_auth_members m JOIN pg_roles r ON r.oid=m.roleid JOIN pg_roles u ON u.oid=m.member WHERE r.rolname='competence_migrator' AND u.rolname='postgres'");
assert.equal(membership?.admin_option, true, "The maintenance login must already administer the dedicated migration role");
// Supabase deliberately creates this existing DBA membership with SET/INHERIT
// disabled. Enable it only for this bounded maintenance operation, then restore
// its exact prior options even if a DDL statement fails. Runtime is not elevated.
writeFileSync("output/managed-qa/migration-role-restore.json", JSON.stringify(membership));
await linkedSql("GRANT competence_migrator TO postgres WITH INHERIT TRUE, SET TRUE; SELECT true AS ready;");
try {
for (const migration of pending) {
  const checksum = hash(migration.raw.toString().replaceAll("\r\n", "\n"));
  const id = randomUUID();
  const begin = `BEGIN; SET LOCAL search_path=competence,pg_catalog,public; SELECT 1 FROM pg_advisory_xact_lock(hashtext('competence-managed-rollout')); DO $guard$ BEGIN IF EXISTS (SELECT 1 FROM competence._prisma_migrations WHERE migration_name=${sqlQuote(migration.name)} AND rolled_back_at IS NULL) THEN RAISE EXCEPTION 'Migration already present; re-inspect'; END IF; END $guard$;`;
  const insert = (complete) => `INSERT INTO competence._prisma_migrations(id,checksum,migration_name,started_at,finished_at,applied_steps_count) VALUES (${sqlQuote(id)},${sqlQuote(checksum)},${sqlQuote(migration.name)},now(),${complete ? "now()" : "NULL"},${complete ? 1 : 0});`;
  // Keep new objects owned by the dedicated migration role. It inherits the
  // existing competence_app owner (verified before the rollout), not runtime.
  const sql = `SET LOCAL ROLE competence_migrator;\n${migration.raw.toString()}`;
  if (sql.includes("CREATE INDEX CONCURRENTLY")) {
    const [prefix, ...indexes] = sql.split(/(?=CREATE INDEX CONCURRENTLY)/);
    await linkedSql(`${begin}\n${prefix}\n${insert(false)} COMMIT; SELECT true AS started;`);
    for (const indexSql of indexes) {
      // A separate statement cannot rely on a preceding SET (which would
      // implicitly put CONCURRENTLY inside a transaction). Qualify only ON.
      const qualified = indexSql.replace(/\bON\s+"/g, 'ON competence."');
      await linkedSql(qualified);
    }
    const indexNames = [...sql.matchAll(/CREATE INDEX CONCURRENTLY IF NOT EXISTS "([^"]+)"/g)].map((match) => match[1]);
    const indexesState = await linkedSql(`SELECT c.relname,i.indisvalid FROM pg_index i JOIN pg_class c ON c.oid=i.indexrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='competence' AND c.relname IN (${indexNames.map(sqlQuote).join(",")})`);
    assert.equal(indexesState.length, indexNames.length); assert.ok(indexesState.every((index) => index.indisvalid));
    await linkedSql(`UPDATE competence._prisma_migrations SET finished_at=now(),applied_steps_count=1 WHERE id=${sqlQuote(id)} AND finished_at IS NULL; SELECT true AS completed;`);
  } else {
    await linkedSql(`${begin}\n${sql}\n${insert(true)} COMMIT; SELECT true AS completed;`);
  }
  audit.push({ migration: migration.name, checksum, completedAt: new Date().toISOString() });
  writeFileSync("output/managed-qa/production-migration-audit.json", JSON.stringify({ projectRef: MANAGED_PRODUCTION_REF, schema: "competence", backupFile: backup.filename, migrations: audit }, null, 2));
  console.log(`APPLIED ${migration.name}`);
}
} finally {
  await linkedSql(`GRANT competence_migrator TO postgres WITH INHERIT ${membership.inherit_option ? "TRUE" : "FALSE"}, SET ${membership.set_option ? "TRUE" : "FALSE"}; SELECT true AS restored;`);
}
const [afterRow] = await linkedSql(readFileSync("scripts/sql/managed-production-state.sql", "utf8"));
for (const key of ["users", "teachers", "bookings", "transactions"]) assert.ok(afterRow.state.counts[key] >= state.counts[key], `Historical ${key} count decreased`);
assert.ok(afterRow.state.newTables?.includes("ManagedCourseDossier"));
console.log(JSON.stringify({ completed: true, before: state.counts, after: afterRow.state.counts, migrationsApplied: audit.length, historicalCountsPreserved: true }, null, 2));
