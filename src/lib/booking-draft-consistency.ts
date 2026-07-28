/**
 * Une clé d'idempotence ne peut réutiliser un brouillon que si la demande est
 * strictement identique. Le montant total seul ne suffit pas : deux trajets,
 * programmes ou répartitions financières peuvent produire le même total.
 */
export function bookingDraftMatchesExpected(
  existing: object,
  expected: object,
) {
  const existingFields = existing as Record<string, unknown>;
  return Object.entries(expected as Record<string, unknown>).every(([field, expectedValue]) => (
    comparableValue(existingFields[field]) === comparableValue(expectedValue)
  ));
}

function comparableValue(value: unknown) {
  return JSON.stringify(normalizeComparableValue(value));
}

function normalizeComparableValue(value: unknown): unknown {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return { date: value.toISOString() };
  if (Array.isArray(value)) return value.map(normalizeComparableValue);
  if (typeof value !== "object") return value;

  const record = value as Record<string, unknown>;
  return Object.fromEntries(
    Object.keys(record)
      .sort()
      .map((key) => [key, normalizeComparableValue(record[key])]),
  );
}
