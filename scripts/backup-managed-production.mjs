import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { linkedSql, MANAGED_PRODUCTION_REF } from "./lib/supabase-linked.mjs";
if (process.platform !== "win32") throw new Error("This backup uses Windows DPAPI; use an encrypted pg_dump on another OS.");
const tables = await linkedSql("SELECT table_name FROM information_schema.tables WHERE table_schema='competence' AND table_type='BASE TABLE' ORDER BY table_name");
if (!tables.some((table) => table.table_name === "User") || !tables.some((table) => table.table_name === "Teacher")) throw new Error("Wrong application schema.");
const quote = (value) => `"${value.replaceAll('"', '""')}"`;
const pairs = tables.map(({ table_name: name }) => `'${name.replaceAll("'", "''")}', COALESCE((SELECT jsonb_agg(to_jsonb(t)) FROM competence.${quote(name)} t),'[]'::jsonb)`);
// One SELECT = one MVCC snapshot for all application tables. Contents are never
// printed, sent to GitHub or copied into a local QA fixture.
const objects = [];
for (let offset = 0; offset < pairs.length; offset += 40) objects.push(`jsonb_build_object(${pairs.slice(offset, offset + 40).join(",")})`);
const [row] = await linkedSql(`SELECT ${objects.join(" || ")} AS backup`, { maxBuffer: 256 * 1024 * 1024 });
const contents = Buffer.from(JSON.stringify({ projectRef: MANAGED_PRODUCTION_REF, schema: "competence", createdAt: new Date().toISOString(), tables: row.backup }));
const counts = Object.fromEntries(Object.entries(row.backup).map(([name, records]) => [name, records.length]));
const protect = (bytes, decrypt = false) => execFileSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", `Add-Type -AssemblyName System.Security; $backupStream = New-Object IO.MemoryStream; [Console]::OpenStandardInput().CopyTo($backupStream); $backupBytes = [Security.Cryptography.ProtectedData]::${decrypt ? "Unprotect" : "Protect"}($backupStream.ToArray(), $null, [Security.Cryptography.DataProtectionScope]::CurrentUser); [Console]::OpenStandardOutput().Write($backupBytes, 0, $backupBytes.Length)`], { input: bytes, maxBuffer: 512 * 1024 * 1024, windowsHide: true });
const encrypted = protect(contents);
const restored = protect(encrypted, true);
const digest = (bytes) => createHash("sha256").update(bytes).digest("hex");
assert.equal(digest(restored), digest(contents), "Backup encryption round trip must match before migration");
const directory = path.resolve("output/managed-qa/backups"); mkdirSync(directory, { recursive: true });
const filename = path.join(directory, `competence-${new Date().toISOString().replaceAll(/[:.]/g, "-")}.json.dpapi`);
writeFileSync(filename, encrypted, { mode: 0o600 });
const metadata = { filename, projectRef: MANAGED_PRODUCTION_REF, schema: "competence", createdAt: new Date().toISOString(), encryptedBytes: encrypted.length, sha256: digest(contents), counts, encryptionRoundTripVerified: true, format: "Application rows JSON, encrypted with current Windows user's DPAPI; not a full cluster pg_dump" };
writeFileSync(path.join(directory, "latest-metadata.json"), JSON.stringify(metadata, null, 2));
console.log(JSON.stringify({ filename, encryptedBytes: encrypted.length, tables: tables.length, users: counts.User, teachers: counts.Teacher, bookings: counts.Booking, encryptionRoundTripVerified: true }, null, 2));
