import { unstable_cache } from "next/cache";
import { db } from "@/lib/db";

const CATALOG_REVALIDATE_SECONDS = 300;

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
