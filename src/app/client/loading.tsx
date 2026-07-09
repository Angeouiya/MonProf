const metricCards = ["w-16", "w-20", "w-14"];
const listRows = ["w-32", "w-40", "w-28"];

export default function ClientLoading() {
  return (
    <div
      data-client-loading
      className="space-y-3 sm:space-y-4"
      aria-label="Chargement de l'espace client"
      aria-live="polite"
      role="status"
    >
      <span className="sr-only">Chargement de l'espace client Compétence.</span>

      <section
        data-client-loading-header
        className="overflow-hidden rounded-lg border border-[#E3E8F2] bg-white"
      >
        <div className="h-1.5 w-full bg-[#111B4D]" />
        <div className="grid gap-4 p-4 sm:p-5 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
          <div className="flex min-w-0 items-start gap-3">
            <LoadingBlock className="h-12 w-12 shrink-0 rounded-lg bg-[#111B4D]" />
            <div className="min-w-0 flex-1 space-y-2.5">
              <LoadingBlock className="h-3 w-24 rounded-full bg-[#D7DEE9]" />
              <LoadingBlock className="h-6 w-4/5 max-w-xl rounded-full bg-[#111B4D]" />
              <LoadingBlock className="h-3 w-full max-w-2xl rounded-full bg-[#D7DEE9]" />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {metricCards.map((width, index) => (
              <div key={index} className="min-h-16 rounded-lg border border-[#E3E8F2] bg-white p-3">
                <LoadingBlock className="h-2.5 w-10 rounded-full bg-[#D7DEE9]" />
                <LoadingBlock className={`mt-3 h-4 ${width} rounded-full bg-[#111B4D]`} />
              </div>
            ))}
          </div>
        </div>
      </section>

      <section data-client-loading-workspace className="grid gap-3 lg:grid-cols-[0.9fr_1.1fr]">
        <div data-client-loading-primary-panel className="rounded-lg border border-[#E3E8F2] bg-white p-4">
          <div className="flex items-center justify-between gap-3">
            <LoadingBlock className="h-4 w-36 rounded-full bg-[#111B4D]" />
            <LoadingBlock className="h-9 w-24 rounded-lg bg-[#111B4D]" />
          </div>
          <div className="mt-4 grid gap-2">
            {[0, 1, 2, 3].map((item) => (
              <div key={item} className="flex min-h-14 items-center gap-3 rounded-lg border border-[#E3E8F2] bg-white px-3">
                <LoadingBlock className="h-9 w-9 shrink-0 rounded-full bg-[#D7DEE9]" />
                <div className="min-w-0 flex-1 space-y-2">
                  <LoadingBlock className={`h-3 ${listRows[item % listRows.length]} rounded-full bg-[#111B4D]`} />
                  <LoadingBlock className="h-2.5 w-4/5 rounded-full bg-[#D7DEE9]" />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div data-client-loading-secondary-panel className="rounded-lg border border-[#E3E8F2] bg-white p-4">
          <div className="flex items-center justify-between gap-3">
            <LoadingBlock className="h-4 w-32 rounded-full bg-[#111B4D]" />
            <LoadingBlock className="h-8 w-8 rounded-lg bg-[#D7DEE9]" />
          </div>
          <div className="mt-4 grid gap-3 min-[520px]:grid-cols-2">
            {[0, 1, 2, 3].map((item) => (
              <div key={item} className="min-h-24 rounded-lg border border-[#E3E8F2] bg-white p-3">
                <LoadingBlock className="h-3 w-20 rounded-full bg-[#D7DEE9]" />
                <LoadingBlock className="mt-3 h-5 w-2/3 rounded-full bg-[#111B4D]" />
                <LoadingBlock className="mt-3 h-3 w-full rounded-full bg-[#D7DEE9]" />
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

function LoadingBlock({ className }: { className: string }) {
  return <div className={`motion-safe:animate-pulse ${className}`} aria-hidden="true" />;
}
