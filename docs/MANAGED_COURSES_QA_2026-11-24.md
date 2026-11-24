# Recette du service accompagné — 24 novembre 2026

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

## Limites explicites

Les textes légaux nécessitent une revue professionnelle et la vérification de
l'identité de l'exploitant. L'accord électronique simple ne certifie pas l'identité.
Les qualifications précises des professeurs historiques doivent être vérifiées
dans l'admin : aucune compétence n'est inventée par migration. La réception push
sur un téléphone réel fermé et la charge de 100 000 connexions simultanées ne
sont pas démontrées par ces tests. Les opérations financières de ce service
enregistrent des paiements manuels vérifiés ; elles ne réalisent pas un virement.
