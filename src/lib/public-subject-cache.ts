export type PublicSubject = { id: string; name: string };
const KEY =
  "https://www.competence.ci/__competence_public_catalog/managed-subjects-v1";
const LIMIT = 256;

function publicRows(value: unknown): PublicSubject[] | null {
  if (!Array.isArray(value) || value.length > LIMIT) return null;
  if (
    !value.every(
      (row) =>
        row &&
        typeof row.id === "string" &&
        typeof row.name === "string" &&
        row.id.length <= 100 &&
        row.name.length <= 200,
    )
  )
    return null;
  // Never cache model spreads or anything belonging to a client/professor.
  return value.map(({ id, name }) => ({ id, name }));
}

export async function readPublicSubjectCatalog(
  load: () => Promise<PublicSubject[]>,
  cache?: Pick<Cache, "match" | "put">,
  waitUntil?: (task: Promise<unknown>) => void,
  scope = "production",
): Promise<PublicSubject[]> {
  const key = new Request(`${KEY}/${encodeURIComponent(scope)}`);
  if (cache) {
    try {
      const hit = await cache.match(key);
      if (hit) {
        const rows = publicRows(await hit.json());
        if (rows) return rows;
      }
    } catch {
      /* A cache outage must not hide the authoritative catalogue. */
    }
  }
  const rows = publicRows(await load());
  if (!rows) throw new Error("Catalogue public invalide.");
  if (cache) {
    const write = cache
      .put(
        key,
        Response.json(rows, {
          headers: {
            "Cache-Control": "public, max-age=60",
            "Cache-Tag": "catalog-subjects",
          },
        }),
      )
      .catch(() => undefined);
    if (waitUntil) waitUntil(write);
    else await write;
  }
  return rows;
}
