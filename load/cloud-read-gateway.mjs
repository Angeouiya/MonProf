import { Agent, createServer, request } from "node:http";
import { publicCoursePageCache } from "../src/lib/public-course-page-cache.mjs";
import { createCloudPublicCache } from "./cloud-public-cache.mjs";

export function createCloudReadGateway({ ports, proof }) {
  const agent = new Agent({ keepAlive: true, maxSockets: 2048, maxFreeSockets: 512 });
  const cache = createCloudPublicCache();
  const cacheStats = { hits: 0, misses: 0, coalesced: 0 };
  const background = new Set();
  const waitUntil = task => { if(background.has(task))return;background.add(task);void task.finally(()=>background.delete(task)); };
  let next = 0;
  const server = createServer(async (req, res) => {
    if (req.method !== "GET") { res.writeHead(405); res.end(); return; }
    if (req.url === "/__load/identity") { res.setHeader("Content-Type", "application/json"); res.end(JSON.stringify(proof)); return; }
    if (!["/api/client/notifications", "/client/accompagnement", "/demande-cours"].includes(req.url)) { res.writeHead(404); res.end(); return; }
    if (req.url === "/demande-cours") {
      try {
        const incoming = new Request("http://127.0.0.1:3334" + req.url, { headers: req.headers });
        const response = await publicCoursePageCache(incoming, {
          cache, version: proof.runId || "unit-test", scope: "synthetic-cloud", enabled: true, waitUntil,
          allowedOrigins: ["http://127.0.0.1:3334"],
        }, (publicRequest) => fetch("http://127.0.0.1:" + ports[next++ % ports.length] + new URL(publicRequest.url).pathname, { redirect: "manual", headers: { ...Object.fromEntries(publicRequest.headers), "accept-encoding": "identity" } }));
        if (response.headers.get("x-competence-intake-cache") === "HIT") cacheStats.hits++;
        if (response.headers.get("x-competence-intake-cache") === "MISS") cacheStats.misses++;
        if (response.headers.get("x-competence-intake-cache") === "COALESCED") cacheStats.coalesced++;
        res.writeHead(response.status, Object.fromEntries(response.headers));
        res.end(Buffer.from(await response.arrayBuffer()));
      } catch { if (!res.headersSent) res.writeHead(502); res.end(); }
      return;
    }
    const upstream = request({ hostname: "127.0.0.1", port: ports[next++ % ports.length], path: req.url, method: "GET", agent, headers: { ...req.headers, host: "127.0.0.1:3334" } }, reply => {
      res.writeHead(reply.statusCode, reply.headers); reply.pipe(res);
    });
    upstream.on("error", () => { if (!res.headersSent) res.writeHead(502); if (!res.writableEnded) res.end(); });
    // A normal completed response must NOT destroy the pooled upstream socket.
    res.once("close", () => { if (!res.writableFinished) upstream.destroy(); });
    upstream.end();
  });
  return { server, cacheStats, async close() { agent.destroy(); server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); await Promise.allSettled([...background]); } };
}
