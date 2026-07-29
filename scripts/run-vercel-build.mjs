import { spawnSync } from "node:child_process";

const vercelEnvironment = process.env.VERCEL_ENV?.trim().toLowerCase() || null;
const targetScript = vercelEnvironment === "production"
  ? "build:production"
  : vercelEnvironment === "preview"
    ? "build:preview"
    : null;
const npmCliPath = process.env.npm_execpath?.trim();

if (!targetScript) {
  throw new Error(
    `[build] Unsupported VERCEL_ENV ${vercelEnvironment ?? "not set"}; expected production or preview.`,
  );
}
if (!npmCliPath) {
  throw new Error("[build] npm_execpath is unavailable; invoke this dispatcher through npm run build:vercel.");
}

console.log(
  `[build] Vercel environment ${vercelEnvironment}: running ${targetScript}.`,
);

const result = spawnSync(process.execPath, [npmCliPath, "run", targetScript], {
  env: process.env,
  stdio: "inherit",
});

if (result.error) throw result.error;
if (result.signal) {
  console.error(`[build] ${targetScript} stopped by signal ${result.signal}.`);
  process.exitCode = 1;
} else {
  process.exitCode = result.status ?? 1;
}
