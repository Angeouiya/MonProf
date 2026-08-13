ALTER TABLE competence."Notification"
  ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);

ALTER TABLE competence."CommunicationCampaign"
  ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "dispatchPhase" TEXT,
  ADD COLUMN IF NOT EXISTS "dispatchCursor" TEXT,
  ADD COLUMN IF NOT EXISTS "lastDispatchAt" TIMESTAMP(3);

ALTER TABLE competence."TeacherNotification"
  ADD COLUMN IF NOT EXISTS "expiresAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "Notification_expiresAt_idx"
  ON competence."Notification"("expiresAt");

CREATE INDEX IF NOT EXISTS "Notification_deletedAt_idx"
  ON competence."Notification"("deletedAt");

CREATE INDEX IF NOT EXISTS "CommunicationCampaign_expiresAt_idx"
  ON competence."CommunicationCampaign"("expiresAt");

CREATE INDEX IF NOT EXISTS "CommunicationCampaign_deletedAt_idx"
  ON competence."CommunicationCampaign"("deletedAt");

CREATE INDEX IF NOT EXISTS "CommunicationCampaign_status_lastDispatchAt_idx"
  ON competence."CommunicationCampaign"("status", "lastDispatchAt");

CREATE INDEX IF NOT EXISTS "TeacherNotification_expiresAt_idx"
  ON competence."TeacherNotification"("expiresAt");

CREATE INDEX IF NOT EXISTS "TeacherNotification_deletedAt_idx"
  ON competence."TeacherNotification"("deletedAt");

CREATE UNIQUE INDEX IF NOT EXISTS "Notification_campaign_client_unique"
  ON competence."Notification"("campaignId", "userId", "recipientType")
  WHERE "campaignId" IS NOT NULL
    AND "userId" IS NOT NULL
    AND "recipientType" = 'CLIENT';

CREATE UNIQUE INDEX IF NOT EXISTS "TeacherNotification_campaign_teacher_unique"
  ON competence."TeacherNotification"("campaignId", "teacherId")
  WHERE "campaignId" IS NOT NULL;
