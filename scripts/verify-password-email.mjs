import assert from "node:assert/strict";
import fs from "node:fs";
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url);
const {
  passwordChangedEmailTemplate,
  passwordResetEmailTemplate,
} = jiti("../src/lib/password-email-templates.ts");

const resetUrl = "https://www.competence.ci/reinitialiser-mot-de-passe?token=secret-token&compte=client";
const reset = passwordResetEmailTemplate({
  name: "Professeur <script>alert(1)</script>",
  resetUrl,
  expiresInMinutes: 60,
});
assert.match(reset.text, /expire dans 60 minutes/);
assert.match(reset.text, /secret-token/);
assert.match(reset.html, /Modifier mon mot de passe/);
assert.match(reset.html, /Professeur &lt;script&gt;alert\(1\)&lt;\/script&gt;/);
assert.doesNotMatch(reset.html, /<script>alert\(1\)<\/script>/);

const changed = passwordChangedEmailTemplate({
  name: "Awa",
  changedAtLabel: "27 juillet 2026 à 12:00",
  securityUrl: "https://www.competence.ci/mot-de-passe-oublie",
  accountLabel: "espace professeur Compétence",
});
assert.match(changed.text, /espace professeur Compétence/);
assert.match(changed.html, /Votre mot de passe a été modifié/);

const gmailSource = fs.readFileSync(new URL("../src/lib/gmail-email.ts", import.meta.url), "utf8");
const deliverySource = fs.readFileSync(new URL("../src/lib/notification-delivery.ts", import.meta.url), "utf8");
assert.match(gmailSource, /diplomateimmobilier99@gmail\.com/);
assert.doesNotMatch(gmailSource, /NEXT_PUBLIC_GMAIL/);
assert.match(gmailSource, /AbortSignal\.timeout\(GMAIL_REQUEST_TIMEOUT_MS\)/);
assert.match(deliverySource, /sendClientResetPasswordEmail[\s\S]*?return sendGmailSecurityEmail/);
assert.match(deliverySource, /sendClientPasswordChangedEmail[\s\S]*?return sendGmailSecurityEmail/);
assert.match(deliverySource, /Aucun autre expéditeur n'est autorisé/);

const forgotRoute = fs.readFileSync(new URL("../src/app/api/auth/forgot-password/route.ts", import.meta.url), "utf8");
const resetRoute = fs.readFileSync(new URL("../src/app/api/auth/reset-password/route.ts", import.meta.url), "utf8");
const outboxSource = fs.readFileSync(new URL("../src/lib/password-email-outbox.ts", import.meta.url), "utf8");
const forgotForm = fs.readFileSync(new URL("../src/app/mot-de-passe-oublie/forgot-password-form.tsx", import.meta.url), "utf8");
const adminLogin = fs.readFileSync(new URL("../src/app/(public-admin)/admin/connexion/page.tsx", import.meta.url), "utf8");
assert.match(outboxSource, /async function resolveClientResetTarget/);
assert.match(outboxSource, /user\?\.role === "CLIENT"/);
assert.doesNotMatch(outboxSource, /resolveResetTarget|AMBIGUOUS_TEACHER|accountTypeToHint/);
assert.doesNotMatch(outboxSource, /teacherPasswordResetToken/);
assert.match(outboxSource, /encryptPasswordEmailPayload/);
assert.match(outboxSource, /status: "SUPERSEDED"/);
assert.match(outboxSource, /delivery\.ambiguous/);
assert.match(outboxSource, /finalizeResetTokenDelivery/);
assert.match(forgotRoute, /after\(async \(\) =>/);
assert.match(forgotRoute, /flushPasswordEmailOutbox/);
assert.match(outboxSource, /passwordResetRequestAudit/);
assert.match(outboxSource, /deliveredAt: now/);
assert.doesNotMatch(forgotForm, /Espace concerné|PROFESSOR|ADMIN/);
assert.match(forgotForm, /body: JSON\.stringify\(\{ email \}\)/);
assert.doesNotMatch(adminLogin, /mot-de-passe-oublie/);
assert.match(resetRoute, /resetToken\.user\.role !== "CLIENT"/);
assert.match(resetRoute, /redirectTo: "\/connexion"/);
assert.doesNotMatch(resetRoute, /teacherPasswordResetToken|compte=professeur|compte=admin/);
assert.match(resetRoute, /deliveredAt: \{ not: null \}/);
assert.match(resetRoute, /enqueuePasswordChangedEmailInTransaction\(tx/);
assert.doesNotMatch(resetRoute, /await sendClientPasswordChangedEmail/);

for (const relativePath of [
  "../src/app/api/client/profile/route.ts",
  "../src/app/api/admin/profile/route.ts",
  "../src/app/api/admin/team/[id]/route.ts",
  "../src/app/api/professor/profile/route.ts",
  "../src/app/api/admin/teachers/[id]/route.ts",
]) {
  const route = fs.readFileSync(new URL(relativePath, import.meta.url), "utf8");
  assert.match(route, /enqueuePasswordChangedEmailInTransaction\(tx/);
  assert.doesNotMatch(route, /await sendClientPasswordChangedEmail/);
}

console.log("Password reset email verification passed.");
