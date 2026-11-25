import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { linkedSql, MANAGED_PRODUCTION_REF } from "./lib/supabase-linked.mjs";

// Read-only, pinned production audit. No credentials or application rows leave
// PostgreSQL; only function metadata, role options and index validity are read.
const functions = await linkedSql(`
  SELECT p.proname AS name,p.proconfig AS config,p.prosecdef AS security_definer,
    has_function_privilege('anon',p.oid,'EXECUTE') AS anonymous_access,
    has_function_privilege('authenticated',p.oid,'EXECUTE') AS browser_access,
    has_function_privilege('competence_runtime',p.oid,'EXECUTE') AS server_access
  FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='competence' AND p.proname IN (
    'managed_accounting_append_only','managed_commission_snapshot_immutable',
    'enqueue_web_push_notification','enqueue_teacher_web_push_notification',
    'managed_partner_budget_guard','managed_partner_snapshot_guard','managed_parent_confirmation_guard'
  ) ORDER BY p.proname`);
assert.equal(functions.length, 7);
for (const fn of functions) {
  assert.deepEqual(fn.config, ["search_path=pg_catalog, competence"], fn.name);
  assert.equal(fn.anonymous_access, false, fn.name);
  assert.equal(fn.browser_access, false, fn.name);
  assert.equal(fn.server_access, true, fn.name);
  assert.equal(fn.security_definer, fn.name.startsWith("enqueue_"), fn.name);
}
const indexes = await linkedSql(`SELECT c.relname,i.indisvalid,i.indisready
  FROM pg_index i JOIN pg_class c ON c.oid=i.indexrelid
  JOIN pg_namespace n ON n.oid=c.relnamespace
  WHERE n.nspname='competence' AND c.relname='WebPushOutbox_active_priority_created_idx'`);
assert.equal(indexes.length, 1);
assert.equal(indexes[0].indisvalid, true);
assert.equal(indexes[0].indisready, true);
const maintenance = await linkedSql(`SELECT inherit_option,set_option FROM pg_auth_members
  WHERE roleid='competence_migrator'::regrole AND member='postgres'::regrole`);
assert.ok(maintenance.length > 0);
assert.ok(maintenance.every(row => !row.inherit_option && !row.set_option), "Temporary maintenance elevation must be restored");
const report = { passed: true, testedAt: new Date().toISOString(), projectRef: MANAGED_PRODUCTION_REF, readOnly: true, functions, indexes, maintenance };
mkdirSync("output/managed-qa", { recursive: true });
writeFileSync("output/managed-qa/capacity-production-security.json", JSON.stringify(report, null, 2));
console.log("PASS production capacity/security: seven internal functions hardened, priority index valid, maintenance role restored; no application data read or changed.");
