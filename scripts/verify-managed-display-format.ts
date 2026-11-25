import assert from "node:assert/strict";
import { managedMoney, managedSessionDate, managedScheduleDate, managedDueDate } from "../src/lib/managed-display-format";

for (const value of [0, 1, -100, 12_500, 1_234_567, 12.5, 0.125, NaN, Infinity]) {
  assert.equal(managedMoney(value), `${value.toLocaleString("fr-FR")} F CFA`);
}
for (const date of ["2024-02-29T00:00:00Z", "2027-01-01T23:59:59Z", "2026-12-31T23:59:59-05:00", "2000-01-01T00:00:00+09:00", "invalid"]) {
  const value = new Date(date);
  assert.equal(managedSessionDate(value), value.toLocaleDateString("fr-FR", { timeZone: "Africa/Abidjan" }));
}
for (const date of ["2024-02-29", "2027-01-01", "2026-12-31"]) {
  const value = new Date(`${date}T00:00:00Z`);
  assert.equal(managedScheduleDate(date), new Intl.DateTimeFormat("fr-FR", { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(value));
  assert.equal(managedDueDate(date), new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(value));
}
console.log("OK reusable ICU formatters preserve amounts, accents, timezone and date output; no user-value cache");
