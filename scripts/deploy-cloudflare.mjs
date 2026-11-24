import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const args = process.argv.slice(2);
const environment = args[1];
assert.ok(args[0] === "--env" && ["production", "staging"].includes(environment), "Use --env production or --env staging");
assert.ok(args.length === 2 || (args.length === 3 && args[2] === "--verify-only"), "Unsupported deployment argument");
if (environment === "staging") await import("./verify-cloudflare-staging-isolation.mjs");
for (const file of [".next/BUILD_ID", ".open-next/worker.js", ".open-next/server-functions/default/handler.mjs", ".open-next/assets"]) {
  assert.ok(existsSync(file), `Build the Cloudflare artifact first: missing ${file}`);
}
const { default: config } = await import(pathToFileURL(path.resolve(".open-next/server-functions/default/open-next.config.mjs")).href);
// Direct Wrangler upload is equivalent only when no remote incremental/tag
// cache must be populated and no deployment mapping must be generated. Refuse
// future configuration changes instead of silently skipping those operations.
for (const name of ["incrementalCache", "tagCache", "queue", "cdnInvalidation"]) {
  assert.equal(config.default?.override?.[name], "dummy", `Use the OpenNext deployment pipeline for ${name}`);
}
assert.notEqual(config.cloudflare?.skewProtection?.enabled, true, "Skew protection requires the OpenNext deployment mapping");
console.log(`Verified Cloudflare artifact (${environment}); no remote cache initialization required.`);
if (args[2] === "--verify-only") process.exit(0);

// OpenNext's deploy helper initializes a local Hyperdrive proxy even though
// this app has no remote cache to populate. Upload the completed Worker through
// the same Wrangler CLI without inventing a local DB URL or exposing prod keys.
const result = spawnSync(process.execPath, [path.resolve("node_modules/wrangler/bin/wrangler.js"), "deploy", "--env", environment, "--keep-vars"], {
  stdio: "inherit",
  windowsHide: true,
  env: { ...process.env, OPEN_NEXT_DEPLOY: "true" },
});
if (result.error) throw result.error;
if (result.signal) throw new Error(`Deployment interrupted: ${result.signal}`);
process.exit(result.status ?? 1);
