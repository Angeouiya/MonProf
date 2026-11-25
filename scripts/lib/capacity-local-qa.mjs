import assert from "node:assert/strict";
import { createServer } from "node:http";
import { randomBytes, randomUUID } from "node:crypto";
import {
  mkdirSync,
  readFileSync,
  writeFileSync,
  createWriteStream,
  statfsSync,
} from "node:fs";
import { spawn } from "node:child_process";
import path from "node:path";
import { performance } from "node:perf_hooks";
import os from "node:os";
import { encode } from "next-auth/jwt";

const priority = `CASE "priority" WHEN 'CRITICAL' THEN 1 WHEN 'URGENT' THEN 2 WHEN 'IMPORTANT' THEN 3 ELSE 4 END`;
const claim = `SELECT id FROM competence."WebPushOutbox"
 WHERE status IN ('PENDING','FAILED','PARTIAL','PROCESSING')
 AND ((status IN ('PENDING','FAILED','PARTIAL') AND "nextAttemptAt"<=now()) OR (status='PROCESSING' AND "updatedAt"<now()-interval '5 minutes'))
 AND attempts<6 ORDER BY ${priority},"createdAt" ASC FOR UPDATE SKIP LOCKED LIMIT 500`;

export async function verifyLocalCapacity({ client, check }) {
  // Only the integration runner's freshly allocated loopback cluster is accepted.
  const target = new URL(process.env.DATABASE_URL);
  assert.equal(target.hostname, "127.0.0.1");
  assert.equal(target.pathname, "/postgres");
  assert.equal(target.username, "competence_runtime");
  assert.equal(process.env.WEB_PUSH_QUEUE_DISABLED, "true");
  const runId = randomUUID();
  const directory = path.resolve("output/capacity-qa", runId);
  mkdirSync(directory, { recursive: true });
  const disk = statfsSync(directory);
  assert.ok(disk.bavail * disk.bsize > 4 * 1024 ** 3, "At least 4 GiB free disk is required for isolated fixtures and WAL");
  const rows = 500_000;
  const seedStart = performance.now();
  for (let start = 1; start <= rows; start += 25_000) {
    const end = Math.min(rows, start + 24_999);
    await client.query(
      `INSERT INTO competence."User"(id,name,email,"passwordHash","updatedAt") SELECT 'capacity-user-'||i,'Synthetic capacity account','capacity-'||i||'@example.invalid','not-a-real-password',now() FROM generate_series($1::int,$2::int) i`,
      [start, end],
    );
    await client.query(
      `INSERT INTO competence."Notification"(id,"userId","clientId",title,message,type,"recipientType") SELECT 'capacity-notification-'||i,'capacity-user-'||i,'capacity-user-'||i,'Synthetic capacity QA','Local fixture, never delivered','CAPACITY_QA','CLIENT' FROM generate_series($1::int,$2::int) i`,
      [start, end],
    );
    if (end % 100_000 === 0) console.log(`Local synthetic fixtures: ${end}/${rows} accounts and notifications`);
  }
  await client.query(`WITH template AS (SELECT * FROM competence."ManagedCourseDossier" WHERE "clientId" IS NOT NULL AND "receivedAmount">0 AND "cancelledAmount"=0 AND NOT "onHold" ORDER BY id LIMIT 1)
    INSERT INTO competence."ManagedCourseDossier" SELECT (jsonb_populate_record(NULL::competence."ManagedCourseDossier",to_jsonb(t)||jsonb_build_object(
      'id','capacity-dossier-'||i,'reference','QA-CAPACITY-'||i,'clientKey','capacity-key-'||i,'clientId','capacity-user-'||i,
      'contractTokenHash',NULL,'contractTokenExpiresAt',NULL,'partnerId',NULL,'partnerRateBps',0,'receivedAmount',0,'cancelledAmount',0,'onHold',false,'status','NEW'
    ))).* FROM template t CROSS JOIN generate_series(1,100) i`);
  await client.query(`WITH template AS (SELECT s.* FROM competence."ManagedCourseSession" s WHERE s."dossierId"=(SELECT id FROM competence."ManagedCourseDossier" WHERE "clientId" IS NOT NULL AND "receivedAmount">0 AND "cancelledAmount"=0 AND NOT "onHold" ORDER BY id LIMIT 1))
    INSERT INTO competence."ManagedCourseSession" SELECT (jsonb_populate_record(NULL::competence."ManagedCourseSession",to_jsonb(t)||jsonb_build_object(
      'id','capacity-session-'||i||'-'||t.sequence,'dossierId','capacity-dossier-'||i,'teacherId',NULL,'offerId',NULL,'commissionRateBps',NULL,
      'fundedAmount',0,'creditedTeacherAmount',0,'status','PLANNED','completedAt',NULL,'validatedAt',NULL,'validatedBy',NULL,'parentConfirmedAt',NULL,'parentConfirmationMethod',NULL
    ))).* FROM template t CROSS JOIN generate_series(1,100) i`);
  await client.query(
    'ANALYZE competence."User"; ANALYZE competence."Notification"; ANALYZE competence."WebPushOutbox"; ANALYZE competence."ManagedCourseDossier";',
  );
  const explain = async (sql) =>
    (await client.query(`EXPLAIN (ANALYZE,BUFFERS,FORMAT JSON) ${sql}`))
      .rows[0]["QUERY PLAN"][0];
  // Dropping this one newly generated index is permitted only in this disposable,
  // local synthetic cluster. Re-create the exact migration before HTTP QA.
  await client.query(
    'DROP INDEX competence."WebPushOutbox_active_priority_created_idx"',
  );
  const before = await explain(claim);
  const indexSql = readFileSync(
    "prisma/migrations/20261125173046_web_push_active_priority_index/migration.sql",
    "utf8",
  );
  await client.query(indexSql);
  await client.query('ANALYZE competence."WebPushOutbox"');
  const after = await explain(claim);
  const unread = await explain(
    `SELECT count(*) FROM competence."Notification" WHERE "recipientType"='CLIENT' AND NOT read AND "deletedAt" IS NULL AND ("expiresAt" IS NULL OR "expiresAt">now()) AND ("userId"='capacity-user-250000' OR "clientId"='capacity-user-250000')`,
  );
  assert.ok(
    JSON.stringify(after.Plan).includes(
      "WebPushOutbox_active_priority_created_idx",
    ),
    "Planner must use the priority index on the 500k backlog",
  );
  writeFileSync(path.join(directory, "sql-plans.json"), JSON.stringify({ before, after, unread }, null, 2));
  const seedAndPreparationMs = Math.round(performance.now() - seedStart);
  const secret = randomBytes(32).toString("hex");
  const origin = "http://127.0.0.1:3326";
  const users = await Promise.all(
    Array.from({ length: 100 }, async (_, i) => {
      const id = `capacity-user-${i + 1}`;
      const jwt = await encode({
        secret,
        maxAge: 3600,
        token: {
          id,
          sub: id,
          role: "CLIENT",
          sessionVersion: 0,
          name: "Synthetic capacity account",
          email: `capacity-${i + 1}@example.invalid`,
        },
      });
      return { id, cookie: `next-auth.session-token=${jwt}` };
    }),
  );
  const usersFile = path.join(directory, "users.synthetic.json");
  writeFileSync(usersFile, JSON.stringify(users));
  await client.query("ALTER ROLE competence_runtime SET default_transaction_read_only = on");
  const env = {
    ...process.env,
    NODE_ENV: "production",
    PORT: "3325",
    HOSTNAME: "127.0.0.1",
    NEXTAUTH_URL: origin,
    NEXT_PUBLIC_APP_URL: origin,
    APP_URL: origin,
    NEXTAUTH_SECRET: secret,
    NEXT_TELEMETRY_DISABLED: "1",
  };
  env.APP_DEPLOYMENT_PLATFORM = "local";
  env.APP_DEPLOYMENT_ENV = "load";
  env.CLOUDFLARE_ENV = "";
  env.NODE_OPTIONS = "--max-old-space-size=1536";
  const log = createWriteStream(path.join(directory, "application.log"));
  const server = spawn(process.execPath, [".next/standalone/server.js"], {
    env,
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"],
  });
  server.stdout.pipe(log);
  server.stderr.pipe(log);
  const gateway = createServer(async (req, res) => {
    if (!["GET", "HEAD"].includes(req.method)) {
      res.writeHead(405);
      res.end();
      return;
    }
    if (req.url === "/__load/identity") {
      res.setHeader("Content-Type", "application/json");
      res.end(
        JSON.stringify({
          runId,
          accounts: rows,
          dataset: "synthetic",
          productionDataPresent: false,
          writesBlocked: true,
          databaseReadOnly: true,
        }),
      );
      return;
    }
    try {
      const upstream = await fetch(`http://127.0.0.1:3325${req.url}`, {
        redirect: "manual",
        headers: { ...req.headers, host: "127.0.0.1:3326" },
      });
      res.writeHead(
        upstream.status,
        Object.fromEntries(
          [...upstream.headers].filter(
            ([key]) =>
              ![
                "content-encoding",
                "content-length",
                "transfer-encoding",
                "connection",
              ].includes(key),
          ),
        ),
      );
      res.end(Buffer.from(await upstream.arrayBuffer()));
    } catch {
      // A client may disconnect while the response body is being buffered.
      // Do not throw a second error after upstream headers were already sent.
      if (!res.headersSent) res.writeHead(502);
      if (!res.destroyed && !res.writableEnded) res.end();
    }
  });
  try {
    await new Promise((resolve) => gateway.listen(3326, "127.0.0.1", resolve));
    let ready = false;
    for (let attempt = 0; attempt < 60; attempt++) {
      try {
        const r = await fetch(`${origin}/demande-cours`, {
          signal: AbortSignal.timeout(2000),
        });
        await r.body?.cancel();
        if (r.ok) {
          ready = true;
          break;
        }
      } catch {}
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    assert.ok(ready, "Isolated production-build server must be ready");
    const response = await fetch(`${origin}/api/client/notifications`, {
      headers: { Cookie: users[0].cookie },
    });
    assert.equal(response.status, 200);
    assert.equal((await response.json()).unreadCount, 1);
    const ownCourse = await fetch(`${origin}/client/accompagnement`, {
      headers: { Cookie: users[0].cookie },
    });
    assert.equal(ownCourse.status, 200);
    const ownHtml = await ownCourse.text();
    assert.ok(ownHtml.includes("QA-CAPACITY-1"));
    assert.equal(
      ownHtml.includes("QA-CAPACITY-100"),
      false,
      "Load fixtures must retain owner-only course access",
    );
    const summaryFile = path.join(directory, "k6-local-summary.json");
    const k6Env = {
      ...env,
      BASE_URL: origin,
      LOCAL_CAPACITY_TEST: "true",
      PEAK_VUS: process.env.CAPACITY_PEAK_VUS || "20",
      CAPACITY_USERS_FILE: usersFile,
      CAPACITY_RUN_ID: runId,
      CAPACITY_SUMMARY_FILE: summaryFile,
      K6_NO_USAGE_REPORT: "true",
    };
    assert.ok(
      process.env.CAPACITY_K6_BIN,
      "A pinned and checksum-verified k6 binary is required",
    );
    const generatorLog = createWriteStream(path.join(directory, "k6.log"));
    const k6 = spawn(
      process.env.CAPACITY_K6_BIN,
      ["run", "load/500k-active.k6.js"],
      { env: k6Env, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] },
    );
    k6.stdout.pipe(generatorLog);
    k6.stderr.pipe(generatorLog);
    let previousCpu = os.cpus().map((cpu) => ({ ...cpu.times }));
    let maxSystemCpuBusy = 0;
    let minFreeMemoryBytes = os.freemem();
    let resourceAbort = null;
    const resourceSamples = [];
    const monitor = setInterval(() => {
      const cpus = os.cpus();
      let total = 0,
        idle = 0;
      for (let index = 0; index < cpus.length; index++) {
        for (const key of Object.keys(cpus[index].times))
          total += cpus[index].times[key] - previousCpu[index][key];
        idle += cpus[index].times.idle - previousCpu[index].idle;
      }
      previousCpu = cpus.map((cpu) => ({ ...cpu.times }));
      if (total > 0)
        maxSystemCpuBusy = Math.max(maxSystemCpuBusy, 100 * (1 - idle / total));
      minFreeMemoryBytes = Math.min(minFreeMemoryBytes, os.freemem());
      resourceSamples.push({ at: new Date().toISOString(), freeMemoryBytes: os.freemem() });
      if (minFreeMemoryBytes < 256 * 1024 * 1024 && !resourceAbort) {
        resourceAbort = "Generator stopped to preserve at least 256 MiB of free system RAM";
        k6.kill();
      }
    }, 1000);
    const code = await new Promise((resolve, reject) => {
      k6.on("error", reject);
      k6.on("close", resolve);
    }).finally(() => clearInterval(monitor));
    generatorLog.end();
    writeFileSync(path.join(directory, "resources.json"), JSON.stringify({ resourceAbort, resourceSamples }, null, 2));
    let summary = null;
    try {
      summary = JSON.parse(readFileSync(summaryFile, "utf8"));
    } catch {
      // Preserve an honest failed report even if k6 was terminated before its
      // summary hook. Never convert an incomplete generator run into a pass.
    }
    const report = {
      testedAt: new Date().toISOString(),
      localOnly: true,
      syntheticAccounts: rows,
      simulatedConcurrentUsers: summary?.observedPeakVUs ?? null,
      configuredPeakVUs: Number(k6Env.PEAK_VUS),
      seedAndPreparationMs,
      database: { before, after, unread },
      k6: summary,
      k6ExitCode: code,
      resourceAbort,
      generator: {
        cpuCount: os.availableParallelism(),
        totalMemoryGiB: os.totalmem() / 1073741824,
        freeMemoryGiB: os.freemem() / 1073741824,
        minFreeMemoryGiB: minFreeMemoryBytes / 1073741824,
        maxSystemCpuBusyPercent: maxSystemCpuBusy,
        generatorSharesMachineWithServer: true,
      },
      productionLoadExecuted: false,
      certified500kConcurrent: false,
    };
    writeFileSync(
      path.join(directory, "results.json"),
      JSON.stringify(report, null, 2),
    );
    writeFileSync(
      path.resolve("output/capacity-qa/results.json"),
      JSON.stringify(
        { ...report, runId, artifactsDirectory: directory },
        null,
        2,
      ),
    );
    console.log(
      JSON.stringify({
        syntheticAccounts: rows,
        k6ExitCode: code,
        observedPeakVUs: summary?.observedPeakVUs ?? null,
        p95Ms: summary?.p95Ms ?? null,
        errorRate: summary?.errorRate ?? null,
        resourceAbort,
        queueBeforeMs: before["Execution Time"],
        queueAfterMs: after["Execution Time"],
      }),
    );
    assert.equal(
      code,
      0,
      "Local load thresholds failed; inspect output/capacity-qa/results.json",
    );
    assert.equal(
      summary.observedPeakVUs,
      Number(k6Env.PEAK_VUS),
      "Report must prove the actual configured local concurrency was reached",
    );
    check(
      "Production-build HTTP load uses isolated synthetic accounts; 500k-row queue and owner-scoped notification queries measured, not a 500k-concurrency certification",
    );
  } finally {
    await client.query("ALTER ROLE competence_runtime RESET default_transaction_read_only");
    gateway.closeAllConnections();
    await new Promise((resolve) => gateway.close(resolve));
    if (server.exitCode === null) server.kill();
    log.end();
  }
}
