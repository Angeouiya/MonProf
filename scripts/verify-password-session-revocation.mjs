import assert from "node:assert/strict";
import fs from "node:fs";
import { createJiti } from "jiti";
import "tsconfig-paths/register.js";

const jiti = createJiti(import.meta.url);
const { isCurrentSessionVersion } = jiti("../src/lib/session-revocation.ts");
const { authOptions } = jiti("../src/lib/auth.ts");

assert.equal(isCurrentSessionVersion(0, 0), true);
assert.equal(isCurrentSessionVersion(4, 4), true);
assert.equal(isCurrentSessionVersion(3, 4), false);
assert.equal(isCurrentSessionVersion(undefined, 0), false);
assert.equal(isCurrentSessionVersion("4", 4), false);
assert.equal(isCurrentSessionVersion(-1, -1), false);

const invalidatedToken = await authOptions.callbacks.jwt({
  token: { sessionInvalidated: true },
});
assert.equal(invalidatedToken.sessionInvalidated, true);
const invalidatedSession = await authOptions.callbacks.session({
  session: {
    user: { name: "Session révoquée", email: "revoked@example.com" },
    expires: new Date(Date.now() + 60_000).toISOString(),
  },
  token: invalidatedToken,
});
assert.equal(invalidatedSession, null);

const schema = read("../prisma/schema.prisma");
const userModel = modelBlock(schema, "User");
const teacherModel = modelBlock(schema, "Teacher");
assert.match(userModel, /sessionVersion\s+Int\s+@default\(0\)/);
assert.match(teacherModel, /sessionVersion\s+Int\s+@default\(0\)/);

const migration = read("../prisma/migrations/20260728030000_password_session_version/migration.sql");
assert.match(migration, /ALTER TABLE "User"[\s\S]*"sessionVersion" INTEGER NOT NULL DEFAULT 0/);
assert.match(migration, /ALTER TABLE "Teacher"[\s\S]*"sessionVersion" INTEGER NOT NULL DEFAULT 0/);

const auth = read("../src/lib/auth.ts");
assert.match(auth, /sessionVersion: user\.sessionVersion/);
assert.match(auth, /sessionVersion: teacher\.sessionVersion/);
assert.match(auth, /if \(!await isPersistedSessionCurrent\(token\)\)/);
assert.match(auth, /return \{ sessionInvalidated: true \}/);
assert.match(auth, /if \(token\.sessionInvalidated === true\) return null as any/);
assert.match(auth, /db\.user\.findUnique\([\s\S]*sessionVersion: true/);
assert.match(auth, /db\.teacher\.findUnique\([\s\S]*sessionVersion: true/);

assertIncrementCount("../src/app/api/auth/reset-password/route.ts", 1);
assertIncrementCount("../src/app/api/client/profile/route.ts", 1);
assertIncrementCount("../src/app/api/admin/profile/route.ts", 1);
assertIncrementCount("../src/app/api/professor/profile/route.ts", 1);
assertIncrementCount("../src/app/api/admin/team/[id]/route.ts", 3);

const professorProfile = read("../src/app/api/professor/profile/route.ts");
assert.match(
  professorProfile,
  /db\.\$transaction\(async \(tx\) => \{[\s\S]*tx\.teacher\.update\([\s\S]*sessionVersion: \{ increment: 1 \}[\s\S]*tx\.teacherPasswordResetToken\.updateMany\(/,
);

const adminTeacher = read("../src/app/api/admin/teachers/[id]/route.ts");
assert.match(adminTeacher, /data\.sessionVersion = \{ increment: 1 \}/);
assert.match(adminTeacher, /data\.portalPasswordMustChange = true/);
assert.match(
  adminTeacher,
  /statusChanged \|\| portalAccessChanged \|\| portalPhoneChanged[\s\S]*data\.sessionVersion = \{ increment: 1 \}/,
);

const temporaryPasswordGate = read("../src/components/professor/temporary-password-gate.tsx");
const bookingSessionRoute = read("../src/app/api/bookings/[id]/sessions/[sessionId]/route.ts");
assert.match(teacherModel, /portalPasswordMustChange\s+Boolean\s+@default\(false\)/);
assert.match(temporaryPasswordGate, /mot de passe transmis par le service client est temporaire/);
assert.match(professorProfile, /portalPasswordMustChange: false/);
const teacherApiGateStart = bookingSessionRoute.indexOf('if (role === "TEACHER") {');
const bookingSessionLookupStart = bookingSessionRoute.indexOf("const courseSession = await db.bookingSession.findFirst");
assert.ok(teacherApiGateStart >= 0, "La garde API professeur des séances doit exister.");
assert.ok(
  bookingSessionLookupStart > teacherApiGateStart,
  "La garde API professeur doit précéder le chargement et toute mutation de séance.",
);
const teacherApiGate = bookingSessionRoute.slice(teacherApiGateStart, bookingSessionLookupStart);
assert.match(teacherApiGate, /await requireTeacherApi\(\)/);
assert.doesNotMatch(teacherApiGate, /allowPasswordChangeRequired/);
assert.match(teacherApiGate, /status: 403/);
assert.match(bookingSessionRoute, /courseSession\.teacherId !== authenticatedTeacherId/);
assert.match(
  adminTeacher,
  /status: nextStatus,[\s\S]*sessionVersion: \{ increment: 1 \}/,
);
assert.match(
  adminTeacher,
  /db\.\$transaction\(async \(tx\) => \{[\s\S]*tx\.teacher\.update\([\s\S]*if \(passwordWasChanged && passwordChangedAt\)[\s\S]*tx\.teacherPasswordResetToken\.updateMany\(/,
);

const teamRoute = read("../src/app/api/admin/team/[id]/route.ts");
const ownerResetGuard = teamRoute.indexOf('if (owner && action === "reset_password")');
const resetBranch = teamRoute.indexOf('if (action === "reset_password")');
assert.ok(ownerResetGuard >= 0, "La garde OWNER de reset_password doit exister.");
assert.ok(resetBranch > ownerResetGuard, "La garde OWNER doit précéder la branche reset_password.");
assert.match(
  teamRoute,
  /adminTeamRole:[\s\S]*adminPermissions:[\s\S]*adminAccountStatus:[\s\S]*adminAccessEnabled:[\s\S]*adminDeletedAt: null,[\s\S]*sessionVersion: \{ increment: 1 \}/,
);
assert.match(
  teamRoute,
  /adminDeletedAt: new Date\(\),[\s\S]*adminSuspensionReason:[\s\S]*sessionVersion: \{ increment: 1 \}/,
);

assertSelfServiceSignOut(
  "../src/app/client/parametres/settings-client.tsx",
  /router\.replace\(ownerAdmin \? "\/admin\/connexion\?passwordChanged=1" : "\/connexion\?passwordChanged=1"\)/,
);
assertSelfServiceSignOut(
  "../src/app/admin/mon-compte/password-form.tsx",
  /router\.replace\("\/admin\/connexion\?passwordChanged=1"\)/,
);
assertSelfServiceSignOut(
  "../src/app/professeur/(espace)/parametres/settings-client.tsx",
  /router\.replace\("\/professeur\/connexion\?passwordChanged=1"\)/,
);

console.log("Password session revocation verification passed.");

function read(relativePath) {
  return fs.readFileSync(new URL(relativePath, import.meta.url), "utf8");
}

function modelBlock(source, modelName) {
  const match = source.match(new RegExp(`model ${modelName} \\{([\\s\\S]*?)\\n\\}`));
  assert.ok(match, `Modèle Prisma ${modelName} introuvable.`);
  return match[1];
}

function assertIncrementCount(relativePath, expected) {
  const source = read(relativePath);
  const actual = source.match(/sessionVersion: \{ increment: 1 \}/g)?.length ?? 0;
  assert.equal(actual, expected, `${relativePath} doit incrémenter sessionVersion ${expected} fois.`);
}

function assertSelfServiceSignOut(relativePath, redirectPattern) {
  const source = read(relativePath);
  assert.match(source, /await signOut\(\{ redirect: false \}\)/);
  assert.match(source, redirectPattern);
}
