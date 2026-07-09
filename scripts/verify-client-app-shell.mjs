import fs from "node:fs";

const layout = fs.readFileSync("src/app/layout.tsx", "utf8");
const manifest = fs.readFileSync("src/app/manifest.ts", "utf8");

const checks = [
  {
    label: "Root metadata declares Compétence as an installable app",
    ok:
      /applicationName:\s*"Compétence"/.test(layout)
      && /manifest:\s*"\/manifest\.webmanifest"/.test(layout)
      && /appleWebApp:\s*\{[\s\S]*?capable:\s*true/.test(layout),
  },
  {
    label: "Mobile viewport is app-like with solid navy theme",
    ok:
      /export const viewport/.test(layout)
      && /viewportFit:\s*"cover"/.test(layout)
      && /themeColor:\s*"#111B4D"/.test(layout)
      && /colorScheme:\s*"light"/.test(layout),
  },
  {
    label: "Manifest starts in standalone mode on competence shell",
    ok:
      /display:\s*"standalone"/.test(manifest)
      && /start_url:\s*"\/"/.test(manifest)
      && /scope:\s*"\/"/.test(manifest)
      && /background_color:\s*"#FFFFFF"/.test(manifest)
      && /theme_color:\s*"#111B4D"/.test(manifest),
  },
  {
    label: "Manifest exposes 192 and 512 pixel brand icons",
    ok:
      fs.existsSync("public/images/brand/competence-icon.png")
      && fs.existsSync("public/images/brand/competence-icon-512.png")
      && /sizes:\s*"192x192"/.test(manifest)
      && /sizes:\s*"512x512"/.test(manifest)
      && /purpose:\s*"any"/.test(manifest)
      && /purpose:\s*"maskable"/.test(manifest),
  },
];

for (const check of checks) {
  console.log(`${check.ok ? "OK" : "FAIL"} ${check.label}`);
}

const failed = checks.filter((check) => !check.ok);
if (failed.length > 0) {
  console.log(`FAIL Client app shell verification failed: ${failed.length} issue(s).`);
  process.exitCode = 1;
}
