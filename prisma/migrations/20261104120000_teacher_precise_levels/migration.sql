-- Additive: les niveaux et dossiers professeurs historiques restent intacts.
CREATE TABLE "TeacherPreciseLevel" (
    "teacherId" TEXT NOT NULL,
    "journey" TEXT NOT NULL,
    "className" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    CONSTRAINT "TeacherPreciseLevel_pkey" PRIMARY KEY ("teacherId", "journey", "className", "subjectId"),
    CONSTRAINT "TeacherPreciseLevel_journey_check" CHECK ("journey" IN ('ivoirien', 'francais'))
);

CREATE INDEX "TeacherPreciseLevel_journey_className_subjectId_teacherId_idx"
    ON "TeacherPreciseLevel"("journey", "className", "subjectId", "teacherId");
CREATE INDEX "TeacherPreciseLevel_subjectId_teacherId_idx"
    ON "TeacherPreciseLevel"("subjectId", "teacherId");

ALTER TABLE "TeacherPreciseLevel" ADD CONSTRAINT "TeacherPreciseLevel_teacherId_fkey"
    FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TeacherPreciseLevel" ADD CONSTRAINT "TeacherPreciseLevel_subjectId_fkey"
    FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Aucun accès public direct : seuls les traitements serveur autorisés utilisent
-- cette relation. Le propriétaire de la table (Prisma) conserve son accès SQL.
ALTER TABLE "TeacherPreciseLevel" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "TeacherPreciseLevel" FROM anon, authenticated;
GRANT ALL ON TABLE "TeacherPreciseLevel" TO service_role;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'competence_runtime') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON "TeacherPreciseLevel" TO competence_runtime;
    CREATE POLICY competence_server_only ON "TeacherPreciseLevel" TO competence_runtime USING (true) WITH CHECK (true);
  END IF;
END $$;
