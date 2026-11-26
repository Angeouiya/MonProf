import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

export async function verifyManagedClientRead({ db, client, jiti, check }) {
  const { getManagedClientCourses } = await jiti.import("../src/lib/managed-client-courses.ts");
  const select = { id: true, reference: true, subjectName: true, className: true, totalPrice: true,
    cancelledAmount: true, receivedAmount: true, onHold: true, sessions: {
      orderBy: { sequence: "asc" }, select: { id: true, sequence: true, scheduledDate: true,
        scheduledTime: true, status: true, parentConfirmedAt: true, teacher: { select: { fullName: true, phone: true } } },
    } };
  const canonical = (clientId, cursor) => db.managedCourseDossier.findMany({
    where: { clientId, ...(cursor ? { OR: [{ createdAt: { lt: cursor.createdAt } }, { createdAt: cursor.createdAt, id: { lt: cursor.id } }] } : {}) },
    select, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 21,
  });
  const owners = await db.managedCourseDossier.findMany({ where: { clientId: { not: null } }, select: { clientId: true }, distinct: ["clientId"] });
  assert.ok(owners.length);
  for (const { clientId } of owners) assert.deepEqual(await getManagedClientCourses(clientId), await canonical(clientId), "Existing private projection, dates, money and assigned contacts must be unchanged");

  const ids = [];
  for (const label of ["a", "b"]) {
    const user = await db.user.create({ data: { name: `Read-only QA ${label}`, email: `read-${randomUUID()}@example.invalid`, passwordHash: "not-a-login" } });
    ids.push(user.id);
    await client.query(`WITH template AS (SELECT * FROM competence."ManagedCourseDossier" ORDER BY id LIMIT 1)
      INSERT INTO competence."ManagedCourseDossier" SELECT (jsonb_populate_record(NULL::competence."ManagedCourseDossier",to_jsonb(t)||jsonb_build_object(
        'id','qa-read-'||$2::text||'-'||lpad(i::text,2,'0'),'reference','QA-READ-'||$2::text||'-'||i,'clientKey','qa-read-key-'||$2::text||'-'||i,
        'clientId',$1::text,'partnerId',NULL,'partnerRateBps',0,'contractTokenHash',NULL,'contractTokenExpiresAt',NULL,
        'receivedAmount',0,'cancelledAmount',0,'onHold',false,'createdAt','2028-01-01T00:00:00.000Z'
      ))).* FROM template t CROSS JOIN generate_series(0,23) i`, [user.id, label]);
  }
  const first = await getManagedClientCourses(ids[0]);
  assert.equal(first.length, 21);
  assert.ok(first.every(row => row.reference.startsWith("QA-READ-a-") && row.sessions.length === 0));
  const cursor = await db.managedCourseDossier.findUniqueOrThrow({ where: { id: first[19].id }, select: { id: true, createdAt: true } });
  const second = await getManagedClientCourses(ids[0], cursor.id);
  assert.deepEqual(second, await canonical(ids[0], cursor));
  assert.equal(second.length, 4);
  assert.equal(new Set([...first.slice(0, 20), ...second].map(row => row.id)).size, 24, "Equal-timestamp keyset pages must be exhaustive and disjoint");
  const foreign = (await getManagedClientCourses(ids[1]))[0].id;
  assert.deepEqual(await getManagedClientCourses(ids[0], foreign), first, "A foreign cursor must not scope another client's data");
  assert.deepEqual(await getManagedClientCourses(ids[0], "' OR TRUE --"), first);
  assert.deepEqual(await getManagedClientCourses("' OR TRUE --"), []);
  assert.deepEqual(await getManagedClientCourses(""), []);
  check("Private joined read equals the previous ORM projection; owner isolation, parameter binding, empty sessions and equal-timestamp keyset pagination verified");
}
