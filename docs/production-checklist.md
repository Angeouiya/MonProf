# Checklist production Compétence

Avant de déployer sur Vercel, exécuter :

```bash
npm run production:check
```

Le contrôle ne doit afficher aucun `FAIL`.

Variables obligatoires dans la portée **Production** de Vercel :

- `DATABASE_URL`
- `DIRECT_URL`
- `NEXTAUTH_SECRET`
- `NEXTAUTH_URL`
- `NEXT_PUBLIC_APP_URL`
- `NEXT_PUBLIC_PAYMENT_SERVICE_FEE_RATE_BPS` avec la valeur `300` (3 %)
- `CRON_SECRET`
- `JEKO_API_KEY`
- `JEKO_API_KEY_ID`
- `JEKO_STORE_ID`
- `JEKO_WEBHOOK_SECRET`
- `GMAIL_CLIENT_ID`
- `GMAIL_CLIENT_SECRET`
- `GMAIL_REFRESH_TOKEN`
- `GMAIL_SENDER_EMAIL` avec la valeur `diplomateimmobilier99@gmail.com`

`DATABASE_URL` doit utiliser le rôle restreint `competence_runtime` via le pooler transactionnel. `DIRECT_URL` doit utiliser le rôle séparé `competence_migrator` uniquement pour les migrations. Le rôle propriétaire historique `competence_app` ne doit pas être utilisé par le runtime Vercel.

`JEKO_*` et `GMAIL_*` sont des secrets de production : ne jamais les cibler vers Preview. En défense supplémentaire, le runtime ignore automatiquement Jèko et Gmail dès que `VERCEL_ENV` existe et diffère de `production`, même si un secret a été ajouté par erreur. Lorsque `VERCEL_ENV` est absent, les intégrations restent disponibles pour une vérification locale explicite avec des variables fournies localement.

La portée **Preview** doit utiliser une base Supabase de test isolée de Production, avec son propre `DATABASE_URL`, son propre `DIRECT_URL`, un `NEXTAUTH_SECRET` distinct, les migrations appliquées et uniquement des données factices compatibles avec les contrôles de build. Une Preview ne doit jamais pouvoir écrire dans la base réelle. Si des tests fournisseurs sont nécessaires, utiliser une boutique Jèko de test et un compte email de test dans un environnement local dédié; le runtime Vercel Preview gardera quand même les intégrations réelles désactivées.

Les variables d'URL doivent utiliser le domaine canonique actuellement actif : `https://www.competence.ci`. Le domaine `boutiquecompetences.ci` ne doit être utilisé qu'après création de son DNS, ajout dans Vercel et validation HTTPS.

Avant d'activer Jèko, appliquer le schéma Prisma sur la base cible :

```bash
npm run db:deploy
npm run db:backfill-admin-team
npm run payment:reschedule-provider:audit
```

`db:deploy` doit être exécuté avant de publier le nouveau code : il ajoute notamment les versions de session requises par l'authentification, l'outbox chiffrée des emails de sécurité et les index partiels qui sérialisent les envois et interdisent deux reports actifs sur une même réservation. Son préflight s'arrête avant la migration si des données historiques contiennent plusieurs reports actifs pour une même réservation. `prisma db push` ne remplace pas cette étape, car il ne sait pas reproduire ces index SQL partiels.

La base Compétence historique a été créée avant l'introduction de Prisma Migrate. Le script `ensure-prisma-migration-baseline.mjs`, exécuté automatiquement par `db:deploy`, distingue donc trois situations :

- base vide : la migration baseline est réellement exécutée ;
- schéma historique complet : toutes les tables, colonnes, nullabilités, énumérations, contraintes et tous les index de référence sont contrôlés ; la baseline est ensuite seulement enregistrée comme déjà appliquée, puis les nouvelles migrations sont exécutées ;
- schéma historique partiel : le déploiement s'arrête sans rien modifier afin d'éviter une migration destructive.

Ne jamais lancer manuellement la migration baseline SQL sur la base de production existante. Vérifier d'abord l'intégrité de tous les fichiers avec `npm run verify:migrations`.

Le backfill attribue `OWNER` au plus ancien administrateur uniquement si aucun propriétaire n'existe déjà; les autorisations ne dépendent plus d'une adresse Gmail codée en dur.

L'audit des reports doit ensuite lister les anciennes demandes. Si les candidats PayDunya identifiés par leurs traces sont corrects, exécuter `npm run payment:reschedule-provider:backfill-known-paydunya`. Les lignes historiques sans aucune trace restent volontairement sans fournisseur et ne doivent jamais être reclassées automatiquement en Jèko.

Configurer ensuite le webhook Jèko vers `/api/webhooks/jeko` sur le domaine public HTTPS. Les retours navigateur ne valident jamais un paiement seuls : la plateforme confirme toujours le paiement auprès de Jèko.

Le compte Gmail `diplomateimmobilier99@gmail.com` doit avoir l'API Gmail activée et un refresh token OAuth2 valide autorisé avec exactement les scopes `openid email https://www.googleapis.com/auth/gmail.send`. Les scopes d'identité `openid` et `email` permettent à `tokeninfo` de confirmer que le refresh token appartient exactement à l'expéditeur configuré; ils ne donnent aucun accès supplémentaire à la boîte Gmail. `GMAIL_REFRESH_TOKEN` doit être créé **uniquement dans la portée Production** de Vercel, jamais dans Preview. Les identifiants OAuth restent exclusivement côté serveur. Les emails de réinitialisation et de confirmation de changement de mot de passe utilisent exclusivement ce compte et n'emploient pas le fournisseur de secours Resend. Leur payload sensible est chiffré en AES-256-GCM avec une clé dérivée de `NEXTAUTH_SECRET`; ne jamais modifier ce secret tant que l'outbox contient des jobs actifs.

Après avoir configuré les quatre variables `GMAIL_*`, la vérification live suivante est une **porte obligatoire avant toute promotion vers Production**. L'exécuter soit localement avec `VERCEL_ENV` absent et les variables Production chargées temporairement, soit dans un contexte Vercel Production. Le script refuse volontairement Preview et Development. Valider d'abord l'identité et les scopes sans envoyer d'email, puis autoriser explicitement un unique email test vers l'expéditeur :

```bash
npm run verify:gmail-live
npm run verify:gmail-live -- --send-self
```

Vérifier que le cron Vercel `/api/cron/password-email-outbox` s'exécute toutes les cinq minutes avec l'en-tête exact `Authorization: Bearer <CRON_SECRET>`. Les crons refusent les secrets placés dans l'URL ou dans un en-tête de secours; ne jamais utiliser `?secret=`. Le flush `after()` accélère le premier essai, mais le cron et la table `PasswordEmailOutbox` assurent la reprise après une coupure de fonction, un timeout Gmail ou une indisponibilité OAuth.

Ne jamais renseigner ni transmettre le mot de passe Gmail dans le projet, GitHub ou Vercel. Seuls le client OAuth, son secret et le refresh token sont utilisés. `/api/health` expose séparément `configured`, `runtimeEnabled` et `liveVerification: "not_checked_by_health"`; il ne contacte jamais Google et ne prouve donc pas qu'OAuth est opérationnel. Seule la commande `npm run verify:gmail-live`, suivie du test volontaire `--send-self`, valide l'identité, le scope et l'envoi avant promotion. Après cette porte, tester le parcours d'un compte client. La réinitialisation publique par email est réservée aux clients. En cas d'oubli professeur, le service client attribue un mot de passe temporaire depuis la fiche professeur; la prochaine connexion oblige le professeur à le remplacer. Les administrateurs utilisent leur circuit interne géré par le propriétaire.

PayDunya n'est plus requis pour les nouveaux paiements. Conserver ses anciens identifiants côté serveur uniquement si des dossiers PayDunya historiques restent à rapprocher, soit via variables d'environnement, soit via la table `Setting` de Supabase :

- `paydunya_master_key`
- `paydunya_public_key`
- `paydunya_private_key`
- `paydunya_token`
- `paydunya_mode` avec la valeur `live`

Ne jamais créer de variable `NEXT_PUBLIC_PAYDUNYA_*`.

PayDunya reste documenté uniquement pour la lecture et le rapprochement des anciens paiements. Les nouvelles réservations, leurs suppléments et les versements professeurs utilisent Jèko.
