-- Une nouvelle fiche commence dans un seul système.
-- Les autres mini-applications doivent être activées explicitement après validation du profil.
ALTER TABLE "Teacher"
  ALTER COLUMN "offersFrenchSystem" SET DEFAULT false,
  ALTER COLUMN "offersProfessionalTraining" SET DEFAULT false;
