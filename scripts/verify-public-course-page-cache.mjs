import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { publicCoursePageCache } from "../src/lib/public-course-page-cache.mjs";
import { createCloudPublicCache } from "../load/cloud-public-cache.mjs";

const cache = createCloudPublicCache();
const options = { cache, version: "version-one", enabled: true };
const make = (url = "https://www.competence.ci/demande-cours", headers = {}, method = "GET") => new Request(url, { method, headers: { accept: "text/html", ...headers } });
let calls = 0;
const render = async (request) => {
  calls++;
  assert.equal(request.headers.has("cookie"), false);
  assert.equal(request.headers.has("x-user-id"), false);
  assert.equal(request.headers.get("accept-language"), "fr-FR");
  return new Response(`<html>Public ${new URL(request.url).searchParams.get("systeme") || "ivoirien"}</html>`, { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "private, no-store", vary: "RSC, Next-Router-State-Tree, Accept-Encoding" } });
};
const first = await publicCoursePageCache(make(undefined, { cookie: "next-auth.session-token=private-one", "x-user-id": "private-one" }), options, render);
assert.equal(first.headers.get("x-competence-intake-cache"), "MISS");
assert.match(first.headers.get("cache-control"), /private, no-store/);
assert.equal(await first.text(), "<html>Public ivoirien</html>");
const second = await publicCoursePageCache(make(undefined, { cookie: "next-auth.session-token=private-two" }), options, render);
assert.equal(second.headers.get("x-competence-intake-cache"), "HIT");
assert.equal(await second.text(), "<html>Public ivoirien</html>");
assert.equal(calls, 1);
assert.match(await (await publicCoursePageCache(make("https://www.competence.ci/demande-cours?systeme=francais"), options, render)).text(), /francais/);
assert.equal(calls, 2, "Systems must never share their initial selection");
await publicCoursePageCache(make(), { ...options, version: "version-two" }, render);
await publicCoursePageCache(make(), { ...options, scope: "staging" }, render);
assert.equal(calls, 4, "Release and environment keys must be isolated");
for (const request of [
  make("https://www.competence.ci/client/accompagnement"), make("https://www.competence.ci/api/client/notifications"),
  make("https://www.competence.ci/admin"), make("https://www.competence.ci/professeur"),
  make("https://www.competence.ci/demande-cours?token=private"), make("https://www.competence.ci/demande-cours?_rsc=secret"),
  make("https://www.competence.ci/demande-cours?systeme=francais&systeme=ivoirien"), make("https://www.competence.ci/demande-cours?systeme=other"),
  make("https://untrusted.invalid/demande-cours"), make(undefined, {}, "POST"), make(undefined, { rsc: "1" }),
  make(undefined, { "next-router-state-tree": "private-router" }), make(undefined, { authorization: "Bearer private" }),
  make(undefined, { range: "bytes=0-10" }), make(undefined, { accept: "text/x-component" }),
]) {
  let passed;
  const response = await publicCoursePageCache(request, options, async (value) => { passed = value; return new Response("uncached"); });
  assert.equal(passed, request, "Non-public requests must pass unchanged");
  assert.equal(response.headers.has("x-competence-intake-cache"), false);
}
for (const disabled of [{ ...options, version: undefined }, { ...options, enabled: false }, { ...options, cache: undefined }]) {
  let passed;
  const request = make();
  await publicCoursePageCache(request, disabled, async (value) => { passed = value; return new Response("disabled"); });
  assert.equal(passed, request);
}
for (const headers of [{ "content-type": "text/html", "set-cookie": "private=yes" }, { "content-type": "text/x-component" }, { "content-type": "text/html", vary: "*" }]) {
  let writes = 0;
  const guarded = { ...options, cache: { match: async () => undefined, put: async () => { writes++; } } };
  await publicCoursePageCache(make(), guarded, async () => new Response("not shareable", { headers }));
  assert.equal(writes, 0);
}
const broken = { ...options, cache: { match: async () => { throw new Error("offline"); }, put: async () => { throw new Error("offline"); } } };
assert.equal((await publicCoursePageCache(make(), broken, render)).status, 200, "Cache outage must fail open to public rendering");
let releaseCold;
const coldGate = new Promise(resolve => { releaseCold = resolve; });
let coldRenders = 0;
const coldOptions = { ...options, version: "cold-wave" };
const cold = Array.from({ length: 50 }, () => publicCoursePageCache(make(), coldOptions, async () => {
  coldRenders++; await coldGate;
  return new Response("One public origin render", { headers: { "content-type": "text/html" } });
}));
await new Promise(resolve => setImmediate(resolve));
assert.equal(coldRenders, 1, "Concurrent cold misses must coalesce, not stampede the origin");
releaseCold();
const coldResponses = await Promise.all(cold);
assert.equal(coldResponses.filter(response => response.headers.get("x-competence-intake-cache") === "COALESCED").length, 49);
assert.ok((await Promise.all(coldResponses.map(response => response.text()))).every(body => body === "One public origin render"));

let clock = 1000, warmRenders = 0, releaseWarm;
const warmGate = new Promise(resolve => { releaseWarm = resolve; });
const background = new Set();
const warmOptions = { ...options, version: "warm-refresh", now: () => clock, waitUntil: task => background.add(task) };
const warmRender = async () => {
  warmRenders++;
  if (warmRenders > 1) await warmGate;
  return new Response(warmRenders === 1 ? "Old but valid" : "Refreshed public", { headers: { "content-type": "text/html" } });
};
await publicCoursePageCache(make(), warmOptions, warmRender);
clock += 46_000;
const warm = await Promise.all(Array.from({ length: 50 }, () => publicCoursePageCache(make(), warmOptions, warmRender)));
assert.equal(warmRenders, 2, "Only one proactive refresh may run per isolate/key");
assert.equal(background.size, 1);
assert.ok((await Promise.all(warm.map(response => response.text()))).every(body => body === "Old but valid"), "A pending refresh must not block still-valid public documents");
releaseWarm();await Promise.all(background);
assert.equal(await (await publicCoursePageCache(make(), warmOptions, warmRender)).text(), "Refreshed public");

let cookieNonce = 0;
const cookieResponses = await Promise.all(Array.from({ length: 2 }, () => publicCoursePageCache(make(), { ...options, version: "unsafe-cookie-wave" }, async () => new Response("Individual response", { headers: { "content-type": "text/html", "set-cookie": `nonce=${++cookieNonce}` } }))));
assert.notEqual(cookieResponses[0].headers.get("set-cookie"), cookieResponses[1].headers.get("set-cookie"), "An uncacheable per-visitor cookie must never be coalesced across visitors");
for (const file of ["src/app/demande-cours/page.tsx", "src/components/managed/public-shell.tsx", "src/components/managed/request-form.tsx", "src/app/layout.tsx"]) {
  assert.doesNotMatch(readFileSync(file, "utf8"), /getSessionUser|optionalClient|getServerSession|from ["']next\/headers|db\.(?:user|teacher|managedCourseDossier)/,
    "The shared intake tree must not read request identity or private models: " + file);
}
const worker = readFileSync("cloudflare-worker.ts", "utf8");
assert.match(worker, /publicCoursePageCache\(request/);
assert.match(worker, /version: env\.CF_VERSION_METADATA\?\.id/);
const config = JSON.parse(readFileSync("wrangler.jsonc", "utf8"));
assert.equal(config.env.production.version_metadata.binding, "CF_VERSION_METADATA");
assert.equal(config.env.staging.version_metadata.binding, "CF_VERSION_METADATA");
console.log("PASS public intake cache: identity stripped, private routes excluded, scope/release isolation, unsafe cookie responses never shared, cold-miss coalescing and proactive nonblocking refresh verified.");
