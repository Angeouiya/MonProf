export default function ClientLoading() {
  return (
    <div className="space-y-4" aria-label="Chargement de l'espace client" aria-live="polite">
      <section
        data-client-loading-header
        className="overflow-hidden rounded-lg border border-[#E3E8F2] bg-white"
      >
        <div className="h-1.5 w-full bg-[#111B4D]" />
        <div className="p-4 sm:p-5">
          <div className="flex items-start gap-3">
            <div className="h-11 w-11 shrink-0 rounded-lg bg-[#111B4D]" aria-hidden="true" />
            <div className="min-w-0 flex-1 space-y-2.5">
              <div className="h-3 w-24 rounded-full bg-[#D8DEE9]" aria-hidden="true" />
              <div className="h-6 w-3/4 max-w-lg rounded-full bg-[#111B4D]" aria-hidden="true" />
              <div className="h-3 w-full max-w-xl rounded-full bg-[#D8DEE9]" aria-hidden="true" />
            </div>
          </div>
          <div className="mt-5 grid gap-2 min-[520px]:grid-cols-3">
            {[0, 1, 2].map((item) => (
              <div key={item} className="h-14 rounded-lg border border-[#E3E8F2] bg-white" aria-hidden="true" />
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-2">
        {[0, 1].map((item) => (
          <div key={item} className="rounded-lg border border-[#E3E8F2] bg-white p-4" aria-hidden="true">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 shrink-0 rounded-full bg-[#D8DEE9]" />
              <div className="min-w-0 flex-1 space-y-2">
                <div className="h-3 w-28 rounded-full bg-[#D8DEE9]" />
                <div className="h-4 w-4/5 rounded-full bg-[#111B4D]" />
              </div>
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
