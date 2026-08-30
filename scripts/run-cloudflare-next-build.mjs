import { spawnSync } from "node:child_process";
import path from "node:path";

const inheritedNodeOptions = process.env.NODE_OPTIONS?.trim() || "";
const env = {
  ...process.env,
  NEXT_TELEMETRY_DISABLED: "1",
  NODE_OPTIONS: `${inheritedNodeOptions} --max-old-space-size=8192`.trim(),
};

run(path.resolve("node_modules/next/dist/bin/next"), ["build", "--webpack"]);
run(path.resolve("scripts/copy-standalone-assets.mjs"), []);

function run(script, args) {
  const result = spawnSync(process.execPath, [script, ...args], {
    cwd: process.cwd(),
    env,
    stdio: "inherit",
  });

  if (result.error) throw result.error;
  if (result.signal) {
    throw new Error(`La compilation Cloudflare a été interrompue par ${result.signal}.`);
  }
  if (result.status !== 0) process.exit(result.status || 1);
}
