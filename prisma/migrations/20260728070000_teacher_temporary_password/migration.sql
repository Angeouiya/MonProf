-- Tout mot de passe professeur attribué par le service client est temporaire.
-- Le professeur doit le remplacer lors de sa prochaine connexion.
ALTER TABLE "Teacher"
ADD COLUMN "portalPasswordMustChange" BOOLEAN NOT NULL DEFAULT false;
