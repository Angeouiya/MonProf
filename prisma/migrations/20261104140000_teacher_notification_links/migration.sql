-- Keep legacy teacher notifications intact. A V2 mission notification may
-- deep-link to its mission instead of always opening the generic inbox.
ALTER TABLE competence."TeacherNotification"
  ADD COLUMN IF NOT EXISTS "link" TEXT;

CREATE OR REPLACE FUNCTION competence.enqueue_teacher_web_push_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = competence, public
AS $$
BEGIN
  INSERT INTO competence."WebPushOutbox" (
    "id", "teacherNotificationId", "recipientType", "targetTeacherId", "title", "message",
    "link", "priority", "status", "nextAttemptAt", "createdAt", "updatedAt"
  ) VALUES (
    gen_random_uuid(), NEW."id", 'TEACHER', NEW."teacherId", NEW."title", NEW."message",
    CASE
      WHEN NEW."link" LIKE '/professeur/%'
        AND POSITION('//' IN NEW."link") = 0
        AND POSITION(CHR(92) IN NEW."link") = 0
      THEN NEW."link"
      ELSE '/professeur/notifications'
    END,
    'IMPORTANT', 'PENDING', NOW(), NOW(), NOW()
  ) ON CONFLICT ("teacherNotificationId") DO NOTHING;
  RETURN NEW;
END;
$$;
