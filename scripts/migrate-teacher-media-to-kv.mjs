import { execFileSync } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const namespaceId = readArgument("--namespace-id") || process.env.TEACHER_MEDIA_KV_NAMESPACE_ID?.trim();
const baseUrl = (readArgument("--base-url") || "https://www.competence.ci").replace(/\/$/, "");
if (!namespaceId || !/^\w{20,}$/.test(namespaceId)) {
  throw new Error("Utilisez --namespace-id <identifiant KV Cloudflare>.");
}

const mediaIds = await discoverReferencedMediaIds(baseUrl);
if (mediaIds.size < 25) {
  throw new Error(`Migration interrompue : ${mediaIds.size} médias trouvés, au moins 25 attendus.`);
}

const records = [];
for (const mediaId of [...mediaIds].sort()) {
  const response = await fetchWithRetry(`${baseUrl}/api/teacher-photos/${mediaId}?kv-migration=1`, 10);
  const contentType = response.headers.get("content-type") || "";
  if (!response.ok || !contentType.startsWith("image/")) {
    throw new Error(`Média ${mediaId} indisponible (${response.status}, ${contentType || "sans type"}).`);
  }
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length < 100) throw new Error(`Média ${mediaId} vide ou invalide.`);
  records.push({
    key: `teacher-photos/${mediaId}`,
    value: bytes.toString("base64"),
    base64: true,
    metadata: { contentType, size: bytes.length },
  });
  console.log(`OK ${mediaId} (${bytes.length} octets)`);
}

const temporaryDirectory = await mkdtemp(join(tmpdir(), "competence-teacher-media-kv-"));
const bulkFile = join(temporaryDirectory, "teacher-media.json");
try {
  await writeFile(bulkFile, JSON.stringify(records), "utf8");
  const projectDirectory = fileURLToPath(new URL("..", import.meta.url));
  const wranglerCli = fileURLToPath(new URL("../node_modules/wrangler/bin/wrangler.js", import.meta.url));
  execFileSync(process.execPath, [
    wranglerCli,
    "kv",
    "bulk",
    "put",
    bulkFile,
    "--namespace-id",
    namespaceId,
    "--remote",
  ], { stdio: "inherit", cwd: projectDirectory });
} finally {
  await rm(temporaryDirectory, { recursive: true, force: true });
}

console.log(`OK ${records.length} médias enseignants migrés vers Cloudflare KV.`);

async function discoverReferencedMediaIds(origin) {
  const result = new Set();
  for (const journey of ["ivoirien", "francais", "professionnel"]) {
    for (let page = 1; page <= 3; page += 1) {
      const html = await fetchTextWithRetry(
        `${origin}/professeurs?journey=${journey}&page=${page}&kv-scan=1`,
        6,
      );
      for (const match of html.matchAll(/\/api\/teacher-photos\/(c[a-z0-9]{20,})/gi)) {
        result.add(match[1]);
      }

      const apiResponse = await fetchWithRetry(
        `${origin}/api/teachers?journey=${journey}&page=${page}&pageSize=24&kv-scan=1`,
        6,
      );
      if (!apiResponse.ok) continue;
      const payload = await apiResponse.json().catch(() => null);
      for (const item of payload?.items || []) {
        const match = String(item.photoUrl || "").match(/\/api\/teacher-photos\/(c[a-z0-9]{20,})/i);
        if (match) result.add(match[1]);
      }
    }
  }
  return result;
}

async function fetchTextWithRetry(url, attempts) {
  const response = await fetchWithRetry(url, attempts);
  if (!response.ok) throw new Error(`Lecture impossible (${response.status}) : ${url}`);
  return response.text();
}

async function fetchWithRetry(url, attempts) {
  let lastResponse = null;
  let lastError = null;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const attemptUrl = new URL(url);
      attemptUrl.searchParams.set("migration-attempt", `${attempt}-${Date.now()}`);
      const response = await fetch(attemptUrl, {
        headers: {
          "user-agent": "Competence-Media-Migration/1.0",
          "connection": "close",
        },
        cache: "no-store",
      });
      lastResponse = response;
      if (response.ok) return response;
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, Math.min(1_500, attempt * 150)));
  }
  if (lastResponse) return lastResponse;
  throw lastError || new Error(`Réseau indisponible : ${url}`);
}

function readArgument(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1]?.trim() : null;
}
