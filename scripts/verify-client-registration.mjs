import fs from "node:fs";

const formPath = "src/components/auth/inscription-form.tsx";
const pagePath = "src/app/inscription/page.tsx";
const form = fs.readFileSync(formPath, "utf8");
const page = fs.readFileSync(pagePath, "utf8");

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
    && /passwordValid/.test(form)
    && /passwordsMatch/.test(form)
    && /Les deux mots de passe sont identiques/.test(form),
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
