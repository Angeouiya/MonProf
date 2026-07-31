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
- `NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY`
- `WEB_PUSH_VAPID_PRIVATE_KEY`
- `WEB_PUSH_SUBJECT` avec la valeur `mailto:contact@competence.ci`
- `JEKO_API_KEY`
- `JEKO_API_KEY_ID`
- `JEKO_STORE_ID`
- `JEKO_WEBHOOK_SECRET`
- `PASSWORD_EMAIL_PROVIDER` avec exactement `gmail` ou `resend`

Si `PASSWORD_EMAIL_PROVIDER=gmail` :

- `GMAIL_CLIENT_ID`
- `GMAIL_CLIENT_SECRET`
- `GMAIL_REFRESH_TOKEN`
- `GMAIL_SENDER_EMAIL` avec la valeur `diplomateimmobilier99@gmail.com`

Si `PASSWORD_EMAIL_PROVIDER=resend` :

- `RESEND_API_KEY` (clé serveur commençant par `re_`)
- `RESEND_FROM_EMAIL` avec une adresse du domaine vérifié `competence.ci`

`DATABASE_URL` doit utiliser le rôle restreint `competence_runtime` via le pooler transactionnel. `DIRECT_URL` doit utiliser le rôle séparé `competence_migrator` uniquement pour les migrations. Le rôle propriétaire historique `competence_app` ne doit pas être utilisé par le runtime Vercel.

`JEKO_*`, `GMAIL_*` et `RESEND_*` sont des secrets de production : ne jamais les cibler vers Preview. En défense supplémentaire, le runtime ignore automatiquement Jèko, Gmail et Resend dès que `VERCEL_ENV` existe et diffère de `production`, même si un secret a été ajouté par erreur. Lorsque `VERCEL_ENV` est absent, les intégrations restent disponibles pour une vérification locale explicite avec des variables fournies localement.

La portée **Preview** doit utiliser une base Supabase de test isolée de Production, avec son propre `DATABASE_URL`, son propre `DIRECT_URL`, un `NEXTAUTH_SECRET` distinct, les migrations appliquées et uniquement des données factices compatibles avec les contrôles de build. Une Preview ne doit jamais pouvoir écrire dans la base réelle. Si des tests fournisseurs sont nécessaires, utiliser une boutique Jèko de test et un compte email de test dans un environnement local dédié; le runtime Vercel Preview gardera quand même les intégrations réelles désactivées.

Les variables d'URL doivent utiliser le domaine canonique actuellement actif : `https://www.competence.ci`. Le domaine `boutiquecompetences.ci` ne doit être utilisé qu'après création de son DNS, ajout dans Vercel et validation HTTPS.

Avant d'activer Jèko, appliquer le schéma Prisma sur la base cible :

```bash
npm run db:deploy
npm run db:backfill-admin-team
npm run payment:reschedule-provider:audit
```

`db:deploy` doit être exécuté avant de publier le nouveau code : il ajoute notamment les versions de session requises par l'authentification, l'outbox chiffrée des emails de sécurité et les index partiels qui sérialisent les envois et interdisent deux reports actifs sur une même réservation. Son préflight s'arrête avant la migration si des données historiques contiennent plusieurs reports actifs pour une même réservation. `prisma db push` ne remplace pas cette étape, car il ne sait pas reproduire ces index SQL partiels.

Les étapes privilégiées de `db:deploy` (baseline et déclencheurs Web Push) utilisent automatiquement `DIRECT_URL`. Ne jamais accorder de DDL au rôle `competence_runtime` pour faire passer ce déploiement.

La base Compétence historique a été créée avant l'introduction de Prisma Migrate. Le script `ensure-prisma-migration-baseline.mjs`, exécuté automatiquement par `db:deploy`, distingue donc trois situations :

- base vide : la migration baseline est réellement exécutée ;
- schéma historique complet : toutes les tables, colonnes, nullabilités, énumérations, contraintes et tous les index de référence sont contrôlés ; la baseline est ensuite seulement enregistrée comme déjà appliquée, puis les nouvelles migrations sont exécutées ;
- schéma historique partiel : le déploiement s'arrête sans rien modifier afin d'éviter une migration destructive.

Ne jamais lancer manuellement la migration baseline SQL sur la base de production existante. Vérifier d'abord l'intégrité de tous les fichiers avec `npm run verify:migrations`.

Le backfill attribue `OWNER` au plus ancien administrateur uniquement si aucun propriétaire n'existe déjà; les autorisations ne dépendent plus d'une adresse Gmail codée en dur.

L'audit des reports doit ensuite lister les anciennes demandes. Si les candidats PayDunya identifiés par leurs traces sont corrects, exécuter `npm run payment:reschedule-provider:backfill-known-paydunya`. Les lignes historiques sans aucune trace restent volontairement sans fournisseur et ne doivent jamais être reclassées automatiquement en Jèko.

Configurer ensuite le webhook Jèko vers `/api/webhooks/jeko` sur le domaine public HTTPS. Les retours navigateur ne valident jamais un paiement seuls : la plateforme confirme toujours le paiement auprès de Jèko.

Après installation des quatre secrets Jèko dans Vercel Production, le pipeline `build:production` lance automatiquement la lecture non débitrice suivante dans l'environnement Vercel, où les variables `Sensitive` restent accessibles sans être révélées :

```bash
npm run verify:jeko-live
```

Cette commande appelle uniquement en `GET` le solde du magasin afin de confirmer la clé API, l'identifiant de clé et le magasin. Elle ne crée ni paiement, ni contact, ni retrait et n'affiche pas le solde. Une variable Vercel marquée `Sensitive` n'est pas relisible par `vercel env pull` ou `vercel env run`; ne jamais la rendre moins sûre pour un test local. Le secret webhook ne peut être prouvé de bout en bout que par un événement Jèko signé reçu sur `/api/webhooks/jeko`; effectuer ce test sur un déploiement Production staged avant de promouvoir le domaine public.

`PASSWORD_EMAIL_PROVIDER` choisit l'unique fournisseur des emails de réinitialisation et de confirmation. Chaque nouveau payload chiffré v3 enregistre le fournisseur, l'identité expéditrice validée, le sujet et les versions texte/HTML déjà rendues. Même si une variable d'environnement ou un modèle d'email change entre deux tentatives, un retry Resend réutilise exactement le même corps JSON et la même valeur `Idempotency-Key`; un retry Gmail réutilise exactement le même corps JSON/MIME, car la frontière multipart et le `Message-ID` sont dérivés par SHA-256 de la clé stable du job. Les anciens payloads chiffrés v1 restent liés à Gmail, qui était leur seul expéditeur possible; les payloads v2 restent lisibles pour assurer la compatibilité de transition. Il n'existe aucun fallback entre Gmail et Resend pour un email de sécurité, notamment après un timeout ou une réponse ambiguë. Ne jamais modifier `NEXTAUTH_SECRET` tant que l'outbox contient des jobs actifs.

Lors d'une bascule de fournisseur, conserver temporairement les identifiants de l'ancien fournisseur jusqu'à ce que ses jobs actifs soient envoyés, échoués ou expirés (24 heures au maximum pour les confirmations). Supprimer immédiatement l'ancien secret pourrait rendre ces retries impossibles; ils ne seront volontairement jamais redirigés vers le nouveau fournisseur.

Avec `PASSWORD_EMAIL_PROVIDER=gmail`, le compte `diplomateimmobilier99@gmail.com` doit avoir l'API Gmail activée et un refresh token OAuth2 valide autorisé avec exactement les scopes `openid email https://www.googleapis.com/auth/gmail.send`. Les scopes d'identité `openid` et `email` permettent à Google UserInfo de confirmer que le refresh token appartient exactement à l'expéditeur configuré; ils ne donnent aucun accès supplémentaire à la boîte Gmail. `GMAIL_REFRESH_TOKEN` doit être créé **uniquement dans la portée Production** de Vercel, jamais dans Preview. Les identifiants OAuth restent exclusivement côté serveur.

Pour créer ce refresh token sans jamais saisir le mot de passe Gmail dans le projet, enregistrer d'abord l'URI de redirection exacte `http://127.0.0.1:53682/oauth2/callback` dans le client OAuth Google si celui-ci est de type Web. Vérifier que l'écran de consentement Google est publié en **Production**; en mode Testing, Google peut expirer le refresh token après sept jours. Ouvrir ensuite une session Vercel valide avec `npx vercel login`, fournir `GMAIL_CLIENT_ID` et `GMAIL_CLIENT_SECRET` uniquement dans l'environnement du processus local, puis exécuter :

```bash
npm run gmail:authorize
```

Le script refuse tout lien local autre que le projet exact `ouiya-tech/competence`, ouvre le consentement Google avec `state` et PKCE, exige le compte exact et les trois scopes exacts, puis échange immédiatement le refresh token une seconde fois en mémoire pour prouver qu'il fonctionne. Il transmet ensuite le jeton par HTTPS à l'API Vercel, dans une variable Production marquée `Sensitive`. Le jeton n'est ni affiché, ni placé dans les arguments de commande, ni écrit dans un fichier. Une présence humaine reste obligatoire une seule fois pour la connexion et le consentement Google; aucun outil ne doit automatiser le mot de passe ou contourner cette validation.

Avant de rendre le refresh token `Sensitive`, le bootstrap ci-dessus vérifie déjà en mémoire l'échange OAuth, l'identité, `email_verified` et les scopes exacts. La commande suivante reste disponible uniquement lorsqu'un refresh token est fourni explicitement dans le processus local; elle ne peut pas relire une variable Vercel `Sensitive`. Elle valide d'abord sans envoyer d'email, puis permet un unique email test vers l'expéditeur :

```bash
npm run verify:gmail-live
npm run verify:gmail-live -- --send-self
```

Avec `PASSWORD_EMAIL_PROVIDER=resend`, vérifier d'abord le domaine `competence.ci` dans Resend et publier les enregistrements DNS SPF et DKIM demandés. Utiliser une clé API serveur avec droit d'envoi et une adresse `RESEND_FROM_EMAIL` de ce domaine. L'adaptateur impose une clé d'idempotence stable à chaque job, refuse les adresses ou en-têtes injectables et ne considère l'envoi accepté qu'après une réponse HTTP 2xx contenant un identifiant de message. Un timeout, un 5xx ou un conflit d'idempotence concurrent reste ambigu et est réessayé sur Resend uniquement avec la même clé.

Quel que soit le fournisseur sélectionné, créer ensuite un déploiement Production staged et tester le parcours réel « mot de passe oublié » d'un client sur cette URL. Ce test runtime est la porte obligatoire avant promotion : il prouve que le nouveau déploiement a reçu les variables `Sensitive`, que l'outbox fonctionne et que le fournisseur livre le lien Compétence. Une modification de variable Vercel ne s'applique jamais aux déploiements antérieurs.

Vérifier que le cron Vercel `/api/cron/password-email-outbox` s'exécute toutes les cinq minutes avec l'en-tête exact `Authorization: Bearer <CRON_SECRET>`. Les crons refusent les secrets placés dans l'URL ou dans un en-tête de secours; ne jamais utiliser `?secret=`. Le flush `after()` accélère le premier essai, mais le cron et la table `PasswordEmailOutbox` assurent la reprise après une coupure de fonction, un timeout fournisseur ou une indisponibilité OAuth/API.

Ne jamais renseigner ni transmettre le mot de passe Gmail dans le projet, GitHub ou Vercel. Seuls le client OAuth, son secret et le refresh token sont utilisés. `/api/health` expose le fournisseur sélectionné et, séparément, `configured`, `runtimeEnabled` et `liveVerification: "not_checked_by_health"` pour Gmail et Resend; il ne contacte aucun fournisseur et ne prouve donc pas qu'un envoi est opérationnel. Le parcours client sur le déploiement staged valide l'envoi runtime avant promotion. Avec Gmail, le bootstrap valide l'identité, les scopes et le refresh token avant stockage; `npm run verify:gmail-live -- --send-self` reste un test local volontaire lorsqu'un jeton est explicitement disponible. La réinitialisation publique par email est réservée aux clients. En cas d'oubli professeur, le service client attribue un mot de passe temporaire depuis la fiche professeur; la prochaine connexion oblige le professeur à le remplacer. Les administrateurs utilisent leur circuit interne géré par le propriétaire.

PayDunya n'est plus requis pour les nouveaux paiements. Conserver ses anciens identifiants côté serveur uniquement si des dossiers PayDunya historiques restent à rapprocher, soit via variables d'environnement, soit via la table `Setting` de Supabase :

- `paydunya_master_key`
- `paydunya_public_key`
- `paydunya_private_key`
- `paydunya_token`
- `paydunya_mode` avec la valeur `live`

Ne jamais créer de variable `NEXT_PUBLIC_PAYDUNYA_*`.

PayDunya reste documenté uniquement pour la lecture et le rapprochement des anciens paiements. Les nouvelles réservations, leurs suppléments et les versements professeurs utilisent Jèko.
