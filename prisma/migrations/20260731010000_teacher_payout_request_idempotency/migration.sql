-- Les demandes historiques restent valides avec une clé NULL. Toute nouvelle
-- demande issue du portail professeur reçoit une clé UUID unique afin qu'un
-- retry HTTP ne puisse pas réserver le solde une seconde fois.
ALTER TABLE "TeacherPayoutRequest"
ADD COLUMN "idempotencyKey" TEXT;

CREATE UNIQUE INDEX "TeacherPayoutRequest_idempotencyKey_key"
ON "TeacherPayoutRequest"("idempotencyKey");
