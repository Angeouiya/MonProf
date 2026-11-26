const CACHE_SECONDS = 60;
const REFRESH_AFTER_MS = 45_000;
// Public documents only. Per-isolate coalescing bounds origin work during a
// cold miss/refresh; no client identity or private model is retained here.
const inFlight = new Map();
const ROUTE = "/demande-cours";
const BLOCKED_HEADERS = ["rsc", "next-router-state-tree", "next-router-prefetch", "next-router-segment-prefetch", "next-url", "range", "authorization", "if-none-match", "if-modified-since"];

/**
 * Only the anonymous intake document may be shared. It is rendered without ANY
 * incoming cookies/identity headers. All private/API/RSC/contract requests pass
 * through unchanged. Versioned keys prevent old Next chunks crossing releases.
 *
 * @param {Request} request
 * @param {{cache?: Pick<Cache, 'match' | 'put'>, version?: string, scope?: string, enabled?: boolean, allowedOrigins?: string[], waitUntil?: (task: Promise<unknown>) => void, now?: () => number}} options
 * @param {(request: Request) => Promise<Response>} dispatch
 * @returns {Promise<Response>}
 */
export async function publicCoursePageCache(request, options, dispatch) {
  const { cache, version, scope = "production", enabled = false, allowedOrigins = ["https://www.competence.ci", "https://competence.ci"], waitUntil, now = Date.now } = options;
  const url = new URL(request.url);
  const system = url.searchParams.get("systeme") || "ivoirien";
  const eligible = enabled && cache && version && version.length <= 100
    && request.method === "GET" && url.pathname === ROUTE && allowedOrigins.includes(url.origin)
    && request.headers.get("accept")?.includes("text/html")
    && !BLOCKED_HEADERS.some((name) => request.headers.has(name))
    && [...url.searchParams.keys()].every((name) => name === "systeme")
    && url.searchParams.getAll("systeme").length <= 1
    && ["ivoirien", "francais"].includes(system);
  if (!eligible) return dispatch(request);

  const key = new Request(`${url.origin}/__competence_edge_cache/intake/${encodeURIComponent(scope)}/${encodeURIComponent(version)}/${system}`);
  const annotate = (response, status) => {
    const headers = new Headers(response.headers);
    // Cache only at the controlled server boundary, never in a browser cache.
    headers.set("cache-control", "private, no-store, max-age=0");
    headers.set("x-competence-intake-cache", status);
    headers.delete("cache-tag");
    headers.delete("x-competence-intake-refresh-at");
    return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
  };
  const publicUrl = new URL(ROUTE, url.origin);
  if (system === "francais") publicUrl.searchParams.set("systeme", system);
  const render = () => dispatch(new Request(publicUrl, {
    method: "GET", headers: { accept: "text/html", "accept-language": "fr-FR" },
  }));
  const refresh = () => {
    const existing = inFlight.get(key.url);
    if (existing) return existing;
    const task = (async () => {
      const response = await render();
      if (response.status !== 200 || !response.headers.get("content-type")?.includes("text/html")
        || response.headers.has("set-cookie") || response.headers.get("vary") === "*") {
        await response.body?.cancel();
        return null; // Never share even an anonymous per-visitor cookie.
      }
      const payload = { body: await response.arrayBuffer(), headers: [...response.headers] };
      const headers = new Headers(response.headers);
      headers.delete("vary");
      headers.set("cache-control", `public, max-age=${CACHE_SECONDS}`);
      headers.set("cache-tag", "competence-public-intake");
      headers.set("x-competence-intake-refresh-at", String(now() + REFRESH_AFTER_MS));
      await cache.put(key, new Response(payload.body.slice(0), { status: 200, headers })).catch(() => undefined);
      return payload;
    })().catch(() => null);
    if (inFlight.size < 8) {
      inFlight.set(key.url, task);
      void task.finally(() => { if (inFlight.get(key.url) === task) inFlight.delete(key.url); });
    }
    return task;
  };
  try {
    const hit = await cache.match(key);
    if (hit) {
      // Refresh BEFORE the 60s TTL, while the previous public response remains
      // valid. No stale document is served beyond the cache's existing TTL.
      if (now() >= Number(hit.headers.get("x-competence-intake-refresh-at") || 0) && waitUntil) waitUntil(refresh());
      return annotate(hit, "HIT");
    }
  } catch { /* A cache outage must not block authoritative public rendering. */ }
  const coalesced = inFlight.has(key.url);
  const payload = await refresh();
  if (!payload) return render();
  return annotate(new Response(payload.body.slice(0), { status: 200, headers: payload.headers }), coalesced ? "COALESCED" : "MISS");
}
