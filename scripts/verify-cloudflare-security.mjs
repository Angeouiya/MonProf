import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [worker, wrangler, nextConfig] = await Promise.all([
  readFile(new URL("../cloudflare-worker.ts", import.meta.url), "utf8"),
  readFile(new URL("../wrangler.jsonc", import.meta.url), "utf8"),
  readFile(new URL("../next.config.ts", import.meta.url), "utf8"),
]);

const checks = [
  ["authentification limitée", worker.includes("AUTH_RATE_LIMITER") && wrangler.includes('"AUTH_RATE_LIMITER"')],
  ["opérations financières limitées", worker.includes("FINANCIAL_RATE_LIMITER") && wrangler.includes('"FINANCIAL_RATE_LIMITER"')],
  ["mutations API limitées", worker.includes("API_WRITE_RATE_LIMITER") && wrangler.includes('"API_WRITE_RATE_LIMITER"')],
  ["lectures publiques protégées", worker.includes("PUBLIC_READ_RATE_LIMITER") && wrangler.includes('"PUBLIC_READ_RATE_LIMITER"')],
  ["webhooks exclus du rate limiting applicatif", worker.includes('pathname.startsWith("/api/webhooks/")')],
  ["réponse 429 explicite", worker.includes('code: "RATE_LIMITED"') && worker.includes('"retry-after": "60"')],
  ["clé de compteur non réversible", worker.includes('crypto.subtle.digest("SHA-256"')],
  ["taille des requêtes bornée", worker.includes("maximumRequestBytes") && worker.includes("413")],
  ["origine des mutations contrôlée", worker.includes("isAllowedMutationOrigin")],
  ["CSP minimale appliquée", worker.includes('"content-security-policy"') && worker.includes("object-src 'none'")],
  ["en-têtes anti-interprétation", worker.includes('"x-content-type-options"') && worker.includes('"nosniff"')],
  ["HSTS Next actif", nextConfig.includes("Strict-Transport-Security")],
  ["médias enseignants servis par KV", worker.includes("serveTeacherMediaFromKv") && wrangler.includes('"TEACHER_MEDIA_KV"')],
];

for (const [label, condition] of checks) {
  assert.equal(condition, true, `Contrôle absent : ${label}`);
  console.log(`OK ${label}`);
}

const namespaceIds = [...wrangler.matchAll(/"namespace_id"\s*:\s*"(\d+)"/g)].map((match) => match[1]);
assert.equal(namespaceIds.length, 8, "Quatre compteurs distincts sont requis pour staging et production.");
assert.equal(new Set(namespaceIds).size, namespaceIds.length, "Les espaces de compteurs doivent être uniques.");
console.log("OK espaces rate limiting isolés entre staging et production");
console.log("OK Cloudflare security verification passed.");
