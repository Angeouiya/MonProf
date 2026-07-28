import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  buildTeacherReplacementSessionSnapshots,
  calculateReplacementTransportTotal,
  getTeacherReplacementSessionBlocker,
  type ReplacementSessionInput,
} from "../src/lib/teacher-replacement-financials";

function session(overrides: Partial<ReplacementSessionInput> = {}): ReplacementSessionInput {
  return {
    id: overrides.id ?? "session-1",
    status: overrides.status ?? "PLANNED",
    completedAt: overrides.completedAt ?? null,
    clientValidatedAt: overrides.clientValidatedAt ?? null,
    releasedAt: overrides.releasedAt ?? null,
    paidAt: overrides.paidAt ?? null,
    releasedAmount: overrides.releasedAmount ?? 0,
    paidAmount: overrides.paidAmount ?? 0,
    retainedAmount: overrides.retainedAmount ?? 0,
    payoutStatuses: overrides.payoutStatuses ?? [],
  };
}

const transport = calculateReplacementTransportTotal(2_500, 4);
assert.deepEqual(transport, { transportFeePerSession: 2_500, transportFee: 10_000 });

const snapshots = buildTeacherReplacementSessionSnapshots({
  sessions: [
    session({ id: "s1" }),
    session({ id: "s2", status: "TEACHER_CONFIRMED" }),
    session({ id: "s3", status: "NEEDS_REPLACEMENT" }),
    session({ id: "s4", status: "REPLACEMENT_PROPOSED" }),
  ],
  expectedSessionsCount: 4,
  newTeacherId: "teacher-new",
  courseAmount: 40_000,
  commissionAmount: 6_000,
  teacherCourseAmount: 34_000,
  transportFee: transport.transportFee,
});

assert.equal(snapshots.length, 4);
assert.ok(snapshots.every((item) => item.teacherId === "teacher-new"));
assert.equal(snapshots.reduce((sum, item) => sum + item.courseAmount, 0), 40_000);
assert.equal(snapshots.reduce((sum, item) => sum + item.commissionAmount, 0), 6_000);
assert.equal(snapshots.reduce((sum, item) => sum + item.teacherCourseAmount, 0), 34_000);
assert.equal(snapshots.reduce((sum, item) => sum + item.transportFee, 0), 10_000);
assert.equal(snapshots.reduce((sum, item) => sum + item.teacherNetAmount, 0), 44_000);
assert.equal(snapshots[2]?.status, "PLANNED");
assert.equal(snapshots[3]?.status, "PLANNED");

assert.match(getTeacherReplacementSessionBlocker(session({ paidAmount: 1_000 })) ?? "", /versement/);
assert.match(getTeacherReplacementSessionBlocker(session({ releasedAmount: 8_500 })) ?? "", /libérée/);
assert.match(getTeacherReplacementSessionBlocker(session({ payoutStatuses: ["DRAFT"] })) ?? "", /retrait Jèko/);
assert.match(getTeacherReplacementSessionBlocker(session({ completedAt: new Date() })) ?? "", /effectuée/);
assert.throws(() => buildTeacherReplacementSessionSnapshots({
  sessions: [session()],
  expectedSessionsCount: 4,
  newTeacherId: "teacher-new",
  courseAmount: 40_000,
  commissionAmount: 6_000,
  teacherCourseAmount: 34_000,
  transportFee: 10_000,
}), /SESSION_COUNT_MISMATCH/);

const route = readFileSync("src/app/api/admin/bookings/[id]/route.ts", "utf8");
assert.match(route, /calculateReplacementTransportTotal\([\s\S]*booking\.sessionsCount/);
assert.match(route, /buildTeacherReplacementSessionSnapshots/);
assert.match(route, /tx\.bookingSession\.update/);
assert.match(route, /tx\.bookingSessionHistory\.createMany/);
assert.match(route, /payoutStatuses:\s*session\.payoutAllocations/);
assert.match(route, /isolationLevel:\s*"Serializable"/);

console.log("OK teacher replacement: transport pack, session snapshots, payout guards and atomic reassignment verified.");
