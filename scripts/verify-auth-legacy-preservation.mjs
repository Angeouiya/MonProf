import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { linkedSql, MANAGED_PRODUCTION_REF } from "./lib/supabase-linked.mjs";

// Read-only comparison against an encrypted pre-rollout backup. No identifier,
// password/hash, token or backup content is printed or written in plaintext.
const backupFile = process.argv[2];
if (!backupFile?.endsWith(".json.dpapi") || process.platform !== "win32") throw new Error("Pass the encrypted Windows backup path.");
const decrypted = execFileSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", "Add-Type -AssemblyName System.Security; $authAuditStream = New-Object IO.MemoryStream; [Console]::OpenStandardInput().CopyTo($authAuditStream); $authAuditPlain = [Security.Cryptography.ProtectedData]::Unprotect($authAuditStream.ToArray(), $null, [Security.Cryptography.DataProtectionScope]::CurrentUser); [Console]::OpenStandardOutput().Write($authAuditPlain, 0, $authAuditPlain.Length)"], { input: readFileSync(backupFile), windowsHide: true, maxBuffer: 128 * 1024 * 1024 });
const backup = JSON.parse(decrypted.toString("utf8"));
decrypted.fill(0);
assert.equal(backup.projectRef, MANAGED_PRODUCTION_REF);
assert.equal(backup.schema, "competence");
const [row] = await linkedSql(`SELECT json_build_object(
  'users', (SELECT json_agg(json_build_object('id',id,'digest',md5("passwordHash"))) FROM competence."User"),
  'teachers', (SELECT json_agg(json_build_object('id',id,'digest',md5(COALESCE("portalPasswordHash",'')))) FROM competence."Teacher")
) AS credentials`);
const digest = (value) => createHash("md5").update(value ?? "").digest("hex");
const result = {};
for (const [table, field, key] of [["User", "passwordHash", "users"], ["Teacher", "portalPasswordHash", "teachers"]]) {
  const current = new Map((row.credentials[key] ?? []).map((item) => [item.id, item.digest]));
  const previous = backup.tables[table];
  const missing = previous.filter((item) => !current.has(item.id)).length;
  const unchanged = previous.filter((item) => current.get(item.id) === digest(item[field])).length;
  result[key] = { previous: previous.length, current: current.size, missing, unchanged, changed: previous.length - unchanged - missing };
}
console.log(JSON.stringify({ baselineAt: backup.createdAt, readOnly: true, result }, null, 2));
for (const counts of Object.values(result)) {
  assert.equal(counts.missing, 0, "A historical account is missing");
  assert.equal(counts.changed, 0, "A historical credential hash changed; investigate before publishing");
}
