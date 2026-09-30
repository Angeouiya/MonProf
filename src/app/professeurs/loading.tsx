import { TeacherCardSkeleton } from "@/components/shared/teacher-card";
import { Skeleton } from "@/components/ui/skeleton";

export default function PublicTeachersLoading() {
  return (
    <main
      className="min-h-screen bg-white px-4 pb-28 pt-24 sm:px-6 sm:pb-12 lg:px-8"
      data-public-teachers-loading
      aria-busy="true"
      aria-live="polite"
    >
      <div className="mx-auto max-w-7xl">
        <span className="sr-only">Chargement des professeurs…</span>
        <section className="max-w-3xl" aria-hidden="true">
          <div className="grid grid-cols-3 gap-2 rounded-2xl border border-[#DDE6F7] bg-white p-2">
            <Skeleton className="h-14 rounded-xl" />
            <Skeleton className="h-14 rounded-xl" />
            <Skeleton className="h-14 rounded-xl" />
          </div>
          <div className="mt-5 rounded-[1.6rem] border border-[#DDE6F7] bg-[#F8FAFF] p-4">
            <Skeleton className="h-7 w-52 rounded-full" />
            <Skeleton className="mt-3 h-4 w-full max-w-xl rounded-full" />
            <Skeleton className="mt-2 h-4 w-3/4 max-w-md rounded-full" />
          </div>
        </section>

        <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-hidden="true">
          {Array.from({ length: 6 }, (_, index) => (
            <TeacherCardSkeleton key={index} />
          ))}
        </section>
      </div>
    </main>
  );
}
