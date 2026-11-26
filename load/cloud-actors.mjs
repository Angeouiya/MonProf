import assert from "node:assert/strict";
import http from "node:http";
import os from "node:os";
import { performance, monitorEventLoopDelay } from "node:perf_hooks";
import { readFileSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { assertLoadTarget, assertLoadProof } from "./target-policy.mjs";

export function assertHostedCloud(env = process.env, platform = os.platform()) {
  assert.equal(platform, "linux", "Cloud load must not run on the owner's PC");
  assert.equal(env.GITHUB_ACTIONS, "true");
  assert.equal(env.RUNNER_ENVIRONMENT, "github-hosted");
  assert.equal(env.GITHUB_REPOSITORY, "Angeouiya/MonProf");
  assert.equal(env.CAPACITY_PUBLIC_REPOSITORY, "true", "Only free standard public-repository compute is allowed");
  assert.ok(env.GITHUB_RUN_ID);
}

export function percentile(histogram, fraction) {
  const total = histogram.reduce((sum, count) => sum + count, 0);
  if (!total) return null;
  const target = Math.ceil(total * fraction);
  let cumulative = 0;
  for (let index = 0; index < histogram.length; index++) {
    cumulative += histogram[index];
    if (cumulative >= target) return index;
  }
  return histogram.length - 1;
}

export function cpuCorePercent(deltaTicks, elapsedMs, ticksPerSecond) {
  return Math.round(deltaTicks * 1_000_000 / ticksPerSecond / elapsedMs) / 10;
}

class MinHeap {
  values = [];
  push(value) {
    const a = this.values;
    let i = a.length;
    a.push(value);
    while (i) {
      const parent = (i - 1) >> 1;
      if (a[parent].at <= value.at) break;
      a[i] = a[parent];
      i = parent;
    }
    a[i] = value;
  }
  pop() {
    const a = this.values;
    const first = a[0];
    const end = a.pop();
    if (a.length) {
      let i = 0;
      while (i * 2 + 1 < a.length) {
        let child = i * 2 + 1;
        if (child + 1 < a.length && a[child + 1].at < a[child].at) child++;
        if (a[child].at >= end.at) break;
        a[i] = a[child];
        i = child;
      }
      a[i] = end;
    }
    return first;
  }
}

export async function runCloudActors({ origin, users, runId, rampSeconds = 120, holdSeconds = 600, thinkSeconds = 180, diagnosticOnly = false }) {
  assertHostedCloud();
  assertLoadTarget(origin, { local: true, runId });
  assert.equal(users.length, 100_000);
  assert.equal(new Set(users.map(user => user.id)).size, users.length);
  assert.ok(users.every(user => user.id.startsWith("capacity-user-") && typeof user.cookie === "string"));
  assert.ok(os.totalmem() >= 12 * 1024 ** 3, "The cloud runner must have at least 12 GiB RAM");
  assert.ok(os.availableParallelism() >= 4);
  const proofResponse = await fetch(origin + "/__load/identity");
  assert.equal(proofResponse.status, 200);
  assertLoadProof(await proofResponse.json(), runId);
  const agent = new http.Agent({ keepAlive: true, maxSockets: 4096, maxFreeSockets: 512, timeout: 10_000 });
  const start = performance.now();
  const end = start + (rampSeconds + holdSeconds + 1) * 1000;
  const heap = new MinHeap();
  const seen = new Uint8Array(users.length);
  const successful = new Uint8Array(users.length);
  for (let i = 0; i < users.length; i++) heap.push({ index: i, iteration: 0, at: start + i * rampSeconds * 1000 / users.length });
  const routes = [
    { name: "client-notifications", path: "/api/client/notifications", histogram: new Uint32Array(60001), requests: 0, errors: 0, errorsByCause: {} },
    { name: "client-courses", path: "/client/accompagnement", histogram: new Uint32Array(60001), requests: 0, errors: 0, errorsByCause: {} },
    { name: "public-request", path: "/demande-cours", histogram: new Uint32Array(60001), requests: 0, errors: 0, errorsByCause: {} },
  ];
  const histogram = new Uint32Array(60001);
  const loopDelay = monitorEventLoopDelay({ resolution: 20 });
  loopDelay.enable();
  let inFlight = 0, maxInFlight = 0, requests = 0, errors = 0, distinct = 0, uniqueSuccessful = 0;
  let peakAt = null, abortReason = null, queueSaturated = false, minFreeMemory = os.freemem();
  let lastCpu = process.cpuUsage(), lastCpuAt = performance.now(), maxGeneratorCorePercent = 0;
  const samples = [];
  const active = new Set();
  const timer = setInterval(() => {
    const now = performance.now();
    const cpu = process.cpuUsage(lastCpu);
    maxGeneratorCorePercent = Math.max(maxGeneratorCorePercent, (cpu.user + cpu.system) / ((now - lastCpuAt) * 10));
    lastCpu = process.cpuUsage(); lastCpuAt = now;
    minFreeMemory = Math.min(minFreeMemory, os.freemem());
    if (minFreeMemory < 1024 ** 3) abortReason = "Cloud runner free memory fell below 1 GiB";
    samples.push({ elapsedSeconds: Math.round((now - start) / 1000), distinctUsers: distinct, requests, errors, inFlight, freeMemoryMiB: Math.round(os.freemem() / 1048576) });
    console.log("CLOUD_CAPACITY_PROGRESS " + JSON.stringify(samples.at(-1)));
  }, 10_000);
  const launch = actor => {
    const choice = (actor.index + actor.iteration) % 10;
    const route = routes[choice < 5 ? 0 : choice < 8 ? 1 : 2];
    if (!seen[actor.index]) { seen[actor.index] = 1; distinct++; if (distinct === users.length) peakAt = performance.now(); }
    inFlight++; maxInFlight = Math.max(maxInFlight, inFlight);
    let body = "", done = false;
    const finish = (valid, cause = "unexpected-response") => {
      if (done) return;
      done = true; active.delete(req); inFlight--; requests++; route.requests++;
      const ms = Math.min(60000, Math.ceil(performance.now() - actor.at));
      histogram[ms]++; route.histogram[ms]++;
      if (!valid) { errors++; route.errors++; route.errorsByCause[cause] = (route.errorsByCause[cause] || 0) + 1; }
      else if (choice < 8 && !successful[actor.index]) { successful[actor.index] = 1; uniqueSuccessful++; }
      actor.iteration++;
      const jitter = 0.8 + ((actor.index * 31 + actor.iteration * 7919) % 1000) / 2500;
      actor.at += thinkSeconds * 1000 * jitter;
      if (actor.at < end && !abortReason) heap.push(actor);
    };
    const req = http.get(origin + route.path, {
      agent, headers: { Cookie: users[actor.index].cookie, Accept: choice < 5 ? "application/json" : "text/html" },
    }, res => {
      res.on("data", chunk => { if (choice < 8 && body.length < (choice < 5 ? 4096 : 262144)) body += chunk.toString(); });
      res.on("error", error => finish(false, error.code || "response-stream"));
      res.on("end", () => {
        let valid = res.statusCode === 200;
        if (valid && choice < 5) { try { valid = JSON.parse(body).unreadCount === 1; } catch { valid = false; } }
        if (valid && choice >= 5 && choice < 8) {
          const references = [...body.matchAll(/QA-CAPACITY-(\d+)/g)];
          valid = references.length > 0 && references.every(match => Number(match[1]) === actor.index + 1);
        }
        finish(valid, res.statusCode === 200 ? "invalid-authenticated-body" : "HTTP-" + res.statusCode);
      });
    });
    active.add(req);
    req.setTimeout(10_000, () => req.destroy(Object.assign(new Error("Request deadline"), { code: "CAPACITY_TIMEOUT" })));
    req.on("error", error => finish(false, error.code || "client-request"));
  };
  try {
    while (performance.now() < end && !abortReason) {
      let batch = 0;
      while (heap.values[0]?.at <= performance.now() && inFlight < 4096 && batch++ < 1000) launch(heap.pop());
      if (inFlight >= 4096 && heap.values[0]?.at <= performance.now() - 1000) queueSaturated = true;
      await new Promise(resolve => setTimeout(resolve, 5));
    }
    const drainUntil = performance.now() + 12_000;
    while (inFlight && performance.now() < drainUntil) await new Promise(resolve => setTimeout(resolve, 100));
  } finally {
    clearInterval(timer);
    for (const req of active) req.destroy(new Error("End of isolated run"));
    agent.destroy(); loopDelay.disable();
  }
  const elapsedSeconds = (performance.now() - start) / 1000;
  const summarize = route => ({ requests: route.requests, errors: route.errors, errorsByCause: route.errorsByCause, p50Ms: percentile(route.histogram, .5), p95Ms: percentile(route.histogram, .95), p99Ms: percentile(route.histogram, .99) });
  const report = {
    requestedUsers: users.length, observedDistinctUsers: distinct, distinctSuccessfulUsers: uniqueSuccessful,
    peakConcurrentSessions: distinct, heldAtPeakSeconds: peakAt ? (Math.min(performance.now(), end) - peakAt) / 1000 : 0,
    requests, errors, unfinishedRequests: inFlight, errorRate: requests ? errors / requests : 1, requestsPerSecond: requests / elapsedSeconds,
    p50Ms: percentile(histogram, .5), p95Ms: percentile(histogram, .95), p99Ms: percentile(histogram, .99), elapsedSeconds,
    pacing: { rampSeconds, holdSeconds, thinkSeconds, jitter: "80–120%", mix: "50% private notifications; 30% private courses; 20% public form" },
    routes: Object.fromEntries(routes.map(route => [route.name, summarize(route)])),
    generator: { maxInFlight, queueSaturated, abortReason, maxGeneratorCorePercent, eventLoopP95Ms: loopDelay.percentile(95) / 1e6, minFreeMemoryGiB: minFreeMemory / 1024 ** 3, cpuCount: os.availableParallelism(), totalMemoryGiB: os.totalmem() / 1024 ** 3, sharesHostWithServer: true },
    samples, cloud: "GitHub Actions standard public runner", runId: process.env.GITHUB_RUN_ID,
    productionTraffic: false, productionCapacityCertified: false, diagnosticOnly,
  };
  report.failures = [
    distinct !== users.length && "100k distinct users were not reached",
    uniqueSuccessful !== users.length && "Some users never completed a successful authenticated journey",
    inFlight !== 0 && "Requests remained unfinished at the end of the run",
    report.heldAtPeakSeconds < holdSeconds && "Full peak was not held for ten minutes",
    report.errorRate >= .001 && "HTTP errors exceed 0.1%",
    (report.p95Ms === null || report.p95Ms >= 2500) && "Overall p95 exceeds 2.5s",
    routes.some(route => percentile(route.histogram, .95) === null || percentile(route.histogram, .95) >= 2500) && "A route p95 exceeds 2.5s",
    queueSaturated && "Generator in-flight safety limit saturated",
    maxGeneratorCorePercent >= 80 && "Generator CPU saturation: result cannot certify the server",
    report.generator.eventLoopP95Ms >= 100 && "Generator event-loop delay exceeds 100ms",
    abortReason,
    diagnosticOnly && "CPU diagnostic only: the ten-minute capacity target was not tested",
  ].filter(Boolean);
  report.passed = report.failures.length === 0;
  return report;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const diagnosticOnly = process.env.CAPACITY_DIAGNOSTIC_ONLY === "true";
  const report = await runCloudActors({ origin: process.env.BASE_URL, users: JSON.parse(readFileSync(process.env.CAPACITY_USERS_FILE, "utf8")), runId: process.env.CAPACITY_RUN_ID, diagnosticOnly, holdSeconds: diagnosticOnly ? 30 : 600 });
  writeFileSync(process.env.CAPACITY_SUMMARY_FILE, JSON.stringify(report, null, 2));
  console.log("CLOUD_CAPACITY_RESULT " + JSON.stringify(report));
  if (!report.passed && !diagnosticOnly) process.exitCode = 1;
}
