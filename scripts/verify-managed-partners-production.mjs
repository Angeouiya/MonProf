import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";

// No account is created and no financial action is requested by this smoke test.
const checks = [];
for (const origin of ["https://competence.ci", "https://www.competence.ci"]) {
  for (const [path, expectedPath] of [
    ["/demande-cours", "/demande-cours"],
    ["/partenariat", "/contact"],
    ["/client/accompagnement", "/connexion"],
    ["/admin/accompagnement/partenaires", "/admin/connexion"],
  ]) {
    const response = await fetch(`${origin}${path}`, {
      signal: AbortSignal.timeout(30_000),
    });
    assert.equal(
      response.status,
      200,
      `${origin}${path}: unexpected HTTP status`,
    );
    assert.equal(
      new URL(response.url).pathname,
      expectedPath,
      `${origin}${path}: unexpected destination`,
    );
    checks.push({
      origin,
      path,
      status: response.status,
      destination: expectedPath,
    });
    await response.body?.cancel();
  }
  for (const path of [
    "/api/partner-interest",
    "/api/client/partner-referral/verify",
  ]) {
    const response = await fetch(`${origin}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: origin },
      body: "{}",
      redirect: "manual",
      signal: AbortSignal.timeout(30_000),
    });
    assert.equal(
      response.status,
      410,
      `${origin}${path}: retired programme must reject new declarations`,
    );
    checks.push({ origin, path, status: response.status });
    await response.body?.cancel();
  }
}
mkdirSync("output/managed-qa", { recursive: true });
writeFileSync(
  "output/managed-qa/production-partners-smoke.json",
  JSON.stringify(
    {
      passed: true,
      testedAt: new Date().toISOString(),
      productionAccountsCreated: false,
      financialWritesRequested: false,
      checks,
    },
    null,
    2,
  ),
);
console.log(
  `PASS ${checks.length} production checks: guest form, private-role access and retired customer promotions on both domains.`,
);
