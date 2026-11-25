import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";

export async function verifySqlHardening({
  client,
  db,
  teacher,
  oldClient,
  check,
}) {
  assert.equal(new URL(process.env.DIRECT_URL).hostname, "127.0.0.1");
  execFileSync(process.execPath, ["scripts/install-web-push-outbox.mjs"], {
    env: process.env,
    windowsHide: true,
    stdio: "pipe",
  });
  const { rows } = await client.query(`
    SELECT p.proname AS name,p.proconfig AS config,
      has_function_privilege('anon',p.oid,'EXECUTE') AS anonymous_access,
      has_function_privilege('authenticated',p.oid,'EXECUTE') AS browser_access,
      has_function_privilege('competence_runtime',p.oid,'EXECUTE') AS server_access
    FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='competence' AND p.proname IN (
      'managed_accounting_append_only','managed_commission_snapshot_immutable',
      'enqueue_web_push_notification','enqueue_teacher_web_push_notification',
      'managed_partner_budget_guard','managed_partner_snapshot_guard','managed_parent_confirmation_guard'
    )`);
  assert.equal(rows.length, 7);
  for (const row of rows) {
    assert.equal(row.anonymous_access, false, row.name);
    assert.equal(row.browser_access, false, row.name);
    assert.equal(row.server_access, true, row.name);
    assert.deepEqual(
      row.config,
      ["search_path=pg_catalog, competence"],
      row.name,
    );
  }
  for (const role of ["anon", "authenticated"]) {
    await client.query(`SET ROLE ${role}`);
    try {
      await assert.rejects(
        client.query("SELECT competence.enqueue_web_push_notification()"),
        (error) => error.code === "42501",
      );
      await assert.rejects(
        client.query(
          "SELECT competence.enqueue_teacher_web_push_notification()",
        ),
        (error) => error.code === "42501",
      );
    } finally {
      await client.query("RESET ROLE");
    }
  }
  const nonce = randomUUID();
  const parent = await db.notification.create({
    data: {
      userId: oldClient.id,
      clientId: oldClient.id,
      recipientType: "CLIENT",
      title: `Local security QA ${nonce}`,
      type: "SECURITY_QA",
      message: "Synthetic isolated trigger verification",
      link: "/client/accompagnement",
    },
  });
  const professor = await db.teacherNotification.create({
    data: {
      teacherId: teacher.id,
      title: `Local security QA ${nonce}`,
      message: "Synthetic isolated teacher trigger verification",
      channel: "INTERNAL",
      link: "/professeur/accompagnement",
    },
  });
  assert.equal(
    await db.webPushOutbox.count({ where: { notificationId: parent.id } }),
    1,
  );
  const queued = await db.webPushOutbox.findUniqueOrThrow({
    where: { teacherNotificationId: professor.id },
  });
  assert.equal(queued.link, "/professeur/accompagnement");
  check(
    "Seven internal SQL functions have fixed search paths and no browser EXECUTE; client and teacher notification triggers still enqueue once",
  );
}
