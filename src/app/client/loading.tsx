import { Skeleton } from "@/components/ui/skeleton";

export default function ClientLoading() {
  return (
    <div className="space-y-5" aria-label="Chargement de l'espace client" aria-live="polite">
      <section
        data-client-loading-header
        className="rounded-lg border-b border-[#E6EAF3] bg-white pb-3"
      >
        <div className="mb-2 flex min-h-8 items-center gap-2">
          <Skeleton className="h-10 w-24 bg-white ring-1 ring-[#DDE6F7]" />
          <Skeleton className="h-5 w-28 bg-[#E6EAF3]" />
        </div>
        <Skeleton className="h-8 w-4/5 max-w-xl bg-[#E6EAF3]" />
        <Skeleton className="mt-2 h-4 w-full max-w-2xl bg-[#E6EAF3]" />
      </section>

      <section data-client-loading-rail className="grid grid-cols-2 gap-2 min-[720px]:grid-cols-4">
        {[0, 1, 2, 3].map((item) => (
          <div key={item} className="min-h-20 rounded-lg border border-[#E3E8F2] bg-white p-3">
            <Skeleton className="h-3 w-20 bg-[#E6EAF3]" />
            <Skeleton className="mt-3 h-5 w-24 bg-[#E6EAF3]" />
          </div>
        ))}
      </section>

      <section className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="rounded-lg border border-[#E3E8F2] bg-white p-4">
          <div className="flex items-start gap-3">
            <Skeleton className="h-11 w-11 shrink-0 bg-[#111B4D]" />
            <div className="min-w-0 flex-1">
              <Skeleton className="h-4 w-32 bg-[#E6EAF3]" />
              <Skeleton className="mt-3 h-7 w-4/5 bg-[#E6EAF3]" />
              <Skeleton className="mt-3 h-4 w-full bg-[#E6EAF3]" />
            </div>
          </div>
          <div className="mt-5 grid gap-2 min-[520px]:grid-cols-3">
            {[0, 1, 2].map((item) => (
              <Skeleton key={item} className="h-16 bg-white ring-1 ring-[#E3E8F2]" />
            ))}
          </div>
        </div>

        <aside className="rounded-lg border border-[#E3E8F2] bg-white p-4">
          <Skeleton className="h-4 w-28 bg-[#E6EAF3]" />
          <Skeleton className="mt-4 h-24 bg-white ring-1 ring-[#E3E8F2]" />
          <Skeleton className="mt-4 h-11 bg-[#111B4D]" />
        </aside>
      </section>

      <section className="grid gap-3">
        {[0, 1].map((item) => (
          <div key={item} className="rounded-lg border border-[#E3E8F2] bg-white p-4">
            <div className="flex items-start gap-3">
              <Skeleton className="h-12 w-12 shrink-0 rounded-full bg-[#E6EAF3]" />
              <div className="min-w-0 flex-1">
                <Skeleton className="h-4 w-28 bg-[#E6EAF3]" />
                <Skeleton className="mt-3 h-5 w-3/4 bg-[#E6EAF3]" />
                <Skeleton className="mt-3 h-4 w-full bg-[#E6EAF3]" />
              </div>
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
