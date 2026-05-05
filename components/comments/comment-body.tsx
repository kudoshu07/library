const URL_RE = /(https?:\/\/[^\s]+)/g

export function CommentBody({ body }: { body: string }) {
  const parts = body.split(URL_RE)
  return (
    <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-foreground">
      {parts.map((part, i) => {
        const isUrl = /^https?:\/\//.test(part)
        if (!isUrl) return <span key={i}>{part}</span>
        return (
          <a
            key={i}
            href={part}
            target="_blank"
            rel="nofollow noopener noreferrer"
            className="break-all text-primary underline-offset-2 hover:underline"
          >
            {part}
          </a>
        )
      })}
    </p>
  )
}
