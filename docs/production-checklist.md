# Checklist production Compétence

Avant de déployer sur Vercel, exécuter :

```bash
npm run production:check
```

Le contrôle ne doit afficher aucun `FAIL`.

Variables obligatoires côté Vercel :

- `DATABASE_URL`
- `DIRECT_URL`
- `NEXTAUTH_SECRET`
- `NEXTAUTH_URL`
- `NEXT_PUBLIC_APP_URL`
- `CRON_SECRET`

PayDunya doit être configuré côté serveur, soit via variables d'environnement, soit via la table `Setting` de Supabase :

- `paydunya_master_key`
- `paydunya_public_key`
- `paydunya_private_key`
- `paydunya_token`
- `paydunya_mode` avec la valeur `live`

Ne jamais créer de variable `NEXT_PUBLIC_PAYDUNYA_*`.
