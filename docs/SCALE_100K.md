# Capacité cible : plus de 100 000 utilisateurs actifs

## Architecture verrouillée dans le code

- Les fonctions Next.js restent sans état local durable et peuvent être répliquées horizontalement.
- Prisma réutilise une instance par conteneur et passe par le pooler Supabase/PgBouncer avec une connexion runtime par instance.
- Les pages publiques critiques évitent les lectures PostgreSQL inutiles et les catalogues partagés sont mis en cache.
- Les notifications et campagnes massives utilisent des files durables et des lots, jamais une boucle HTTP synchrone de 100 000 destinataires.
- Le temps réel repose sur Web Push, Service Worker, focus et retour au premier plan. Aucun polling global périodique n'est lancé par chaque appareil.
- `npm run verify:scale-readiness` empêche la publication si ces garde-fous disparaissent.

## Validation avant campagne massive

Une garantie de 100 000 actifs ne peut pas être déduite d'un build. Elle doit être confirmée par un essai distribué sur un environnement isolé, avec les mêmes tailles Vercel, Supabase et Queues que la production.

1. Dupliquer la production sans données personnelles et activer le pooler PostgreSQL.
2. Exécuter progressivement le profil `load/100k-active.k6.js` depuis plusieurs générateurs.
3. Arrêter immédiatement si les erreurs atteignent 0,1 %, si le p95 dépasse 2,5 s durablement, si les connexions DB approchent la limite ou si la file accumule du retard.
4. Observer fonctions, CPU, mémoire, connexions PostgreSQL, latence SQL, cache, queue lag et taux d'erreurs.
5. Conserver le rapport daté et répéter le test après toute modification structurante.

Commande k6 sur l'environnement de charge :

```powershell
k6 run -e BASE_URL=https://charge.competence.ci load/100k-active.k6.js
```

Le script refuse `competence.ci` par défaut afin d'éviter de saturer accidentellement les vrais utilisateurs.
