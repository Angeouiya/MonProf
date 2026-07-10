export function WorkspaceLoading({ audience }: { audience: "admin" | "professeur" }) {
  const metrics = audience === "admin" ? 4 : 3;
  return (
    <div
      data-workspace-loading={audience}
      className="space-y-4"
      role="status"
      aria-live="polite"
      aria-label="Chargement de l'espace"
    >
      <span className="sr-only">Chargement en cours.</span>
      <div className="flex items-start justify-between gap-4 border-b border-[#E6EAF3] pb-5">
        <div className="min-w-0 flex-1 space-y-3">
          <Pulse className="h-3 w-24" />
          <Pulse className="h-7 w-56 max-w-[70vw] bg-[#111B4D]" />
          <Pulse className="h-3 w-full max-w-lg" />
        </div>
        <Pulse className="hidden h-11 w-32 bg-[#111B4D] sm:block" />
      </div>
      <div className={`grid gap-2 ${metrics === 4 ? "grid-cols-2 lg:grid-cols-4" : "grid-cols-3"}`}>
        {Array.from({ length: metrics }, (_, index) => (
          <div key={index} className="min-h-20 rounded-lg border border-[#E3E8F2] bg-white p-3">
            <Pulse className="h-3 w-16" />
            <Pulse className="mt-4 h-5 w-20 bg-[#111B4D]" />
          </div>
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
        <LoadingPanel rows={4} />
        <LoadingPanel rows={3} />
      </div>
    </div>
  );
}

function LoadingPanel({ rows }: { rows: number }) {
  return (
    <section className="rounded-lg border border-[#E3E8F2] bg-white p-4">
      <div className="flex items-center justify-between gap-3">
        <Pulse className="h-4 w-36 bg-[#111B4D]" />
        <Pulse className="h-9 w-9" />
      </div>
      <div className="mt-4 space-y-2">
        {Array.from({ length: rows }, (_, index) => (
          <div key={index} className="flex min-h-14 items-center gap-3 rounded-lg border border-[#E6EAF3] px-3">
            <Pulse className="h-9 w-9 shrink-0 rounded-full" />
            <div className="min-w-0 flex-1 space-y-2">
              <Pulse className="h-3 w-2/5 bg-[#111B4D]" />
              <Pulse className="h-2.5 w-4/5" />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function Pulse({ className }: { className: string }) {
  return <div aria-hidden="true" className={`rounded-lg bg-[#D7DEE9] motion-safe:animate-pulse ${className}`} />;
}
