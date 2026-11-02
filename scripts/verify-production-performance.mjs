import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";

const baseUrl = (process.env.PERFORMANCE_BASE_URL || "https://www.competence.ci").replace(/\/$/, "");
const targets = [
  { path: "/", samples: 5, p95BudgetMs: 2_500 },
  { path: "/mot-de-passe-oublie", samples: 4, p95BudgetMs: 3_500 },
  { path: "/api/health", samples: 3, p95BudgetMs: 4_000 },
];

const results = [];
for (const target of targets) {
  const samples = [];
  for (let index = 0; index < target.samples; index += 1) {
    const startedAt = performance.now();
    const response = await fetch(`${baseUrl}${target.path}`, {
      redirect: "follow",
      headers: { "user-agent": "Competence-QA-Performance/1.0" },
    });
    const elapsedMs = Math.round(performance.now() - startedAt);
    await response.arrayBuffer();
    assert.equal(response.ok, true, `${target.path} répond ${response.status}`);
    samples.push(elapsedMs);
  }
  const ordered = [...samples].sort((a, b) => a - b);
  const p95 = ordered[Math.ceil(ordered.length * 0.95) - 1];
  const median = ordered[Math.floor(ordered.length / 2)];
  assert.ok(p95 <= target.p95BudgetMs, `${target.path} p95 ${p95} ms > budget ${target.p95BudgetMs} ms`);
  results.push({ path: target.path, medianMs: median, p95Ms: p95, samples });
}

console.log(JSON.stringify({ ok: true, baseUrl, results }, null, 2));
