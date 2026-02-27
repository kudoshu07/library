function HeaderSkeleton() {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white">
      <div className="h-44 w-full animate-pulse rounded-t-3xl bg-slate-200 sm:h-56" />
      <div className="px-4 pb-6 pt-8 sm:px-6">
        <div className="mb-3 h-9 w-64 animate-pulse rounded bg-slate-200" />
        <div className="space-y-2">
          <div className="h-5 w-full animate-pulse rounded bg-slate-100" />
          <div className="h-5 w-11/12 animate-pulse rounded bg-slate-100" />
          <div className="h-5 w-8/12 animate-pulse rounded bg-slate-100" />
        </div>
      </div>
    </div>
  )
}

function CardSkeleton() {
  return (
    <div className="rounded-none border-x border-b border-slate-200 bg-white px-4 py-4">
      <div className="mb-3 flex items-center gap-2">
        <div className="size-9 animate-pulse rounded-full bg-slate-200" />
        <div className="h-6 w-28 animate-pulse rounded-full bg-slate-200" />
        <div className="h-4 w-24 animate-pulse rounded bg-slate-100" />
      </div>
      <div className="mb-3 space-y-2">
        <div className="h-6 w-11/12 animate-pulse rounded bg-slate-200" />
        <div className="h-6 w-8/12 animate-pulse rounded bg-slate-200" />
      </div>
      <div className="mb-3 space-y-2">
        <div className="h-4 w-full animate-pulse rounded bg-slate-100" />
        <div className="h-4 w-10/12 animate-pulse rounded bg-slate-100" />
        <div className="h-4 w-7/12 animate-pulse rounded bg-slate-100" />
      </div>
      <div className="aspect-video w-full animate-pulse rounded-xl bg-slate-200" />
    </div>
  )
}

export default function HomeLoading() {
  return (
    <div className="min-h-svh bg-[#f7f9f9] pb-[calc(clamp(3.75rem,8svh,4.5rem)+env(safe-area-inset-bottom))] min-[800px]:pb-0">
      <div className="mx-auto w-full max-w-[1520px] px-0 min-[800px]:px-4">
        <div className="grid min-[800px]:grid-cols-[200px_minmax(0,1fr)] min-[1100px]:grid-cols-[200px_minmax(0,1fr)_280px] min-[800px]:gap-4">
          <aside className="hidden min-[800px]:block">
            <div className="sticky top-0 h-svh rounded-3xl border border-slate-200 bg-white p-4">
              <div className="h-8 w-16 animate-pulse rounded bg-slate-200" />
              <div className="mt-8 space-y-4">
                <div className="h-10 w-full animate-pulse rounded-xl bg-slate-100" />
                <div className="h-10 w-full animate-pulse rounded-xl bg-slate-100" />
                <div className="h-10 w-full animate-pulse rounded-xl bg-slate-100" />
              </div>
            </div>
          </aside>

          <main className="min-w-0">
            <HeaderSkeleton />
            <section className="mt-3 border-t border-slate-200">
              <div className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur">
                <div className="flex items-center gap-3">
                  <div className="inline-block size-3 animate-spin rounded-full border-2 border-slate-300 border-t-[#264F8B]" />
                  <p className="text-sm font-semibold text-slate-700">ホームを読み込み中...</p>
                </div>
              </div>
              {Array.from({ length: 5 }).map((_, i) => (
                <CardSkeleton key={i} />
              ))}
            </section>
          </main>

          <aside className="hidden min-[1100px]:block">
            <div className="sticky top-0 h-svh rounded-3xl border border-slate-200 bg-white p-4">
              <div className="h-11 w-full animate-pulse rounded-full bg-slate-100" />
              <div className="mt-5 space-y-3">
                <div className="h-8 w-24 animate-pulse rounded-full bg-slate-200" />
                <div className="h-8 w-20 animate-pulse rounded-full bg-slate-200" />
                <div className="h-8 w-28 animate-pulse rounded-full bg-slate-200" />
              </div>
              <div className="mt-6 space-y-4">
                <div className="h-24 animate-pulse rounded-2xl bg-slate-100" />
                <div className="h-24 animate-pulse rounded-2xl bg-slate-100" />
                <div className="h-24 animate-pulse rounded-2xl bg-slate-100" />
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  )
}
