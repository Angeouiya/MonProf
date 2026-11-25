import assert from "node:assert/strict";
import { createJiti } from "jiti";
const jiti = createJiti(import.meta.url);
const { readPublicSubjectCatalog } = await jiti.import(
  "../src/lib/public-subject-cache.ts",
);
const entries = new Map();
let reads = 0;
const load = async () => {
  reads++;
  return [{ id: "maths", name: "Mathématiques", privateNote: "must-not-leak" }];
};
const cache = {
  match: async (key) => entries.get(key.url)?.clone(),
  put: async (key, response) => {
    entries.set(key.url, response.clone());
  },
};
await readPublicSubjectCatalog(load, cache);
await Promise.all(
  Array.from({ length: 500 }, () => readPublicSubjectCatalog(load, cache)),
);
assert.equal(reads, 1, "Warm public catalogue must not fan out to PostgreSQL");
const cached = [...entries.values()][0];
assert.equal(cached.headers.get("cache-control"), "public, max-age=60");
assert.equal((await cached.text()).includes("must-not-leak"), false);
await readPublicSubjectCatalog(load, {
  match: async () => {
    throw new Error("cache down");
  },
  put: async () => {
    throw new Error("cache down");
  },
});
assert.equal(reads, 2);
await readPublicSubjectCatalog(load, {
  ...cache,
  match: async () => Response.json({ invalid: true }),
});
assert.equal(reads, 3);
await assert.rejects(
  readPublicSubjectCatalog(async () => Array(257).fill({ id: "x", name: "x" })),
  /invalide/,
);
console.log(
  "PASS public subject cache: 500 warm reads, one source read; 60s expiry, field allowlist, failure fallback and size bound.",
);
