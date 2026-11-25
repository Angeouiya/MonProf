import { PrismaClient } from "@prisma/client";

const ddlDatabaseUrl =
  process.env.DIRECT_URL?.trim() || process.env.DATABASE_URL?.trim();
if (!ddlDatabaseUrl) {
  throw new Error(
    "DIRECT_URL or DATABASE_URL is required to install the Web Push outbox.",
  );
}

// Creating functions and triggers requires the migration role. Production keeps
// DATABASE_URL on the least-privilege runtime role, so prefer DIRECT_URL here.
const db = new PrismaClient({ datasourceUrl: ddlDatabaseUrl });

const statements = [
  `
    CREATE OR REPLACE FUNCTION competence.enqueue_web_push_notification()
    RETURNS trigger
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = pg_catalog, competence
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
    SET search_path = pg_catalog, competence
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
    $$
  `,
  `DROP TRIGGER IF EXISTS teacher_notification_web_push_outbox ON competence."TeacherNotification"`,
  `
    CREATE TRIGGER teacher_notification_web_push_outbox
    AFTER INSERT ON competence."TeacherNotification"
    FOR EACH ROW EXECUTE FUNCTION competence.enqueue_teacher_web_push_notification()
  `,
  `DO $hardening$
   DECLARE fn text; role_name text;
   BEGIN
     FOREACH fn IN ARRAY ARRAY['enqueue_web_push_notification', 'enqueue_teacher_web_push_notification'] LOOP
       EXECUTE format('REVOKE EXECUTE ON FUNCTION competence.%I() FROM PUBLIC', fn);
       FOREACH role_name IN ARRAY ARRAY['anon', 'authenticated'] LOOP
         IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = role_name) THEN
           EXECUTE format('REVOKE EXECUTE ON FUNCTION competence.%I() FROM %I', fn, role_name);
         END IF;
       END LOOP;
       FOREACH role_name IN ARRAY ARRAY['competence_runtime', 'competence_app', 'service_role'] LOOP
         IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = role_name) THEN
           EXECUTE format('GRANT EXECUTE ON FUNCTION competence.%I() TO %I', fn, role_name);
         END IF;
       END LOOP;
     END LOOP;
   END;
   $hardening$`,
];

try {
  await db.$transaction(
    async (tx) => {
      for (const statement of statements) await tx.$executeRawUnsafe(statement);
    },
    { timeout: 30_000 },
  );

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
    throw new Error(
      `Installation incomplète : ${installed.length}/2 déclencheur(s).`,
    );
  }

  console.log("Web Push outbox : 2 déclencheurs PostgreSQL installés.");
} finally {
  await db.$disconnect();
}
