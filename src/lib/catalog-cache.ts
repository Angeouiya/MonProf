import { unstable_cache } from "next/cache";
import { db } from "@/lib/db";

const CATALOG_REVALIDATE_SECONDS = 300;

type TeacherSearchCatalog = {
  teacherCount: number;
  subjects: Array<{ id: string; name: string; slug: string; icon: string | null }>;
  levels: Array<{ id: string; name: string; slug: string; order: number }>;
  communes: Array<{ id: string; name: string; zone: string | null }>;
};

export const getCachedTeacherSearchCatalog = unstable_cache(
  async () => {
    const [catalog] = await db.$queryRaw<TeacherSearchCatalog[]>`
      SELECT
        (
          SELECT COUNT(*)::int
          FROM competence."Teacher"
          WHERE "status" = 'ACTIVE'
            AND "photoUrl" IS NOT NULL
            AND "photoUrl" <> ''
        ) AS "teacherCount",
        COALESCE(
          (
            SELECT jsonb_agg(
              jsonb_build_object('id', "id", 'name', "name", 'slug', "slug", 'icon', "icon")
              ORDER BY "name" ASC
            )
            FROM competence."Subject"
          ),
          '[]'::jsonb
        ) AS "subjects",
        COALESCE(
          (
            SELECT jsonb_agg(
              jsonb_build_object('id', "id", 'name', "name", 'slug', "slug", 'order', "order")
              ORDER BY "order" ASC
            )
            FROM competence."Level"
          ),
          '[]'::jsonb
        ) AS "levels",
        COALESCE(
          (
            SELECT jsonb_agg(
              jsonb_build_object('id', "id", 'name', "name", 'zone', "zone")
              ORDER BY "name" ASC
            )
            FROM competence."Commune"
          ),
          '[]'::jsonb
        ) AS "communes"
    `;
    return catalog ?? { teacherCount: 0, subjects: [], levels: [], communes: [] };
  },
  ["teacher-search-catalog-v1"],
  {
    revalidate: CATALOG_REVALIDATE_SECONDS,
    tags: ["catalog-subjects", "catalog-levels", "catalog-communes", "teachers"],
  },
);

export const getCachedSubjects = unstable_cache(
  async () =>
    db.subject.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, slug: true, icon: true },
    }),
  ["catalog-subjects-v1"],
  { revalidate: CATALOG_REVALIDATE_SECONDS, tags: ["catalog-subjects"] },
);

export const getCachedSubjectsWithTeacherCounts = unstable_cache(
  async () =>
    db.subject.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        slug: true,
        icon: true,
        _count: { select: { teachers: true } },
      },
    }),
  ["catalog-subjects-counts-v1"],
  { revalidate: CATALOG_REVALIDATE_SECONDS, tags: ["catalog-subjects"] },
);

export const getCachedLevels = unstable_cache(
  async () =>
    db.level.findMany({
      orderBy: { order: "asc" },
      select: { id: true, name: true, slug: true, order: true },
    }),
  ["catalog-levels-v1"],
  { revalidate: CATALOG_REVALIDATE_SECONDS, tags: ["catalog-levels"] },
);

export const getCachedLevelsWithTeacherCounts = unstable_cache(
  async () =>
    db.level.findMany({
      orderBy: { order: "asc" },
      select: {
        id: true,
        name: true,
        slug: true,
        order: true,
        _count: { select: { teachers: true } },
      },
    }),
  ["catalog-levels-counts-v1"],
  { revalidate: CATALOG_REVALIDATE_SECONDS, tags: ["catalog-levels"] },
);

export const getCachedCommunes = unstable_cache(
  async () =>
    db.commune.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, zone: true },
    }),
  ["catalog-communes-v1"],
  { revalidate: CATALOG_REVALIDATE_SECONDS, tags: ["catalog-communes"] },
);

export const getCachedCommunesWithTeacherCounts = unstable_cache(
  async () =>
    db.commune.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        zone: true,
        _count: { select: { teachers: true } },
      },
    }),
  ["catalog-communes-counts-v1"],
  { revalidate: CATALOG_REVALIDATE_SECONDS, tags: ["catalog-communes"] },
);
