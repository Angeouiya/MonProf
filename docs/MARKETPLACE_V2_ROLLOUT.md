# Compétence — nouveau parcours de mise en relation

## Nouveau service accompagné — décision du 24 novembre 2026

Le flag `MANAGED_LESSONS_ENABLED` reste désactivé par défaut dans les environnements
non configurés et en staging. Le déploiement Cloudflare production l'active explicitement.
Il est prioritaire sur la marketplace V2 pour les nouvelles demandes :

- Le parent dépose une demande sans compte. L'équipe attribue un professeur ;
  le catalogue public n'est plus exposé et les nouvelles réservations V1/V2
  doivent passer par le formulaire accompagné. Les dossiers historiques restent conservés.
- Séances de **120 minutes**. La grille fournie pour huit séances est divisée
  par deux pour afficher la base initiale de quatre séances. Calcul exact :
  `prix de quatre séances / 4 × nombre choisi`, de 1 à 24 séances par dossier.
  Le formulaire propose quatre séances par défaut ; huit séances proposent deux
  dates par semaine. Chaque date reste modifiable avant l'accord.
- Le parent paie Compétence hors ligne. Les échéances proposées sont hebdomadaires,
  par période de 14 jours ou par mois calendaire à partir du premier cours.
  Elles sont explicitement affichées et acceptées. Aucun débit ni rappel bancaire
  automatique n'est exécuté par ce module.
- L'admin fixe la commission Compétence entre 20 % et 30 % (pourcentages entiers)
  lors de la proposition de chaque mission ; le professeur reçoit entre 70 % et
  80 %. Le taux exact est présenté avant acceptation et enregistré de façon
  immuable sur l'offre puis sur les séances acceptées. Une réattribution peut
  avoir un autre taux pour les seules séances non effectuées. Les rémunérations
  déjà acquises ne sont jamais recalculées avec le nouveau taux.
  Une séance déclarée terminée par le professeur doit être validée par l'admin.
  Le crédit payable exige à la fois cette validation et un règlement parent
  enregistré. Un paiement parent partiel finance les séances chronologiquement
  et crédite uniquement la fraction correspondante des séances validées.
- Les versements professeurs sont effectués hors plateforme par l'équipe puis
  enregistrés avec montant, moyen, référence, opérateur et clé d'idempotence.
  Ces écritures ne déclenchent aucun transfert Jèko. Le reste payable est verrouillé
  par professeur ; il ne peut pas être consommé deux fois.
- L'administration peut saisir une demande téléphonique mais ne peut pas accepter
  le contrat au nom du parent. Un tarif exceptionnel avant engagement annule
  l'accord pour la nouvelle version et révoque les offres non acceptées.
  Un lien privé de sept jours permet au parent d'accepter le récapitulatif.
- L'acceptation est une preuve électronique simple, **pas** une signature qualifiée
  ni une vérification d'identité. L'équipe doit vérifier le contact du parent avant
  le début du service. Aucun SMS OTP ni signature certifiée n'est simulé.
- Une annulation professeur est signalée à l'équipe. L'admin peut libérer seulement
  les séances futures non effectuées pour réattribution, sans effacer les séances
  effectuées, les crédits et les règlements.

### Migration, recette et retour arrière

1. Tester d'abord toutes les migrations précédentes puis
   `20261124200512_managed_courses` sur une base PostgreSQL locale isolée. La nouvelle
   table de séances est utilisée par le verrou planning partagé, même si le
   flag est désactivé. Le nouveau code ne doit donc pas précéder la migration.
2. Vérifier les accès du rôle runtime réel : les tables sont protégées par RLS,
   sans accès `anon/authenticated`, avec politique serveur pour `competence_runtime`.
   Les reçus, le ledger et le journal sont append-only. Aucun ancien solde n'est converti.
3. Exécuter `npm run verify:managed-courses`, `npm run verify:managed-postgres`,
   typage, lint et build. La recette PostgreSQL utilise un rôle runtime limité,
   aucun accès à une base distante et des données entièrement synthétiques. Elle teste : deux acceptations concurrentes,
   encaissement partiel avant/après validation, double clic, deux paiements
   simultanés, refus professeur, réattribution, révision tarifaire et lien expiré.
4. Faire compléter la vérification juridique, l'identité légale de l'exploitant, les
   durées de conservation et les prestataires/transferts de données. Le modèle
   de contrat livré n'est ni une signature certifiée ni une attestation de conformité.
5. Les procédures de litige, annulation parent, remboursement
   manuel et extourne d'une erreur de saisie sont implémentées et testées. Le module ne
   permet pas d'effacer ou modifier une écriture financière, ni de fabriquer un
   crédit hors encaissement. Ces procédures utilisent des écritures compensatrices :
   remboursement des seules séances annulées non effectuées, extourne d'un reçu
   ou d'un paiement professeur, traçabilité opérateur et idempotence. Une extourne
   d'encaissement ne peut pas créer une dette sur une rémunération déjà versée.
   Un litige gèle les opérations et le solde concerné jusqu'à décision de l'équipe.
6. Vérifier la réception réelle du push et les droits des rôles admin/professeur.
   Les tests sans base ni appareils ne constituent pas une recette de production.

Commandes de maintenance production, ciblées exclusivement sur le projet
`edhcvqwpxtcudzkecoea`, schéma `competence` :

```powershell
node scripts/inspect-managed-production.mjs
node scripts/backup-managed-production.mjs
node scripts/migrate-managed-production.mjs
node scripts/migrate-managed-production.mjs --apply
```

La sauvegarde est un instantané JSON cohérent des lignes des tables applicatives,
chiffré DPAPI pour l'utilisateur Windows courant, avec vérification du déchiffrement
et SHA-256. Ce n'est pas un dump complet du cluster PostgreSQL. Le script exige
une sauvegarde et une recette locale récentes, compare les empreintes des migrations,
refuse les suppressions de tables/colonnes et restaure les options du rôle de
maintenance. Aucun mot de passe ou contenu de dossier n'est écrit dans les logs.
Les fichiers `output/` et `.wrangler/` restent hors Git.

Le staging actuellement déclaré partage le Hyperdrive production : son déploiement
est bloqué par `predeploy:cloudflare:staging` jusqu'à configuration d'une base distincte.
Ne jamais y importer des comptes de test. Pour désactiver les nouvelles demandes,
remettre `MANAGED_LESSONS_ENABLED=false` et redéployer, sans supprimer les tables.
Les dossiers existants, accords privés, fonctions de suivi et contraintes planning
restent accessibles avec leurs autorisations, y compris après désactivation.

`npm run deploy:cloudflare:production` charge le paquet OpenNext déjà compilé et
le publie par Wrangler. Le wrapper vérifie que le cache OpenNext ne demande aucune
initialisation distante et que la protection de version ne demande pas de mapping.
Il évite ainsi l'émulation locale Hyperdrive inutile du helper de déploiement,
sans ajouter une fausse URL PostgreSQL ni copier de secret production. Si une
configuration de cache ou de protection de version est ajoutée, il refuse le
déploiement jusqu'à adaptation explicite de la procédure.

Les professeurs historiques doivent être habilités explicitement par système,
classe et matière dans l'admin. Les compétences ne sont pas inventées ou déduites
d'une ancienne catégorie générique. Les anciens comptes, cours, paiements et
portefeuilles restent séparés et ne sont pas convertis en nouveaux soldes.

Les grilles primaire/professionnel et les éventuels suppléments de transport
n'ont pas été fournis pour ce nouveau service : aucun ancien tarif ou supplément
n'est appliqué implicitement. Ces besoins passent par le contact et une proposition
acceptée avant engagement. Pour les anciennes règles V2, voir ci-dessous.

## Ancien modèle V2 conservé pour l'historique — non actif pour les nouvelles demandes

- Les trois systèmes existants restent Ivoirien, Français et Professionnel. Les comptes clients et professeurs, réservations et paiements historiques ne sont ni supprimés ni convertis.
- Le client précise le besoin, le niveau, la date, l'heure, le format et le lieu. La recherche filtre les compétences, la disponibilité, les conflits d'horaire et le crédit de commission ; elle propose les professeurs compatibles, d'abord dans la zone indiquée.
- Une mission est proposée à un professeur à la fois, avec expiration et passage au suivant après refus, annulation avant cours ou absence de réponse. Le prix annoncé ne peut pas augmenter lors de cette réattribution automatique.
- Le professeur recharge son portefeuille Compétence par Jèko. Une commission de 30 % du cours, hors transport, est réservée à l'acceptation puis débitée seulement au démarrage par code client. Le cours est payé directement entre client et professeur : Compétence ne vérifie pas ce paiement privé.
- Le compte à rebours, la confirmation client, le signalement de litige, les avis et la supervision administrateur sont séparés du parcours historique.
- Un webhook Jèko signé et une vérification serveur confirment les recharges. Le cron Jèko récupère aussi les confirmations perdues. Le ledger et les clés uniques empêchent un double crédit/débit.
- Une carte de secteurs affiche les communes des professeurs compatibles, jamais leur position GPS individuelle. Le client peut synchroniser carte et liste. Le déplacement est estimé depuis le dernier cours confirmé connu du même jour, sinon depuis la zone déclarée du professeur.
- La qualification scolaire V2 est explicite par **système + classe + matière**. Les anciennes associations génériques ne sont pas extrapolées : chaque profil historique concerné doit être revalidé par l'administration avant de paraître dans la recherche V2.
- Un suivi de 2 à 6 dates peut être proposé au même professeur. Chaque séance garde son tarif normal, sans remise de pack, son horaire, son code et son statut. L'acceptation réserve la somme des commissions sous verrou ; un refus ou une expiration avant acceptation concerne tout le suivi.
- L'historique V2 est distinct des anciens cours payés par Jèko. Les notifications professeur portent un lien direct vers la mission ; leur envoi Web Push reste soumis à l'abonnement actif de l'appareil.

## Activation prudente

1. Conserver `MARKETPLACE_V2_ENABLED=false` pendant la revue. Appliquer toutes les migrations additives V2, de `20261102090000_marketplace_missions_wallet` à `20261104150000_marketplace_scale_rls`, dans leur ordre, sur une base de **préproduction** issue d'une copie anonymisée, jamais directement sur la production comme premier essai. Le contrôle planning des engagements V2 existants reste actif même si le flag est ensuite désactivé : les tables doivent donc exister avant le déploiement du nouveau code.
2. Configurer un secret stable `MARKETPLACE_START_CODE_SECRET` de 32 caractères ou plus. Vérifier `NEXTAUTH_SECRET`, `CRON_SECRET`, Jèko et l'URL publique sans copier des clés dans les journaux.
3. Revalider dans l'admin les triplets système/classe/matière des professeurs éligibles à la V2. Exécuter `npm run verify:marketplace-v2`, `npm run verify:marketplace-series`, `npm run verify:marketplace-push`, `npm run build:quality`, `npm run build`, puis un scénario navigateur/API/base de bout en bout avec comptes de test pour les trois rôles et les deux formats de cours.
4. Tester Jèko en conditions réelles autorisées : succès, refus, webhook manquant, webhook rejoué et réponse ambiguë, avec audit du montant en base et du solde. Tester deux acceptations concurrentes, une acceptation multi-dates, un conflit entre mission nouvelle et réservation historique payée, ainsi que le comportement après désactivation du flag.
5. Faire revoir CGU, confidentialité, fiscalité du modèle de paiement direct et traitement des litiges par un juriste local. Les textes de cette branche constituent une base de travail, pas une validation juridique.
6. Tester sur appareils réels la réception push client/professeur lorsque l'application est fermée, et mesurer sa latence. Un événement en outbox ou accepté par le fournisseur n'est pas une preuve de réception par le téléphone.
7. Ne basculer le flag qu'après approbation, supervision et plan de retour arrière. Le retour arrière consiste à remettre le flag à `false`, sans supprimer les nouvelles tables ni ignorer les missions déjà acceptées.

## Non encore validé / hors promesse

- La carte indique des centres de communes, pas une géolocalisation temps réel des professeurs. La distance, le temps d'arrivée et le tarif ne doivent pas être présentés comme une mesure GPS précise. Les limites de balayage de candidats et le classement nécessitent encore un essai de charge et une mesure sur données représentatives.
- La capacité à 100 000 utilisateurs simultanés n'est pas prouvée par une compilation. Il faut un test de charge réaliste, une revue des index/plans SQL, des limites Jèko/queues/push, des connexions base et un dimensionnement infrastructure.
- Un professeur doit disposer d'une vraie photo de profil enregistrée avant d'apparaître dans cette recherche. Les récents correctifs de `main` sur l'upload Cloudflare sont conservés, mais le cas signalé sur mobile exige encore un essai réel et des journaux de production pour être déclaré résolu.
- Les avantages historiques « partenariat/cadeaux » dépendant d'un paiement Jèko du cours ne s'appliquent pas automatiquement aux paiements privés du nouveau parcours. Il faut définir leur preuve et leur financement avant activation.
- Aucun versement privé client-professeur n'est encaissé, arbitré ou remboursé automatiquement par Compétence dans ce modèle. Les interfaces et textes ne doivent pas laisser croire le contraire.
- Le partage des coordonnées après acceptation et la libération automatique d'une réserve si aucun code de démarrage n'est saisi peuvent permettre un contournement hors plateforme. Avant activation large, il faut une politique anti-contournement vérifiable (échanges internes, traçabilité des absences et sanctions proportionnées) compatible avec l'expérience simple demandée.
