-- Les mots de passe temporaires professeur expirent 24 h après leur émission.
-- L'horodatage est également utilisé comme verrou de consommation atomique à
-- la première connexion. Les mots de passe temporaires déjà actifs reçoivent
-- une nouvelle fenêtre de 24 h au moment du déploiement de cette migration.
ALTER TABLE "Teacher"
ADD COLUMN "portalTemporaryPasswordIssuedAt" TIMESTAMP(3);

UPDATE "Teacher"
SET "portalTemporaryPasswordIssuedAt" = CURRENT_TIMESTAMP
WHERE "portalPasswordMustChange" = true
  AND "portalPasswordHash" IS NOT NULL;
