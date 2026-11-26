# Essai cloud de 100 000 sessions Compétence

**État au 26 novembre 2026 : cible de capacité non validée.** Cinq essais complets ont atteint le palier de 100 000 sessions dans le cloud, sans utiliser le PC du propriétaire comme serveur/générateur et sans données de production. Le dernier mesure encore **6,691 % d'erreurs** et un **p95 de 10 004 ms**, au-delà des seuils. Les optimisations sont conservées sur `codex/cloud-capacity-100k` ; `main` et le déploiement de production ne sont pas modifiés par ce travail.

## Périmètre et coût

Demande du propriétaire le 25 novembre 2026 : viser 100 000 utilisateurs simultanés, exécuter la charge dans le cloud et ne pas utiliser son PC comme générateur ou serveur. La contrainte de coût supplémentaire nul reste applicable.

L'essai s'exécute dans GitHub Actions, sur un runner **standard** `ubuntu-24.04` du dépôt public `Angeouiya/MonProf` : 4 vCPU et environ 16 Go de RAM. Ces machines standard sont gratuites pour un dépôt public. Aucun runner « larger », abonnement, cache Actions ou artefact facturable n'est créé. Les rapports sont dans les logs et le résumé du job. Voir les [conditions de facturation GitHub](https://docs.github.com/en/billing/concepts/product-billing/github-actions) et les [spécifications des runners](https://docs.github.com/en/actions/reference/runners/github-hosted-runners).

La production n'est jamais ciblée. Le job ne reçoit aucun de ses secrets et ne déploie rien. PostgreSQL 17 est créé sur le loopback de la VM jetable, les migrations réelles sont appliquées et les tests métier s'exécutent avant la charge. Les données sont entièrement synthétiques. À la fin, la VM est détruite par GitHub.

## Ce qui est effectivement testé

- 100 000 identités clientes distinctes, avec des sessions NextAuth signées par un secret aléatoire de test. Le coût d'une connexion par mot de passe n'est pas inclus dans cette mesure de sessions déjà authentifiées.
- 100 000 notifications et dossiers de cours, avec des séances représentatives ; aucune donnée de production n'est importée.
- Le vrai build `standalone` Next.js, répliqué dans la VM, et le vrai PostgreSQL configuré avec au maximum 60 connexions. Aucun service de données n'est remplacé par une réponse fictive pendant la charge.
- Le rôle SQL de l'application est placé en lecture seule pendant l'essai et le proxy ne permet que trois routes GET. Les écritures financières sont vérifiées séparément par les tests d'intégration, pas par cette charge de lecture.
- Mélange : 50 % `/api/client/notifications`, 30 % `/client/accompagnement`, 20 % `/demande-cours`. Les pages sont demandées en HTML complet ; il ne s'agit pas d'un test de rendu dans 100 000 navigateurs physiques.
- Montée sur 120 secondes, puis maintien de 100 000 sessions pendant au moins 600 secondes. Chaque session fait une lecture environ toutes les 180 secondes, avec un intervalle de 80 à 120 % de cette durée. Le débit réel est publié ; 100 000 sessions ne signifie pas 100 000 requêtes en vol.

Le générateur coopératif utilise un ordonnanceur et des histogrammes partagés plutôt qu'une VM JavaScript par utilisateur. Il reste soumis à des contrôles CPU, mémoire, retard de boucle événementielle et requêtes inachevées. Il ne peut être lancé que dans le contexte GitHub-hosted Linux du dépôt public autorisé ; les domaines de production restent interdits.

## Critères de réussite

Toutes les conditions doivent être satisfaites :

- 100 000 identités distinctes observées, chacune avec au moins une réponse valide ;
- palier complet maintenu dix minutes ;
- erreurs HTTP inférieures à 0,1 % ;
- p95 global **et p95 de chaque route** inférieurs à 2,5 s, attente du générateur et réception du corps comprises ;
- aucun reliquat de requêtes, aucune saturation du garde-fou de concurrence ;
- générateur sous 80 % d'un cœur, p95 du retard de boucle inférieur à 100 ms, au moins 1 Go de mémoire système disponible.

Les percentiles proviennent d'un histogramme global, pas d'une moyenne de p95.

## Historique des essais

### Premier essai — échec conservé

[Run 45714832222](https://github.com/Angeouiya/MonProf/actions/runs/45714832222), commit `158b117` :

| Mesure | Résultat |
| --- | ---: |
| Identités atteintes | 100 000 |
| Identités avec au moins un succès | 99 956 |
| Maintien au palier | 600,998 s |
| Requêtes | 419 498 |
| Erreurs | 70 419 — 16,786 % |
| Débit, réponses et erreurs comprises | 581,75 req/s |
| p95 global | 10 006 ms |
| CPU maximal du générateur | 29,87 % d'un cœur |
| Mémoire système minimale disponible | 12,20 Go |

**Échec : le nombre de sessions a été atteint, mais pas les critères de fiabilité et de latence.** Il ne constitue pas une certification de capacité. Deux processus applicatifs étaient utilisés. La réutilisation des connexions du proxy, le préchauffage de chaque processus et la répartition de charge ont été revus ; plusieurs variables changent, donc aucun gain éventuel ne doit être attribué à une seule correction sans expérience isolée.

### Deuxième essai — échec instrumenté

[Run 45718114773](https://github.com/Angeouiya/MonProf/actions/runs/45718114773), commit `28cd64b` : trois processus préchauffés, test fonctionnel de conservation des connexions, ventilation des erreurs, CPU par processus et suivi SQL.

| Mesure | Résultat |
| --- | ---: |
| Identités atteintes / avec au moins un succès | 100 000 / 100 000 |
| Maintien au palier | 600,997 s |
| Requêtes | 419 498 |
| Erreurs | 59 022 — 14,070 % |
| p95 global / de chaque route | 10 006 ms |
| Connexions SQL maximales | 27 / 60 |
| CPU maximal du générateur | 28,02 % d'un cœur |
| Mémoire système minimale disponible | 11,97 Go |

**Échec conservé.** Les trois processus Next saturent chacun environ un cœur ; les requêtes utilisent les index, et les connexions PostgreSQL ne saturent pas. Le run intermédiaire `45717952739` a été annulé pendant le build pour corriger les unités de télémétrie ; il n'a pas exécuté la phase de charge.

### Diagnostic CPU — ne vaut pas une réussite de charge

[Run 45721725092](https://github.com/Angeouiya/MonProf/actions/runs/45721725092), commit `8e90400` : trois profils V8 capturés dans la VM. Le palier a été réduit à 30 secondes pour ce diagnostic, avec `diagnosticOnly=true` et `passed=false` dans le rapport. Le statut vert du job signifie seulement que les profils ont été capturés. Le run précédent `45721050645` s'est arrêté au lint, avant toute charge.

Le formatage répété des dates apparaît parmi les fonctions applicatives coûteuses ; le rendu React, la sérialisation et le ramasse-miettes consomment aussi une grande partie du CPU. Les corrections suivantes réutilisent les formateurs `Intl` (sans mettre en cache de données personnelles) et évitent le rendu initial des étapes non encore visitées du formulaire. Une étape visitée reste montée pour conserver les champs non contrôlés et le `FormData` final.

### Troisième essai — échec malgré les optimisations de rendu

[Run 45724350799](https://github.com/Angeouiya/MonProf/actions/runs/45724350799), commit `2243bdd` : profil complet de dix minutes rétabli, critères inchangés. La suite `build:quality`, les tests d'équivalence de formatage et le contrôle Chromium 390/1440 px sont passés : validation, calcul de 16 séances, navigation retour/continuer, conservation des coordonnées et absence d'erreur d'hydratation. Le navigateur a été fermé avant la mesure.

| Mesure | Résultat |
| --- | ---: |
| Identités atteintes / avec au moins un succès | 100 000 / 100 000 |
| Maintien au palier | 601,001 s |
| Requêtes | 419 498 |
| Erreurs | 52 263 — 12,458 % |
| p50 / p95 / p99 | 372 / 10 005 / 10 010 ms |
| Connexions SQL maximales | 27 / 60 |
| CPU maximal du générateur | 26,48 % d'un cœur |
| Mémoire système minimale disponible | 11,60 Go |

**Échec conservé : les trois processus applicatifs restent limités par le CPU.** Le temps médian et le nombre d'erreurs baissent par rapport à l'essai précédent, mais les seuils restent largement dépassés. Ces observations sur des VM Actions successives ne sont pas une mesure isolée de la contribution de chaque optimisation.

### Quatrième essai — échec, cache public contrôlé

[Run 45727686477](https://github.com/Angeouiya/MonProf/actions/runs/45727686477), commit `9a05695` : même montée sur 120 s, même palier de 600 s et mêmes seuils. Le formulaire public est servi via **le même helper de cache que celui ajouté au Worker de production**, avec un adaptateur Cache API en mémoire dans le proxy Node. Les réponses sont produites par le vrai serveur puis conservées 60 s ; ce n'est pas une réponse HTML inventée. Les espaces privés ne sont jamais mis en cache. Cela teste la politique et son effet sur l'origine, pas le réseau de cache Cloudflare.

Garde-fous du cache : suppression des cookies et en-têtes d'identité avant le rendu partagé ; clé par système, environnement et version ; pas de cache pour API, contrats, mutations, RSC, autorisation explicite, query inconnue, réponse avec cookie ou statut autre que 200. Les tests de garde-fous sont aussi dans `prebuild:quality`. Le binding gratuit `CF_VERSION_METADATA` empêche la réutilisation d'un ancien HTML après changement de version ; en son absence, le cache est désactivé.

La vérification des réponses privées est renforcée : chaque page de cours doit contenir exclusivement la référence de son propriétaire, et une réponse publique ne suffit plus à compter une identité comme authentifiée avec succès. Le bundle Cloudflare et les contrôles qualité/navigateur sont passés, sans déploiement.

| Mesure | Résultat |
| --- | ---: |
| Identités atteintes / avec un succès privé | 100 000 / 99 735 |
| Maintien au palier | 600,999 s |
| Requêtes | 419 498 |
| Erreurs | 38 497 — 9,177 % |
| p50 / p95 / p99 | 114 / 10 005 / 10 010 ms |
| p50 public / cours privés / notifications privées | 6 / 278 / 200 ms |
| Opérations cache enregistrées avant nettoyage | 72 071 HIT, 3 938 MISS |
| CPU maximal du générateur | 26,45 % d'un cœur |
| Mémoire système minimale disponible | 11,84 Go |

**Échec conservé.** Les erreurs sont des timeouts/502, pas des références appartenant à un autre client. Les expirations du cache provoquent de nombreux recalculs simultanés. Les compteurs de cache ne couvrent pas exactement tous les essais HTTP : des clients ont abandonné avant la fin du rendu d'origine.

Un diagnostic séquentiel de 500 requêtes par route, hors cache public, mesure environ 3,90 ms CPU serveur par notification, 10,80 ms par page de cours et 5,12 ms par formulaire. Ce sont des temps CPU cumulatifs du processus, pas des latences de production.

### Contrôle navigateur ciblé — passé, sans verdict de capacité

[Run 45729045400](https://github.com/Angeouiya/MonProf/actions/runs/45729045400), commit `9c931d1` : `capacityVerdict=false`, 1 000 comptes synthétiques seulement, pas de charge 100k. Le formulaire est réellement servi depuis le cache puis hydraté dans Chromium 390/1440 px. Champs conservés, prix de 16 séances correct, clé d'idempotence différente par contexte et charge JSON contrôlée. Les POST sont interceptés avant le serveur ; aucun faux dossier n'est créé. Les 23 scénarios SQL/navigateur de ce job sont passés. Le run `45728914446` a été refusé avant démarrage à cause du nom dynamique du workflow, puis corrigé ; il n'a exécuté aucun test.

### Cinquième essai — échec, coalescence publique et lecture privée regroupée

[Run 45731601561](https://github.com/Angeouiya/MonProf/actions/runs/45731601561), commit `495bc7a` : même profil HTML, montée 120 s et palier 600 s, seuils inchangés. Le cache regroupe les requêtes simultanées d'une même entrée et renouvelle le document après 45 s pendant que l'ancienne copie reste valide (TTL 60 s inchangé). Cela ne coordonne que les requêtes d'un même isolate ; ce n'est pas un verrou global multi-PoP. Une réponse avec cookie n'est jamais partagée, même entre deux requêtes concurrentes.

La page de cours utilise une lecture SQL paramétrée avec jointure latérale, limitée à 21 dossiers appartenant au client avant chargement des séances (une requête de données en première page ; validation supplémentaire d'un curseur si fourni). Pas de modification de schéma, pas de cache privé, pas de changement des règles financières ou de l'authentification. Les tests comparent les données à l'ancienne projection ORM, y compris dates UTC, montants, contacts attribués, curseurs étrangers/injectés et pagination avec dates identiques. Ces tests sont passés. L'`EXPLAIN ANALYZE` mesure 0,173 ms sur le cas isolé et utilise les index client/date/id des dossiers et dossier/séquence des séances. Cela ne constitue pas une garantie de latence SQL en production.

| Mesure | Résultat |
| --- | ---: |
| Identités atteintes / avec un succès privé | 100 000 / 99 905 |
| Maintien au palier | 600,997 s |
| Requêtes | 419 498 |
| Erreurs | 28 068 — 6,691 % |
| p50 / p95 / p99 | 67 / 10 004 / 10 025 ms |
| p50 cours privés / notifications / formulaire | 137 / 100 / 6 ms |
| CPU diagnostic par page de cours | 9,96 ms / requête |
| Opérations cache avant nettoyage | 72 504 HIT, 2 MISS, 11 410 COALESCED |
| CPU maximal du générateur | 25,79 % d'un cœur |
| p95 retard de boucle du générateur | 23,07 ms |
| Mémoire système minimale disponible | 11,76 Go |
| Garde-fou concurrence | 4 096 requêtes en vol atteint ; `queueSaturated=true` |

**Échec conservé.** Les tests navigateur depuis le cache, les contrôles d'équivalence SQL, les builds et la qualité sont passés avant la charge. Les erreurs de charge sont des timeouts/502 ; aucune référence d'un autre client n'a été acceptée. La coalescence évite du travail d'origine dupliqué, mais les attentes d'un recalcul peuvent encore dépasser le délai sous saturation. Le garde-fou de concurrence atteint disqualifie aussi toute certification de débit sur ce générateur partagé. Les observations ne doivent pas être transformées en une promesse de 100k en production.

### Contrôle final des clés de cache publiques

L'accueil et les trois catalogues publics sont maintenant eux aussi isolés par identifiant de version Worker, pour ne pas réutiliser un HTML référençant les anciens chunks après un déploiement. En l'absence de version, leur cache est désactivé. Les exclusions de sessions, filtres inconnus et RSC du catalogue restent en place.

Le [run 45732506164](https://github.com/Angeouiya/MonProf/actions/runs/45732506164) s'est arrêté avant les builds/SQL sur une assertion statique qui attendait l'ancienne signature du cache. L'assertion a été renforcée pour attendre la version, sans retirer les contrôles d'anonymat/RSC. [Contrôle final 45734481833](https://github.com/Angeouiya/MonProf/actions/runs/45734481833), commit `d3e73a5` : **PASS qualité, builds Cloudflare/Next et 24 scénarios SQL/navigateur** ; mode UI seulement, 1 000 comptes synthétiques et `capacityVerdict=false`. Cette dernière modification du Worker n'intervient pas dans le proxy Node du test de charge. L'arbre applicatif `src/` est identique à celui du cinquième essai (`a826d946ae6a7fd684088e1faff6b42920c1a7aa`). Un contrôle QA vert ne remplace pas le verdict 100k, qui reste négatif.

## Ce qui manque pour poursuivre la validation

La VM gratuite de quatre vCPU partage le générateur, le proxy, trois processus Next.js et PostgreSQL. Les essais montrent encore une saturation CPU/attente et, au dernier essai, le plafond de concurrence. Augmenter artificiellement le seuil d'erreurs, ignorer les délais ou faire passer un contrôle UI vert pour un test 100k n'est pas une solution.

Il faut un environnement représentatif de Cloudflare/Hyperdrive, une origine SQL **réellement isolée** et suffisamment dimensionnée, des générateurs séparés et un budget/quotas connus avant de certifier la production. Le staging actuellement configuré partage encore le Hyperdrive de production : le garde-fou `verify-cloudflare-staging-isolation.mjs` le refuse pour cette raison. Il ne faut pas y injecter cette charge ou ces données synthétiques. Aucun service payant supplémentaire n'a été créé et aucune permission/sécurité n'a été contournée.

## Limites de toute conclusion

Même un résultat positif ne certifie que ce profil de lecture sur ce serveur cloud. Il ne certifie pas la configuration Cloudflare de production, Hyperdrive, les limites réseau globales, les notifications physiques, les débits de paiements ou les écritures concurrentes à la même échelle. Une certification de production nécessite un environnement Cloudflare et une origine SQL réellement isolés, puis un essai représentatif de cette infrastructure.
