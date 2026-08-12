import fs from "node:fs";
import path from "node:path";

const sourceRoot = path.join(process.cwd(), "src");
const files = walk(sourceRoot).filter((filePath) => filePath.endsWith(".tsx"));
const sources = files.map((filePath) => ({ filePath, source: fs.readFileSync(filePath, "utf8") }));
const sharedControlPath = path.join(sourceRoot, "components", "shared", "password-input.tsx");
const applicationSources = sources.filter(({ filePath }) => filePath !== sharedControlPath);
const toRelative = (filePath) => path.relative(process.cwd(), filePath).replaceAll("\\", "/");

const rawPasswordTypes = applicationSources.filter(({ source }) => (
  /type\s*=\s*["']password["']/.test(source)
  || /type\s*=\s*\{[\s\S]{0,120}?["']password["'][\s\S]{0,120}?\}/.test(source)
));

const plaintextSensitiveInputs = applicationSources.flatMap(({ filePath, source }) => {
  const tags = source.match(/<Input\b[\s\S]*?\/>/g) ?? [];
  return tags
    .filter((tag) => (
      /autoComplete=["'](?:current|new)-password["']/.test(tag)
      || /\{\.\.\.register\(["'][^"']*password["']\)\}/i.test(tag)
      || /\b(?:id|name)=["'][^"']*password["']/i.test(tag)
    ))
    .map((tag) => ({ filePath, tag: tag.replace(/\s+/g, " ").slice(0, 220) }));
});

const duplicatedVisibilityLogic = applicationSources.filter(({ source }) => (
  /showPassword|setShowPassword/.test(source)
  || /visible\s*\?\s*["']text["']\s*:\s*["']password["']/.test(source)
));

const renderedPasswordControlFiles = applicationSources
  .filter(({ source }) => /<PasswordInput\b/.test(source))
  .map(({ filePath }) => toRelative(filePath))
  .sort();
const importedPasswordControlFiles = applicationSources
  .filter(({ source }) => /import\s*\{\s*PasswordInput\s*\}\s*from\s*["']@\/components\/shared\/password-input["']/.test(source))
  .map(({ filePath }) => toRelative(filePath))
  .sort();
const importWithoutRender = importedPasswordControlFiles.filter((filePath) => !renderedPasswordControlFiles.includes(filePath));
const renderWithoutImport = renderedPasswordControlFiles.filter((filePath) => !importedPasswordControlFiles.includes(filePath));

const passwordSurfaces = [
  "src/app/connexion/page.tsx",
  "src/app/professeur/connexion/page.tsx",
  "src/app/(public-admin)/admin/connexion/page.tsx",
  "src/components/auth/inscription-form.tsx",
  "src/app/reinitialiser-mot-de-passe/reset-password-form.tsx",
  "src/app/client/parametres/settings-client.tsx",
  "src/app/professeur/(espace)/parametres/settings-client.tsx",
  "src/app/admin/mon-compte/password-form.tsx",
  "src/app/admin/equipe/team-client.tsx",
  "src/components/admin/teacher-form.tsx",
  "src/components/admin/client-temporary-password-form.tsx",
];
const passwordRuleSurfaces = [
  "src/components/auth/inscription-form.tsx",
  "src/app/reinitialiser-mot-de-passe/reset-password-form.tsx",
  "src/app/client/parametres/settings-client.tsx",
  "src/app/professeur/(espace)/parametres/settings-client.tsx",
  "src/app/admin/mon-compte/password-form.tsx",
  "src/app/admin/equipe/team-client.tsx",
  "src/components/admin/teacher-form.tsx",
];

const sharedPasswordInput = read("src/components/shared/password-input.tsx");
const sharedPasswordRuleList = read("src/components/shared/password-rule-list.tsx");
const missingSharedControl = passwordSurfaces.filter((surface) => !/<PasswordInput\b/.test(read(surface)));
const missingRuleList = passwordRuleSurfaces.filter((surface) => !/<PasswordRuleList\b/.test(read(surface)));
const clientTemporaryPassword = read("src/components/admin/client-temporary-password-form.tsx");
const clientPasswordSettings = read("src/app/client/parametres/settings-client.tsx");
const professorPasswordSettings = read("src/app/professeur/(espace)/parametres/settings-client.tsx");
const adminPasswordSettings = read("src/app/admin/mon-compte/password-form.tsx");
const adminTeam = read("src/app/admin/equipe/team-client.tsx");
const teacherForm = read("src/components/admin/teacher-form.tsx");
const clientLogin = read("src/app/connexion/page.tsx");
const professorLogin = read("src/app/professeur/connexion/page.tsx");
const adminLogin = read("src/app/(public-admin)/admin/connexion/page.tsx");
const forgotPasswordForm = read("src/app/mot-de-passe-oublie/forgot-password-form.tsx");
const resetPasswordForm = read("src/app/reinitialiser-mot-de-passe/reset-password-form.tsx");
const clientTemporaryGate = read("src/components/client/temporary-password-gate.tsx");
const professorTemporaryGate = read("src/components/professor/temporary-password-gate.tsx");

const checks = [
  [`All ${passwordSurfaces.length} required password surfaces use the same revealable control`, missingSharedControl.length === 0],
  [`All ${passwordRuleSurfaces.length} password creation/change surfaces show rules before validation`, missingRuleList.length === 0],
  [`Every rendered password control is imported and tracked (${renderedPasswordControlFiles.length} surfaces)`, importWithoutRender.length === 0 && renderWithoutImport.length === 0],
  ["No application password field bypasses the shared control", rawPasswordTypes.length === 0 && plaintextSensitiveInputs.length === 0],
  ["Password visibility logic is not duplicated across pages", duplicatedVisibilityLogic.length === 0],
  ["Shared password control starts masked unless explicitly requested", /defaultVisible\s*=\s*false/.test(sharedPasswordInput) && /useState\(defaultVisible\)/.test(sharedPasswordInput)],
  ["Reveal button never submits and exposes its state accessibly", /type="button"/.test(sharedPasswordInput) && /const controlLabel = visible \? "Masquer le mot de passe" : "Afficher le mot de passe";/.test(sharedPasswordInput) && /aria-label=\{controlLabel\}/.test(sharedPasswordInput) && /aria-pressed=\{visible\}/.test(sharedPasswordInput)],
  ["Reveal button is readable on mobile with Voir/Masquer text", /const controlText = visible \? "Masquer" : "Voir";/.test(sharedPasswordInput) && /data-password-visibility-label=\{controlText\.toLowerCase\(\)\}/.test(sharedPasswordInput) && /<span>\{controlText\}<\/span>/.test(sharedPasswordInput)],
  ["Shared password control exposes visible state and verification capability for QA", /data-password-can-verify="true"/.test(sharedPasswordInput) && /data-password-visible=\{visible \? "true" : "false"\}/.test(sharedPasswordInput)],
  ["Shared password rule list exposes ready and per-rule states for QA", /data-password-rule-list/.test(sharedPasswordRuleList) && /data-password-rule-list-ready=\{ready \? "true" : "false"\}/.test(sharedPasswordRuleList) && /data-password-rule=\{rule\.ok \? "ok" : "pending"\}/.test(sharedPasswordRuleList)],
  ["Visible password input disables phone autocorrection", /autoCapitalize="none"/.test(sharedPasswordInput) && /autoCorrect="off"/.test(sharedPasswordInput) && /spellCheck=\{false\}/.test(sharedPasswordInput)],
  ["Reveal button is always tied to its controlled input", /useId/.test(sharedPasswordInput) && /const inputId = typeof props\.id === "string" && props\.id\.trim\(\) \? props\.id : `password-\$\{generatedId\}`;/.test(sharedPasswordInput) && /id=\{inputId\}/.test(sharedPasswordInput) && /aria-controls=\{inputId\}/.test(sharedPasswordInput)],
  ["Generated one-time client password remains immediately readable", /<PasswordInput[\s\S]*?defaultVisible/.test(clientTemporaryPassword)],
  [
    "Password changes use calm inline states instead of non-critical floating toasts",
    !/toast\./.test(clientPasswordSettings)
      && !/toast\./.test(professorPasswordSettings)
      && !/toast\./.test(adminPasswordSettings)
      && countOccurrences(`${clientPasswordSettings}\n${professorPasswordSettings}\n${adminPasswordSettings}`, "data-password-settings-inline-error") >= 3
      && /data-password-changed-login-state/.test(clientLogin)
      && /data-password-changed-login-state/.test(professorLogin)
      && /data-password-changed-login-state/.test(adminLogin)
      && !/Connexion réussie|Connexion professeur réussie|Connexion administrateur réussie/.test(`${clientLogin}\n${professorLogin}\n${adminLogin}`),
  ],
  [
    "Admin temporary password actions are blocked until visible rules are satisfied",
    /const createPasswordRules = temporaryPasswordRules\(form\.password\)/.test(adminTeam)
      && /const createPasswordReady = createPasswordRules\.every\(\(rule\) => rule\.ok\)/.test(adminTeam)
      && /disabled=\{creating \|\| !createPasswordReady\}/.test(adminTeam)
      && /data-admin-team-create-password-rules/.test(adminTeam)
      && /const resetPasswordRules = temporaryPasswordRules\(password\)/.test(adminTeam)
      && /const resetPasswordReady = resetPasswordRules\.every\(\(rule\) => rule\.ok\)/.test(adminTeam)
      && /disabled=\{loading \|\| !resetPasswordReady\}/.test(adminTeam)
      && /data-admin-team-reset-password-rules/.test(adminTeam),
  ],
  [
    "Teacher portal temporary password shows rules when a new access password is required",
    /const portalPasswordRules = teacherPortalPasswordRules\(portalPasswordText\)/.test(teacherForm)
      && /const showPortalPasswordRules = Boolean\(portalAccessEnabled\)/.test(teacherForm)
      && /data-admin-teacher-portal-password-rules/.test(teacherForm)
      && /function teacherPortalPasswordRules\(value: string\)/.test(teacherForm),
  ],
  [
    "Professor payout settings use inline status instead of routine floating toasts",
    !/toast\./.test(professorPasswordSettings)
      && /data-professor-payout-profile-inline-error/.test(professorPasswordSettings)
      && /data-professor-payout-profile-saved/.test(professorPasswordSettings),
  ],
  [
    "Forgot and reset password flows keep routine feedback inline",
    !/toast\.success|toast\.warning/.test(`${forgotPasswordForm}\n${resetPasswordForm}`)
      && /data-forgot-password-inline-state/.test(forgotPasswordForm)
      && /passwordChanged/.test(resetPasswordForm)
      && /setFormError/.test(forgotPasswordForm)
      && /setFormError/.test(resetPasswordForm),
  ],
  [
    "Temporary password gates stay mobile-simple and reuse revealable password forms",
    /data-temporary-password-gate="client"/.test(clientTemporaryGate)
      && /data-temporary-password-gate="professor"/.test(professorTemporaryGate)
      && /data-temporary-password-intro/.test(clientTemporaryGate)
      && /data-temporary-password-intro/.test(professorTemporaryGate)
      && /max-w-\[30rem\]/.test(clientTemporaryGate)
      && /max-w-\[30rem\]/.test(professorTemporaryGate)
      && /<ClientPasswordSettingsForm \/>/.test(clientTemporaryGate)
      && /<TeacherPasswordSettingsForm \/>/.test(professorTemporaryGate)
      && /Nouveau mot de passe/.test(clientTemporaryGate)
      && /Nouveau mot de passe/.test(professorTemporaryGate)
      && /Espace débloqué après validation\./.test(clientTemporaryGate)
      && /Missions et paiements protégés\./.test(professorTemporaryGate)
      && !/Bonjour/.test(`${clientTemporaryGate}\n${professorTemporaryGate}`)
      && !/session temporaire sera ensuite fermée|Après validation, votre session temporaire/.test(`${clientTemporaryGate}\n${professorTemporaryGate}`),
  ],
];

for (const [label, ok] of checks) console.log(`${ok ? "OK" : "FAIL"} ${label}`);

for (const surface of missingSharedControl) console.log(`FAIL Missing shared password control: ${surface}`);
for (const surface of missingRuleList) console.log(`FAIL Missing password rule list: ${surface}`);
for (const filePath of importWithoutRender) console.log(`FAIL PasswordInput imported but not rendered: ${filePath}`);
for (const filePath of renderWithoutImport) console.log(`FAIL PasswordInput rendered without direct shared import: ${filePath}`);
for (const { filePath } of rawPasswordTypes) console.log(`FAIL Raw password type: ${toRelative(filePath)}`);
for (const { filePath, tag } of plaintextSensitiveInputs) console.log(`FAIL Password-like Input exposed as plain text: ${toRelative(filePath)} :: ${tag}`);
for (const { filePath } of duplicatedVisibilityLogic) console.log(`FAIL Duplicated visibility state: ${toRelative(filePath)}`);

if (checks.some(([, ok]) => !ok)) process.exitCode = 1;

function read(relativePath) {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(fullPath) : [fullPath];
  });
}

function countOccurrences(source, fragment) {
  return source.split(fragment).length - 1;
}
