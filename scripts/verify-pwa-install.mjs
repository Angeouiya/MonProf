import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const prompt = readFileSync("src/components/shared/pwa-install-prompt.tsx", "utf8");
const deferredPrompt = readFileSync("src/components/shared/deferred-pwa-install-prompt.tsx", "utf8");
const layout = readFileSync("src/app/layout.tsx", "utf8");
const manifest = readFileSync("src/app/manifest.ts", "utf8");

assert.match(prompt, /beforeinstallprompt/);
assert.match(prompt, /appinstalled/);
assert.match(prompt, /serviceWorker\.register\("\/sw\.js"/);
assert.match(prompt, /display-mode: standalone/);
assert.match(prompt, /iPhone\|iPad\|iPod/);
assert.match(prompt, /Ajouter à l’écran d’accueil/);
assert.match(prompt, /DISMISS_DURATION_MS/);
assert.match(prompt, /competence:pwa-install-dismissed-at:v2/);
assert.match(prompt, /data-pwa-install-prompt/);
assert.match(layout, /<DeferredPwaInstallPrompt \/>/);
assert.match(deferredPrompt, /PWA_PROMPT_AFTER_LOAD_MS = 5_000/);
assert.match(deferredPrompt, /lazy\(\(\) => import\("@\/components\/shared\/pwa-install-prompt"\)/);
assert.match(manifest, /display: "standalone"/);
assert.match(manifest, /competence-icon-512-maskable\.png/);

console.log("OK installation PWA: invite mobile, installation Android, parcours iOS, anti-répétition et manifest vérifiés.");
