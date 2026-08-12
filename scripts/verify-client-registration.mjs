import fs from "node:fs";

const formPath = "src/components/auth/inscription-form.tsx";
const pagePath = "src/app/inscription/page.tsx";
const form = fs.readFileSync(formPath, "utf8");
const page = fs.readFileSync(pagePath, "utf8");
const passwordPolicy = fs.readFileSync("src/lib/password-policy.ts", "utf8");
const registerRoute = fs.readFileSync("src/app/api/auth/register/route.ts", "utf8");
const resetRoute = fs.readFileSync("src/app/api/auth/reset-password/route.ts", "utf8");
const resetForm = fs.readFileSync("src/app/reinitialiser-mot-de-passe/reset-password-form.tsx", "utf8");
const clientSettings = fs.readFileSync("src/app/client/parametres/settings-client.tsx", "utf8");

const checks = [];

function check(label, condition) {
  checks.push({ label, condition: Boolean(condition) });
}

check(
  "Registration is split into two progressive steps",
  /useState<1 \| 2>\(1\)/.test(form)
    && /Étape \{step} sur 2/.test(form)
    && /continueToPassword/.test(form)
    && /step === 1/.test(form),
);
check(
  "Registration asks only for identity and access data",
  !/SearchableCatalogSelect/.test(form)
    && !/id="commune"/.test(form)
    && !/id="quartier"/.test(form)
    && !/getCachedTeacherSearchCatalog/.test(page),
);
check(
  "Email or phone remains accepted",
  /!normalizedEmail && !normalizedPhone/.test(form)
    && /email: normalizedEmail \|\| undefined/.test(form)
    && /phone: normalizedPhone \|\| undefined/.test(form),
);
check(
  "Both password fields can be revealed before validation",
  (form.match(/<PasswordInput/g) ?? []).length === 2
    && /<PasswordRuleList rules=\{passwordRules\}/.test(form)
    && /data-client-registration-password-rules/.test(form)
    && /passwordValid/.test(form)
    && /passwordsMatch/.test(form)
    && /Les deux mots de passe sont identiques/.test(form),
);
check(
  "Client passwords start at 6 characters while admin and professor policies stay stricter",
  /CLIENT_PASSWORD_MIN_LENGTH\s*=\s*6/.test(passwordPolicy)
    && /PASSWORD_MIN_LENGTH\s*=\s*10/.test(passwordPolicy)
    && /ADMIN_PASSWORD_MIN_LENGTH\s*=\s*10/.test(passwordPolicy)
    && /TEACHER_PASSWORD_MIN_LENGTH\s*=\s*PASSWORD_MIN_LENGTH/.test(passwordPolicy)
    && /input\.role === "CLIENT" \? CLIENT_PASSWORD_MIN_LENGTH : PASSWORD_MIN_LENGTH/.test(passwordPolicy)
    && /isClientPasswordCompliant/.test(passwordPolicy)
    && /CLIENT_PASSWORD_MIN_LENGTH/.test(form)
    && /isClientPasswordCompliant/.test(form)
    && /CLIENT_PASSWORD_MIN_LENGTH/.test(registerRoute)
    && /isClientPasswordCompliant/.test(registerRoute)
    && /validatePasswordForAccount\(password, resetToken\.user\)/.test(resetRoute)
    && /CLIENT_PASSWORD_MIN_LENGTH/.test(resetForm)
    && /isClientPasswordCompliant/.test(resetForm)
    && /CLIENT_PASSWORD_MIN_LENGTH/.test(clientSettings),
);
check(
  "Legal acceptance stays mandatory",
  /if \(!legalAccepted\)/.test(form)
    && /legalAccepted,/.test(form)
    && /conditions-utilisation/.test(form)
    && /politique-confidentialite/.test(form),
);
check(
  "Return-to-booking handoff stays preserved",
  /getSafeInternalReturnPath\(from\)/.test(page)
    && /router\.push\(returnTo \?/.test(form)
    && /router\.push\(returnTo \?\? "\/client"\)/.test(form),
);

const failed = checks.filter((item) => !item.condition);
for (const item of checks) {
  console.log(`${item.condition ? "PASS" : "FAIL"}: ${item.label}`);
}

if (failed.length > 0) {
  process.exitCode = 1;
} else {
  console.log("Client registration verification passed.");
}
