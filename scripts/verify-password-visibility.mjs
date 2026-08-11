import fs from "node:fs";
import path from "node:path";

const sourceRoot = path.join(process.cwd(), "src");
const files = walk(sourceRoot).filter((filePath) => filePath.endsWith(".tsx"));
const sources = files.map((filePath) => ({ filePath, source: fs.readFileSync(filePath, "utf8") }));
const sharedControlPath = path.join(sourceRoot, "components", "shared", "password-input.tsx");
const applicationSources = sources.filter(({ filePath }) => filePath !== sharedControlPath);

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

const sharedPasswordInput = read("src/components/shared/password-input.tsx");
const missingSharedControl = passwordSurfaces.filter((surface) => !/<PasswordInput\b/.test(read(surface)));
const clientTemporaryPassword = read("src/components/admin/client-temporary-password-form.tsx");

const checks = [
  ["All 11 password surfaces use the same revealable control", missingSharedControl.length === 0],
  ["No application password field bypasses the shared control", rawPasswordTypes.length === 0 && plaintextSensitiveInputs.length === 0],
  ["Password visibility logic is not duplicated across pages", duplicatedVisibilityLogic.length === 0],
  ["Shared password control starts masked unless explicitly requested", /defaultVisible\s*=\s*false/.test(sharedPasswordInput) && /useState\(defaultVisible\)/.test(sharedPasswordInput)],
  ["Reveal button never submits and exposes its state accessibly", /type="button"/.test(sharedPasswordInput) && /const controlLabel = visible \? "Masquer le mot de passe" : "Afficher le mot de passe";/.test(sharedPasswordInput) && /aria-label=\{controlLabel\}/.test(sharedPasswordInput) && /aria-pressed=\{visible\}/.test(sharedPasswordInput)],
  ["Reveal button is readable on mobile with Voir/Masquer text", /const controlText = visible \? "Masquer" : "Voir";/.test(sharedPasswordInput) && /data-password-visibility-label=\{controlText\.toLowerCase\(\)\}/.test(sharedPasswordInput) && /<span>\{controlText\}<\/span>/.test(sharedPasswordInput)],
  ["Shared password control exposes visible state for QA", /data-password-visible=\{visible \? "true" : "false"\}/.test(sharedPasswordInput)],
  ["Visible password input disables phone autocorrection", /autoCapitalize="none"/.test(sharedPasswordInput) && /autoCorrect="off"/.test(sharedPasswordInput) && /spellCheck=\{false\}/.test(sharedPasswordInput)],
  ["Reveal button is always tied to its controlled input", /useId/.test(sharedPasswordInput) && /const inputId = typeof props\.id === "string" && props\.id\.trim\(\) \? props\.id : `password-\$\{generatedId\}`;/.test(sharedPasswordInput) && /id=\{inputId\}/.test(sharedPasswordInput) && /aria-controls=\{inputId\}/.test(sharedPasswordInput)],
  ["Generated one-time client password remains immediately readable", /<PasswordInput[\s\S]*?defaultVisible/.test(clientTemporaryPassword)],
];

for (const [label, ok] of checks) console.log(`${ok ? "OK" : "FAIL"} ${label}`);

for (const surface of missingSharedControl) console.log(`FAIL Missing shared password control: ${surface}`);
for (const { filePath } of rawPasswordTypes) console.log(`FAIL Raw password type: ${path.relative(process.cwd(), filePath)}`);
for (const { filePath, tag } of plaintextSensitiveInputs) console.log(`FAIL Password-like Input exposed as plain text: ${path.relative(process.cwd(), filePath)} :: ${tag}`);
for (const { filePath } of duplicatedVisibilityLogic) console.log(`FAIL Duplicated visibility state: ${path.relative(process.cwd(), filePath)}`);

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
