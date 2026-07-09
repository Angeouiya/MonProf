import fs from "node:fs";

const checks = [];

const layoutPath = "src/components/layouts/client-layout.tsx";
const publicLayoutPath = "src/components/layouts/public-layout.tsx";
const providersPath = "src/components/providers.tsx";
const cssPath = "src/app/globals.css";

const layout = read(layoutPath);
const publicLayout = read(publicLayoutPath);
const providers = read(providersPath);
const css = read(cssPath);

record(
  "Client bottom nav is guarded while mobile drawer is open",
  /const shouldRenderMobileBottomNav\s*=\s*!hideMobileBottomNav\s*&&\s*!open\s*;/.test(layout)
    && /{shouldRenderMobileBottomNav\s*&&\s*\(\s*<MobileBottomNav/.test(layout),
);

record(
  "Client mobile drawer owns the full screen area below the topbar",
  /data-client-mobile-layer[\s\S]*?style=\{\{\s*bottom:\s*"0px"\s*\}\}/.test(layout),
);

record(
  "CSS also disables bottom nav when the mobile menu is open",
  /\.client-shell\[data-mobile-menu-open="true"\]\s*\[data-client-mobile-nav\]\s*\{[\s\S]*?display:\s*none\s*!important;[\s\S]*?pointer-events:\s*none\s*!important;[\s\S]*?\}/.test(css),
);

record(
  "Route progress indicator is a short settled animation, not an infinite spinner",
  /@keyframes client-route-progress-settle/.test(css)
    && /animation:\s*client-route-progress-settle\s+320ms[\s\S]*?both\s*!important;/.test(css)
    && css.lastIndexOf("client-route-progress-settle 320ms") > css.lastIndexOf("client-route-progress-slide"),
);

record(
  "Client navigation prefetch is enabled for app-like transitions",
  /const CLIENT_NAV_PREFETCH\s*=\s*true\s*;/.test(layout)
    && /requestIdleCallback\(prefetchClientRoutes,\s*\{\s*timeout:\s*desktop\s*\?\s*900\s*:\s*1400\s*\}/.test(layout)
    && /setTimeout\(prefetchClientRoutes,\s*desktop\s*\?\s*220\s*:\s*720\s*\)/.test(layout)
    && /setTimeout\(\(\)\s*=>\s*\{\s*setNavigating\(true\);[\s\S]*?\},\s*16\s*\)/.test(layout),
);

record(
  "Client mobile drawer does not repeat the primary search action",
  /const showPrimaryAction\s*=\s*!compactAccount\s*;/.test(layout)
    && /\{showPrimaryAction\s*&&\s*\(/.test(layout)
    && /compactAccount\s*\/>/.test(layout),
);

record(
  "Client tab and filter labels are protected against vertical wrapping",
  /Final client readability guard/.test(css)
    && /\[data-client-tab-item\][\s\S]*?white-space:\s*nowrap\s*!important;[\s\S]*?word-break:\s*normal\s*!important;/.test(css)
    && /\[data-client-reservation-filter-rail\]\s*button/.test(css),
);

record(
  "Public mobile menu avoids duplicated professor search entries",
  !/useSession/.test(publicLayout)
    && !/SessionProvider/.test(providers)
    && /navLinks\.filter\(\(link\)\s*=>\s*link\.href\s*!==\s*"\/professeurs"\)\.map/.test(publicLayout)
    && /!\s*hideMobileNav\s*&&\s*!\s*mobileOpen\s*&&\s*<PublicMobileNav/.test(publicLayout),
);

for (const check of checks) {
  console.log(`${check.ok ? "OK" : "FAIL"} ${check.label}`);
}

const failed = checks.filter((check) => !check.ok);
if (failed.length > 0) {
  console.log(`FAIL Client mobile navigation verification failed: ${failed.length} issue(s).`);
  process.exitCode = 1;
}

function read(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

function record(label, ok) {
  checks.push({ label, ok });
}
