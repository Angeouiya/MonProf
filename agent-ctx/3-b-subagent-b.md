# Task 3-b — Subagent B : Espace client MonProf CI

## Périmètre livré
Toutes les pages sous `/client/*` + APIs `/api/bookings/*` et `/api/client/*`.

## Fichiers créés
### Pages client (src/app/client/)
- `layout.tsx` — garde-fou session + rôle CLIENT, wrap ClientLayout
- `page.tsx` — dashboard (4 StatCards, prochain cours, actions requises, recommandés)
- `rechercher/page.tsx` — recherche filtrable
- `reserver/page.tsx` + `reserver-form.tsx` — formulaire 5 étapes (CŒUR)
- `reservations/page.tsx` — liste filtrable par tabs
- `reservations/[id]/page.tsx` + `actions.tsx` — détail + actions contextuelles
- `cours/page.tsx` — cours à venir/en cours/terminés
- `paiements/page.tsx` — historique transactions + StatCards
- `avis/page.tsx` + `review-dialog.tsx` — avis à laisser + mes avis
- `support/page.tsx` + `dispute-form.tsx` — ouvrir litige + mes litiges
- `profil/page.tsx` — infos + mot de passe

### APIs (src/app/api/)
- `bookings/route.ts` — GET (liste own) + POST (création)
- `bookings/[id]/route.ts` — GET (détail) + PATCH (confirm/report/reschedule/cancel/open_dispute)
- `client/reviews/route.ts` — POST (avis)
- `client/disputes/route.ts` — GET + POST (litige)
- `client/profile/route.ts` — GET + PATCH (infos / changePassword)

## Tests réalisés (curl + cookies session)
- Authentification client@demo.ci OK (session JWT)
- 401 sans session sur /api/bookings
- POST /api/bookings crée booking PAID + paymentStatus BLOCKED + Transaction + Notification admin
  - Calcul vérifié: PACK_4 teacher Traoré (57000 attendu) → unitPrice=57000, total=57000, commission=11400 (20%), net=45600 ✓
- PATCH /api/bookings/[id] action=confirm passe PENDING_CLIENT_VALIDATION → PAYMENT_TO_RELEASE + paymentStatus TO_PAY_TEACHER ✓
- POST /api/client/reviews sur booking déjà noté → 400 "Vous avez déjà laissé un avis" ✓
- PATCH /api/client/profile met à jour phone ✓
- Layout redirige : non auth → /connexion?from=/client ; admin → /admin ✓
- Toutes les pages /client/* rendent en HTTP 200 avec session client

## Lint
- `eslint src/app/client src/app/api/bookings src/app/api/client` → 0 erreur, 0 warning
- (Une erreur de parsing existe sur src/app/api/admin/bookings/[id]/route.ts — fichier de Subagent C, hors périmètre)

## Convention respectée
- API routes (pas de server actions), tous les writes via fetch /api/*
- Server components par défaut, 'use client' pour formulaires
- Composants partagés utilisés (StatCard, PageHeader, EmptyState, Money, StatusBadge, TeacherCard)
- Palette MonProf (vert #10A37F, orange #F59E0B) — pas d'indigo/blue en principal
- Mobile-first : tables responsive, tabs scrollables, dialogs
- Tous montants en FCFA via Money/formatFCFA
- Sonner pour notifications visuelles
