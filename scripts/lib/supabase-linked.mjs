import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { closeSync, existsSync, openSync, readdirSync, readFileSync, mkdirSync, writeFileSync, unlinkSync } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
const execute = promisify(execFile);
export const MANAGED_PRODUCTION_REF = "edhcvqwpxtcudzkecoea";
const workdir = path.resolve(".wrangler/managed-supabase");
async function acquireCliLock() {
  const directory = path.resolve(".wrangler"); mkdirSync(directory, { recursive: true });
  const file = path.join(directory, "managed-supabase-cli.lock");
  const deadline = Date.now() + 180_000;
  for (;;) {
    try {
      const fd = openSync(file, "wx");
      writeFileSync(fd, JSON.stringify({ pid: process.pid })); closeSync(fd);
      return () => unlinkSync(file);
    } catch (error) {
      if (error.code !== "EEXIST") throw error;
      try {
        const owner = JSON.parse(readFileSync(file, "utf8"));
        try { process.kill(owner.pid, 0); } catch (check) { if (check.code === "ESRCH") unlinkSync(file); }
      } catch { /* Owner may still be writing its PID. */ }
      if (Date.now() > deadline) throw new Error("Another Supabase CLI query is still active; refusing concurrent temporary-login rotation.");
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }
}
function cliPath() {
  if (process.env.SUPABASE_CLI_PATH) return process.env.SUPABASE_CLI_PATH;
  const cache = path.join(process.env.LOCALAPPDATA || "", "npm-cache", "_npx");
  for (const item of readdirSync(cache)) {
    const root = path.join(cache, item, "node_modules", "supabase");
    const binary = path.join(root, "bin", process.platform === "win32" ? "supabase.exe" : "supabase");
    if (existsSync(binary) && JSON.parse(readFileSync(path.join(root, "package.json"), "utf8")).version === "2.81.3") return binary;
  }
  throw new Error("Install the pinned Supabase CLI 2.81.3 or set SUPABASE_CLI_PATH.");
}
export async function linkedSql(sql, { maxBuffer = 64 * 1024 * 1024 } = {}) {
  if (readFileSync(path.join(workdir, "supabase/.temp/project-ref"), "utf8").trim() !== MANAGED_PRODUCTION_REF) throw new Error("Wrong linked project; refusing SQL.");
  const directory = path.resolve(".wrangler/managed-query"); mkdirSync(directory, { recursive: true });
  const file = path.join(directory, `${randomUUID()}.sql`); writeFileSync(file, sql);
  // db query initialises a temporary login. Concurrent CLI calls can rotate
  // that login during another connection attempt, so serialize per workspace.
  const unlock = await acquireCliLock();
  let stage = "execute";
  try {
    const { stdout } = await execute(cliPath(), ["db", "query", "--linked", "--workdir", workdir, "--file", file, "--output", "json"], { windowsHide: true, timeout: 120_000, maxBuffer });
    stage = "decode";
    const result = JSON.parse(stdout.slice(stdout.indexOf("{"), stdout.lastIndexOf("}") + 1));
    if (!Array.isArray(result.rows)) throw new Error(`Unexpected SQL result envelope (keys: ${Object.keys(result).join(",")}; stdout bytes: ${stdout.length}).`);
    return result.rows;
  } catch (error) {
    if (error.message?.startsWith("Unexpected SQL result envelope")) throw error;
    const details = String(error.stderr || "");
    const category = /password authentication failed/i.test(details) ? "temporary login authentication" : /rate.?limit|429/i.test(details) ? "management API rate limit" : /permission denied/i.test(details) ? "database permission" : /timeout|timed out/i.test(details) ? "connection timeout" : /syntax error/i.test(details) ? "SQL syntax" : /failed to connect|connection refused/i.test(details) ? "database connection" : "unclassified";
    const permission = category === "database permission" ? details.match(/(?:permission denied[^\r\n]*|must be owner of[^\r\n]*|must be member of[^\r\n]*)/i)?.[0]?.replace(/\([^)]*\)/g, "").slice(0, 180) : null;
    throw new Error(`Linked SQL failed (${stage}, ${error.code || error.name || "unknown"}, ${category}${permission ? `: ${permission}` : ""}, killed=${Boolean(error.killed)}); no database contents printed.`);
  } finally { unlinkSync(file); unlock(); }
}
