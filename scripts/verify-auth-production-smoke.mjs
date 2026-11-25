import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

// Negative auth smoke only: no real credentials, account creation or changes.
for (const origin of ["https://competence.ci", "https://www.competence.ci"]) {
  const cookies = new Map();
  const request = async (route, options = {}) => {
    const response = await fetch(`${origin}${route}`, {
      ...options, redirect: "manual", signal: AbortSignal.timeout(30_000),
      headers: { "Cache-Control": "no-cache", Cookie: [...cookies].map(([key, value]) => `${key}=${value}`).join("; "), ...options.headers },
    });
    for (const cookie of response.headers.getSetCookie()) {
      const [pair] = cookie.split(";"); const i = pair.indexOf("=");
      cookies.set(pair.slice(0, i), pair.slice(i + 1));
    }
    return response;
  };
  const health = await request("/api/health");
  assert.equal(health.status, 200); assert.equal((await health.json()).ok, true);
  for (const route of ["/connexion", "/admin/connexion", "/professeur/connexion"]) {
    const page = await request(route); assert.equal(page.status, 200, `${origin}${route}`);
    // These Suspense login routes hydrate the form in the browser. HTTP smoke
    // checks the document only; visible form controls are covered by Edge QA.
    assert.match(await page.text(), /<script/);
  }
  const anonymous = await request("/api/auth/me");
  assert.equal(anonymous.status, 200); assert.equal((await anonymous.json()).user, null);
  const first = await request("/api/auth/csrf"); assert.equal(first.status, 200);
  const token = (await first.json()).csrfToken;
  assert.ok(token && cookies.size);
  const repeated = await request("/api/auth/csrf"); assert.equal(repeated.status, 200);
  assert.equal((await repeated.json()).csrfToken, token, "CSRF must be stable on the current host");
  const denied = await request("/api/auth/callback/credentials", {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded", Origin: origin },
    body: new URLSearchParams({ email: `qa-nonexistent-${randomUUID()}@example.invalid`, password: randomUUID(), accountRole: "ADMIN", csrfToken: token, callbackUrl: `${origin}/admin`, json: "true" }),
  });
  const result = await denied.json();
  assert.equal(denied.status, 401, "Invalid credentials must not cause a CSRF redirect or service failure");
  assert.equal(new URL(result.url, origin).searchParams.get("error"), "CredentialsSignin");
  const final = await request("/api/auth/me"); assert.equal((await final.json()).user, null);
  console.log(`PASS ${origin}: health, three login routes, host cookies/CSRF and invalid-login refusal; no account modified`);
}
