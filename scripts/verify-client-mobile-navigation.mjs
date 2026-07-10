import fs from "node:fs";
import path from "node:path";

const checks = [];
const clientPrimitivesPath = "src/components/shared/client-page-primitives.tsx";
const clientSourceRoots = ["src/app/client", "src/components/layouts/client-layout.tsx", clientPrimitivesPath];

const layoutPath = "src/components/layouts/client-layout.tsx";
const publicLayoutPath = "src/components/layouts/public-layout.tsx";
const publicTeachersPath = "src/app/professeurs/page.tsx";
const clientReservationDetailPath = "src/app/client/reservations/[id]/page.tsx";
const clientBookingActionsPath = "src/app/client/reservations/[id]/actions.tsx";
const clientReschedulePanelPath = "src/app/client/reservations/[id]/reschedule-request-panel.tsx";
const clientLoadingPath = "src/app/client/loading.tsx";
const clientErrorPath = "src/app/client/error.tsx";
const clientNotFoundPath = "src/app/client/not-found.tsx";
const backButtonPath = "src/components/shared/back-button.tsx";
const teacherCardPath = "src/components/shared/teacher-card.tsx";
const pricingBreakdownPath = "src/components/shared/booking-pricing-breakdown.tsx";
const clientPricingCopyPaths = [
  "src/app/client/page.tsx",
  "src/app/client/reserver/reserver-form.tsx",
  "src/app/client/reservations/page.tsx",
  "src/app/client/reservations/[id]/page.tsx",
  "src/app/client/reservations/[id]/actions.tsx",
  "src/app/client/cours/page.tsx",
  "src/components/shared/booking-pricing-breakdown.tsx",
  "src/components/shared/status-badge.tsx",
  teacherCardPath,
];
const reschedulePolicyPath = "src/lib/reschedule-policy.ts";
const bookingApiPath = "src/app/api/bookings/[id]/route.ts";
const providersPath = "src/components/providers.tsx";
const cssPath = "src/app/globals.css";
const clientRootTabPaths = [
  "src/app/client/page.tsx",
  "src/app/client/rechercher/page.tsx",
  "src/app/client/reservations/page.tsx",
  "src/app/client/cours/page.tsx",
  "src/app/client/paiements/page.tsx",
  "src/app/client/notifications/page.tsx",
  "src/app/client/avis/page.tsx",
  "src/app/client/service-client/page.tsx",
  "src/app/client/profil/profile-client.tsx",
  "src/app/client/parametres/page.tsx",
];

const clientPrimitives = read(clientPrimitivesPath);
const layout = read(layoutPath);
const publicLayout = read(publicLayoutPath);
const publicTeachersPage = read(publicTeachersPath);
const clientReservationDetail = read(clientReservationDetailPath);
const clientBookingActions = read(clientBookingActionsPath);
const clientReschedulePanel = read(clientReschedulePanelPath);
const clientLoading = read(clientLoadingPath);
const clientError = read(clientErrorPath);
const clientNotFound = read(clientNotFoundPath);
const backButton = read(backButtonPath);
const teacherCard = read(teacherCardPath);
const pricingBreakdown = read(pricingBreakdownPath);
const clientReservationsPage = read("src/app/client/reservations/page.tsx");
const clientReviewsPage = read("src/app/client/avis/page.tsx");
const clientProfilePage = read("src/app/client/profil/profile-client.tsx");
const clientPricingCopySources = clientPricingCopyPaths.map(read).join("\n");
const reschedulePolicy = read(reschedulePolicyPath);
const bookingApi = read(bookingApiPath);
const providers = read(providersPath);
const css = read(cssPath);
const clientUiSources = readClientUiSources(clientSourceRoots);
const clientRootTabSources = clientRootTabPaths.map(read).join("\n");

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
  "Client topbar stays fixed and every panel is offset below it",
  /data-client-topbar[\s\S]*?className="[^"]*fixed inset-x-0 top-0/.test(layout)
    && /app-topbar-spacer/.test(layout)
    && /id="client-main-content"/.test(layout)
    && /data-client-main/.test(layout)
    && /app-sidebar-below-topbar fixed left-0/.test(layout)
    && /app-topbar-offset fixed inset-x-0/.test(layout)
    && /style=\{\{\s*top:\s*"var\(--app-topbar-height,\s*4rem\)"\s*\}\}/.test(layout)
    && /\.app-topbar\s*\{[\s\S]*?position:\s*fixed\s*!important;[\s\S]*?top:\s*0\s*!important;[\s\S]*?\}/.test(css)
    && /\.app-topbar-spacer\s*\{[\s\S]*?height:\s*var\(--app-topbar-height\);[\s\S]*?\}/.test(css)
    && /\.app-sidebar-below-topbar\s*\{[\s\S]*?top:\s*var\(--app-topbar-height\)\s*!important;[\s\S]*?height:\s*calc\(100dvh - var\(--app-topbar-height\)\)\s*!important;[\s\S]*?\}/.test(css),
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
    && /animation:\s*client-route-progress-slide\s+95ms/.test(css)
    && /animation:\s*client-route-progress-settle\s+110ms[\s\S]*?both\s*!important;/.test(css)
    && css.lastIndexOf("client-route-progress-settle 110ms") > css.lastIndexOf("client-route-progress-slide"),
);

record(
  "Client navigation prefetch follows user intent without startup fan-out",
  /const CLIENT_NAV_PREFETCH\s*=\s*false\s*;/.test(layout)
    && !/CLIENT_PRIMARY_PREFETCH_ROUTES|CLIENT_SECONDARY_PREFETCH_ROUTES|CLIENT_PRIORITY_PREFETCH_ROUTES/.test(layout)
    && /function maybePrefetchClientNavigation/.test(layout)
    && /onMouseOverCapture=\{handleClientPrefetchCapture\}/.test(layout)
    && /onFocusCapture=\{handleClientFocusPrefetch\}/.test(layout)
    && /onPointerDownCapture=\{handleClientNavigationIntent\}/.test(layout)
    && /const CLIENT_NAV_FEEDBACK_DELAY_MS\s*=\s*18\s*;/.test(layout)
    && /const CLIENT_NAV_FEEDBACK_TIMEOUT_MS\s*=\s*340\s*;/.test(layout)
    && /setTimeout\(\(\)\s*=>\s*\{\s*setNavigating\(true\);[\s\S]*?\},\s*CLIENT_NAV_FEEDBACK_DELAY_MS\s*\)/.test(layout)
    && /setTimeout\(\(\)\s*=>\s*\{\s*setNavigating\(false\);[\s\S]*?\},\s*CLIENT_NAV_FEEDBACK_TIMEOUT_MS\s*\)/.test(layout),
);

record(
  "Client shell synchronizes its notification count without blocking initial navigation",
  /competence:notification-count/.test(layout)
    && /WebPushRealtime/.test(layout)
    && !/fetch\("\/api\/client\/notifications"/.test(layout),
);

record(
  "Client route constants still include every main client tab",
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
  ].every((route) => layout.includes(`"${route}"`)),
);

record(
  "Client quick search uses precise filter-aware shortcuts",
  /Maths Cocody[\s\S]*?\/client\/rechercher\?q=math&commune=Cocody/.test(layout)
    && /Anglais ligne[\s\S]*?\/client\/rechercher\?q=anglais&format=ONLINE/.test(layout)
    && countMatches(layout, /enterKeyHint="search"/g) >= 2
    && countMatches(layout, /autoComplete="off"/g) >= 2
    && countMatches(layout, /spellCheck=\{false\}/g) >= 2
    && /data-client-mobile-search-panel/.test(layout),
);

record(
  "Client navigation exposes a stable active state on sidebar and bottom tabs",
  /aria-current=\{active\s*\?\s*"page"\s*:\s*undefined\}/.test(layout)
    && countMatches(layout, /aria-current=\{active\s*\?\s*"page"\s*:\s*undefined\}/g) >= 2
    && /data-active=\{active\s*\?\s*"true"\s*:\s*"false"\}/.test(layout)
    && countMatches(layout, /data-active=\{active\s*\?\s*"true"\s*:\s*"false"\}/g) >= 2
    && /data-client-sidebar-link/.test(layout)
    && /data-client-mobile-nav/.test(layout),
);

record(
  "Client mobile navigation dismisses transient panels before route changes",
  /<Link href="\/client"[\s\S]*?onClick=\{closeMobileSurfaces\}/.test(layout)
    && /href="\/client\/notifications"[\s\S]*?onClick=\{closeMobileSurfaces\}/.test(layout)
    && /onClick=\{closeMobileSurfaces\}[\s\S]*?className="inline-flex min-h-9/.test(layout)
    && /<MobileBottomNav[\s\S]*?onNavigate=\{closeMobileSurfaces\}/.test(layout)
    && /function MobileBottomNav\([\s\S]*?onNavigate,[\s\S]*?onClick=\{onNavigate\}/.test(layout),
);

record(
  "Client shell warns cleanly when the mobile network drops",
  /const\s+\[isOffline,\s*setIsOffline\]\s*=\s*useState\(false\)/.test(layout)
    && /window\.addEventListener\("online",\s*syncNetworkState\)/.test(layout)
    && /window\.addEventListener\("offline",\s*syncNetworkState\)/.test(layout)
    && /data-client-offline-banner/.test(layout)
    && /role="status"/.test(layout)
    && /aria-live="polite"/.test(layout)
    && /Connexion interrompue/.test(layout)
    && /bg-\[#111B4D\]/.test(layout)
    && /WifiOff/.test(layout),
);

record(
  "Client shell exposes a keyboard skip link to the main content",
  /data-client-skip-link/.test(layout)
    && /href="#client-main-content"/.test(layout)
    && /id="client-main-content"/.test(layout)
    && /tabIndex=\{-1\}/.test(layout)
    && /focus:translate-y-0/.test(layout)
    && /bg-\[#111B4D\]/.test(layout),
);

record(
  "Client back affordance never sends users back to PayDunya or another platform space",
  /canSafelyGoBack\(pathname\)/.test(backButton)
    && /document\.referrer/.test(backButton)
    && /referrerUrl\.origin\s*!==\s*window\.location\.origin/.test(backButton)
    && /getNavigationSpace\(pathname\)/.test(backButton)
    && /currentSpace\s*===\s*referrerSpace/.test(backButton)
    && /pathname\s*===\s*"\/client"\s*\|\|\s*pathname\.startsWith\("\/client\/"\)/.test(backButton)
    && /router\.push\(fallback\)/.test(backButton),
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
  "Client root tabs avoid redundant back buttons while deep flows keep them",
  clientRootTabPaths.every((filePath) => /showBack=\{false\}/.test(read(filePath)))
    && /<ClientPageHeader[\s\S]*?title=\{`Réservation/.test(clientReservationDetail)
    && !/<ClientPageHeader[\s\S]*?title=\{`Réservation[\s\S]*?showBack=\{false\}/.test(clientReservationDetail)
    && /<BackButton\s+fallbackHref="\/client\/rechercher"/.test(read("src/app/client/reserver/reserver-form.tsx"))
    && countMatches(clientRootTabSources, /showBack=\{false\}/g) >= clientRootTabPaths.length,
);

record(
  "Client tab and filter labels are protected against vertical wrapping",
  /Final client readability guard/.test(css)
    && /\[data-client-tab-item\][\s\S]*?white-space:\s*nowrap\s*!important;[\s\S]*?word-break:\s*normal\s*!important;/.test(css)
    && /\[data-client-reservation-filter-rail\]\s*button/.test(css),
);

record(
  "Client short tab rails stay balanced on small phones",
  /data-item-count=\{items\.length\}/.test(clientPrimitives)
    && /\[data-client-tab-bar\]\[data-item-count="3"\][\s\S]*?grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)\s*!important/.test(css)
    && /\[data-client-tab-bar\]\s*>\s*:last-child:nth-child\(odd\)[\s\S]*?grid-column:\s*1\s*\/\s*-1/.test(css)
    && /@media\s*\(max-width:\s*359px\)[\s\S]*?\[data-client-tab-bar\][\s\S]*?grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)\s*!important/.test(css),
);

record(
  "Client deep-page back action remains compact on mobile",
  /data-client-back-button/.test(backButton)
    && /\[data-client-page-header\]\s*\[data-client-back-button\][\s\S]*?width:\s*fit-content\s*!important/.test(css),
);

record(
  "Client reservation summary keeps its three financial facts readable",
  /data-client-reservation-mobile-priority[\s\S]*?mt-3 grid grid-cols-3 gap-2/.test(clientReservationsPage),
);

record(
  "Client reviews avoid repeating the same empty pending state",
  /\{primaryReviewBooking\s*&&\s*\([\s\S]*?id="avis-a-evaluer"/.test(clientReviewsPage)
    && !/title="Aucun avis en attente"/.test(clientReviewsPage),
);

record(
  "Client profile header contains commands instead of static button-like labels",
  !/Compte sécurisé/.test(clientProfilePage)
    && /Trouver un professeur/.test(clientProfilePage),
);

record(
  "Client mobile pages keep app-like compact copy",
  /data-client-page-header-description/.test(clientPrimitives)
    && /data-client-root-tab-header/.test(clientPrimitives)
    && /data-client-page-header-eyebrow/.test(clientPrimitives)
    && /data-client-section-description/.test(clientPrimitives)
    && /data-client-focus-description/.test(clientPrimitives)
    && /\[data-client-root-tab-header="true"\]\)\s*\{[\s\S]*?padding-bottom:\s*0\.45rem\s*!important;[\s\S]*?\}/.test(css)
    && /\[data-client-root-tab-header="true"\]\s+\[data-client-page-header-eyebrow\]\)\s*\{[\s\S]*?display:\s*none\s*!important;[\s\S]*?\}/.test(css)
    && /\[data-client-page-header-description\]\s*\{[\s\S]*?display:\s*none\s*!important;[\s\S]*?\}/.test(css)
    && /\[data-client-section-description\],[\s\S]*?\[data-client-focus-description\]\s*\{[\s\S]*?-webkit-line-clamp:\s*1;[\s\S]*?\}/.test(css),
);

record(
  "Client dashboard exposes one primary booking action per mobile context",
  /className="min-h-11 rounded-lg max-md:hidden"/.test(read("src/app/client/page.tsx"))
    && /\{\(pendingValidation \|\| nextCourse\) && \(/.test(read("src/app/client/page.tsx"))
    && /Nouveau cours/.test(read("src/app/client/page.tsx"))
    && !/<Link href="\/client\/rechercher">Réserver<\/Link>/.test(read("src/app/client/page.tsx")),
);

record(
  "Client booking keeps one progress control and a viewport-fixed mobile action",
  !/data-client-booking-mobile-progress/.test(read("src/app/client/reserver/reserver-form.tsx"))
    && /data-client-booking-desktop-progress/.test(read("src/app/client/reserver/reserver-form.tsx"))
    && /\[data-client-booking-desktop-progress\][\s\S]*?display:\s*none\s*!important/.test(css)
    && !/\.client-content\s*\{[^}]*contain\s*:/.test(css)
    && !/\[data-client-content\][^}]*container-type/.test(css)
    && /client-booking-mobile-action fixed/.test(read("src/app/client/reserver/reserver-form.tsx")),
);

record(
  "Client app rails are swipeable on mobile without visible scrollbar noise",
  /Client app polish guard/.test(css)
    && /\[data-client-dashboard-action-rail\][\s\S]*?scroll-snap-type:\s*x\s+mandatory\s*!important;[\s\S]*?scrollbar-width:\s*none\s*!important;/.test(css)
    && /\[data-client-payment-method-rail\][\s\S]*?::-webkit-scrollbar[\s\S]*?display:\s*none\s*!important;/.test(css),
);

record(
  "Client long lists use browser rendering containment for faster mobile scrolling",
  /@supports\s*\(content-visibility:\s*auto\)/.test(css)
    && /\[data-client-record-card\][\s\S]*?\[data-client-empty-state\][\s\S]*?content-visibility:\s*auto;[\s\S]*?contain-intrinsic-size:\s*auto\s+12rem;/.test(css)
    && /\[data-client-payment-history\]\s+article/.test(css)
    && /\[data-client-review-history\]\s+article/.test(css),
);

record(
  "Client mobile controls keep comfortable app touch targets",
  /@media\s*\(max-width:\s*719px\)\s*\{[\s\S]*?\.client-shell\s*:where\([\s\S]*?button,[\s\S]*?input,[\s\S]*?select,[\s\S]*?textarea,[\s\S]*?\[role="button"\],[\s\S]*?a\[data-client-tab-item\],[\s\S]*?\[data-client-mobile-nav\]\s+a,[\s\S]*?a\[class\*="rounded"\][\s\S]*?\)\s*\{[\s\S]*?min-height:\s*44px;[\s\S]*?\}/.test(css),
);

record(
  "Client motion budget stays fast and app-like",
  /CLIENT_NAV_FEEDBACK_TIMEOUT_MS\s*=\s*340/.test(layout)
    && /transition-duration:\s*75ms\s*!important/.test(css)
    && /\[data-client-loading\]\s+\.animate-pulse\s*\{[\s\S]*?animation-duration:\s*680ms\s*!important;[\s\S]*?\}/.test(css)
    && !/CLIENT_NAV_FEEDBACK_TIMEOUT_MS\s*=\s*(?:[5-9]\d\d|[1-9]\d{3,})/.test(layout)
    && !/transition-duration:\s*(?:2\d\d|[3-9]\d\d|\d{4,})ms\s*!important/.test(css),
);

record(
  "Client focus state is visible and consistent across app controls",
  /\.client-shell\s*:where\([\s\S]*?a,[\s\S]*?button,[\s\S]*?input,[\s\S]*?select,[\s\S]*?textarea,[\s\S]*?\[role="button"\],[\s\S]*?\[data-slot="button"\],[\s\S]*?\[data-slot="select-trigger"\][\s\S]*?\):focus-visible\s*\{[\s\S]*?outline:\s*2px\s+solid\s+#111B4D\s*!important;[\s\S]*?outline-offset:\s*3px\s*!important;[\s\S]*?box-shadow:\s*none\s*!important;[\s\S]*?\}/.test(css),
);

record(
  "Client reduced-motion mode disables decorative transitions and route progress",
  /@media\s*\(prefers-reduced-motion:\s*reduce\)/.test(css)
    && /\.client-shell,[\s\S]*?\.client-shell\s+\*\s*\{[\s\S]*?scroll-behavior:\s*auto\s*!important;[\s\S]*?transition-duration:\s*0\.01ms\s*!important;[\s\S]*?animation-duration:\s*0\.01ms\s*!important;[\s\S]*?animation-iteration-count:\s*1\s*!important;[\s\S]*?\}/.test(css)
    && /\.client-shell\s+\[data-client-route-progress\]\s*\{[\s\S]*?display:\s*none\s*!important;[\s\S]*?\}/.test(css),
);

record(
  "Client action buttons stay solid navy, never gradient-led",
  !/bg-gradient|from-|to-|via-/.test(layout)
    && /\.client-shell\s*:where\(button,\s*a\)\[class\*="bg-\[#111B4D\]"\][\s\S]*?background-color:\s*#111B4D\s*!important;[\s\S]*?color:\s*#FFFFFF\s*!important;/.test(css),
);

record(
  "Client platform source avoids gradient-led UI",
  !/\b(?:bg-gradient(?:-[a-z]+)?|from-(?:\[[^\]]+\]|[a-z]+-\d+)|via-(?:\[[^\]]+\]|[a-z]+-\d+)|to-(?:\[[^\]]+\]|[a-z]+-\d+))\b/.test(clientUiSources),
);

record(
  "Client platform avoids oversized rounded marketing cards",
  !/rounded-(?:2xl|3xl|\[2rem\]|\[2\.5rem\])/.test(clientUiSources),
);

record(
  "Client command centers are suppressed to avoid repeated UI blocks",
  /\[data-client-course-command-center\][\s\S]*?\[data-client-support-command-center\][\s\S]*?\)\s*\{[\s\S]*?display:\s*none\s*!important;[\s\S]*?\}/.test(css),
);

const commandCenterRenderCount = countMatches(clientUiSources, /<[A-Za-z]+CommandCenter\b/g);
const gatedCommandCenterRenderCount = countMatches(
  clientUiSources,
  /CLIENT_COMMAND_CENTERS_ENABLED\s*&&\s*\([\s\S]{0,300}?<[A-Za-z]+CommandCenter\b/g,
);

record(
  "Client command centers are disabled before render",
  /export const CLIENT_COMMAND_CENTERS_ENABLED\s*=\s*false\s*;/.test(clientPrimitives)
    && commandCenterRenderCount === 9
    && gatedCommandCenterRenderCount === commandCenterRenderCount,
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
  "Client teacher cards avoid fake zero-rating trust signals",
  /const publicRating\s*=\s*teacher\.ratingCount\s*>\s*0\s*&&\s*teacher\.rating\s*>\s*0/.test(teacherCard)
    && /const trustLabel\s*=\s*publicRating/.test(teacherCard)
    && /Certifié/.test(teacherCard)
    && /Profil suivi/.test(teacherCard)
    && /trustLabel/.test(teacherCard)
    && !/displayRating\.toFixed\(1\)\/5/.test(teacherCard),
);

record(
  "Client pricing copy avoids manual quote language",
  !/Prix à finaliser|Prix en préparation|Prix en validation|Prix à confirmer|Tarif à finaliser|Forfait à finaliser|estimation manuelle|\bdevis\b|\bDevis\b/.test(clientPricingCopySources)
    && /Montant à recalculer/.test(clientPricingCopySources)
    && /Calcul à reprendre/.test(clientPricingCopySources)
    && /Calculé à la réservation/.test(clientPricingCopySources),
);

record(
  "Client pricing adapts to its panel width instead of the viewport",
  /containerType:\s*"inline-size"/.test(pricingBreakdown)
    && /data-client-pricing-header/.test(pricingBreakdown)
    && /data-client-pricing-line/.test(pricingBreakdown)
    && /@container\s*\(min-width:\s*520px\)/.test(css)
    && /@container\s*\(min-width:\s*620px\)/.test(css)
    && !/min-\[620px\]:grid-cols-\[minmax\(0,1fr\)_minmax\(13rem,auto\)\]/.test(pricingBreakdown),
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
  "Client reschedule fees use the approved visible policy grid",
  /RESCHEDULE_POLICY_WINDOWS/.test(reschedulePolicy)
    && /title:\s*"Plus de 24h"[\s\S]*?feeRate:\s*0/.test(reschedulePolicy)
    && /title:\s*"Entre 24h et 6h"[\s\S]*?feeRate:\s*25[\s\S]*?teacherRate:\s*60/.test(reschedulePolicy)
    && /title:\s*"Moins de 6h"[\s\S]*?feeRate:\s*50[\s\S]*?teacherRate:\s*70/.test(reschedulePolicy)
    && /title:\s*"Cours commencé"[\s\S]*?feeRate:\s*100[\s\S]*?teacherRate:\s*70/.test(reschedulePolicy)
    && /data-client-reschedule-fee-grid/.test(clientBookingActions)
    && /Calcul automatique sur une séance de 2h/.test(clientBookingActions)
    && /Le professeur n'est notifié qu'après confirmation serveur/.test(clientBookingActions)
    && !/Part plateforme/.test(clientBookingActions),
);

record(
  "Client route loading is an app-like responsive skeleton",
  /data-client-loading/.test(clientLoading)
    && /role="status"/.test(clientLoading)
    && /aria-live="polite"/.test(clientLoading)
    && /motion-safe:animate-pulse/.test(clientLoading)
    && /data-client-loading-primary-panel/.test(clientLoading)
    && /data-client-loading-secondary-panel/.test(clientLoading)
    && /lg:grid-cols-\[1\.2fr_0\.8fr\]/.test(clientLoading)
    && /lg:grid-cols-\[0\.9fr_1\.1fr\]/.test(clientLoading)
    && /bg-gradient|from-|to-|via-/.test(clientLoading) === false
    && /rounded-lg border border-\[#E3E8F2\] bg-white/.test(clientLoading)
    && /bg-\[#111B4D\]/.test(clientLoading),
);

record(
  "Client route loading stays compact on very small phones",
  /\[data-client-loading\]\s*\{[\s\S]*?min-height:\s*calc\(100dvh - var\(--app-topbar-height\) - 2rem\);[\s\S]*?\}/.test(css)
    && /\[data-client-loading-secondary-panel\]\s*\{[\s\S]*?display:\s*none\s*!important;[\s\S]*?\}/.test(css),
);

record(
  "Client route errors render a professional recoverable app screen",
  /"use client";/.test(clientError)
    && /data-client-error/.test(clientError)
    && /aria-live="polite"/.test(clientError)
    && /onClick=\{reset\}/.test(clientError)
    && /href="\/client"/.test(clientError)
    && /Référence incident/.test(clientError)
    && /bg-\[#111B4D\]/.test(clientError)
    && !/bg-gradient|from-|to-|via-|rounded-(?:2xl|3xl|\[2rem\])/.test(clientError),
);

record(
  "Client missing routes render a professional recoverable app screen",
  /data-client-not-found/.test(clientNotFound)
    && /href="\/client"/.test(clientNotFound)
    && /href="\/client\/rechercher"/.test(clientNotFound)
    && /Cette page client est introuvable/.test(clientNotFound)
    && /bg-\[#111B4D\]/.test(clientNotFound)
    && !/bg-gradient|from-|to-|via-|rounded-(?:2xl|3xl|\[2rem\])/.test(clientNotFound),
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

function countMatches(source, pattern) {
  return Array.from(source.matchAll(pattern)).length;
}

function readClientUiSources(entries) {
  return entries.flatMap((entry) => {
    if (!fs.existsSync(entry)) return [];
    const stat = fs.statSync(entry);
    if (stat.isFile()) return [read(entry)];
    return walk(entry)
      .filter((filePath) => /\.(tsx|ts|css)$/.test(filePath))
      .map(read);
  }).join("\n");
}

function walk(dirPath) {
  return fs.readdirSync(dirPath, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) return walk(fullPath);
    return [fullPath];
  });
}
