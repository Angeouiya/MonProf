import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { createJiti } from "jiti";
import ts from "typescript";
import { runInNewContext } from "node:vm";

const jiti = createJiti(import.meta.url, { alias: { "@": path.resolve("src") } });
const { normalizeTeacherPhone } = await jiti.import("../src/lib/teacher-portal.ts");
const { normalizeAccountPhone } = await jiti.import("../src/lib/account-phone.ts");
const { AUTH_FAILURE, authenticationBoundary, loginDestination, loginErrorMessage, loginResultError, readLoginSession } = await jiti.import("../src/lib/auth-feedback.ts");
for (const phone of ["0700000088", "+2250700000088", "2250700000088", "002250700000088", "+225 07 00 00 00 88"]) {
  assert.equal(normalizeTeacherPhone(phone), "+2250700000088");
  assert.equal(normalizeAccountPhone(phone), "+2250700000088");
}
assert.equal(normalizeTeacherPhone("123"), "");
assert.equal(loginDestination("ADMIN"), "/admin");
assert.equal(loginDestination("TEACHER"), "/professeur");
assert.equal(loginDestination("CLIENT"), "/client");
assert.equal(loginDestination("CLIENT", "/client/reserver?journey=francais"), "/client/reserver?journey=francais");
for (const role of ["CLIENT", "ADMIN", "TEACHER"]) {
  const fallback = loginDestination(role);
  for (const value of ["//evil.invalid", "https://evil.invalid", "/\\evil.invalid", "/client/../admin/connexion"]) assert.equal(loginDestination(role, value), fallback);
}
assert.equal(loginDestination("TEACHER", "/professeurs"), "/professeur");
assert.equal(loginDestination("CLIENT", "/professeur/parametres"), "/client");
assert.equal(loginDestination("CLIENT", "/professeurs"), "/professeurs");
assert.match(loginDestination("CLIENT", null, true), /motDePasseTemporaire/);
assert.match(loginDestination("TEACHER", null, true), /motDePasseTemporaire/);
assert.match(loginResultError({ error: "CredentialsSignin", ok: false, status: 401 }, "CLIENT"), /incorrect/);
assert.match(loginResultError({ ok: false, status: 429 }, "CLIENT"), /tentatives/);
assert.match(loginResultError(undefined, "CLIENT"), /indisponible/);
assert.match(loginResultError({ ok: true, url: "/connexion?csrf=true" }, "CLIENT"), /cookies/);
assert.equal(loginResultError({ ok: true, status: 200, url: "/client" }, "CLIENT"), null);
assert.match(loginErrorMessage(AUTH_FAILURE.unavailable, "ADMIN"), /indisponible/);
assert.doesNotMatch(loginErrorMessage(AUTH_FAILURE.unavailable, "ADMIN"), /incorrect/);
assert.match(loginErrorMessage(AUTH_FAILURE.temporaryExpired, "TEACHER"), /expiré/);
await assert.rejects(authenticationBoundary("qa", async () => { throw new Error(AUTH_FAILURE.disabled); }), { message: AUTH_FAILURE.disabled });
const originalError = console.error;
let logged;
try {
  console.error = (message) => { logged = message; };
  await assert.rejects(authenticationBoundary("qa", async () => { throw Object.assign(new Error("private database diagnostic"), { code: "P1001" }); }), { message: AUTH_FAILURE.unavailable });
  assert.equal(JSON.parse(logged).code, "P1001");
  assert.doesNotMatch(logged, /private database diagnostic/);
} finally { console.error = originalError; }
const originalFetch = globalThis.fetch;
try {
  globalThis.fetch = async () => new Response("unavailable", { status: 503 });
  await assert.rejects(readLoginSession("ADMIN"), { message: AUTH_FAILURE.unavailable });
  globalThis.fetch = async () => Response.json({ user: null });
  await assert.rejects(readLoginSession("CLIENT"), { message: AUTH_FAILURE.session });
  globalThis.fetch = async () => Response.json({ user: { role: "CLIENT" } });
  await assert.rejects(readLoginSession("ADMIN"), { message: AUTH_FAILURE.wrongSpace });
  assert.equal((await readLoginSession("CLIENT")).role, "CLIENT");
} finally { globalThis.fetch = originalFetch; }
const auth = readFileSync("src/lib/auth.ts", "utf8");
assert.match(auth, /get secret\(\) \{ return getNextAuthSecret\(\); \}/);
assert.match(auth, /expectedRole !== user\.role/);
assert.doesNotMatch(auth, /validatePasswordForAccount|password\.trim\(|password\.length/);
for (const file of ["src/app/connexion/page.tsx", "src/app/(public-admin)/admin/connexion/page.tsx", "src/app/professeur/connexion/page.tsx"]) {
  const source = readFileSync(file, "utf8");
  assert.match(source, /loginResultError/);
  assert.match(source, /readLoginSession/);
  assert.match(source, /window\.location\.replace/);
  assert.doesNotMatch(source, /router\.prefetch|signOut/);
}
// Exercise the actual edge helpers without booting the generated OpenNext
// worker or giving a unit test any production credentials/bindings.
const worker = readFileSync("cloudflare-worker.ts", "utf8");
const ast = ts.createSourceFile("worker.ts", worker, ts.ScriptTarget.ESNext, true);
const names = ["readSessionCookie", "redirectPublicNavigationToCanonicalHost", "respondToAnonymousSessionProbe"];
const helpers = ast.statements.filter((statement) => ts.isFunctionDeclaration(statement) && names.includes(statement.name?.text)).map((statement) => statement.getText(ast)).join("\n");
assert.equal(ast.statements.filter((statement) => ts.isFunctionDeclaration(statement) && names.includes(statement.name?.text)).length, names.length);
const javascript = ts.transpileModule(helpers, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } }).outputText;
const edge = runInNewContext(`${javascript}\n({ ${names.join(", ")} });`, { Request, Response, URL });
for (const cookie of ["__Secure-next-auth.session-token=qa-token", "__Secure-next-auth.session-token.0=qa-first; __Secure-next-auth.session-token.1=qa-second", "next-auth.session-token.0=qa-local"]) {
  assert.ok(edge.readSessionCookie(cookie));
  const navigation = new Request("https://competence.ci/admin", { headers: { Accept: "text/html", Cookie: cookie } });
  assert.equal(edge.redirectPublicNavigationToCanonicalHost(navigation), null);
  assert.equal(edge.respondToAnonymousSessionProbe(new Request("https://competence.ci/api/auth/me", { headers: { Cookie: cookie } })), null);
}
assert.equal(edge.readSessionCookie("next-auth.csrf-token=qa-csrf"), null);
const anonymousNavigation = new Request("https://competence.ci/connexion", { headers: { Accept: "text/html" } });
assert.equal(edge.redirectPublicNavigationToCanonicalHost(anonymousNavigation).status, 308);
assert.equal(edge.redirectPublicNavigationToCanonicalHost(new Request("https://competence.ci/api/auth/csrf")), null);
assert.equal((await edge.respondToAnonymousSessionProbe(new Request("https://competence.ci/api/auth/me")).json()).user, null);
console.log("PASS legacy phone formats, exact role routing, safe return paths, technical-error distinction and unchanged login password policy");
console.log("PASS host-only sessions survive canonical navigation and chunked admin JWTs are never treated as anonymous");
