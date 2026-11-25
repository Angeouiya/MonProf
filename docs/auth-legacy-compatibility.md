# Compatibilité des accès historiques

Les identifiants existants ne sont ni réinitialisés ni soumis rétroactivement aux nouvelles règles de création de mot de passe. Les empreintes bcrypt restent inchangées.

## Accès

- Client : `/connexion`, email ou téléphone et ancien mot de passe.
- Administrateur : `/admin/connexion`, email et ancien mot de passe.
- Professeur : `/professeur/connexion`, téléphone et ancien mot de passe.
- Les nouveaux formulaires transmettent le rôle attendu au serveur. Le rôle réellement attribué vient toujours de la base, jamais du formulaire.
- Les anciens appels sans `accountRole` restent compatibles ; ils ne peuvent pas changer le rôle du compte.
- Les formats téléphoniques local, `+225`, `225` et `00225` convergent vers le même identifiant canonique.
- Une navigation complète après connexion évite de réutiliser un préchargement anonyme d’une page protégée.
- Une session historique sur `competence.ci` conserve son domaine : elle n’est pas redirigée vers `www.competence.ci` en perdant son cookie. Cette exception de navigation ne remplace jamais la validation du JWT ou des permissions.
- Les cookies JWT découpés par NextAuth (`session-token.0`, `.1`, etc.) sont reconnus à l’edge, notamment pour les administrateurs ayant beaucoup de permissions. Ils ne passent plus par le raccourci « utilisateur anonyme » ; NextAuth vérifie toujours leur signature.
- Les erreurs de service, session/cookies, mauvais espace et accès temporaire expiré sont distinctes des identifiants invalides.
- Les comptes désactivés et mots de passe temporaires expirés restent refusés. La récupération contrôlée existante reste obligatoire.

## Vérifications locales

```powershell
npm run verify:auth-compatibility
npm run verify:password-email
$env:MANAGED_QA_PG_MODULE='C:/Users/Public/Documents/competence-managed-qa-20261124/node_modules/embedded-postgres/dist/index.js'
$env:MANAGED_QA_BROWSER='true'
npm run verify:managed-postgres
```

Le dernier test démarre une base PostgreSQL 17 isolée puis Next.js local. Il vérifie de vrais cookies/CSRF, les trois rôles, les anciens mots de passe courts et bcrypt 2a/2b/2y, la séparation des espaces, les refus de sécurité et une panne de base simulée suivie d’une reprise. Il ne lit ni ne modifie la production. Fermer le serveur avec le fichier sentinelle `output/managed-qa/STOP`.

## Audit historique en lecture seule

`scripts/sql/auth-legacy-inspect.sql` ne retourne que des agrégats. Sous Windows, `node scripts/verify-auth-legacy-preservation.mjs <chemin-absolu-sauvegarde.json.dpapi>` compare les empreintes courantes à la sauvegarde chiffrée avant migration. Aucun mot de passe, hash, identifiant ou secret n’est affiché. Aucun changement de schéma ou réécriture de compte n’est requis pour ce correctif.

Les tests locaux ne certifient pas qu’un mot de passe personnel saisi est exact. Un test authentifié de chaque compte réel nécessiterait son titulaire ; aucun mot de passe n’est demandé dans le chat.

Après déploiement, `node scripts/verify-auth-production-smoke.mjs` contrôle les deux domaines, les trois formulaires, les cookies/CSRF et le refus d’un identifiant inexistant aléatoire. Il ne crée ni ne modifie aucun compte réel.
