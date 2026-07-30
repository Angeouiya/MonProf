import assert from "node:assert/strict";
import fs from "node:fs";
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url);
const { normalizeAccountPhone, normalizeAccountEmail } = jiti("../src/lib/account-phone.ts");

assert.equal(normalizeAccountPhone("07 01 23 45 67"), "+2250701234567");
assert.equal(normalizeAccountPhone("+225 07 01 23 45 67"), "+2250701234567");
assert.equal(normalizeAccountPhone("00225 07 01 23 45 67"), "+2250701234567");
assert.equal(normalizeAccountPhone("000701234567"), "+2250701234567");
assert.equal(normalizeAccountPhone("+33 6 12 34 56 78"), "+33612345678");
assert.equal(normalizeAccountPhone("123"), null);
assert.equal(normalizeAccountPhone("01 23 45 67"), null);
assert.equal(normalizeAccountPhone("0000000000"), null);
assert.equal(normalizeAccountEmail(" Client@Example.CI "), "client@example.ci");
assert.equal(normalizeAccountEmail(""), null);

const schema = read("../prisma/schema.prisma");
const userModel = modelBlock(schema, "User");
assert.match(userModel, /email\s+String\?\s+@unique/);
assert.match(userModel, /phoneNormalized\s+String\?\s+@unique/);
assert.match(userModel, /passwordMustChange\s+Boolean\s+@default\(false\)/);
assert.match(userModel, /temporaryPasswordIssuedAt\s+DateTime\?/);

const migration = read("../prisma/migrations/20260730000000_client_assisted_password_recovery/migration.sql");
assert.match(migration, /ALTER COLUMN "email" DROP NOT NULL/);
assert.match(migration, /count\(\*\) OVER \(PARTITION BY normalized\)/);
assert.match(migration, /ranked\.duplicate_count = 1/);
assert.match(migration, /without_international_prefix/);
assert.match(migration, /WHEN digits LIKE '00%' THEN substring\(digits FROM 3\)/);
assert.match(migration, /digits NOT LIKE '225%' AND length\(digits\) = 10/);
assert.match(migration, /digits LIKE '0%'/);
assert.match(migration, /digits ~ '\^0\+\$'/);
assert.match(migration, /CREATE UNIQUE INDEX "User_phoneNormalized_key"/);
assert.match(migration, /User_recovery_identifier_check/);
assert.match(migration, /"role" = 'ADMIN' AND "email" IS NOT NULL/);
assert.match(migration, /UPDATE "PasswordResetToken"[\s\S]*"deliveredAt" = NULL/);

const register = read("../src/app/api/auth/register/route.ts");
assert.match(register, /normalizeAccountEmail/);
assert.match(register, /normalizeAccountPhone/);
assert.match(register, /Renseignez un email ou un numéro de téléphone/);
assert.match(register, /phoneNormalized/);
assert.match(register, /error instanceof Prisma\.PrismaClientKnownRequestError/);

const auth = read("../src/lib/auth.ts");
assert.match(auth, /credentials\?\.identifier \|\| credentials\?\.email \|\| credentials\?\.phone/);
assert.match(auth, /findUnique\(\{ where: \{ phoneNormalized:/);
assert.match(auth, /user\.role === "ADMIN" && !emailLogin/);
assert.match(auth, /user\.role === "CLIENT" && user\.passwordMustChange/);
assert.match(auth, /temporaryPasswordIssuedAt: user\.temporaryPasswordIssuedAt/);
assert.match(auth, /temporaryPasswordIssuedAt: null,[\s\S]*sessionVersion: \{ increment: 1 \}/);
assert.match(auth, /passwordMustChange: user\.role === "CLIENT" && user\.passwordMustChange/);
assert.match(auth, /const DUMMY_PASSWORD_HASH = "\$2b\$12\$/);
assert.match(auth, /accountAllowed && user \? user\.passwordHash : DUMMY_PASSWORD_HASH/);
assert.match(auth, /portalAllowed && teacher\?\.portalPasswordHash[\s\S]*DUMMY_PASSWORD_HASH/);

const forgotRoute = read("../src/app/api/auth/forgot-password/route.ts");
assert.match(forgotRoute, /requestPasswordResetAssistanceByPhone/);
assert.match(forgotRoute, /if \(!email && phone\)/);
assert.match(forgotRoute, /GENERIC_PHONE_RESPONSE/);

const outbox = read("../src/lib/password-email-outbox.ts");
const assistanceContract = read("../src/lib/client-password-assistance.ts");
assert.match(assistanceContract, /CLIENT_PASSWORD_ASSISTANCE_REQUESTED/);
const assistanceStart = outbox.indexOf("export async function requestPasswordResetAssistanceByPhone");
const assistanceEnd = outbox.indexOf("export type PasswordChangedEmailInput", assistanceStart);
assert.ok(assistanceStart >= 0 && assistanceEnd > assistanceStart);
const assistance = outbox.slice(assistanceStart, assistanceEnd);
assert.match(assistance, /accountType: "CLIENT_PHONE_ASSISTED"/);
assert.match(assistance, /target\.role !== "CLIENT" \|\| target\.email/);
assert.match(assistance, /type: CLIENT_PASSWORD_ASSISTANCE_NOTIFICATION_TYPE/);
assert.match(assistance, /recipientType: "ADMIN"/);
assert.doesNotMatch(assistance, /recipientType: "CLIENT"|sendClientResetPasswordEmail|passwordResetToken\.create/);

const adminTemporaryPassword = read("../src/app/api/admin/clients/[id]/temporary-password/route.ts");
assert.match(adminTemporaryPassword, /requireAdminApi\("CLIENTS_MANAGE"\)/);
assert.match(adminTemporaryPassword, /if \(target\.email\)/);
assert.match(adminTemporaryPassword, /passwordMustChange: true/);
assert.match(adminTemporaryPassword, /temporaryPasswordIssuedAt: now/);
assert.match(adminTemporaryPassword, /sessionVersion: \{ increment: 1 \}/);
assert.match(adminTemporaryPassword, /passwordHash: target\.passwordHash/);
assert.match(adminTemporaryPassword, /CLIENT_ASSISTED_RECOVERY_STATE_CHANGED/);
assert.match(adminTemporaryPassword, /status: 409/);
assert.match(adminTemporaryPassword, /tx\.passwordResetToken\.updateMany/);
assert.match(adminTemporaryPassword, /type: CLIENT_PASSWORD_ASSISTANCE_NOTIFICATION_TYPE/);
assert.match(adminTemporaryPassword, /Cache-Control": "no-store, max-age=0"/);
assert.doesNotMatch(adminTemporaryPassword, /console\.log\([^)]*temporaryPassword/);

const adminClientPage = read("../src/app/admin/clients/[id]/page.tsx");
assert.match(adminClientPage, /type: CLIENT_PASSWORD_ASSISTANCE_NOTIFICATION_TYPE/);
assert.match(adminClientPage, /canIssueTemporaryPassword = !client\.email && Boolean\(client\.phoneNormalized\)/);

const adminTemporaryPasswordForm = read("../src/components/admin/client-temporary-password-form.tsx");
assert.match(adminTemporaryPasswordForm, /setPassword\(data\.temporaryPassword\)/);
assert.doesNotMatch(adminTemporaryPasswordForm, /createTemporaryPassword|JSON\.stringify\(\{ password/);

const proxy = read("../src/proxy.ts");
assert.match(proxy, /token\?\.role !== "CLIENT" \|\| token\.passwordMustChange !== true/);
assert.match(proxy, /pathname\.startsWith\("\/api\/auth\/"\)/);
assert.match(proxy, /pathname === "\/api\/client\/profile" && request\.method === "PATCH"/);
assert.match(proxy, /matcher: "\/api\/:path\*"/);

const profileRoute = read("../src/app/api/client/profile/route.ts");
assert.match(profileRoute, /action !== "changePassword"/);
assert.match(profileRoute, /PASSWORD_CHANGE_REQUIRED/);

for (const relativePath of [
  "../src/app/api/auth/reset-password/route.ts",
  "../src/app/api/client/profile/route.ts",
]) {
  const source = read(relativePath);
  assert.match(source, /passwordMustChange: false/);
  assert.match(source, /temporaryPasswordIssuedAt: null/);
}

console.log("Client assisted password recovery verification passed.");

function read(relativePath) {
  return fs.readFileSync(new URL(relativePath, import.meta.url), "utf8");
}

function modelBlock(source, modelName) {
  const match = source.match(new RegExp(`model ${modelName} \\{([\\s\\S]*?)\\n\\}`));
  assert.ok(match, `Modèle Prisma ${modelName} introuvable.`);
  return match[1];
}
