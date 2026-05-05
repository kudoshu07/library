const PALETTE = [
  ["bg-rose-100", "text-rose-700"],
  ["bg-amber-100", "text-amber-800"],
  ["bg-lime-100", "text-lime-800"],
  ["bg-emerald-100", "text-emerald-800"],
  ["bg-cyan-100", "text-cyan-800"],
  ["bg-sky-100", "text-sky-800"],
  ["bg-violet-100", "text-violet-800"],
  ["bg-pink-100", "text-pink-800"],
] as const

function hash(str: string): number {
  let h = 0
  for (let i = 0; i < str.length; i++) {
    h = (h * 31 + str.charCodeAt(i)) | 0
  }
  return Math.abs(h)
}

export function CommentAvatar({
  name,
  size = 36,
}: {
  name: string
  size?: number
}) {
  const initial = (name.trim()[0] || "?").toUpperCase()
  const idx = hash(name || "?") % PALETTE.length
  const [bg, fg] = PALETTE[idx]
  return (
    <div
      className={`flex shrink-0 items-center justify-center rounded-full font-semibold ${bg} ${fg}`}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.42) }}
      aria-hidden
    >
      {initial}
    </div>
  )
}
