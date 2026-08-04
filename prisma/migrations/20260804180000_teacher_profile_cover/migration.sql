-- Les couvertures peuvent pointer vers le catalogue public ou vers un média
-- optimisé et persistant servi par /api/teacher-photos/:id.
ALTER TABLE "Teacher" ADD COLUMN "coverUrl" TEXT;
ALTER TABLE "Teacher" ADD COLUMN "pendingCoverUrl" TEXT;
