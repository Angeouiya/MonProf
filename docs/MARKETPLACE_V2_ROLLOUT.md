# Compétence — nouveau parcours de mise en relation

## Périmètre livré dans cette branche

- Les trois systèmes existants restent Ivoirien, Français et Professionnel. Les comptes clients et professeurs, réservations et paiements historiques ne sont ni supprimés ni convertis.
- Le client précise le besoin, le niveau, la date, l'heure, le format et le lieu. La recherche filtre les compétences, la disponibilité, les conflits d'horaire et le crédit de commission ; elle propose les professeurs compatibles, d'abord dans la zone indiquée.
- Une mission est proposée à un professeur à la fois, avec expiration et passage au suivant après refus, annulation avant cours ou absence de réponse. Le prix annoncé ne peut pas augmenter lors de cette réattribution automatique.
- Le professeur recharge son portefeuille Compétence par Jèko. Une commission de 30 % du cours, hors transport, est réservée à l'acceptation puis débitée seulement au démarrage par code client. Le cours est payé directement entre client et professeur : Compétence ne vérifie pas ce paiement privé.
- Le compte à rebours, la confirmation client, le signalement de litige, les avis et la supervision administrateur sont séparés du parcours historique.
- Un webhook Jèko signé et une vérification serveur confirment les recharges. Le cron Jèko récupère aussi les confirmations perdues. Le ledger et les clés uniques empêchent un double crédit/débit.

## Activation prudente

1. Conserver `MARKETPLACE_V2_ENABLED=false` pendant la revue. Appliquer la migration additive `20261102090000_marketplace_missions_wallet` sur une base de **préproduction** issue d'une copie anonymisée, jamais directement sur la production comme premier essai.
2. Configurer un secret stable `MARKETPLACE_START_CODE_SECRET` de 32 caractères ou plus. Vérifier `NEXTAUTH_SECRET`, `CRON_SECRET`, Jèko et l'URL publique sans copier des clés dans les journaux.
3. Exécuter `npm run verify:marketplace-v2`, `npm run typecheck`, `npm run lint`, `npm run build`, puis un scénario navigateur/API/base de bout en bout avec comptes de test pour les trois rôles et les deux formats de cours.
4. Tester Jèko en conditions réelles autorisées : succès, refus, webhook manquant, webhook rejoué et réponse ambiguë, avec audit du montant en base et du solde. Tester deux acceptations concurrentes et un conflit entre mission nouvelle et réservation historique payée.
5. Faire revoir CGU, confidentialité, fiscalité du modèle de paiement direct et traitement des litiges par un juriste local. Les textes de cette branche constituent une base de travail, pas une validation juridique.
6. Ne basculer le flag qu'après approbation, supervision et plan de retour arrière. Le retour arrière consiste à remettre le flag à `false`, sans supprimer les nouvelles tables.

## Non encore validé / hors promesse

- La vue « secteur » ne place pas de professeurs sur une vraie carte géographique : aucune position GPS vérifiée ni fournisseur cartographique n'est encore configuré. Ne pas afficher de marqueurs ou distances fictifs.
- La capacité à 100 000 utilisateurs simultanés n'est pas prouvée par une compilation. Il faut un test de charge réaliste, une revue des index/plans SQL, des limites Jèko/queues/push, des connexions base et un dimensionnement infrastructure.
- Un professeur doit disposer d'une vraie photo de profil enregistrée avant d'apparaître dans cette recherche. L'upload garde la base comme source durable si la copie Cloudflare KV échoue, mais le cas signalé sur mobile exige encore un essai réel et des journaux de production pour être déclaré résolu.
- Les avantages historiques « partenariat/cadeaux » dépendant d'un paiement Jèko du cours ne s'appliquent pas automatiquement aux paiements privés du nouveau parcours. Il faut définir leur preuve et leur financement avant activation.
- Aucun versement privé client-professeur n'est encaissé, arbitré ou remboursé automatiquement par Compétence dans ce modèle. Les interfaces et textes ne doivent pas laisser croire le contraire.
- Le partage des coordonnées après acceptation et la libération automatique d'une réserve si aucun code de démarrage n'est saisi peuvent permettre un contournement hors plateforme. Avant activation large, il faut une politique anti-contournement vérifiable (échanges internes, traçabilité des absences et sanctions proportionnées) compatible avec l'expérience simple demandée.
