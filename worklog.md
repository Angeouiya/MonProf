# Worklog — MonProf CI / ProfLink CI

Plateforme de réservation de cours à domicile et en ligne en Côte d'Ivoire.
Cahier des charges: `upload/Cahier de projet - Plateforme de cours à domicile et en ligne.pdf`

## Résumé du projet
- Plateforme (pas marketplace): admin crée/gère les professeurs vérifiés.
- Client: recherche, réserve, paie, confirme.
- Admin: gère professeurs, réservations, paiements bloqués/libérés, litiges.
- Paiement sécurisé: fonds bloqués jusqu'à confirmation client, puis admin libère au prof (après commission 20%).
- Style: OpenAI-like, minimaliste, premium, mobile-first.
- Palette: bg #F7F7F8, carte #FFFFFF, texte #111827/#6B7280, vert #10A37F/#0F5132, orange #F59E0B, bordures #E5E7EB.
- Police: Inter / Geist.
- Devise: FCFA.

## Convention de code (à respecter par tous les agents)
- Next.js 16 App Router + TypeScript + Tailwind 4 + shadcn/ui (New York).
- **API routes** obligatoires (pas de server actions). Tous les writes passent par `fetch('/api/...')`.
- **Auth**: NextAuth.js v4, credentials provider. Session côté client. Routes protégées via middleware ou check `getServerSession` dans les API.
- **DB**: Prisma + SQLite via `import { db } from '@/lib/db'`.
- **Design tokens** déjà définis dans `src/app/globals.css` (`--primary` = vert MonProf `#10A37F`, `--accent` = orange `#F59E0B`, etc.). Utiliser les classes Tailwind `bg-primary`, `text-primary`, `bg-accent`, etc.
- **Layouts** déjà créés dans `src/components/layouts/` : `PublicLayout`, `AdminLayout`, `ClientLayout`. Les utiliser.
- **Composants partagés** dans `src/components/shared/` : `TeacherCard`, `StatusBadge`, `StatCard`, `EmptyState`, `PageHeader`, `Money`.
- **Rôles utilisateur**: `CLIENT`, `ADMIN` (champ `role` sur `User`).
- **Pas d'espace professeur**: les professeurs sont des ressources gérées par l'admin.
- **Pas de test code**.
- **Toutes les montants en FCFA** (entier).
- **API routes** dans `src/app/api/.../route.ts`. Toujours retourner JSON. Gérer erreurs avec `NextResponse.json({error}, {status})`.
- **Pages server components** par défaut, client components avec `'use client'` quand nécessaire (formulaires, interactivité).
- **Sidebar admin & client** via composant `sidebar.tsx` de shadcn (déjà dans `src/components/ui/sidebar.tsx`).

## Référence rapide des statuts
Réservation: `PENDING_PAYMENT`, `PAID`, `PENDING_ADMIN_VALIDATION`, `CONFIRMED`, `ASSIGNED`, `IN_PROGRESS`, `COURSE_DONE`, `PENDING_CLIENT_VALIDATION`, `VALIDATED_BY_CLIENT`, `PAYMENT_TO_RELEASE`, `TEACHER_PAID`, `DISPUTED`, `CANCELLED`, `REFUNDED`.

Paiement: `FAILED`, `RECEIVED`, `BLOCKED`, `VALIDATED`, `TO_PAY_TEACHER`, `TEACHER_PAID`, `DISPUTED`, `REFUNDED`.

## Comptes de démo (créés par le seed)
- Admin: `admin@monprof.ci` / `admin123`
- Client: `client@demo.ci` / `client123`

---
Task ID: 1
Agent: main
Task: Setup base (Prisma schema, palette, fonts, NextAuth, seed, layouts)

Work Log:
- Lecture du cahier des charges PDF (25 pages).
- Définition de la convention de code partagée (ci-dessus).
- Écriture du Prisma schema complet.
- Configuration de la palette MonProf CI dans globals.css.
- Mise à jour du root layout (fonts Inter, providers).
- Implémentation de NextAuth (credentials, JWT, session).
- Seed: matières, niveaux, communes, 1 admin, 1 client démo, 8 professeurs vérifiés, 3 réservations d'exemple, notifications.
- Création des layouts PublicLayout, AdminLayout, ClientLayout.
- Création des composants partagés TeacherCard, StatusBadge, StatCard, EmptyState, PageHeader, Money.
- Création des utilitaires lib/auth.ts, lib/format.ts.

Stage Summary:
- Base prête pour les subagents A/B/C.
- DB poussée via `bun run db:push` + seed exécuté.
- Dev server démarré sur port 3000.

---
Task ID: 3-a
Agent: Subagent A — Pages publiques + Auth
Task: Pages publiques (accueil, liste profs, détail, comment ça marche, tarifs, contact) + auth (connexion, inscription)

Work Log:
- src/app/page.tsx — Page d'accueil (Hero + barre de recherche + 3 étapes + profs vedettes + avantages + grille tarifaire + KPIs + CTA).
- src/app/professeurs/page.tsx — Liste SSR avec sidebar filtres (matière/niveau/commune/format/prix/tri/recherche) + pagination + empty state.
- src/app/professeurs/[id]/page.tsx — Détail prof (header + à propos + expérience + matières/niveaux + zones + dispo + tarifs + avis + carte latérale sticky réserver). Aucune info personnelle affichée.
- src/app/comment-ca-marche/page.tsx — 9 étapes parcours client + section parents + garanties + CTA.
- src/app/tarifs/page.tsx — Grille tarifaire 5 niveaux + packs 1/4/8/12 + 8 étapes paiement sécurisé + exemple chiffré + FAQ.
- src/app/contact/page.tsx — Formulaire client component (POST /api/contact) + infos latérales + toast Sonner.
- src/app/connexion/page.tsx — Login client/admin via NextAuth credentials + redirection rôle + comptes démo cliquables.
- src/app/inscription/page.tsx + src/components/auth/inscription-form.tsx — Inscription client (communes SSR, validation, auto-login).
- src/app/api/contact/route.ts — POST ContactMessage (zod validation).
- src/app/api/auth/me/route.ts — GET session {user:{id,email,name,role}}.
- src/components/home/home-search-bar.tsx — Barre de recherche rapide home.

Stage Summary:
- Toutes les pages publiques + auth livrées et testées (HTTP 200 via curl).
- Lint OK sur ce périmètre. (1 erreur de parsing subsiste dans src/app/api/admin/bookings/[id]/route.ts ligne 75 — hors périmètre, à corriger par Subagent C.)
- Conventions respectées : PublicLayout, TeacherCard, Money, EmptyState réutilisés ; API routes pour tous les writes ; mobile-first ; palette MonProf (vert/orange/blanc) sans indigo/blue ; montants en FCFA ; aucune info personnelle prof affichée.
- Comptes démo fonctionnels : admin@monprof.ci/admin123 et client@demo.ci/client123.
- Logs dev server OK, aucune erreur runtime observée.

---
Task ID: 3-b
Agent: Subagent B — Espace client
Task: Espace client complet (dashboard, réservations, cours, paiements, avis, support, profil) + API bookings/reviews/disputes/profile

Work Log:
- src/app/client/layout.tsx — Layout serveur (session + role CLIENT, wrap ClientLayout)
- src/app/client/page.tsx — Tableau de bord (4 StatCards, prochain cours, actions requises, recommandés)
- src/app/client/rechercher/page.tsx — Recherche filtrable (matière/niveau/commune/format/tri) + cartes prof avec lien "Réserver"
- src/app/client/reserver/page.tsx — Server component (fetch teacher + refs)
- src/app/client/reserver/reserver-form.tsx — Formulaire multi-étapes 5 pages (Besoin, Format, Dispo, Récap, Paiement) avec calcul dynamique des prix (SINGLE/PACK_4/PACK_8/PACK_12 -15%/EXAM_PREP), validation par étape, progress bar, méthodes de paiement simulées
- src/app/client/reservations/page.tsx — Liste filtrable par tabs (Toutes/En cours/À confirmer/Terminées/Annulées)
- src/app/client/reservations/[id]/page.tsx — Détail (header statuts, carte prof, détails cours, timeline, transactions, montants)
- src/app/client/reservations/[id]/actions.tsx — Composant client actions contextuelles (confirm/report/reschedule/cancel/open_dispute/avis)
- src/app/client/cours/page.tsx — Cours par onglets (À venir / En cours / Terminés) avec lien online
- src/app/client/paiements/page.tsx — Tableau transactions + 3 StatCards (dépensé/bloqué/remboursé), responsive table/cards
- src/app/client/avis/page.tsx — Avis à laisser + Mes avis
- src/app/client/avis/review-dialog.tsx — Dialog avis (étoiles 1-5 + commentaire)
- src/app/client/support/page.tsx — Coordonnées support + ouvrir litige + mes litiges
- src/app/client/support/dispute-form.tsx — Form litige (sélecteur réservation + raison + description)
- src/app/client/profil/page.tsx — Profil (infos + changement mot de passe) avec fetch/PATCH /api/client/profile

API créées:
- src/app/api/bookings/route.ts — GET (liste own) + POST (création avec calcul prix/commission + transaction + notif admin)
- src/app/api/bookings/[id]/route.ts — GET (détail) + PATCH (actions: confirm/report/reschedule/cancel/open_dispute)
- src/app/api/client/reviews/route.ts — POST (crée review + recalcul rating moyen prof)
- src/app/api/client/disputes/route.ts — GET (liste own) + POST (crée litige + met booking en DISPUTED + notif admin)
- src/app/api/client/profile/route.ts — GET (user sans password) + PATCH (update infos / changePassword)

Stage Summary:
- Parcours de réservation multi-étapes complet et fonctionnel (cœur du projet).
- Toutes les APIs testées avec curl (auth + 401 sans session + POST/PATCH/GET ok).
- Toutes les pages client rendent en HTTP 200 (testé avec session client@demo.ci).
- Redirections d'authentification validées : non connecté -> /connexion?from=/client ; admin -> /admin.
- Calculs financiers conformes au cahier : commission 20%, packs (4, 8, 12 -15%, EXAM_PREP x10), fonds bloqués en BLOCKED jusqu'à validation client.
- Composants partagés utilisés (StatCard, PageHeader, EmptyState, Money, BookingStatusBadge, PaymentStatusBadge, TeacherCard).
- Lint clean sur tous les fichiers du périmètre (aucune erreur ESLint sur src/app/client et src/app/api/bookings et src/app/api/client).
- Palette respectée (primary vert, accent orange), pas d'indigo/blue pour les éléments principaux.
- Mobile-first avec tables responsive (desktop table / mobile cards) et onglets scrollables.

---
Task ID: 5
Agent: main
Task: Vérification finale (lint, dev server, agent-browser E2E)

Work Log:
- Lint ESLint : PASS (0 erreur)
- Dev server Next.js 16 sur port 3000 : OK, compile sans erreur
- Test E2E complet avec agent-browser :
  1. Page d'accueil publique : affiche hero, barre recherche, 6 profs en vedette, grille tarifaire
  2. Page /professeurs : 8 profs, filtres matière/niveau/commune/format/tri, pagination
  3. Page détail prof public : toutes sections (à propos, matières, niveaux, zones, dispo, tarifs, avis), aucune info privée affichée
  4. Connexion admin (admin@monprof.ci) : redirect /admin, dashboard 12 KPIs + graphique
  5. Connexion client (client@demo.ci) : redirect /client, dashboard 4 StatCards
  6. Formulaire réservation 5 étapes : Besoin → Format → Dispo → Récap → Paiement (Wave/Orange/MTN/Moov/Carte)
  7. Paiement réussi : création booking MP-XXXXXXX + transaction BLOCKED + notification admin
  8. Admin : Valider réservation (PAID→CONFIRMED) → Affecter prof (→ASSIGNED + notif) → Marquer cours fait (→PENDING_CLIENT_VALIDATION)
  9. Client : Confirmer le cours (→PAYMENT_TO_RELEASE + paymentStatus TO_PAY_TEACHER)
  10. Admin : Payer le professeur (→TEACHER_PAID, transaction TEACHER_PAYOUT créée)
- Toutes les 12 pages admin testées : 0 erreur
- Toutes les 8 pages client testées : 0 erreur
- Toutes les 6 pages publiques testées : 0 erreur
- Responsive mobile (375x812) : menu burger, footer sticky, cartes OK
- Correction appliquée : admin "Valider la réservation" s'affiche aussi pour statut PAID (en plus de PENDING_ADMIN_VALIDATION)

Stage Summary:
- Plateforme MonProf CI entièrement fonctionnelle de bout en bout.
- Workflow complet du cahier des charges validé : recherche → réservation → paiement sécurisé (fonds bloqués) → validation admin → affectation prof → réalisation cours → confirmation client → libération paiement prof (après commission 20%).
- Style OpenAI premium respecté (palette vert #10A37F, fond #F7F7F8, bordures fines, mobile-first).
- 2 espaces : client (8 pages) + admin (22 pages) + 6 pages publiques + auth.
- Aucune erreur de lint, aucune erreur runtime.
