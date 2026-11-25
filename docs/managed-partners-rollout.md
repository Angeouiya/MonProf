# Répartition interne, partenaires et suivi parent

## Règles

- Le tarif initial d’une nouvelle demande est archivé dans `initialTotalPrice`. Les anciennes lignes conservent `null` : aucun montant historique n’est inventé.
- Avant engagement, un administrateur habilité peut proposer un **montant total négocié**. La somme est ventilée exactement entre les séances, y compris si elle n’est pas divisible. Le parent doit accepter la nouvelle révision ; les offres non acceptées et l’ancien lien sont révoqués.
- La part professeur est libre entre 0 et 100 %, avec deux décimales maximum. Elle est figée sur l’offre et sur les séances acceptées. Une rémunération acquise n’est jamais recalculée avec un nouveau taux.
- Le partenaire est créé par un administrateur finance dans le nouveau registre privé. Le numéro canonique est unique. Aucun ancien apporteur public n’est importé automatiquement.
- La commission partenaire est un pourcentage du prix final du cours, et non un pourcentage de la seule marge Compétence. Professeur + partenaire ne peuvent jamais dépasser 100 %.
- Exemple : cours négocié à 90 000 F, professeur 80 %, partenaire 10 % : professeur 72 000 F, partenaire 9 000 F, Compétence 9 000 F.
- Les montants deviennent acquis au prorata des encaissements réellement enregistrés pour les séances validées. Les litiges bloquent le disponible. Un enregistrement de versement ne déclenche aucun transfert bancaire/Mobile Money.
- Les versements partenaires sont sérialisés par partenaire, idempotents et immuables. Une correction crée une contre-écriture. Un encaissement dont la commission a déjà été réglée ne peut pas être annulé sans rapprochement préalable.

## Visibilité

- Le professeur reçoit une projection à liste blanche : rémunération uniquement, séances, informations pédagogiques et, après acceptation, contact/lieu du parent. Ni prix parent, ni pourcentage, ni partenaire, ni note comptable interne ne sont exposés.
- Le parent voit son propre prix et son suivi, jamais la répartition. Les dossiers créés connecté sont rattachés au compte créateur. Un dossier anonyme peut être rattaché avec son lien privé valide ; un numéro similaire ne donne aucun droit de lecture.
- La confirmation parent est un élément de suivi horodaté, idempotent et non réinscriptible. Elle n’enregistre pas d’encaissement et ne remplace pas la validation Compétence.
- Les cadeaux et déclarations partenaires publics sont fermés par un verrou applicatif central. Les anciennes écritures et corrections demeurent disponibles pour l’audit.
- Les compteurs professeur sont calculés sur toutes ses séances déclarées effectuées/validées, indépendamment de la pagination. L’administration dispose du filtre « Réalisées aujourd’hui » et du suivi par séance.

## Vérifications et publication

1. Générer Prisma puis exécuter `npm run verify:managed-courses`.
2. Exécuter `npm run verify:managed-postgres` avec le module PostgreSQL 17 isolé et `MANAGED_QA_BROWSER=true`. Le test doit inclure négociation, confidentialité, permissions, lien privé, confirmation, concurrence et corrections partenaires.
3. Contrôler les écrans admin/client/professeur dans le navigateur. Arrêter le serveur local avec `output/managed-qa/STOP`.
4. Exécuter `npm run build:quality` et `npm run build:cloudflare`.
5. Créer une sauvegarde production chiffrée avec `node scripts/backup-managed-production.mjs`, puis lancer le dry-run et l’application de `scripts/migrate-managed-production.mjs`. Le script exige une sauvegarde et un rapport PostgreSQL récents avec l’empreinte exacte de la migration.
6. Publier sans force-push, déployer Cloudflare, puis exécuter `node scripts/verify-auth-production-smoke.mjs` et `node scripts/verify-managed-partners-production.mjs` sur les deux domaines. Aucun compte QA n’est créé en production et aucun versement réel n’est exécuté par les tests.

La migration `20261125141353_managed_partners_and_parent_confirmations` ajoute des colonnes facultatives et deux tables privées, sans supprimer de ligne. Les anciennes grilles acceptées, comptes, empreintes de mots de passe, recharges et écritures restent conservés.
