# Capacité cible : 500 000 utilisateurs simultanés

## Ce qui n'est pas une certification

Un build, un profil k6 configuré pour 500 000 VUs, 500 000 lignes SQL et 500 lectures d'un cache ne prouvent pas que 500 000 personnes peuvent utiliser la plateforme simultanément. Le rapport doit distinguer le volume des données, les VUs réellement observés, les requêtes par seconde, les latences et la saturation du générateur. Un rapport par générateur ne suffit pas à certifier une campagne distribuée.

Le propriétaire a choisi **aucun coût supplémentaire** le 25 novembre 2026. Aucune campagne distante de cette taille ne doit être déclenchée dans ce cadre. Le staging actuel partage le Hyperdrive de production ; son déploiement est bloqué tant qu'une origine PostgreSQL séparée n'est pas configurée. Il ne doit jamais être chargé ni réinitialisé.

## Renforcements

- Fonctions SQL internes : chemins de recherche fixés, aucune permission EXECUTE pour PUBLIC/anon/authenticated ; accès serveur explicitement conservé.
- L'installateur de l'outbox réapplique ces restrictions au lieu de réintroduire les alertes lors d'une maintenance.
- Index partiel de priorité pour les notifications actives, créé avec `CONCURRENTLY`. Les états terminaux n'alourdissent pas cet index. Le verrouillage `FOR UPDATE SKIP LOCKED`, les reprises et l'idempotence restent inchangés.
- Concurrence des consommateurs Cloudflare explicitement bornée : 4 invocations push, 2 communication et 2 email, avec un message par invocation. Cela évite un fan-out non borné d'instances Next.js et de clients SQL dans un même lot ; les files conservent les tâches restantes.
- Catalogue scolaire public : cache Cloudflare de 60 secondes avec liste blanche `id/name`, séparation des environnements et retour à la source si le cache échoue. Les prix, disponibilités, écritures financières, sessions privées et mots de passe ne sont jamais servis par ce cache. La validation d'une demande reste une lecture serveur autoritaire.
- Protection contre un lancement accidentel : les profils 100k/500k refusent les domaines de production, même avec l'ancien drapeau `ALLOW_PRODUCTION`. Ils exigent une preuve d'environnement synthétique et de blocage des écritures.

## Essai gratuit isolé

Installer k6 **2.4.0** depuis la release officielle Grafana ; vérifier son SHA-256 avec le fichier de checksums de la même release. Le binaire portable n'est pas une dépendance du projet et ne doit pas être ajouté au dépôt.

Après `npm run build:cloudflare`, lancer sous PowerShell :

```powershell
$env:MANAGED_QA_PG_MODULE='C:/Users/Public/Documents/competence-managed-qa-20261124/node_modules/embedded-postgres/dist/index.js'
$env:CAPACITY_K6_BIN='C:/Users/Public/Documents/competence-load-tools-k6-2.4.0/k6-v2.4.0-windows-amd64/k6.exe'
$env:MANAGED_QA_LOAD='true'
$env:CAPACITY_PEAK_VUS='20'
$env:MANAGED_QA_BROWSER='true'
npm run verify:managed-postgres
```

Le runner crée son propre PostgreSQL 17 sur loopback avec mot de passe aléatoire, applique les migrations, puis génère 500 000 clients et notifications **synthétiques**. Les 100 identités de charge disposent d'un dossier et de séances représentatifs. Le serveur utilise le build production, mais tourne sous Node local ; il ne reproduit pas le réseau mondial, les limites et le pool Hyperdrive de Cloudflare. Un proxy local interdit les écritures pendant la charge. Les cookies ne sont signés qu'avec un secret de test temporaire. Aucun compte, hash, fichier ou destinataire de production n'est importé.

Le rôle PostgreSQL utilisé par le serveur de charge est placé en lecture seule pendant cet essai, puis restauré. Le rapport `output/capacity-qa/results.json` contient les plans SQL avant/après, le pic réellement observé et les métriques k6 ; les anciens essais sont conservés dans leurs sous-dossiers. Les logs et sessions synthétiques restent dans `output/`, ignoré par Git. Le cluster est conservé et arrêté en fin de test ; aucun dossier utilisateur n'est effacé.

### Mesures locales du 25 novembre 2026

Run complet `75e399b7-b76b-4298-91ad-dd38f51e4bf3`, terminé à 18:18:48 UTC :

| Mesure | Résultat observé |
| --- | ---: |
| Comptes et notifications synthétiques | 500 000 de chaque |
| Sessions simultanées réellement observées | 20 |
| Durée du profil, montée et descente comprises | 50 s |
| Requêtes HTTP, preuve d'isolation comprise | 416 |
| Erreurs HTTP | 0 % |
| p95 global HTTP | 49,60 ms |
| p95 suivi des cours privés | 73,98 ms |
| p95 notifications privées | 29,84 ms |
| Sélection de 500 tâches, EXPLAIN avant index | 516,763 ms |
| Même sélection, EXPLAIN après index | 1,543 ms |
| Comptage des notifications privées, EXPLAIN | 0,212 ms |

Les plans SQL sont des mesures ponctuelles sur une base locale, pas des moyennes ni un SLA. Le générateur, Next.js et PostgreSQL partagent un PC de 4 processeurs et 7,88 GiB de RAM ; le CPU système a culminé à 94,2 %, avec au minimum 1,38 GiB de mémoire libre. Les routes testées sont des lectures ; les écritures financières sont couvertes séparément par les tests d'intégration.

Un premier essai à 100 VUs (`7c81e719-229d-4259-ab90-c8ca1831e296`) a atteint le palier mais s'est interrompu sans résumé final exploitable. Il est **incomplet, non validé**. Ses logs sont conservés ; aucune latence ni réussite ne lui est attribuée. Le runner conserve désormais un rapport d'échec et les échantillons mémoire même si le générateur est arrêté avant son résumé.

**Conclusion : essai local borné réussi, aucune certification de 500 000 utilisateurs simultanés. Aucune charge n'a été envoyée en production.**

### Contrôle de sécurité production

Les deux migrations ont été appliquées le 25 novembre 2026 après sauvegarde chiffrée et vérification de restauration. Le nouvel audit Supabase `security --level warn --fail-on warn` répond « No issues found » : les six avertissements précédents sont supprimés. Les sept fonctions internes refusent l'exécution aux rôles navigateur, l'index est valide et les droits de maintenance temporaires ont été restaurés. Comptages avant/après identiques : 11 utilisateurs, 26 professeurs, 7 réservations, 4 transactions. Tous les hashes historiques de connexion sont inchangés. Les rapports locaux, dépourvus de secrets, sont dans `output/managed-qa/capacity-*` ; la sauvegarde DPAPI reste privée et n'est pas publiée.

## Campagne distribuée future — non exécutée sans ressources et budget

Le scénario `load/500k-active.k6.js` monte progressivement à 500 000 VUs, chacun associé à une identité synthétique distincte, et conserve ce palier dix minutes. Le mélange est 50 % consultation des notifications privées, 30 % suivi des cours privés et 20 % formulaire public. Chaque utilisateur réfléchit 15 à 45 secondes entre deux actions : ordre de grandeur de 16 667 requêtes/seconde au palier haut, hors latence et ressources statiques.

Il faut d'abord provisionner une base et un environnement Cloudflare **réellement isolés**, bloquer les emails/SMS/push/banques sortants réels, préparer au moins 500 000 sessions synthétiques et une preuve `/__load/identity`, puis dimensionner des générateurs distribués. Mesurer CPU, mémoire, réseau et connexions des générateurs ; ne pas attribuer leur saturation à l'application. Utiliser les segments k6 ou un opérateur distribué et agréger les histogrammes globaux (ne jamais moyenner les p95).

Critères : pic de 500 000 utilisateurs distincts maintenu, erreurs < 0,1 %, p95 < 2,5 s, connexions PostgreSQL sous la limite, files sans dérive durable et aucun doublon financier. Les parcours de mutation nécessiteront un scénario séparé sur données synthétiques ; ce profil de lecture n'est pas une preuve de débit pour les paiements/versements. Une validation du provider push ne prouve pas la réception sur un téléphone.

Références : [grands tests k6](https://grafana.com/docs/k6/latest/testing-guides/running-large-tests/), [limites Workers](https://developers.cloudflare.com/workers/platform/limits/), [pool Hyperdrive](https://developers.cloudflare.com/hyperdrive/concepts/connection-pooling/), [privilèges des fonctions Supabase](https://supabase.com/docs/guides/database/functions#function-privileges).
