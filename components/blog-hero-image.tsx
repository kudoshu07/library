"use client"

import { useState } from "react"

export function BlogHeroImage({
  src,
  title,
}: {
  src: string
  title: string
}) {
  const [failed, setFailed] = useState(false)

  return (
    <div className="mb-8 overflow-hidden rounded-2xl border border-border bg-card">
      {failed ? (
        <div className="flex aspect-video w-full items-center justify-center bg-white p-6 text-center">
          <p className="max-w-2xl text-xl font-bold leading-tight tracking-tight text-foreground md:text-2xl">
            {title}
          </p>
        </div>
      ) : (
        <img
          src={src}
          alt=""
          className="aspect-video w-full object-cover"
          loading="eager"
          onError={() => setFailed(true)}
        />
      )}
    </div>
  )
}

