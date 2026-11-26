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
console.log("PASS public intake cache: cookies stripped, private/API/RSC/contract/mutations bypassed, systems/releases/scopes isolated, unsafe responses refused, outages tolerated.");
