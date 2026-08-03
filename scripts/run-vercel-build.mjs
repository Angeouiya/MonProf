import { spawnSync } from "node:child_process";

const isProduction = process.env.VERCEL_ENV === "production";
const buildScript = isProduction ? "build:production" : "build:preview";

console.log(`Running ${buildScript} for Vercel ${process.env.VERCEL_ENV || "local"}.`);

const result = spawnSync("npm", ["run", buildScript], {
  stdio: "inherit",
  shell: process.platform === "win32",
});

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}

process.exit(result.status ?? 1);
