# Recette du service accompagné — 24 novembre 2026

## Complément de publication — 25 novembre 2026

Le catalogue réel contient 590 matières. Le formulaire ne charge plus les 250
premières entrées alphabétiques : il sélectionne les matières scolaires du
catalogue pédagogique existant, puis les filtre par système et classe. Le serveur
contrôle la même compatibilité avant toute nouvelle demande, sans réécrire les
anciens dossiers. Une régression vérifie les mathématiques après le 590e élément
et l'exclusion des matières professionnelles. Les 11 scénarios PostgreSQL ont
été réexécutés avec succès après cette correction.

La navigation du nouveau parcours public utilise les liens HTML directs, sans
préchargements RSC de pages privées ou de formulaires. Les grilles et formulaires
restent interactifs une fois ouverts. Le schéma historique de la recette est
épinglé au commit prépublication `631bbeec436ac2b0512eaeaa2b5150e43498f110` :
le test reste reproductible après publication, même lorsque HEAD contient les
nouvelles tables. Aucun nouveau changement de schéma production n'est requis.

## Données et migration

- Base PostgreSQL 17 locale isolée : schéma historique recréé, dix migrations
  additives appliquées, rôle applicatif limité `competence_runtime`.
- Aucun compte de test ni donnée privée de production importés dans la recette.
- Sauvegarde cohérente des 53 tables applicatives de production, chiffrée DPAPI,
  déchiffrement et empreinte vérifiés. L'instantané ne remplace pas un dump complet
  du cluster ; il reste hors dépôt, dans `output/managed-qa/backups/`.
- Migration production appliquée sans reset, sans suppression de table/colonne.
  Contrôle après migration : 11 utilisateurs, 26 professeurs, 7 réservations et
  4 transactions historiques, identiques aux totaux initiaux. Aucun ancien solde
  converti ; aucun transfert financier réel déclenché par la recette.

## Scénarios PostgreSQL réels

1. Conservation des comptes et données historiques après migration.
2. Demande anonyme idempotente, prix serveur et accord privé versionné.
3. Impossibilité pour l'admin de signer au nom du parent.
4. Qualification exacte système/classe/matière et conflits de planning.
5. Deux acceptations concurrentes : une seule peut réserver le professeur.
6. Aucun crédit payable sans séance validée et fonds parent reçus ; financement
   partiel exact, sans double crédit lors d'un rejeu.
7. Deux paiements professeur concurrents ne dépensent pas deux fois le solde.
8. Extournes compensatrices uniques ; refus de créer une dette sur un revenu
   déjà versé ; nouvel encaissement légitime après correction accepté.
9. Litige et retenue bloquant le paiement, puis libération contrôlée.
10. Annulation d'une séance non effectuée et remboursement exact sans doublon.
11. Refus d'accès `anon`, refus de modification des ledgers et taux acceptés.
12. Révision tarifaire invalidant accord et lien précédents ; réclamation parent.
13. Report limité à la séance concernée, avec nouvel accord parent/professeur.

## HTTP et interface

`npm run build:quality` a réussi après les correctifs : typage, lint et ensemble
des vérifications métier, sécurité, navigation, notifications et stockage médias.

- Refus des écritures finance/professeur non authentifiées et des origines tierces.
- Lien privé invalide refusé ; création anonyme et consultation privée réelles.
- Navigateur Edge mobile isolé : six séances ivoiriennes de 6e = 75 000 FCFA,
  échéancier de deux semaines, accord enregistré et récapitulatif consultable.
- Connexion admin et attribution réelle du dossier à 25 % / 75 % ; confirmation
  serveur et données rafraîchies dans l'interface.
- Connexion professeur, mission reçue avec six dates, montant net et engagements ;
  carte de confirmation affichée avant acceptation.
- Correctif de l'icône locale `next/image` de la permission push, qui faisait
  planter le dashboard ; navigation admin adaptée au nouveau service et liens
  historiques conservés. Accès professionnels retirés du shell public client.

## Passe visuelle du 25 novembre — accueil et demande

- En-tête desktop aligné ; sur mobile, logo et deux commandes de 44 px, menu
  repliable natif. Aucun lien professeur/admin dans le parcours parent.
- Accueil raccourci, cartes de parcours bordées, ombres légères, fond blanc,
  icônes vectorielles (y compris les drapeaux, sans dépendance aux emojis).
- Formulaire en trois étapes conservées dans le DOM : cours, séances, contact.
  Prix toujours visible, détails facultatifs repliés, validation par étape,
  focus sur le titre ou le champ invalide et navigation clavier.
- Edge isolé : lien français prérempli, matière obligatoire, six séances
  françaises de 6e à 112 500 FCFA, choix en ligne, coordonnées et consentement,
  retour puis progression sans envoi automatique, envoi explicite HTTP 200 et
  confirmation « Bien reçu. ». Données synthétiques dans PostgreSQL local.
- Tests sur 320 et 390 px sans débordement horizontal ; accueil desktop
  1440 × 1000 ; menu mobile utilisable ; pas d'erreur console sur navigation
  fraîche. Première étape complète visible en 390 × 844.
- Onze scénarios PostgreSQL et contrôles HTTP réexécutés avec succès ;
  `build:quality` réussi. Les règles et les tables métier ne changent pas.
- Captures locales : `output/playwright/refined-home-desktop.png`,
  `refined-home-mobile.png`, `refined-request-mobile.png` (hors Git).

## Limites explicites

Les textes légaux nécessitent une revue professionnelle et la vérification de
l'identité de l'exploitant. L'accord électronique simple ne certifie pas l'identité.
Les qualifications précises des professeurs historiques doivent être vérifiées
dans l'admin : aucune compétence n'est inventée par migration. La réception push
sur un téléphone réel fermé et la charge de 100 000 connexions simultanées ne
sont pas démontrées par ces tests. Les opérations financières de ce service
enregistrent des paiements manuels vérifiés ; elles ne réalisent pas un virement.
