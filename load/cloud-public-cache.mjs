// Small Cache API adapter for the isolated Node experiment. No private data:
// only the shared production intake-cache policy can put a response here.
export function createCloudPublicCache() {
  const entries = new Map();
  return {
    async match(request) {
      const entry = entries.get(request.url);
      if (!entry || entry.expiresAt <= Date.now()) { entries.delete(request.url); return undefined; }
      return new Response(entry.body.slice(0), { status: 200, headers: entry.headers });
    },
    async put(request, response) {
      if (entries.size >= 8 && !entries.has(request.url)) throw new Error("Public cache key budget exceeded");
      const seconds = Number(/(?:^|,)\s*max-age=(\d+)/.exec(response.headers.get("cache-control"))?.[1] || 0);
      if (!seconds || response.headers.has("set-cookie")) throw new Error("Unsafe public response");
      entries.set(request.url, { body: await response.arrayBuffer(), headers: [...response.headers], expiresAt: Date.now() + seconds * 1000 });
    },
  };
}
