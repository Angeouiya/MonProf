import fs from "node:fs";
import path from "node:path";

const sourceRoot = path.join(process.cwd(), "src");
const files = walk(sourceRoot).filter((filePath) => filePath.endsWith(".tsx"));
const sources = files.map((filePath) => ({ filePath, source: fs.readFileSync(filePath, "utf8") }));
const passwordFieldSources = sources.filter(({ source }) => (
  /type\s*=\s*["']password["']/.test(source)
  || /type\s*=\s*\{[\s\S]{0,120}?["']password["'][\s\S]{0,120}?\}/.test(source)
  || /<PasswordInput\b/.test(source)
));

const literalPasswordInputs = sources.filter(({ source }) => /type\s*=\s*["']password["']/.test(source));
const uncoveredPasswordInputs = passwordFieldSources.filter(({ source }) => {
  const usesSharedControl = /<PasswordInput\b/.test(source);
  const ownsAccessibleToggle = source.includes("Afficher")
    && source.includes("Masquer")
    && /type=["']button["']/.test(source);
  return !usesSharedControl && !ownsAccessibleToggle;
});

const sharedPasswordInput = read("src/components/shared/password-input.tsx");
const resetPasswordForm = read("src/app/reinitialiser-mot-de-passe/reset-password-form.tsx");
const clientSettings = read("src/app/client/parametres/settings-client.tsx");
const teacherSettings = read("src/app/professeur/(espace)/parametres/settings-client.tsx");
const adminAccount = read("src/app/admin/mon-compte/password-form.tsx");
const adminTeam = read("src/app/admin/equipe/team-client.tsx");

const checks = [
  ["Every password field can be revealed before validation", literalPasswordInputs.length === 0 && uncoveredPasswordInputs.length === 0],
  ["Shared password control starts masked and toggles without submitting", /useState\(false\)/.test(sharedPasswordInput) && /type=\{visible \? "text" : "password"\}/.test(sharedPasswordInput) && /type="button"/.test(sharedPasswordInput)],
  ["Shared password control exposes accessible reveal state", /aria-label=\{visible \? "Masquer le mot de passe" : "Afficher le mot de passe"\}/.test(sharedPasswordInput) && /aria-pressed=\{visible\}/.test(sharedPasswordInput)],
  ["Client reset and settings fields are revealable", /<PasswordInput/.test(resetPasswordForm) && /data-client-password-toggle/.test(clientSettings)],
  ["Professor password settings are revealable", /<PasswordInput/.test(teacherSettings) && !/type="password"/.test(teacherSettings)],
  ["Administrative password fields are revealable", /<PasswordInput/.test(adminAccount) && /<PasswordInput/.test(adminTeam)],
];

for (const [label, ok] of checks) console.log(`${ok ? "OK" : "FAIL"} ${label}`);

if (literalPasswordInputs.length > 0) {
  for (const { filePath } of literalPasswordInputs) console.log(`FAIL Literal password input: ${path.relative(process.cwd(), filePath)}`);
}
if (uncoveredPasswordInputs.length > 0) {
  for (const { filePath } of uncoveredPasswordInputs) console.log(`FAIL Missing reveal control: ${path.relative(process.cwd(), filePath)}`);
}

if (checks.some(([, ok]) => !ok) || literalPasswordInputs.length > 0 || uncoveredPasswordInputs.length > 0) {
  process.exitCode = 1;
}

function read(relativePath) {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(fullPath) : [fullPath];
  });
}
