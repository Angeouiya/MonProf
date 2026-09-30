import { Skeleton } from "@/components/ui/skeleton";

export default function PublicTeacherProfileLoading() {
  return (
    <main
      className="min-h-screen bg-white px-4 pb-24 pt-24 sm:px-6 lg:px-8"
      data-public-teacher-profile-loading
      aria-busy="true"
      aria-live="polite"
    >
      <span className="sr-only">Chargement du profil professeur…</span>
      <div className="mx-auto max-w-6xl" aria-hidden="true">
        <Skeleton className="aspect-[3/1] w-full rounded-[1.6rem]" />
        <div className="-mt-10 grid gap-4 px-4 md:grid-cols-[180px_minmax(0,1fr)] md:px-8">
          <Skeleton className="h-36 w-36 rounded-full border-4 border-white" />
          <div className="space-y-3 pt-12">
            <Skeleton className="h-7 w-64 max-w-full rounded-full" />
            <Skeleton className="h-4 w-44 max-w-full rounded-full" />
            <Skeleton className="h-4 w-72 max-w-full rounded-full" />
          </div>
        </div>
      </div>
    </main>
  );
}
