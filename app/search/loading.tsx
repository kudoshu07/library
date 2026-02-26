function ChipSkeleton({ w = "w-24" }: { w?: string }) {
  return <div className={`h-8 ${w} animate-pulse rounded-full bg-slate-200`} />
}

function CardSkeleton() {
  return (
    <div className="rounded-2xl bg-white p-4">
      <div className="mb-3 aspect-video w-full animate-pulse rounded-xl bg-slate-200" />
      <div className="mb-3 flex items-center gap-2">
        <div className="h-6 w-20 animate-pulse rounded-full bg-slate-200" />
        <div className="h-4 w-20 animate-pulse rounded bg-slate-200" />
      </div>
      <div className="space-y-2">
        <div className="h-5 w-11/12 animate-pulse rounded bg-slate-200" />
        <div className="h-5 w-7/12 animate-pulse rounded bg-slate-200" />
      </div>
      <div className="mt-4 space-y-2">
        <div className="h-4 w-full animate-pulse rounded bg-slate-100" />
        <div className="h-4 w-10/12 animate-pulse rounded bg-slate-100" />
        <div className="h-4 w-8/12 animate-pulse rounded bg-slate-100" />
      </div>
    </div>
  )
}

export default function SearchLoading() {
  return (
    <div className="min-h-svh bg-[#f7f9f9] pb-[calc(clamp(3.75rem,8svh,4.5rem)+env(safe-area-inset-bottom))] min-[800px]:pb-0">
      <div className="mx-auto w-full max-w-[1520px] px-4 py-4 sm:px-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
          <div className="flex items-center gap-3">
            <div className="size-10 animate-pulse rounded-full bg-slate-200" />
            <div className="h-11 flex-1 animate-pulse rounded-full bg-slate-100" />
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <ChipSkeleton w="w-16" />
            <ChipSkeleton w="w-24" />
            <ChipSkeleton w="w-28" />
            <ChipSkeleton w="w-36" />
          </div>
          <div className="mt-3 border-t border-slate-100 pt-3">
            <div className="flex flex-wrap gap-2">
              <ChipSkeleton w="w-24" />
              <ChipSkeleton w="w-20" />
              <ChipSkeleton w="w-28" />
              <ChipSkeleton w="w-24" />
            </div>
          </div>
        </div>

        <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
          <div className="mb-4 flex items-center gap-3">
            <div className="inline-block size-3 animate-spin rounded-full border-2 border-slate-300 border-t-slate-700" />
            <p className="text-sm font-semibold text-slate-700">検索結果を読み込み中...</p>
          </div>

          <div className="grid grid-cols-1 gap-4 min-[760px]:justify-center min-[760px]:[grid-template-columns:repeat(2,320px)] min-[1100px]:[grid-template-columns:repeat(3,320px)] min-[1460px]:[grid-template-columns:repeat(4,320px)]">
            {Array.from({ length: 8 }).map((_, i) => (
              <CardSkeleton key={i} />
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}

