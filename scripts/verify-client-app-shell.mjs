import fs from "node:fs";
import sharp from "sharp";

const layout = fs.readFileSync("src/app/layout.tsx", "utf8");
const manifest = fs.readFileSync("src/app/manifest.ts", "utf8");
const maskableBounds = await nonWhiteBounds("public/images/brand/competence-icon-512-maskable.png");

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
    label: "Manifest exposes padded any, maskable and Apple brand icons",
    ok:
      fs.existsSync("public/images/brand/competence-icon-192-safe.png")
      && fs.existsSync("public/images/brand/competence-icon-512-safe.png")
      && fs.existsSync("public/images/brand/competence-icon-512-maskable.png")
      && fs.existsSync("public/images/brand/competence-apple-touch-icon.png")
      && /sizes:\s*"192x192"/.test(manifest)
      && /sizes:\s*"512x512"/.test(manifest)
      && /src:\s*"\/images\/brand\/competence-icon-512-maskable\.png"[\s\S]*?purpose:\s*"maskable"/.test(manifest)
      && /purpose:\s*"any"/.test(manifest)
      && /apple:\s*"\/images\/brand\/competence-apple-touch-icon\.png"/.test(layout)
      && maskableBounds.width === 512
      && maskableBounds.height === 512
      && maskableBounds.minX >= 80
      && maskableBounds.minY >= 80
      && maskableBounds.maxX <= 431
      && maskableBounds.maxY <= 431,
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

async function nonWhiteBounds(filePath) {
  const { data, info } = await sharp(filePath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let minX = info.width;
  let minY = info.height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < info.height; y += 1) {
    for (let x = 0; x < info.width; x += 1) {
      const offset = (y * info.width + x) * info.channels;
      const isBrandPixel = data[offset] < 248 || data[offset + 1] < 248 || data[offset + 2] < 248;
      if (!isBrandPixel) continue;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }

  return { width: info.width, height: info.height, minX, minY, maxX, maxY };
}
