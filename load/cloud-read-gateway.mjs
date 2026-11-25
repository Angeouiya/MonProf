import { Agent, createServer, request } from "node:http";

export function createCloudReadGateway({ ports, proof }) {
  const agent = new Agent({ keepAlive: true, maxSockets: 2048, maxFreeSockets: 512 });
  let next = 0;
  const server = createServer((req, res) => {
    if (req.method !== "GET") { res.writeHead(405); res.end(); return; }
    if (req.url === "/__load/identity") { res.setHeader("Content-Type", "application/json"); res.end(JSON.stringify(proof)); return; }
    if (!["/api/client/notifications", "/client/accompagnement", "/demande-cours"].includes(req.url)) { res.writeHead(404); res.end(); return; }
    const upstream = request({ hostname: "127.0.0.1", port: ports[next++ % ports.length], path: req.url, method: "GET", agent, headers: { ...req.headers, host: "127.0.0.1:3334" } }, reply => {
      res.writeHead(reply.statusCode, reply.headers); reply.pipe(res);
    });
    upstream.on("error", () => { if (!res.headersSent) res.writeHead(502); if (!res.writableEnded) res.end(); });
    // A normal completed response must NOT destroy the pooled upstream socket.
    res.once("close", () => { if (!res.writableFinished) upstream.destroy(); });
    upstream.end();
  });
  return { server, async close() { agent.destroy(); server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); } };
}
