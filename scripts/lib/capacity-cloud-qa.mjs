import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { performance } from "node:perf_hooks";
import { randomBytes, randomUUID } from "node:crypto";
import { mkdirSync, writeFileSync, readFileSync, createWriteStream, appendFileSync } from "node:fs";
import { spawn } from "node:child_process";
import path from "node:path";
import { encode } from "next-auth/jwt";
import { assertHostedCloud, cpuCorePercent } from "../../load/cloud-actors.mjs";
import { createCloudReadGateway } from "../../load/cloud-read-gateway.mjs";

export async function verifyCloudCapacity({ client, check, jiti }) {
  assertHostedCloud();
  const target = new URL(process.env.DATABASE_URL);
  assert.equal(target.hostname, "127.0.0.1");
  assert.equal(target.username, "competence_runtime");
  assert.equal(process.env.WEB_PUSH_QUEUE_DISABLED, "true");
  const smokeOnly=process.env.CAPACITY_SMOKE_ONLY === "true";
  const count = smokeOnly ? 1000 : 100_000, runId = randomUUID(), origin = "http://127.0.0.1:3334";
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
    ))).* FROM template t CROSS JOIN generate_series(1,$1::int) i`,[count]);
  await client.query(`WITH template AS (SELECT s.* FROM competence."ManagedCourseSession" s WHERE s."dossierId"=(SELECT id FROM competence."ManagedCourseDossier" WHERE "clientId" IS NOT NULL AND "receivedAmount">0 AND "cancelledAmount"=0 AND NOT "onHold" ORDER BY id LIMIT 1))
    INSERT INTO competence."ManagedCourseSession" SELECT (jsonb_populate_record(NULL::competence."ManagedCourseSession",to_jsonb(t)||jsonb_build_object(
      'id','capacity-session-'||i||'-'||t.sequence,'dossierId','capacity-dossier-'||i,'teacherId',NULL,'offerId',NULL,'commissionRateBps',NULL,
      'fundedAmount',0,'creditedTeacherAmount',0,'status','PLANNED','completedAt',NULL,'validatedAt',NULL,'validatedBy',NULL,'parentConfirmedAt',NULL,'parentConfirmationMethod',NULL
    ))).* FROM template t CROSS JOIN generate_series(1,$1::int) i`,[count]);
  await client.query('ANALYZE competence."User"; ANALYZE competence."Notification"; ANALYZE competence."ManagedCourseDossier"; ANALYZE competence."ManagedCourseSession"');
  const {managedClientCourseQuery}=await jiti.import("../src/lib/managed-client-courses.ts");
  const readQuery=managedClientCourseQuery("capacity-user-1");
  const explain=(await client.query("EXPLAIN (ANALYZE,BUFFERS,FORMAT JSON) "+readQuery.text,readQuery.values)).rows[0]["QUERY PLAN"][0];
  const nodes=[];const walk=node=>{nodes.push({type:node["Node Type"],relation:node["Relation Name"],index:node["Index Name"],rows:node["Actual Rows"]});for(const child of node.Plans||[])walk(child);};walk(explain.Plan);
  if(!smokeOnly)for(const table of ["ManagedCourseDossier","ManagedCourseSession"])assert.ok(nodes.some(node=>node.relation===table&&/Index|Bitmap/.test(node.type)),"Indexed private read required on "+table);
  console.log("CLOUD_PRIVATE_READ_PLAN "+JSON.stringify({executionMs:explain["Execution Time"],nodes}));
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
  const diagnosticOnly=process.env.CAPACITY_DIAGNOSTIC_ONLY === "true";
  const cpuProfiles=[];
  let profileTimer;
  const control=(server,command)=>new Promise((resolve,reject)=>{const timer=setTimeout(()=>{server.off("message",receive);reject(new Error("CPU profiler IPC deadline"));},30000);const receive=message=>{if(message?.type===command+":done"){clearTimeout(timer);server.off("message",receive);if(message.error)reject(new Error(message.error));else resolve(message);}};server.on("message",receive);server.send({command});});
  const ports=[3335,3336,3337];
  const gateway=createCloudReadGateway({ports,proof:{ runId, accounts:count, dataset:"synthetic", productionDataPresent:false, writesBlocked:true, databaseReadOnly:true }});
  const ticksPerSecond=Number(execFileSync("getconf",["CLK_TCK"],{encoding:"utf8"}).trim());
  const cpuTicks=pid=>{try{const s=readFileSync("/proc/"+pid+"/stat","utf8");const f=s.slice(s.lastIndexOf(")")+2).split(" ");return Number(f[11])+Number(f[12]);}catch{return 0;}};
  let telemetryTimer;
  const infrastructure=[];
  try {
    for (const port of ports) {
      const log = createWriteStream(path.join(directory,"application-"+port+".log"));logs.push(log);
      const server = spawn(process.execPath,[diagnosticOnly?"load/profile-cloud-server.mjs":".next/standalone/server.js"],{env:{...env,PORT:String(port),CAPACITY_PROFILE_DIR:directory},stdio:diagnosticOnly?["ignore","pipe","pipe","ipc"]:["ignore","pipe","pipe"]});servers.push(server);server.stdout.pipe(log);server.stderr.pipe(log);
    }
    await new Promise(resolve=>gateway.server.listen(3334,"127.0.0.1",resolve));
    for (let attempt=0;attempt<90;attempt++) {
      try { const response=await fetch(origin+"/demande-cours",{signal:AbortSignal.timeout(2000)});await response.body?.cancel();if(response.ok)break; } catch {}
      if(attempt===89)throw new Error("Cloud production-build server did not become ready");
      await new Promise(resolve=>setTimeout(resolve,1000));
    }
    const notification=await fetch(origin+"/api/client/notifications",{headers:{Cookie:users[0].cookie}});assert.equal(notification.status,200);assert.equal((await notification.json()).unreadCount,1);
    const course=await fetch(origin+"/client/accompagnement",{headers:{Cookie:users[0].cookie}});assert.equal(course.status,200);const html=await course.text();assert.ok(html.includes("QA-CAPACITY-1"));assert.equal(html.includes("QA-CAPACITY-100000"),false);
    for(const user of users.slice(0,2)){const r=await fetch(origin+"/demande-cours",{headers:{accept:"text/html",cookie:user.cookie}});assert.equal(r.status,200);const document=await r.text();assert.equal(/QA-CAPACITY-|capacity-user-|Synthetic cloud account/.test(document),false);assert.ok(r.headers.get("x-competence-intake-cache"));}
    for(const port of ports)for(const route of ["/api/client/notifications","/client/accompagnement","/demande-cours"]){const r=await fetch("http://127.0.0.1:"+port+route,{headers:{Cookie:users[0].cookie,Host:"127.0.0.1:3334"}});assert.equal(r.status,200);await r.arrayBuffer();}
    if(process.env.CAPACITY_PLAYWRIGHT_MODULE){const {verifyManagedFormBrowser}=await import("./managed-form-browser-qa.mjs");await verifyManagedFormBrowser({port:ports[0],check});}
    if(smokeOnly){
      assert.ok(process.env.CAPACITY_PLAYWRIGHT_MODULE,"UI-only mode requires the real browser regression");
      console.log("CLOUD_UI_SMOKE_RESULT "+JSON.stringify({passed:true,capacityVerdict:false,accounts:count,productionTraffic:false,publicCache:gateway.cacheStats}));
      if(process.env.GITHUB_STEP_SUMMARY)appendFileSync(process.env.GITHUB_STEP_SUMMARY,"## Cached intake UI regression only\n\nMobile + desktop, retained fields, unique submission keys; POSTs intercepted before the server.\n\n**NO 100K CAPACITY VERDICT: load was deliberately not executed in this UI-only job.**\n");
      check("Cached public form UI regression only; no capacity verdict");return;
    }
    for(const route of ["/api/client/notifications","/client/accompagnement","/demande-cours"]){
      const before=cpuTicks(servers[0].pid),started=performance.now(),requests=500;
      for(let index=0;index<requests;index++){const r=await fetch("http://127.0.0.1:"+ports[0]+route,{headers:{Cookie:users[index%100].cookie,accept:route.startsWith("/api/")?"application/json":"text/html"}});assert.equal(r.status,200);await r.arrayBuffer();}
      console.log("CLOUD_ROUTE_CPU "+JSON.stringify({route,requests,serverCpuMsPerRequest:(cpuTicks(servers[0].pid)-before)*1000/ticksPerSecond/requests,elapsedMs:performance.now()-started,cacheBypassed:true}));
    }
    console.log("CLOUD_CAPACITY_READY: 100000 distinct authenticated owners, 100000 course dossiers, read-only PostgreSQL, three warmed production-build processes; no production credentials.");
    if(diagnosticOnly){await Promise.all(servers.map(server=>control(server,"profile-start")));profileTimer=setTimeout(()=>Promise.all(servers.map(server=>control(server,"profile-stop"))).then(results=>{cpuProfiles.push(...results);for(const result of results)console.log("CLOUD_CPU_PROFILE "+JSON.stringify(result));}).catch(error=>console.log("CLOUD_CPU_PROFILE_ERROR "+error.message)),90000);}
    let previousCpu=[process.pid,...servers.map(server=>server.pid)].map(cpuTicks),previousAt=performance.now();
    telemetryTimer=setInterval(async()=>{const now=performance.now();const current=[process.pid,...servers.map(server=>server.pid)].map(cpuTicks);const cpu=current.map((value,i)=>cpuCorePercent(value-previousCpu[i],now-previousAt,ticksPerSecond));previousCpu=current;previousAt=now;
      const stats=await client.query("SELECT count(*)::int AS connections FROM pg_stat_activity WHERE datname=current_database()").catch(()=>null);
      infrastructure.push({at:new Date().toISOString(),proxyCorePercent:cpu[0],serverCorePercent:cpu.slice(1),connections:stats?.rows[0]?.connections??null});
      console.log("CLOUD_CAPACITY_INFRA "+JSON.stringify(infrastructure.at(-1)));
    },10000);
    const generator=spawn(process.execPath,["load/cloud-actors.mjs"],{env:{...env,BASE_URL:origin,CAPACITY_USERS_FILE:usersFile,CAPACITY_RUN_ID:runId,CAPACITY_SUMMARY_FILE:reportFile},stdio:["ignore","pipe","pipe"]});
    generator.stdout.pipe(process.stdout);generator.stderr.pipe(process.stderr);
    const exitCode=await new Promise((resolve,reject)=>{generator.on("error",reject);generator.on("close",resolve);});
    const report=JSON.parse(readFileSync(reportFile,"utf8"));
    clearInterval(telemetryTimer);report.infrastructure=infrastructure;report.backendProcesses=ports.length;report.cpuProfiles=cpuProfiles;report.publicCache={...gateway.cacheStats,policy:"same production helper; Node Cache adapter, not the Cloudflare cache network"};
    report.databaseTables=(await client.query("SELECT relname,seq_scan,idx_scan FROM pg_stat_user_tables WHERE schemaname='competence' AND relname IN ('User','Notification','ManagedCourseDossier','ManagedCourseSession')")).rows;
    writeFileSync(reportFile,JSON.stringify(report,null,2));
    console.log("CLOUD_CAPACITY_SERVER_SUMMARY "+JSON.stringify({backendProcesses:ports.length,infrastructure,databaseTables:report.databaseTables,publicCache:report.publicCache}));
    if(!report.passed)for(const port of ports){const lines=readFileSync(path.join(directory,"application-"+port+".log"),"utf8").split(/\r?\n/).filter(line=>/prisma:error|Error:|timed out|P2024|P2037/.test(line));console.log("CLOUD_SERVER_ERRORS "+port+" "+JSON.stringify(lines.slice(-15).map(line=>line.replace(/postgres(?:ql)?:\/\/\S+/g,"[synthetic-db-url]"))));}
    if(process.env.GITHUB_STEP_SUMMARY)appendFileSync(process.env.GITHUB_STEP_SUMMARY,"## Compétence — cloud 100k\n\nStatus: **"+(diagnosticOnly?"CPU DIAGNOSTIC ONLY — NOT A CAPACITY PASS":report.passed?"PASS":"FAIL")+"**\n\n```json\n"+JSON.stringify(report,null,2)+"\n```\n\nThis is a read-only Node/PostgreSQL cloud CI experiment, not Cloudflare production certification. No artifacts/caches or paid runners are provisioned.\n");
    if(diagnosticOnly){assert.equal(cpuProfiles.length,3,"All three CPU profiles must be captured");check("Cloud CPU diagnosis captured; not a capacity validation");return;}
    assert.equal(exitCode,0,"Cloud load failed: "+report.failures.join("; "));
    check("100k cloud resident client sessions measured against real isolated APIs and PostgreSQL; exact workload and limits recorded");
  } finally {
    clearInterval(telemetryTimer);clearTimeout(profileTimer);await gateway.close();
    for(const server of servers)if(server.exitCode===null)server.kill();
    for(const log of logs)log.end();
    await client.query("ALTER ROLE competence_runtime RESET default_transaction_read_only");
  }
}
