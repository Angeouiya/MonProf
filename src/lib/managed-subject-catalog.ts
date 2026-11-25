import "server-only";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { unstable_cache } from "next/cache";
import { db } from "@/lib/db";
import { managedSchoolSubjectWhere } from "@/lib/managed-school-subjects";
import { readPublicSubjectCatalog } from "@/lib/public-subject-cache";

const load = () =>
  db.subject.findMany({
    where: managedSchoolSubjectWhere,
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
const cachedNodeLoad = unstable_cache(load, ["managed-public-subjects-v1"], {
  revalidate: 60,
  tags: ["catalog-subjects"],
});

export async function getManagedPublicSubjects() {
  let waitUntil: ((task: Promise<unknown>) => void) | undefined;
  let scope = "production";
  try {
    const context = getCloudflareContext();
    const execution = context.ctx as {
      waitUntil(task: Promise<unknown>): void;
    };
    if (typeof execution?.waitUntil === "function")
      waitUntil = (task) => execution.waitUntil(task);
    scope = String(
      (context.env as unknown as { APP_DEPLOYMENT_ENV?: string })
        .APP_DEPLOYMENT_ENV || "production",
    );
  } catch {
    /* Node / isolated QA. */
  }
  const edge =
    typeof caches !== "undefined"
      ? (caches as CacheStorage & { default?: Cache }).default
      : undefined;
  return readPublicSubjectCatalog(
    waitUntil && edge ? load : cachedNodeLoad,
    waitUntil ? edge : undefined,
    waitUntil,
    scope,
  );
}
