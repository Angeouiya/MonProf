import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

const statements = [
  `
    CREATE OR REPLACE FUNCTION competence.enqueue_web_push_notification()
    RETURNS trigger
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = competence, public
    AS $$
    BEGIN
      IF NEW."recipientType" = 'CLIENT' AND COALESCE(NEW."userId", NEW."clientId") IS NOT NULL THEN
        INSERT INTO competence."WebPushOutbox" (
          "id", "notificationId", "recipientType", "targetUserId", "title", "message",
          "link", "priority", "status", "nextAttemptAt", "createdAt", "updatedAt"
        ) VALUES (
          gen_random_uuid(), NEW."id", 'CLIENT', COALESCE(NEW."userId", NEW."clientId"), NEW."title", NEW."message",
          NEW."link", NEW."priority", 'PENDING', NOW(), NOW(), NOW()
        ) ON CONFLICT ("notificationId") DO NOTHING;
      ELSIF NEW."recipientType" = 'ADMIN' THEN
        INSERT INTO competence."WebPushOutbox" (
          "id", "notificationId", "recipientType", "targetUserId", "title", "message",
          "link", "priority", "status", "nextAttemptAt", "createdAt", "updatedAt"
        ) VALUES (
          gen_random_uuid(), NEW."id", 'ADMIN', NEW."userId", NEW."title", NEW."message",
          NEW."link", NEW."priority", 'PENDING', NOW(), NOW(), NOW()
        ) ON CONFLICT ("notificationId") DO NOTHING;
      END IF;
      RETURN NEW;
    END;
    $$
  `,
  `DROP TRIGGER IF EXISTS notification_web_push_outbox ON competence."Notification"`,
  `
    CREATE TRIGGER notification_web_push_outbox
    AFTER INSERT ON competence."Notification"
    FOR EACH ROW EXECUTE FUNCTION competence.enqueue_web_push_notification()
  `,
  `
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
        '/professeur/notifications', 'IMPORTANT', 'PENDING', NOW(), NOW(), NOW()
      ) ON CONFLICT ("teacherNotificationId") DO NOTHING;
      RETURN NEW;
    END;
    $$
  `,
  `DROP TRIGGER IF EXISTS teacher_notification_web_push_outbox ON competence."TeacherNotification"`,
  `
    CREATE TRIGGER teacher_notification_web_push_outbox
    AFTER INSERT ON competence."TeacherNotification"
    FOR EACH ROW EXECUTE FUNCTION competence.enqueue_teacher_web_push_notification()
  `,
];

try {
  for (const statement of statements) {
    await db.$executeRawUnsafe(statement);
  }

  const installed = await db.$queryRaw`
    SELECT trigger_name
    FROM information_schema.triggers
    WHERE event_object_schema = 'competence'
      AND trigger_name IN (
        'notification_web_push_outbox',
        'teacher_notification_web_push_outbox'
      )
    ORDER BY trigger_name
  `;

  if (installed.length !== 2) {
    throw new Error(`Installation incomplète : ${installed.length}/2 déclencheur(s).`);
  }

  console.log("Web Push outbox : 2 déclencheurs PostgreSQL installés.");
} finally {
  await db.$disconnect();
}
