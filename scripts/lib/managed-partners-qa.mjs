import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
export async function verifyManagedPartners({
  db,
  jiti,
  service,
  teacher,
  input,
  futureDate,
  check,
}) {
  const partners = await jiti.import("../src/lib/managed-partners.ts");
  const parent = await jiti.import("../src/lib/managed-parent-confirmation.ts");
  const view = await jiti.import("../src/lib/managed-teacher-view.ts");
  const admin = await db.user.create({
    data: {
      name: "Partner QA admin",
      email: `partner-admin-${randomUUID()}@example.invalid`,
      passwordHash: "local-non-login",
      role: "ADMIN",
    },
  });
  const client = await db.user.create({
    data: {
      name: "Managed QA parent",
      email: `managed-parent-${randomUUID()}@example.invalid`,
      passwordHash: await bcrypt.hash("QaManaged2026!LocalOnly", 10),
    },
  });
  const partner = await partners.createManagedPartner(
    { name: "QA partner", phone: "0700000081" },
    admin.id,
  );
  await assert.rejects(
    partners.createManagedPartner(
      { name: "Same number", phone: "+2250700000081" },
      admin.id,
    ),
  );
  const request = {
    ...input(70, "0700000082"),
    sessions: [70, 71, 72].map((n) => ({ date: futureDate(n), time: "10:00" })),
    quotedTotal: 37500,
  };
  const dossier = await service.createManagedDossier(
    request,
    undefined,
    client.id,
  );
  await service.reviseManagedPrice(
    dossier.id,
    90000,
    "QA parent negotiated the total",
    admin.id,
    true,
  );
  let stored = await db.managedCourseDossier.findUniqueOrThrow({
    where: { id: dossier.id },
  });
  assert.equal(stored.initialTotalPrice, 37500);
  assert.equal(stored.totalPrice, 90000);
  const access = await service.createManagedContractLink(dossier.id, admin.id);
  const token = access.path.split("#")[1];
  await service.managedContract(token, 2);
  await partners.setManagedDossierPartner(dossier.id, partner.id, 10, admin.id);
  await assert.rejects(
    service.offerManagedDossier(dossier.id, teacher.id, 5, admin.id),
    /dépassent/,
  );
  const offer = await service.offerManagedDossier(
    dossier.id,
    teacher.id,
    20,
    admin.id,
  );
  await service.respondManagedOffer(offer.id, teacher.id, true, "");
  await assert.rejects(
    partners.setManagedDossierPartner(dossier.id, null, 0, admin.id),
    /avant/,
  );
  stored = await db.managedCourseDossier.findUniqueOrThrow({
    where: { id: dossier.id },
    include: { sessions: { orderBy: { sequence: "asc" } } },
  });
  assert.equal(
    stored.sessions.reduce((sum, s) => sum + s.amount, 0),
    90000,
  );
  const raw = await db.managedCourseOffer.findUniqueOrThrow({
    where: { id: offer.id },
    include: { dossier: true, sessions: true },
  });
  const teacherView = view.managedTeacherOfferView(raw);
  assert.equal(teacherView.remuneration, 72000);
  assert.doesNotMatch(
    JSON.stringify(teacherView),
    /commission|partner|totalPrice|initialTotalPrice|90000/,
  );
  assert.equal(teacherView.dossier.phone, "+2250700000082");
  assert.doesNotMatch(
    JSON.stringify(await service.managedContract(token)),
    /partnerId|partnerRateBps|commissionRateBps|initialTotalPrice/,
  );
  check(
    "Negotiated total preserves original quote; internal partner budget is locked and professor only sees 72,000 net on a 90,000 order",
  );
  const session = stored.sessions[0];
  await assert.rejects(
    parent.confirmManagedParentSession(
      { clientId: "other-client", dossierId: dossier.id },
      session.id,
    ),
    /introuvable/,
  );
  await assert.rejects(
    parent.confirmManagedParentSession(
      { clientId: client.id, dossierId: dossier.id },
      session.id,
    ),
    /déclarer/,
  );
  for (const [i, s] of stored.sessions.entries()) {
    await db.managedCourseSession.update({
      where: { id: s.id },
      data: { scheduledDate: new Date(`${futureDate(-3 + i)}T00:00:00Z`) },
    });
    await service.completeManagedSession(dossier.id, s.id, teacher.id, false);
  }
  const creditsBefore = await db.managedTeacherLedgerEntry.count({
    where: { sessionId: session.id },
  });
  await parent.confirmManagedParentSession(
    { clientId: client.id, dossierId: dossier.id },
    session.id,
  );
  await parent.confirmManagedParentSession({ token }, session.id);
  assert.equal(
    await db.managedCourseEvent.count({
      where: { dossierId: dossier.id, action: "PARENT_SESSION_CONFIRMED" },
    }),
    1,
  );
  assert.equal(
    await db.managedTeacherLedgerEntry.count({
      where: { sessionId: session.id },
    }),
    creditsBefore,
  );
  assert.equal(
    (await partners.managedPartnerBalance(db, partner.id)).earned,
    0,
  );
  for (const s of stored.sessions)
    await service.completeManagedSession(dossier.id, s.id, admin.id, true);
  const receipt = {
    action: "RECEIPT",
    amount: 90000,
    method: "WAVE",
    reference: `QA-PARTNER-${randomUUID()}`,
    idempotencyKey: randomUUID(),
    receivedAt: new Date().toISOString(),
  };
  await service.recordManagedReceipt(dossier.id, receipt, admin.id);
  assert.equal(
    (await partners.managedPartnerBalance(db, partner.id)).earned,
    9000,
  );
  assert.equal(
    (
      await db.managedCourseSession.aggregate({
        where: { dossierId: dossier.id },
        _sum: { creditedTeacherAmount: true },
      })
    )._sum.creditedTeacherAmount,
    72000,
  );
  check(
    "Parent confirmation is owner-scoped, idempotent and non-financial; real receipts plus validated sessions earn exact teacher and partner amounts",
  );
  const pay = (reference) => ({
    amount: 6000,
    method: "WAVE",
    reference,
    note: "QA manual payment was verified",
    idempotencyKey: randomUUID(),
  });
  const attempts = [
    pay(`QA-PAY-${randomUUID()}`),
    pay(`QA-PAY-${randomUUID()}`),
  ];
  const results = await Promise.allSettled(
    attempts.map((p) =>
      partners.recordManagedPartnerPayment(partner.id, p, admin.id),
    ),
  );
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
  const won = attempts[results.findIndex((r) => r.status === "fulfilled")];
  await partners.recordManagedPartnerPayment(partner.id, won, admin.id);
  assert.equal(
    (await partners.managedPartnerBalance(db, partner.id)).available,
    3000,
  );
  const receiptRecord = await db.managedParentReceipt.findUniqueOrThrow({
    where: { idempotencyKey: receipt.idempotencyKey },
  });
  const correction = {
    method: "WAVE",
    reference: `QA-CORR-${randomUUID()}`,
    note: "QA collection correction after reconciliation",
    idempotencyKey: randomUUID(),
  };
  await assert.rejects(
    service.reverseManagedReceipt(
      dossier.id,
      receiptRecord.id,
      correction,
      admin.id,
    ),
    /partenaire.*réglé/i,
  );
  const payment = await db.managedPartnerPayment.findFirstOrThrow({
    where: { partnerId: partner.id, kind: "PAYMENT" },
  });
  await assert.rejects(
    db.managedPartnerPayment.update({
      where: { id: payment.id },
      data: { amountDelta: -1 },
    }),
    /append-only|permission denied/,
  );
  await partners.reverseManagedPartnerPayment(
    partner.id,
    payment.id,
    "QA payment correction verified",
    admin.id,
  );
  await partners.reverseManagedPartnerPayment(
    partner.id,
    payment.id,
    "QA payment correction replay",
    admin.id,
  );
  await service.reverseManagedReceipt(
    dossier.id,
    receiptRecord.id,
    correction,
    admin.id,
  );
  assert.equal(
    (await partners.managedPartnerBalance(db, partner.id)).remaining,
    0,
  );
  check(
    "Concurrent partner payouts cannot overdraw; replay is safe, paid receipt reversal is blocked and immutable compensations restore exact balances",
  );
  const anonymous = await service.createManagedDossier(input(78, "0700000083"));
  const anonymousToken = anonymous.path.split("#")[1];
  await parent.linkManagedParentAccount(anonymousToken, client.id);
  await assert.rejects(
    parent.linkManagedParentAccount(anonymousToken, admin.id),
    /client/,
  );
  const other = await db.user.create({
    data: {
      name: "Other parent",
      email: `other-${randomUUID()}@example.invalid`,
      passwordHash: "local-non-login",
    },
  });
  await assert.rejects(
    parent.linkManagedParentAccount(anonymousToken, other.id),
    /déjà rattaché/,
  );
  const odd = await service.createManagedDossier({
    ...request,
    clientKey: randomUUID(),
    sessions: [80, 81, 82].map((n) => ({ date: futureDate(n), time: "10:00" })),
  });
  await service.reviseManagedPrice(
    odd.id,
    90001,
    "QA uneven negotiated total allocation",
    admin.id,
    true,
  );
  const oddStored = await db.managedCourseDossier.findUniqueOrThrow({
    where: { id: odd.id },
    include: { sessions: true },
  });
  assert.equal(
    oddStored.sessions.reduce((sum, s) => sum + s.amount, 0),
    90001,
  );
  assert.equal(oddStored.initialTotalPrice, 37500);
  const freeLink = await service.createManagedContractLink(odd.id, admin.id);
  await service.managedContract(freeLink.path.split("#")[1], 2);
  assert.ok(
    (await service.offerManagedDossier(odd.id, teacher.id, 40.25, admin.id)).id,
  );
  check(
    "Private-link account binding cannot be stolen; uneven negotiated totals conserve every franc and freely selected rates are accepted",
  );
  await service.recordManagedReceipt(
    dossier.id,
    {
      ...receipt,
      reference: `QA-RECOLLECT-${randomUUID()}`,
      idempotencyKey: randomUUID(),
    },
    admin.id,
  );
  assert.equal(
    (await partners.managedPartnerBalance(db, partner.id)).available,
    9000,
  );
  const pendingOffer = await service.offerManagedDossier(
    anonymous.id,
    teacher.id,
    20,
    admin.id,
  );
  await service.respondManagedOffer(pendingOffer.id, teacher.id, true, "");
  const pendingSession = await db.managedCourseSession.findFirstOrThrow({
    where: { dossierId: anonymous.id },
  });
  await db.managedCourseSession.update({
    where: { id: pendingSession.id },
    data: { scheduledDate: new Date(`${futureDate(-1)}T00:00:00Z`) },
  });
  await service.completeManagedSession(
    anonymous.id,
    pendingSession.id,
    teacher.id,
    false,
  );
  return {
    managedParentEmail: client.email,
    partnerId: partner.id,
    managedParentDossierId: anonymous.id,
  };
}
