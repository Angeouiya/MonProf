# Task 3-a — Subagent A — Pages publiques + Auth

## Périmètre livré

### Pages publiques (Server Components)
- `src/app/page.tsx` — Page d'accueil : Hero + barre de recherche rapide (matière/niveau/commune), 3 étapes, professeurs en vedette (6 max, via Prisma), 4 cartes avantages, grille tarifaire rapide (5 niveaux), preuve sociale (3 KPI), CTA final.
- `src/app/professeurs/page.tsx` — Liste SSR avec filtres sidebar (matière, niveau, commune, format radio, prix min/max, tri, recherche texte), pagination, empty state. Même logique de filtre que `/api/teachers`.
- `src/app/professeurs/[id]/page.tsx` — Détail professeur : header (photo + badges + note + avis), à propos, expérience/diplômes, matières + niveaux, zones, disponibilités (tableau 7j × 3 créneaux), tarifs (séance/pack4/pack8), avis (répartition + liste), carte latérale sticky avec récap + bouton réserver. **Aucune info personnelle (tél/email/adresse) affichée.**
- `src/app/comment-ca-marche/page.tsx` — 9 étapes du parcours client, section "Pour les parents", "Pourquoi nous faire confiance", 3 stats, CTA.
- `src/app/tarifs/page.tsx` — Grille tarifaire par niveau (5 niveaux × 6 colonnes), 4 packs, 8 étapes du paiement sécurisé, exemple chiffré (15 000 → 3 000 → 12 000), FAQ (8 questions en accordéon), CTA.
- `src/app/contact/page.tsx` — Formulaire (client component) + infos contact latérales. POST `/api/contact`, toast Sonner, état succès.

### Pages Auth
- `src/app/connexion/page.tsx` — Client component (avec Suspense pour `useSearchParams`). Email/password, `signIn("credentials")`, fetch `/api/auth/me` pour redirection rôle (admin→/admin, client→/client, ou `?from=`). Comptes démo cliquables (admin + client).
- `src/app/inscription/page.tsx` + `src/components/auth/inscription-form.tsx` — Server component fetch communes → client form. Validation client (nom, email, téléphone, password 6+, confirm), POST `/api/auth/register`, auto-login `signIn`, redirect `/client`.

### APIs créées
- `src/app/api/contact/route.ts` — POST `{name,email,phone?,subject,message}` → `db.contactMessage.create`. Validation zod, retourne `{ok:true}` ou 400/500.
- `src/app/api/auth/me/route.ts` — GET → retourne `{user:{id,email,name,role}}` basé sur `getServerSession`, ou 401.

### Composants créés
- `src/components/home/home-search-bar.tsx` — Barre de recherche rapide (3 selects matière/niveau/commune) pour la home.
- `src/components/auth/inscription-form.tsx` — Form d'inscription client.

## Conventions respectées
- `PublicLayout` wrap toutes les pages publiques (footer sticky OK).
- `TeacherCard`, `Money`, `EmptyState` réutilisés.
- API routes pour tous les writes (contact, register via API existante).
- Server components par défaut, `'use client'` uniquement pour formulaires et barre de recherche.
- Palette `bg-primary`, `bg-card`, `border-border`, `text-muted-foreground` uniquement. Aucun indigo/blue en éléments principaux.
- Mobile-first : tous les composants responsives (`grid sm:grid-cols-2 lg:grid-cols-4`, `flex-col sm:flex-row`, etc.).
- Tous les montants en FCFA via `Money` ou `formatFCFA`.
- Pas d'emoji dans les contenus.
- Aucune info personnelle (tél/email/adresse) affichée sur le détail professeur.

## Tests curl (toutes pages renvoient HTTP 200)
```
Home:           200
Profs (liste):  200
Profs (filtre): 200
Détail prof:    200
Comment:        200
Tarifs:         200
Contact:        200
Connexion:      200
Inscription:    200
/api/auth/me:   401 (sans session, attendu)
POST /api/contact (valid):   200 {"ok":true}
POST /api/contact (invalid): 400 (validation)
```

## Notes pour les autres agents (B et C)
- La redirection après login client va vers `/client` (route à créer par Subagent B).
- La redirection après login admin va vers `/admin` (route Subagent C).
- Le bouton "Réserver" sur la fiche professeur redirige :
  - si client connecté → `/client/reserver?teacherId=...` (à créer par B)
  - sinon → `/connexion?from=/client/reserver?teacherId=...`
- Le formulaire d'inscription crée un User role CLIENT et auto-login → redirige vers `/client`.
- Lint OK sur tous les fichiers de ce périmètre. (1 erreur de lint subsiste sur `src/app/api/admin/bookings/[id]/route.ts` ligne 75, mais c'est hors périmètre — à corriger par Subagent C.)
