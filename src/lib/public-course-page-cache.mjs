const CACHE_SECONDS = 60;
const ROUTE = "/demande-cours";
const BLOCKED_HEADERS = ["rsc", "next-router-state-tree", "next-router-prefetch", "next-router-segment-prefetch", "next-url", "range", "authorization", "if-none-match", "if-modified-since"];

/**
 * Only the anonymous intake document may be shared. It is rendered without ANY
 * incoming cookies/identity headers. All private/API/RSC/contract requests pass
 * through unchanged. Versioned keys prevent old Next chunks crossing releases.
 *
 * @param {Request} request
 * @param {{cache?: Pick<Cache, 'match' | 'put'>, version?: string, scope?: string, enabled?: boolean, allowedOrigins?: string[], waitUntil?: (task: Promise<unknown>) => void}} options
 * @param {(request: Request) => Promise<Response>} dispatch
 * @returns {Promise<Response>}
 */
export async function publicCoursePageCache(request, options, dispatch) {
  const { cache, version, scope = "production", enabled = false, allowedOrigins = ["https://www.competence.ci", "https://competence.ci"], waitUntil } = options;
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
    return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
  };
  try {
    const hit = await cache.match(key);
    if (hit) return annotate(hit, "HIT");
  } catch { /* A cache outage must not block authoritative public rendering. */ }

  const publicUrl = new URL(ROUTE, url.origin);
  if (system === "francais") publicUrl.searchParams.set("systeme", system);
  const response = await dispatch(new Request(publicUrl, {
    method: "GET", headers: { accept: "text/html", "accept-language": "fr-FR" },
  }));
  if (response.status !== 200 || !response.headers.get("content-type")?.includes("text/html")
    || response.headers.has("set-cookie") || response.headers.get("vary") === "*") return response;

  const copy = response.clone();
  const headers = new Headers(copy.headers);
  headers.delete("vary");
  headers.set("cache-control", `public, max-age=${CACHE_SECONDS}`);
  headers.set("cache-tag", "competence-public-intake");
  const write = cache.put(key, new Response(copy.body, { status: 200, headers })).catch(() => undefined);
  if (waitUntil) waitUntil(write); else await write;
  return annotate(response, "MISS");
}
