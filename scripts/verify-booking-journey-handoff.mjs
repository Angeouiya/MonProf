import fs from "node:fs";

const home = read("src/app/page.tsx");
const publicTeachers = read("src/app/professeurs/page.tsx");
const teacherDetail = read("src/app/professeurs/[id]/page.tsx");
const teacherCard = read("src/components/shared/teacher-card.tsx");
const journeySwitcher = read("src/components/shared/journey-switcher.tsx");
const journeyModel = read("src/lib/teacher-journeys.ts");
const bookingPage = read("src/app/client/reserver/page.tsx");
const bookingForm = read("src/app/client/reserver/reserver-form.tsx");
const login = read("src/app/connexion/page.tsx");
const registrationPage = read("src/app/inscription/page.tsx");
const registrationForm = read("src/components/auth/inscription-form.tsx");
const publicLayout = read("src/components/layouts/public-layout.tsx");
const safeReturnPath = read("src/lib/safe-return-path.ts");

const checks = [
  [
    "Homepage starts with three explicit mini-app choices",
    home.includes('ivoirien: "/professeurs?journey=ivoirien"')
      && home.includes('francais: "/professeurs?journey=francais"')
      && home.includes('professionnel: "/professeurs?journey=professionnel"')
      && home.includes('id="parcours"')
      && home.includes('data-home-journey-tabs')
      && home.includes('<JourneySwitcher')
      && journeySwitcher.includes('data-journey-tab={journey}')
      && journeySwitcher.includes('data-mini-app-tablist')
      && journeySwitcher.includes('data-mini-app-system-switcher')
      && journeySwitcher.includes('data-mini-app-active-pill')
      && journeySwitcher.includes('role="tablist"')
      && journeySwitcher.includes('role="tab"')
      && journeySwitcher.includes('aria-selected={active}')
      && journeySwitcher.includes('data-journey-tab-meta')
      && home.includes('showMeta')
      && journeyModel.includes('priceLabel: "Dès 15 000 F"')
      && journeyModel.includes('priceLabel: "Dès 37 500 F"')
      && journeySwitcher.includes('const tabMeta = journey === "professionnel" ? "40 000 F" : config.priceLabel;')
      && !home.includes('Réserver une séance'),
  ],
  [
    "Homepage exposes one premium three-system switcher before secondary content",
    home.includes('pb-8 pt-5 text-center')
      && home.includes('Choisissez un parcours. On calcule le reste.')
      && home.includes('Prix clair · Paiement sécurisé')
      && home.includes('max-w-5xl scroll-mt-20 text-left')
      && home.includes('showLabel')
      && home.includes('size="hero"')
      && journeySwitcher.includes('journey-switcher__indicator')
      && journeySwitcher.includes('data-journey-count={journeys.length}')
      && !home.includes('grid-cols-[auto_minmax(0,1fr)_auto]')
      && !home.includes('Votre parcours')
      && home.includes('hidden border-y border-[#E3E8F2] bg-white sm:block')
      && home.includes('hidden bg-white sm:block')
      && home.includes('hidden bg-[#111B4D] text-white sm:block'),
  ],
  [
    "Public navigation resolves client, admin and teacher sessions without blocking first render",
    publicLayout.includes('queryKey: ["public-session-role"]')
      && publicLayout.includes('enabled: !hideFooter')
      && publicLayout.includes('staleTime: 60_000')
      && publicLayout.includes('CLIENT: { href: "/client"')
      && publicLayout.includes('ADMIN: { href: "/admin"')
      && publicLayout.includes('TEACHER: { href: "/professeur"')
      && publicLayout.includes('fetch("/api/auth/me", { cache: "no-store" })'),
  ],
  [
    "Public teacher search preserves the selected journey through search, filters, pagination and cards",
    publicTeachers.includes('const journey = parseBookingJourney')
      && publicTeachers.includes('params.set("journey", journey)')
      && publicTeachers.includes('name="journey" value={journey}')
      && publicTeachers.includes('&journey=${journey}')
      && publicTeachers.includes('profileHref={journey ?'),
  ],
  [
    "Teacher detail keeps the journey in back and booking destinations",
    teacherDetail.includes('const activeJourney = journey || eligibleJourneys[0] || "ivoirien"')
      && teacherDetail.includes('const teachersHref = `/professeurs?journey=${activeJourney}`')
      && teacherDetail.includes('const bookingDestination = `/client/reserver?teacherId=${teacher.id}&journey=${activeJourney}`')
      && teacherDetail.includes('<PublicLayout backFallbackHref={teachersHref}>')
      && teacherDetail.includes('href={reserveHref}')
      && teacherDetail.includes('data-public-teacher-journey-tabs'),
  ],
  [
    "Public teacher cards preserve the exact booking destination across authentication",
    teacherCard.includes('`/connexion?from=${encodeURIComponent(directBookingHref)}`')
      && publicTeachers.includes('`/connexion?from=${encodeURIComponent(`/client/reserver?teacherId=${t.id}')
      && login.includes('router.replace(from ?? "/client")'),
  ],
  [
    "Booking page redirects a teacherless entry and passes a validated initial journey",
    bookingPage.includes('if (!teacherId) redirect("/client/rechercher")')
      && bookingPage.includes('initialJourney={initialJourney}')
      && bookingPage.includes('parseTeacherJourney(requestedJourney)')
      && bookingPage.includes('!eligibleJourneys.includes(initialJourney)')
      && bookingPage.includes('filterSubjectsForJourney(teacher.subjects')
      && bookingPage.includes('filterLevelsForJourney(teacher.levels'),
  ],
  [
    "Booking form seeds the chosen journey and never displays a fabricated price before selection",
    bookingForm.includes('initialJourney?: BookingJourney')
      && bookingForm.includes('schoolSystem: initialJourney && initialJourney !== "professionnel" ? initialJourney : ""')
      && bookingForm.includes('const hasResolvedPricing = bookingJourney !== ""')
      && bookingForm.includes('data-booking-journey-switcher')
      && bookingForm.includes('role="tablist"')
      && bookingForm.includes('role="tab"')
      && count(bookingForm, 'hasResolvedPricing ? formatFCFA(totalPrice) : "À calculer"') >= 2,
  ],
  [
    "Login and registration return paths are internal-only and survive account creation",
    safeReturnPath.includes('!value.startsWith("/") || value.startsWith("//")')
      && safeReturnPath.includes('url.origin !== LOCAL_ORIGIN')
      && login.includes('getSafeInternalReturnPath(searchParams.get("from"))')
      && registrationPage.includes('returnTo={getSafeInternalReturnPath(from)}')
      && registrationForm.includes('router.push(returnTo ?? "/client")'),
  ],
];

for (const [label, ok] of checks) {
  console.log(`${ok ? "OK" : "FAIL"} ${label}`);
}

const failed = checks.filter(([, ok]) => !ok);
if (failed.length > 0) {
  console.error(`FAIL Booking journey handoff verification: ${failed.length} issue(s).`);
  process.exitCode = 1;
} else {
  console.log("OK Booking journey handoff verification passed.");
}

function read(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

function count(source, fragment) {
  return source.split(fragment).length - 1;
}
