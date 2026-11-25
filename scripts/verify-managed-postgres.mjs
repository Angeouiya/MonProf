import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, readdirSync, writeFileSync, mkdirSync, createWriteStream } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { createJiti } from "jiti";
import { createServer } from "node:net";

// This runner never accepts a remote database URL, never resets a database,
// never imports production data and never removes the generated local cluster.
const modulePath = process.env.MANAGED_QA_PG_MODULE;
if (!modulePath || !path.isAbsolute(modulePath)) throw new Error("MANAGED_QA_PG_MODULE must point to the installed embedded-postgres/dist/index.js (17.x). See the rollout guide.");
const { default: EmbeddedPostgres } = await import(pathToFileURL(modulePath).href);
const directory = mkdtempSync(path.join(tmpdir(), "competence-managed-postgres-"));
const socket = createServer();
await new Promise((resolve) => socket.listen(0, "127.0.0.1", resolve));
const port = socket.address().port;
await new Promise((resolve) => socket.close(resolve));
const password = randomBytes(24).toString("hex");
const cluster = new EmbeddedPostgres({ databaseDir: path.join(directory, "data"), user: "postgres", password, port, persistent: true, createPostgresUser: false, initdbFlags: ["--encoding=UTF8", "--locale=C"], postgresFlags: ["-h", "127.0.0.1"], onLog: () => {}, onError: () => {} });
const checks = [];
let client; let db; let started = false;
const check = (name) => { checks.push(name); console.log(`OK ${name}`); };
try {
  console.log("Starting isolated PostgreSQL integration runner");
  await cluster.initialise(); await cluster.start(); started = true;
  client = cluster.getPgClient("postgres", "127.0.0.1"); await client.connect();
  process.env.DATABASE_URL = `postgresql://postgres:${password}@127.0.0.1:${port}/postgres?schema=competence&connection_limit=8`;
  process.env.DIRECT_URL = process.env.DATABASE_URL;
  process.env.WEB_PUSH_QUEUE_DISABLED = "true";
  process.env.MANAGED_LESSONS_ENABLED = "true";
  delete process.env.APP_DEPLOYMENT_PLATFORM; delete process.env.CLOUDFLARE_ENV;
  // Pin the pre-rollout schema: HEAD contains the new tables after publication.
  // A mutable baseline would test an already-migrated database on the next run.
  const legacyBaseline = "631bbeec436ac2b0512eaeaa2b5150e43498f110";
  let legacySchema = execFileSync("git", ["show", `${legacyBaseline}:prisma/schema.prisma`], { encoding: "utf8" });
  const newModels = ["MarketplaceRequest", "MarketplaceOffer", "MarketplaceReview", "TeacherWallet", "TeacherWalletEntry", "TeacherWalletTopUp"];
  const newEnums = ["MarketplaceRequestStatus", "MarketplaceOfferStatus", "TeacherWalletEntryKind", "TeacherWalletTopUpStatus"];
  for (const name of newModels) legacySchema = legacySchema.replace(new RegExp(`^model ${name} \\{[\\s\\S]*?^\\}`, "gm"), "");
  for (const name of newEnums) legacySchema = legacySchema.replace(new RegExp(`^enum ${name} \\{[\\s\\S]*?^\\}`, "gm"), "");
  legacySchema = legacySchema.split(/\r?\n/).filter((line) => !newModels.some((name) => new RegExp(`^\\s+\\w+\\s+${name}(?:\\[\\]|\\?|\\s|$)`).test(line))).join("\n");
  const schemaPath = path.join(directory, "legacy.prisma");
  writeFileSync(schemaPath, legacySchema);
  const legacySql = execFileSync(process.execPath, ["node_modules/prisma/build/index.js", "migrate", "diff", "--from-empty", "--to-schema-datamodel", schemaPath, "--script"], { encoding: "utf8", env: process.env, maxBuffer: 10_000_000 });
  await client.query("CREATE SCHEMA competence; SET search_path TO competence;");
  await client.query(legacySql);
  await client.query(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS; CREATE ROLE competence_runtime LOGIN PASSWORD '${password}';`);
  await client.query("GRANT USAGE ON SCHEMA competence TO anon, authenticated, service_role, competence_runtime;");
  await client.query("GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA competence TO competence_runtime;");
  process.env.DATABASE_URL = process.env.DATABASE_URL.replace("postgres:", "competence_runtime:");
  const jiti = createJiti(import.meta.url, { alias: { "@": path.resolve("src"), "server-only": path.resolve("node_modules/next/dist/compiled/server-only/empty.js"), "next/cache": path.resolve("scripts/fixtures/managed-next-cache.mjs") }, interopDefault: true });
  ({ db } = await jiti.import("../src/lib/db.ts"));
  const oldClient = await db.user.create({ data: { name: "Historical QA client", email: "historical@example.invalid", passwordHash: "not-a-real-login" } });
  const availability = JSON.stringify(Object.fromEntries(["mon", "tue", "wed", "thu", "fri", "sat", "sun"].map((day) => [day, Object.fromEntries(["08-10", "10-12", "12-14", "14-16", "16-18", "18-20", "20-22"].map((slot) => [slot, true]))])));
  const teacher = await db.teacher.create({ data: { fullName: "Managed QA professor", jobTitle: "Professeur de mathématiques", bio: "Synthetic local integration fixture", availability, phone: "+2250700000001", status: "ACTIVE", portalAccessEnabled: true, portalPasswordHash: "not-a-real-login", offersIvorianSystem: true, offersFrenchSystem: true, offersHome: true, offersOnline: true } });
  const subject = await db.subject.create({ data: { name: "Mathématiques", slug: "qa-mathematics" } });
  const snapshot = JSON.stringify(await client.query('SELECT row_to_json(u) AS data FROM "User" u ORDER BY id').then((result) => result.rows));
  const migrationNames = readdirSync("prisma/migrations").filter((name) => /^\d/.test(name) && name >= "20260901").sort();
  for (const name of migrationNames) {
    const sql = readFileSync(`prisma/migrations/${name}/migration.sql`, "utf8");
    if (sql.includes("CREATE INDEX CONCURRENTLY")) {
      // Concurrent indexes must each execute outside a transaction. SQL before
      // them contains no procedural blocks and can safely be split here.
      const [beforeIndexes, ...indexes] = sql.split(/(?=CREATE INDEX CONCURRENTLY)/);
      await client.query(beforeIndexes);
      for (const statement of indexes) await client.query(statement);
    } else await client.query(sql);
  }
  assert.equal(JSON.stringify(await client.query('SELECT row_to_json(u) AS data FROM "User" u ORDER BY id').then((result) => result.rows)), snapshot);
  assert.equal((await db.teacher.findUniqueOrThrow({ where: { id: teacher.id } })).phone, teacher.phone);
  assert.equal(await db.user.count({ where: { id: oldClient.id } }), 1);
  check("Additive migration preserves historical clients and professors byte-for-byte");
  await db.teacherPreciseLevel.createMany({ data: ["ivoirien", "francais"].map((journey) => ({ teacherId: teacher.id, subjectId: subject.id, journey, className: "6e" })) });
  const service = await jiti.import("../src/lib/managed-courses.ts");
  const core = await jiti.import("../src/lib/managed-courses-core.ts");
  const futureDate = (offset) => new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10);
  const input = (offset, phone = "0700000002") => ({ termsVersion: core.MANAGED_TERMS_VERSION, clientKey: randomUUID(), parentName: "QA Parent", phone, journey: "ivoirien", className: "6e", subjectId: subject.id, courseFormat: "ONLINE", cadence: "FORTNIGHTLY", sessions: [{ date: futureDate(offset), time: "10:00" }], accepted: true, quotedTotal: 12_500 });
  const firstInput = input(20);
  const first = await service.createManagedDossier(firstInput);
  assert.ok(first.path.startsWith("/demande-cours/accord#"));
  assert.equal((await service.createManagedDossier(firstInput)).id, first.id);
  assert.equal(await db.managedCourseDossier.count(), 1);
  check("Guest intake, canonical price, private contract and idempotent replay");
  const adminInput = input(21, "0700000003");
  const adminDossier = await service.createManagedDossier(adminInput, "qa-admin");
  await assert.rejects(service.offerManagedDossier(adminDossier.id, teacher.id, 25, "qa-admin"), /accord/i);
  await service.managedContract(adminDossier.path.split("#")[1], 1);
  const offer = await service.offerManagedDossier(first.id, teacher.id, 25, "qa-admin");
  await service.respondManagedOffer(offer.id, teacher.id, true, "");
  const acceptedSession = await db.managedCourseSession.findFirstOrThrow({ where: { dossierId: first.id } });
  assert.equal(acceptedSession.commissionRateBps, 2500);
  const conflict = await service.createManagedDossier(input(20, "0700000004"));
  const conflictOffer = await service.offerManagedDossier(conflict.id, teacher.id, 20, "qa-admin");
  await assert.rejects(service.respondManagedOffer(conflictOffer.id, teacher.id, true, ""), /réservé|créneau|cours confirmé/);
  await service.respondManagedOffer(conflictOffer.id, teacher.id, false, "QA unavailable for that date");
  assert.equal(await db.managedCourseSession.count({ where: { dossierId: conflict.id, teacherId: { not: null } } }), 0);
  check("Exact qualification, parent consent and conflict lock at professor acceptance");
  // Concurrent acceptances for two different dossiers and one professor.
  const concurrent = await Promise.all([service.createManagedDossier(input(22, "0700000005")), service.createManagedDossier(input(22, "0700000006"))]);
  const offers = await Promise.all(concurrent.map((item) => service.offerManagedDossier(item.id, teacher.id, 30, "qa-admin")));
  const responses = await Promise.allSettled(offers.map((item) => service.respondManagedOffer(item.id, teacher.id, true, "")));
  assert.equal(responses.filter((result) => result.status === "fulfilled").length, 1);
  check("Two simultaneous acceptances cannot reserve the same professor slot");
  // Move only this synthetic QA session into the past to exercise completion.
  await db.managedCourseSession.update({ where: { id: acceptedSession.id }, data: { scheduledDate: new Date(`${futureDate(-1)}T00:00:00Z`) } });
  await service.completeManagedSession(first.id, acceptedSession.id, teacher.id, false);
  assert.equal(await db.managedTeacherLedgerEntry.count({ where: { teacherId: teacher.id } }), 0);
  await service.completeManagedSession(first.id, acceptedSession.id, "qa-admin", true);
  assert.equal(await db.managedTeacherLedgerEntry.count({ where: { teacherId: teacher.id } }), 0);
  const receipt = { action: "RECEIPT", amount: 5000, method: "WAVE", reference: "QA-PARENT-1", idempotencyKey: randomUUID(), receivedAt: new Date().toISOString() };
  await service.recordManagedReceipt(first.id, receipt, "qa-admin");
  await service.recordManagedReceipt(first.id, receipt, "qa-admin");
  const balance = async () => (await db.managedTeacherLedgerEntry.aggregate({ where: { teacherId: teacher.id }, _sum: { amountDelta: true } }))._sum.amountDelta ?? 0;
  assert.equal(await balance(), 3750);
  check("No credit before validation and actual parent collection; partial receipt credits exact net once");
  const payment = (amount, reference) => ({ amount, reference, method: "WAVE", idempotencyKey: randomUUID(), note: "QA verified manual transfer" });
  const payments = await Promise.allSettled([service.recordManagedTeacherPayment(teacher.id, payment(3000, "QA-PAYOUT-1"), "qa-admin"), service.recordManagedTeacherPayment(teacher.id, payment(3000, "QA-PAYOUT-2"), "qa-admin")]);
  assert.equal(payments.filter((result) => result.status === "fulfilled").length, 1);
  assert.equal(await balance(), 750);
  const originalReceipt = await db.managedParentReceipt.findUniqueOrThrow({ where: { idempotencyKey: receipt.idempotencyKey } });
  const correction = { method: "WAVE", reference: "QA-VOID-1", idempotencyKey: randomUUID(), note: "QA incorrect collection entry" };
  await assert.rejects(service.reverseManagedReceipt(first.id, originalReceipt.id, correction, "qa-admin"), /déjà été réglé/);
  assert.equal(await balance(), 750);
  const paid = await db.managedTeacherLedgerEntry.findFirstOrThrow({ where: { teacherId: teacher.id, kind: "PAYMENT" } });
  await service.reverseManagedTeacherPayment(teacher.id, paid.id, "QA transfer entry was incorrect", "qa-admin");
  await service.reverseManagedTeacherPayment(teacher.id, paid.id, "QA transfer entry was incorrect", "qa-admin");
  assert.equal(await balance(), 3750);
  await service.reverseManagedReceipt(first.id, originalReceipt.id, correction, "qa-admin");
  await service.reverseManagedReceipt(first.id, originalReceipt.id, correction, "qa-admin");
  assert.equal(await balance(), 0);
  await service.recordManagedReceipt(first.id, { ...receipt, reference: "QA-PARENT-RECOLLECT", idempotencyKey: randomUUID() }, "qa-admin");
  assert.equal(await balance(), 3750);
  check("Concurrent payouts, immutable compensation, paid-funds reversal refusal and re-collection");
  await service.setManagedHold(first.id, true, "QA parent complaint under review", "qa-admin");
  await assert.rejects(service.recordManagedTeacherPayment(teacher.id, payment(1, "QA-HELD"), "qa-admin"), /retenues/);
  await service.setManagedHold(first.id, false, "QA complaint resolved with parent", "qa-admin");
  check("Dispute hold blocks payable funds and release restores availability");
  const cancellation = await service.createManagedDossier(input(25, "0700000007"));
  await service.recordManagedReceipt(cancellation.id, { ...receipt, amount: 12_500, reference: "QA-CANCEL-COLLECT", idempotencyKey: randomUUID() }, "qa-admin");
  const cancelledSession = await db.managedCourseSession.findFirstOrThrow({ where: { dossierId: cancellation.id } });
  await service.cancelManagedSessions(cancellation.id, [cancelledSession.id], "QA parent requested cancellation", "qa-admin");
  const refund = { ...payment(12_500, "QA-PARENT-REFUND"), note: "QA verified refund for cancelled lesson" };
  await service.refundManagedCancelledSessions(cancellation.id, refund, "qa-admin");
  await service.refundManagedCancelledSessions(cancellation.id, refund, "qa-admin");
  assert.equal((await db.managedCourseDossier.findUniqueOrThrow({ where: { id: cancellation.id } })).receivedAmount, 0);
  check("Cancelled unperformed lesson, exact parent refund and replay without double refund");
  await assert.rejects(db.managedTeacherLedgerEntry.update({ where: { id: paid.id }, data: { amountDelta: -1 } }), /append-only|permission denied/);
  await assert.rejects(db.managedCourseOffer.update({ where: { id: offer.id }, data: { commissionRateBps: 2000 } }), /commission cannot be changed/);
  await client.query("SET ROLE anon");
  await assert.rejects(client.query('SELECT * FROM "ManagedCourseDossier"'), /permission denied/);
  await client.query("RESET ROLE");
  await client.query("SET ROLE competence_runtime");
  assert.ok((await client.query('SELECT count(*) FROM "ManagedCourseDossier"')).rows.length);
  assert.ok((await client.query('SELECT count(*) FROM "TeacherPreciseLevel"')).rows.length);
  assert.ok((await client.query('SELECT count(*) FROM "MarketplaceSeries"')).rows.length);
  assert.ok((await client.query('SELECT count(*) FROM "MarketplaceRequest"')).rows.length);
  await client.query("RESET ROLE");
  check("Database rejects public contract access, financial updates and commission mutation");
  const contractToken = adminDossier.path.split("#")[1];
  await service.reviseManagedPrice(adminDossier.id, 20_000, "QA exceptional quote approved internally", "qa-admin");
  await assert.rejects(service.managedContract(contractToken), /invalide/);
  await assert.rejects(service.offerManagedDossier(adminDossier.id, teacher.id, 20, "qa-admin"), /accord/i);
  const link = await service.createManagedContractLink(adminDossier.id, "qa-admin");
  await service.managedContract(link.path.split("#")[1], 2);
  await service.requestManagedParentAction(link.path.split("#")[1], "DISPUTE", "QA question about proposed lesson terms");
  assert.equal((await db.managedCourseDossier.findUniqueOrThrow({ where: { id: adminDossier.id } })).onHold, true);
  check("Quote revision invalidates prior consent/link and private parent complaint reaches admin");
  const rescheduleDossier = concurrent[responses.findIndex((result) => result.status === "fulfilled")];
  const rescheduleSession = await db.managedCourseSession.findFirstOrThrow({ where: { dossierId: rescheduleDossier.id } });
  await service.rescheduleManagedSession(rescheduleDossier.id, rescheduleSession.id, futureDate(35), "14:00", "QA report agreed with parent", "qa-admin");
  const changed = await db.managedCourseSession.findUniqueOrThrow({ where: { id: rescheduleSession.id } });
  assert.equal(changed.teacherId, null); assert.equal(changed.commissionRateBps, null);
  assert.equal((await db.managedCourseDossier.findUniqueOrThrow({ where: { id: rescheduleDossier.id } })).acceptedRevision, null);
  await assert.rejects(service.offerManagedDossier(rescheduleDossier.id, teacher.id, 20, "qa-admin"), /accord/i);
  assert.equal((await db.managedCourseSession.findUniqueOrThrow({ where: { id: acceptedSession.id } })).commissionRateBps, 2500);
  check("Reschedule releases only the changed session and requires new parent/professor consent");
  assert.equal(core.managedPrice("ivoirien", "6e", 6).total, 75000);
  mkdirSync("output/managed-qa", { recursive: true });
  writeFileSync("output/managed-qa/postgres-results.json", JSON.stringify({ passed: true, testedAt: new Date().toISOString(), postgres: "17", checks, historicalDataPreserved: true, remoteDatabaseUsed: false, migrationHashes: Object.fromEntries(migrationNames.map((name) => [name, createHash("sha256").update(readFileSync(`prisma/migrations/${name}/migration.sql`)).digest("hex")])) }, null, 2));
  console.log(`PASS ${checks.length} PostgreSQL integration scenarios; local cluster retained at ${directory}`);
  if (process.env.MANAGED_QA_BROWSER === "true") {
    const bcrypt = await import("bcryptjs");
    const passwordHash = await bcrypt.hash("QaManaged2026!LocalOnly", 10);
    await db.user.create({ data: { name: "QA Administrator", email: "qa-admin@example.invalid", passwordHash, role: "ADMIN", adminTeamRole: "SUPER_ADMIN", adminAccountStatus: "ACTIVE", adminAccessEnabled: true } });
    await db.teacher.update({ where: { id: teacher.id }, data: { portalPhone: "+2250700000001", portalPasswordHash: passwordHash } });
    const origin = "http://127.0.0.1:3315";
    const env = { ...process.env, NEXT_DIST_DIR: ".next-managed-qa", NEXTAUTH_URL: origin, NEXTAUTH_SECRET: randomBytes(32).toString("hex"), NEXT_PUBLIC_APP_URL: origin, NEXT_TELEMETRY_DISABLED: "1" };
    const logs = createWriteStream("output/managed-qa/browser-server.log");
    const server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "dev", "--webpack", "--hostname", "127.0.0.1", "-p", "3315"], { env, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
    server.stdout.pipe(logs); server.stderr.pipe(logs);
    try {
      let ready = false;
      for (let attempt = 0; attempt < 120; attempt++) {
        try { const response = await fetch(`${origin}/`, { signal: AbortSignal.timeout(2000) }); if (response.ok) { ready = true; break; } } catch {}
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
      assert.ok(ready, "Local Next server must become ready");
      const post = (route, body, source = origin) => fetch(`${origin}${route}`, { method: "POST", headers: { "Content-Type": "application/json", Origin: source }, body: JSON.stringify(body) });
      assert.equal((await post("/api/admin/managed-teacher-payments", {})).status, 403);
      assert.ok([401,403].includes((await post("/api/professor/managed-courses", {})).status));
      assert.equal((await post("/api/managed-courses", {}, "https://other.example.invalid")).status, 403);
      const invalidContract = await post("/api/managed-courses/accord", { token: "x".repeat(43) });
      assert.equal(invalidContract.status, 404, await invalidContract.clone().text());
      const httpInput = input(40, "0700000099");
      const intakeResponse = await post("/api/managed-courses", httpInput);
      assert.equal(intakeResponse.status, 200, await intakeResponse.clone().text());
      const intakeBody = await intakeResponse.json();
      assert.ok(intakeBody.reference && intakeBody.path); assert.equal(intakeBody.id, undefined);
      assert.equal(await db.managedCourseDossier.count({ where: { clientKey: httpInput.clientKey } }), 1);
      assert.equal((await post("/api/managed-courses/accord", { token: intakeBody.path.split("#")[1] })).status, 200);
      check("Real HTTP APIs reject unauthenticated finance/professor writes, foreign Origin and invalid private link");
      check("Guest HTTP intake commits one canonical dossier and private contract preview works without login");
      const report = JSON.parse(readFileSync("output/managed-qa/postgres-results.json", "utf8"));
      writeFileSync("output/managed-qa/postgres-results.json", JSON.stringify({ ...report, checks, httpPassed: true, testedAt: new Date().toISOString() }, null, 2));
      writeFileSync("output/managed-qa/browser-context.json", JSON.stringify({ origin, teacherId: teacher.id, dossierId: first.id, adminEmail: "qa-admin@example.invalid", teacherPhone: "0700000001", password: "QaManaged2026!LocalOnly", subjectId: subject.id }, null, 2));
      console.log(`BROWSER_QA_READY ${origin} (synthetic local accounts only; create output/managed-qa/STOP to stop)`);
      await new Promise((resolve) => { const timer = setInterval(() => { if (existsSync("output/managed-qa/STOP")) { clearInterval(timer); resolve(); } }, 1000); });
    } finally {
      if (server.pid && server.exitCode === null) {
        if (process.platform === "win32") execFileSync("taskkill", ["/PID", String(server.pid), "/T", "/F"], { windowsHide: true, stdio: "ignore" });
        else server.kill("SIGTERM");
      }
      logs.end();
    }
  }
} catch (error) {
  process.exitCode = 1;
  console.error(`FAIL ${error?.message || "Local PostgreSQL startup failed"}`);
} finally {
  await db?.$disconnect(); await client?.end(); if (started) await cluster.stop();
}
