import assert from "node:assert/strict";
import { createServer, request } from "node:http";
import { randomBytes, randomUUID } from "node:crypto";
import { mkdirSync, writeFileSync, readFileSync, createWriteStream, appendFileSync } from "node:fs";
import { spawn } from "node:child_process";
import path from "node:path";
import { encode } from "next-auth/jwt";
import { assertHostedCloud } from "../../load/cloud-actors.mjs";

export async function verifyCloudCapacity({ client, check }) {
  assertHostedCloud();
  const target = new URL(process.env.DATABASE_URL);
  assert.equal(target.hostname, "127.0.0.1");
  assert.equal(target.username, "competence_runtime");
  assert.equal(process.env.WEB_PUSH_QUEUE_DISABLED, "true");
  const count = 100_000, runId = randomUUID(), origin = "http://127.0.0.1:3334";
  const directory = path.resolve("output/capacity-cloud"); mkdirSync(directory, { recursive: true });
  for (let start = 1; start <= count; start += 10000) {
    const end = Math.min(count, start + 9999);
    await client.query(`INSERT INTO competence."User"(id,name,email,"passwordHash","updatedAt") SELECT 'capacity-user-'||i,'Synthetic cloud account','cloud-capacity-'||i||'@example.invalid','not-a-real-password',now() FROM generate_series($1::int,$2::int) i`, [start,end]);
    await client.query(`INSERT INTO competence."Notification"(id,"userId","clientId",title,message,type,"recipientType") SELECT 'capacity-notification-'||i,'capacity-user-'||i,'capacity-user-'||i,'Synthetic cloud QA','Never delivered','CAPACITY_QA','CLIENT' FROM generate_series($1::int,$2::int) i`, [start,end]);
  }
  await client.query(`WITH template AS (SELECT * FROM competence."ManagedCourseDossier" WHERE "clientId" IS NOT NULL AND "receivedAmount">0 AND "cancelledAmount"=0 AND NOT "onHold" ORDER BY id LIMIT 1)
    INSERT INTO competence."ManagedCourseDossier" SELECT (jsonb_populate_record(NULL::competence."ManagedCourseDossier",to_jsonb(t)||jsonb_build_object(
      'id','capacity-dossier-'||i,'reference','QA-CAPACITY-'||i,'clientKey','capacity-key-'||i,'clientId','capacity-user-'||i,
      'contractTokenHash',NULL,'contractTokenExpiresAt',NULL,'partnerId',NULL,'partnerRateBps',0,'receivedAmount',0,'cancelledAmount',0,'onHold',false,'status','NEW'
    ))).* FROM template t CROSS JOIN generate_series(1,100000) i`);
  await client.query(`WITH template AS (SELECT s.* FROM competence."ManagedCourseSession" s WHERE s."dossierId"=(SELECT id FROM competence."ManagedCourseDossier" WHERE "clientId" IS NOT NULL AND "receivedAmount">0 AND "cancelledAmount"=0 AND NOT "onHold" ORDER BY id LIMIT 1))
    INSERT INTO competence."ManagedCourseSession" SELECT (jsonb_populate_record(NULL::competence."ManagedCourseSession",to_jsonb(t)||jsonb_build_object(
      'id','capacity-session-'||i||'-'||t.sequence,'dossierId','capacity-dossier-'||i,'teacherId',NULL,'offerId',NULL,'commissionRateBps',NULL,
      'fundedAmount',0,'creditedTeacherAmount',0,'status','PLANNED','completedAt',NULL,'validatedAt',NULL,'validatedBy',NULL,'parentConfirmedAt',NULL,'parentConfirmationMethod',NULL
    ))).* FROM template t CROSS JOIN generate_series(1,100000) i`);
  await client.query('ANALYZE competence."User"; ANALYZE competence."Notification"; ANALYZE competence."ManagedCourseDossier"; ANALYZE competence."ManagedCourseSession"');
  const secret = randomBytes(32).toString("hex"), users = [];
  for (let start = 1; start <= count; start += 1000) {
    users.push(...await Promise.all(Array.from({ length: 1000 }, async (_, offset) => {
      const id = "capacity-user-" + (start + offset);
      const jwt = await encode({ secret, maxAge: 3600, token: { id, sub: id, role: "CLIENT", sessionVersion: 0, name: "Synthetic cloud account", email: "cloud-capacity-"+(start+offset)+"@example.invalid" } });
      return { id, cookie: "next-auth.session-token=" + jwt };
    })));
  }
  const usersFile = path.join(directory, "users.synthetic.json"), reportFile = path.join(directory,"results.json");
  writeFileSync(usersFile, JSON.stringify(users));
  await client.query("ALTER ROLE competence_runtime SET default_transaction_read_only=on");
  const env = { ...process.env, NODE_ENV:"production", HOSTNAME:"127.0.0.1", NEXTAUTH_URL:origin, NEXTAUTH_SECRET:secret, NEXT_PUBLIC_APP_URL:origin, APP_URL:origin, APP_DEPLOYMENT_PLATFORM:"local", APP_DEPLOYMENT_ENV:"load", CLOUDFLARE_ENV:"", NODE_OPTIONS:"--max-old-space-size=1536", NEXT_TELEMETRY_DISABLED:"1" };
  const servers = [], logs = [];
  const upstreamAgent = new (await import("node:http")).Agent({ keepAlive: true, maxSockets: 2048 });
  let nextServer = 0;
  const gateway = createServer((req,res) => {
    if (req.method !== "GET") { res.writeHead(405);res.end();return; }
    if (req.url === "/__load/identity") { res.setHeader("Content-Type","application/json");res.end(JSON.stringify({ runId, accounts:count, dataset:"synthetic", productionDataPresent:false, writesBlocked:true, databaseReadOnly:true }));return; }
    if (!["/api/client/notifications","/client/accompagnement","/demande-cours"].includes(req.url)) { res.writeHead(404);res.end();return; }
    const upstream = request({ hostname:"127.0.0.1", port:3335+(nextServer++%2), path:req.url, method:"GET", agent:upstreamAgent, headers:{...req.headers,host:"127.0.0.1:3334"} }, reply => { res.writeHead(reply.statusCode,reply.headers);reply.pipe(res); });
    upstream.on("error",()=>{if (!res.headersSent) res.writeHead(502);if (!res.writableEnded)res.end();});
    res.on("close",()=>upstream.destroy());upstream.end();
  });
  try {
    for (const port of [3335,3336]) {
      const log = createWriteStream(path.join(directory,"application-"+port+".log"));logs.push(log);
      const server = spawn(process.execPath,[".next/standalone/server.js"],{env:{...env,PORT:String(port)},stdio:["ignore","pipe","pipe"]});servers.push(server);server.stdout.pipe(log);server.stderr.pipe(log);
    }
    await new Promise(resolve=>gateway.listen(3334,"127.0.0.1",resolve));
    for (let attempt=0;attempt<90;attempt++) {
      try { const response=await fetch(origin+"/demande-cours",{signal:AbortSignal.timeout(2000)});await response.body?.cancel();if(response.ok)break; } catch {}
      if(attempt===89)throw new Error("Cloud production-build server did not become ready");
      await new Promise(resolve=>setTimeout(resolve,1000));
    }
    const notification=await fetch(origin+"/api/client/notifications",{headers:{Cookie:users[0].cookie}});assert.equal(notification.status,200);assert.equal((await notification.json()).unreadCount,1);
    const course=await fetch(origin+"/client/accompagnement",{headers:{Cookie:users[0].cookie}});assert.equal(course.status,200);const html=await course.text();assert.ok(html.includes("QA-CAPACITY-1"));assert.equal(html.includes("QA-CAPACITY-100000"),false);
    console.log("CLOUD_CAPACITY_READY: 100000 distinct authenticated owners, 100000 course dossiers, read-only PostgreSQL, two real production-build processes; no production credentials.");
    const generator=spawn(process.execPath,["load/cloud-actors.mjs"],{env:{...env,BASE_URL:origin,CAPACITY_USERS_FILE:usersFile,CAPACITY_RUN_ID:runId,CAPACITY_SUMMARY_FILE:reportFile},stdio:["ignore","pipe","pipe"]});
    generator.stdout.pipe(process.stdout);generator.stderr.pipe(process.stderr);
    const exitCode=await new Promise((resolve,reject)=>{generator.on("error",reject);generator.on("close",resolve);});
    const report=JSON.parse(readFileSync(reportFile,"utf8"));
    if(process.env.GITHUB_STEP_SUMMARY)appendFileSync(process.env.GITHUB_STEP_SUMMARY,"## Compétence — cloud 100k\n\nStatus: **"+(report.passed?"PASS":"FAIL")+"**\n\n```json\n"+JSON.stringify(report,null,2)+"\n```\n\nThis is a read-only Node/PostgreSQL cloud CI experiment, not Cloudflare production certification. No artifacts/caches or paid runners are provisioned.\n");
    assert.equal(exitCode,0,"Cloud load failed: "+report.failures.join("; "));
    check("100k cloud resident client sessions measured against real isolated APIs and PostgreSQL; exact workload and limits recorded");
  } finally {
    upstreamAgent.destroy();gateway.closeAllConnections();await new Promise(resolve=>gateway.close(resolve));
    for(const server of servers)if(server.exitCode===null)server.kill();
    for(const log of logs)log.end();
    await client.query("ALTER ROLE competence_runtime RESET default_transaction_read_only");
  }
}
