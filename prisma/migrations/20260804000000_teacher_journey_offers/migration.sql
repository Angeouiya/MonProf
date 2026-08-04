-- Un même professeur peut être publié dans une, deux ou trois mini-applications.
-- Les profils existants restent visibles partout jusqu'à leur prochaine validation admin.
ALTER TABLE "Teacher"
  ADD COLUMN "offersIvorianSystem" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "offersFrenchSystem" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "offersProfessionalTraining" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "Teacher"
  ADD CONSTRAINT "Teacher_at_least_one_journey_check"
  CHECK (
    "offersIvorianSystem"
    OR "offersFrenchSystem"
    OR "offersProfessionalTraining"
  );
