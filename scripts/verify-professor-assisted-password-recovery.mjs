import assert from "node:assert/strict";
import fs from "node:fs";

const service = read("../src/lib/teacher-password-assistance.ts");
assert.match(service, /TEACHER_PASSWORD_ASSISTANCE_REQUESTED/);
assert.match(service, /const validPhone = normalizeAccountPhone\(input\.phone\)/);
assert.match(service, /const portalPhone = normalizeTeacherPhone\(input\.phone\)/);
assert.match(service, /passwordEmailIdentifier\(`teacher-phone:\$\{portalPhone\}`/);
assert.match(service, /passwordEmailIdentifier\(`ip:\$\{input\.clientIdentifier\}`/);
assert.match(service, /accountType: "PROFESSOR_PHONE_ASSISTED"/);
assert.match(service, /isPasswordResetIpAllowed\(recentIpRequests\)/);
assert.match(service, /isPasswordResetRequestAllowed\(recentAccountRequests\)/);
assert.match(service, /where: \{ portalPhone \}/);
assert.match(service, /if \(!teacher\)[\s\S]*accepted: true, notificationId: null/);
assert.match(service, /type: TEACHER_PASSWORD_ASSISTANCE_NOTIFICATION_TYPE/);
assert.match(service, /userId: null/);
assert.match(service, /recipientType: "ADMIN"/);
assert.match(service, /priority: "URGENT"/);
assert.match(service, /read: false/);
assert.match(service, /status: "RELAUNCHED"/);
assert.match(service, /createdAt: now/);
assert.match(service, /teacherId: teacher\.id/);
assert.match(service, /ASSIGN_TEACHER_TEMPORARY_PASSWORD/);
assert.doesNotMatch(service, /console\.(?:log|warn|error)\([^\n]*(?:input\.phone|portalPhone)/);

const route = read("../src/app/api/professor/password-assistance/route.ts");
assert.match(route, /requestTeacherPasswordAssistance/);
assert.match(route, /Cache-Control": "no-store, max-age=0"/);
assert.match(route, /Si un accès professeur correspond/);
assert.doesNotMatch(route, /(?:professeur|enseignant|compte)[^\n]*introuvable/i);

const login = read("../src/app/professeur/connexion/page.tsx");
assert.match(login, /\/api\/professor\/password-assistance/);
assert.match(login, /diplomateimmobilier99@gmail\.com/);
assert.match(login, /Demander une assistance sécurisée/);

const adminTeacherRoute = read("../src/app/api/admin/teachers/[id]/route.ts");
assert.match(adminTeacherRoute, /identityVerified !== true/);
assert.match(adminTeacherRoute, /isClientIdentityVerificationMethod\(normalizedVerificationMethod\)/);
assert.match(adminTeacherRoute, /isSafeIdentityVerificationReference\(normalizedVerificationReference\)/);
assert.match(adminTeacherRoute, /référence : \$\{normalizedVerificationReference\}/);
assert.match(adminTeacherRoute, /TEACHER_PASSWORD_ASSISTANCE_NOTIFICATION_TYPE/);
assert.match(adminTeacherRoute, /status: "CONFIRMED"/);

const adminTeacherForm = read("../src/components/admin/teacher-form.tsx");
assert.match(adminTeacherForm, /teacherPasswordResetRequested/);
assert.match(adminTeacherForm, /passwordIdentityVerified/);
assert.match(adminTeacherForm, /passwordVerificationMethod/);
assert.match(adminTeacherForm, /passwordVerificationReference/);

const adminLayout = read("../src/app/admin/layout.tsx");
assert.match(adminLayout, /"userId" IS NULL[\s\S]*"read" = false[\s\S]*'URGENT'/);
assert.match(adminLayout, /"teacherId" IS NOT NULL/);

console.log("Professor assisted password recovery verification passed.");

function read(relativePath) {
  return fs.readFileSync(new URL(relativePath, import.meta.url), "utf8");
}
