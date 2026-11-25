import assert from "node:assert/strict";
import bcrypt from "bcryptjs";

// Called only by the isolated embedded-PostgreSQL runner. Never accepts prod.
export async function createLegacyAuthFixtures(db, origin) {
  assert.equal(origin, "http://127.0.0.1:3315");
  const admin = { email: "qa-legacy-admin@example.invalid", password: "Admin123" };
  const client = { email: "qa-legacy-client@example.invalid", phone: "+2250700000087", password: "Ci12" };
  const teacher = { phone: "+2250700000088", password: "Prof1234" };
  const hashes = {
    admin: (await bcrypt.hash(admin.password, 4)).replace("$2b$", "$2a$"),
    client: await bcrypt.hash(client.password, 4),
    teacher: (await bcrypt.hash(teacher.password, 4)).replace("$2b$", "$2y$"),
  };
  const a = await db.user.create({ data: { name: "Legacy QA admin", email: admin.email, passwordHash: hashes.admin, role: "ADMIN", adminTeamRole: "SUPER_ADMIN", adminAccountStatus: "ACTIVE", adminAccessEnabled: true } });
  const c = await db.user.create({ data: { name: "Legacy QA client", email: client.email, phone: client.phone, phoneNormalized: client.phone, passwordHash: hashes.client } });
  const t = await db.teacher.create({ data: { fullName: "Legacy QA teacher", jobTitle: "Enseignant", bio: "Local fixture only", phone: teacher.phone, portalPhone: teacher.phone, portalPasswordHash: hashes.teacher, status: "ACTIVE", portalAccessEnabled: true } });
  await db.user.create({ data: { name: "Disabled QA admin", email: "qa-disabled@example.invalid", passwordHash: hashes.admin, role: "ADMIN", adminAccessEnabled: false } });
  await db.teacher.create({ data: { fullName: "Expired QA teacher", jobTitle: "Enseignant", bio: "Local fixture only", phone: "+2250700000089", portalPhone: "+2250700000089", portalPasswordHash: hashes.teacher, status: "ACTIVE", portalAccessEnabled: true, portalPasswordMustChange: true, portalTemporaryPasswordIssuedAt: new Date(Date.now() - 48 * 3_600_000) } });
  return { admin, client, teacher, hashes, ids: { admin: a.id, client: c.id, teacher: t.id } };
}

export async function verifyLegacyAuthHttp({ db, sql, origin, fixtures, check }) {
  assert.equal(origin, "http://127.0.0.1:3315");
  async function login(provider, fields) {
    const cookies = new Map();
    const absorb = (response) => { for (const cookie of response.headers.getSetCookie()) { const [pair] = cookie.split(";"); const i = pair.indexOf("="); cookies.set(pair.slice(0, i), pair.slice(i + 1)); } };
    const cookieHeader = () => [...cookies].map(([key, value]) => `${key}=${value}`).join("; ");
    const csrf = await fetch(`${origin}/api/auth/csrf`); absorb(csrf);
    assert.equal(csrf.status, 200);
    const { csrfToken } = await csrf.json();
    const result = await fetch(`${origin}/api/auth/callback/${provider}`, { method: "POST", redirect: "manual", headers: { "Content-Type": "application/x-www-form-urlencoded", Origin: origin, Cookie: cookieHeader() }, body: new URLSearchParams({ ...fields, csrfToken, json: "true", callbackUrl: origin }) });
    absorb(result);
    const body = await result.json();
    const error = new URL(body.url, origin).searchParams.get("error");
    const me = await fetch(`${origin}/api/auth/me`, { headers: { Cookie: cookieHeader() } });
    assert.equal(me.status, 200);
    return { status: result.status, error, user: (await me.json()).user };
  }
  const { admin, client, teacher } = fixtures;
  for (const fields of [{ email: client.email, password: client.password, accountRole: "CLIENT" }, { email: "002250700000087", password: client.password, accountRole: "CLIENT" }]) {
    const result = await login("credentials", fields);
    assert.equal(result.status, 200); assert.equal(result.error, null); assert.equal(result.user?.role, "CLIENT");
  }
  const a = await login("credentials", { email: admin.email.toUpperCase(), password: admin.password, accountRole: "ADMIN" });
  assert.equal(a.status, 200); assert.equal(a.user?.role, "ADMIN");
  for (const phone of ["0700000088", "002250700000088"]) {
    const result = await login("teacher-phone", { phone, password: teacher.password });
    assert.equal(result.status, 200); assert.equal(result.user?.role, "TEACHER");
  }
  check("Real HTTP legacy client/admin/professor login accepts old short passwords and bcrypt 2a/2b/2y, local/00225 phone and uppercase email");
  for (const fields of [{ email: admin.email, password: admin.password, accountRole: "CLIENT" }, { email: client.email, password: client.password, accountRole: "ADMIN" }]) {
    const result = await login("credentials", fields);
    assert.equal(result.status, 401); assert.equal(result.error, "AUTH_WRONG_SPACE"); assert.equal(result.user, null);
  }
  const wrong = await login("credentials", { email: client.email, password: "WrongOnlyLocal", accountRole: "CLIENT" });
  assert.equal(wrong.error, "CredentialsSignin"); assert.equal(wrong.user, null);
  const disabled = await login("credentials", { email: "qa-disabled@example.invalid", password: admin.password, accountRole: "ADMIN" });
  assert.equal(disabled.error, "AUTH_ACCESS_DISABLED"); assert.equal(disabled.user, null);
  const expired = await login("teacher-phone", { phone: "0700000089", password: teacher.password });
  assert.equal(expired.error, "AUTH_TEMPORARY_EXPIRED"); assert.equal(expired.user, null);
  check("Wrong-space credentials, invalid passwords, disabled admin and expired professor temporary access never create a session");
  // Fault injection only in this disposable local database; always restore.
  await sql.query('REVOKE SELECT ON competence."User" FROM competence_runtime');
  try {
    const unavailable = await login("credentials", { email: client.email, password: client.password, accountRole: "CLIENT" });
    assert.equal(unavailable.error, "AUTH_SERVICE_UNAVAILABLE"); assert.equal(unavailable.user, null);
  } finally { await sql.query('GRANT SELECT ON competence."User" TO competence_runtime'); }
  assert.equal((await login("credentials", { email: client.email, password: client.password, accountRole: "CLIENT" })).user?.role, "CLIENT");
  assert.equal((await db.user.findUniqueOrThrow({ where: { id: fixtures.ids.admin } })).passwordHash, fixtures.hashes.admin);
  assert.equal((await db.user.findUniqueOrThrow({ where: { id: fixtures.ids.client } })).passwordHash, fixtures.hashes.client);
  assert.equal((await db.teacher.findUniqueOrThrow({ where: { id: fixtures.ids.teacher } })).portalPasswordHash, fixtures.hashes.teacher);
  check("Local database outage is a technical auth error, recovery works, and all legacy credential hashes remain unchanged");
}
