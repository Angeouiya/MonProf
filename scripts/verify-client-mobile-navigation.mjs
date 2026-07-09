import fs from "node:fs";

const checks = [];

const layoutPath = "src/components/layouts/client-layout.tsx";
const publicLayoutPath = "src/components/layouts/public-layout.tsx";
const publicTeachersPath = "src/app/professeurs/page.tsx";
const clientReservationDetailPath = "src/app/client/reservations/[id]/page.tsx";
const clientReschedulePanelPath = "src/app/client/reservations/[id]/reschedule-request-panel.tsx";
const clientLoadingPath = "src/app/client/loading.tsx";
const bookingApiPath = "src/app/api/bookings/[id]/route.ts";
const providersPath = "src/components/providers.tsx";
const cssPath = "src/app/globals.css";

const layout = read(layoutPath);
const publicLayout = read(publicLayoutPath);
const publicTeachersPage = read(publicTeachersPath);
const clientReservationDetail = read(clientReservationDetailPath);
const clientReschedulePanel = read(clientReschedulePanelPath);
const clientLoading = read(clientLoadingPath);
const bookingApi = read(bookingApiPath);
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
  "Client mobile drawer is an app-like side sheet, not a centered blocking card",
  /data-client-mobile-drawer[\s\S]*?className="[^"]*absolute bottom-2 left-2 top-2[\s\S]*?w-\[min\(22\.5rem,calc\(100vw-1rem\)\)\]/.test(layout)
    && /\.client-shell\s*\[data-client-mobile-drawer\]\.client-mobile-menu-panel\s*\{[\s\S]*?right:\s*auto\s*!important;[\s\S]*?width:\s*min\(22\.5rem,\s*calc\(100vw - 1rem\)\)\s*!important;[\s\S]*?\}/.test(css),
);

record(
  "CSS also disables bottom nav when the mobile menu is open",
  /\.client-shell\[data-mobile-menu-open="true"\]\s*\[data-client-mobile-nav\]\s*\{[\s\S]*?display:\s*none\s*!important;[\s\S]*?pointer-events:\s*none\s*!important;[\s\S]*?\}/.test(css),
);

record(
  "Client mobile overlay is dimmed without turning the app into a black screen",
  /\.client-shell\s*\[data-client-mobile-layer\]\s*>\s*button\s*\{[\s\S]*?opacity:\s*0\.46\s*!important;[\s\S]*?\}/.test(css),
);

record(
  "Route progress indicator is a short settled animation, not an infinite spinner",
  /@keyframes client-route-progress-settle/.test(css)
    && /animation:\s*client-route-progress-slide\s+180ms/.test(css)
    && /animation:\s*client-route-progress-settle\s+220ms[\s\S]*?both\s*!important;/.test(css)
    && css.lastIndexOf("client-route-progress-settle 220ms") > css.lastIndexOf("client-route-progress-slide"),
);

record(
  "Client navigation prefetch is prioritized and feedback avoids instant-load flashes",
  /const CLIENT_NAV_PREFETCH\s*=\s*true\s*;/.test(layout)
    && /const CLIENT_IDLE_PREFETCH_ROUTES\s*=\s*CLIENT_PRIORITY_PREFETCH_ROUTES\s*;/.test(layout)
    && /const CLIENT_NAV_FEEDBACK_DELAY_MS\s*=\s*70\s*;/.test(layout)
    && /const CLIENT_NAV_FEEDBACK_TIMEOUT_MS\s*=\s*900\s*;/.test(layout)
    && /routes\.map\(\(route,\s*index\)\s*=>\s*\([\s\S]*?index\s*\*\s*70/.test(layout)
    && /requestIdleCallback\(\(\)\s*=>\s*\{[\s\S]*?\},\s*\{\s*timeout:\s*desktop\s*\?\s*350\s*:\s*650\s*\}/.test(layout)
    && /window\.setTimeout\(\(\)\s*=>\s*\{[\s\S]*?\},\s*desktop\s*\?\s*90\s*:\s*260\s*\)/.test(layout)
    && /setTimeout\(\(\)\s*=>\s*\{\s*setNavigating\(true\);[\s\S]*?\},\s*CLIENT_NAV_FEEDBACK_DELAY_MS\s*\)/.test(layout)
    && /setTimeout\(\(\)\s*=>\s*\{\s*setNavigating\(false\);[\s\S]*?\},\s*CLIENT_NAV_FEEDBACK_TIMEOUT_MS\s*\)/.test(layout),
);

record(
  "Client idle prefetch covers every main client tab",
  [
    "/client",
    "/client/rechercher",
    "/client/reservations",
    "/client/cours",
    "/client/paiements",
    "/client/notifications",
    "/client/avis",
    "/client/service-client",
    "/client/profil",
    "/client/parametres",
  ].every((route) => layout.includes(`"${route}"`))
    && /slowConnection\)\s*return/.test(layout)
    && /connection\?\.saveData/.test(layout),
);

record(
  "Client mobile drawer does not repeat the primary search action",
  /const showPrimaryAction\s*=\s*!compactAccount\s*;/.test(layout)
    && /\{showPrimaryAction\s*&&\s*\(/.test(layout)
    && /compactAccount\s*\/>/.test(layout),
);

record(
  "Client sidebar keeps one clear profile/settings pair",
  countOccurrences(layout, 'href: "/client/profil"') === 1
    && countOccurrences(layout, 'href: "/client/parametres"') === 1,
);

record(
  "Client tab and filter labels are protected against vertical wrapping",
  /Final client readability guard/.test(css)
    && /\[data-client-tab-item\][\s\S]*?white-space:\s*nowrap\s*!important;[\s\S]*?word-break:\s*normal\s*!important;/.test(css)
    && /\[data-client-reservation-filter-rail\]\s*button/.test(css),
);

record(
  "Client app rails are swipeable on mobile without visible scrollbar noise",
  /Client app polish guard/.test(css)
    && /\[data-client-dashboard-action-rail\][\s\S]*?scroll-snap-type:\s*x\s+mandatory\s*!important;[\s\S]*?scrollbar-width:\s*none\s*!important;/.test(css)
    && /\[data-client-payment-method-rail\][\s\S]*?::-webkit-scrollbar[\s\S]*?display:\s*none\s*!important;/.test(css),
);

record(
  "Client action buttons stay solid navy, never gradient-led",
  !/bg-gradient|from-|to-|via-/.test(layout)
    && /\.client-shell\s*:where\(button,\s*a\)\[class\*="bg-\[#111B4D\]"\][\s\S]*?background-color:\s*#111B4D\s*!important;[\s\S]*?color:\s*#FFFFFF\s*!important;/.test(css),
);

record(
  "Public mobile menu avoids duplicated professor search entries",
  !/useSession/.test(publicLayout)
    && !/SessionProvider/.test(providers)
    && /navLinks\.filter\(\(link\)\s*=>\s*link\.href\s*!==\s*"\/professeurs"\)\.map/.test(publicLayout)
    && /!\s*hideMobileNav\s*&&\s*!\s*mobileOpen\s*&&\s*<PublicMobileNav/.test(publicLayout),
);

record(
  "Public teacher empty state keeps one primary action",
  /Professeurs en cours de publication/.test(publicTeachersPage)
    && /Transmettre mon besoin/.test(publicTeachersPage)
    && !/Retour accueil/.test(publicTeachersPage),
);

record(
  "Client can resume and verify paid reschedule supplements from the booking detail",
  /paydunyaCheckoutUrl:\s*request\.paydunyaCheckoutUrl/.test(clientReservationDetail)
    && /<ClientRescheduleRequestPanel\s+bookingId=\{booking\.id\}\s+requests=\{rescheduleRequests\}\s*\/>/.test(clientReservationDetail)
    && /action:\s*"reschedule_fee_checkout"/.test(clientReschedulePanel)
    && /action:\s*"reschedule_fee_verify"/.test(clientReschedulePanel)
    && /case\s+"reschedule_fee_checkout"/.test(bookingApi)
    && /createPayDunyaRescheduleFeeInvoice/.test(bookingApi),
);

record(
  "Client route loading is an app-like responsive skeleton",
  /data-client-loading/.test(clientLoading)
    && /role="status"/.test(clientLoading)
    && /aria-live="polite"/.test(clientLoading)
    && /lg:grid-cols-\[1\.2fr_0\.8fr\]/.test(clientLoading)
    && /lg:grid-cols-\[0\.9fr_1\.1fr\]/.test(clientLoading)
    && /bg-gradient|from-|to-|via-/.test(clientLoading) === false
    && /rounded-lg border border-\[#E3E8F2\] bg-white/.test(clientLoading)
    && /bg-\[#111B4D\]/.test(clientLoading),
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

function countOccurrences(source, needle) {
  return source.split(needle).length - 1;
}
