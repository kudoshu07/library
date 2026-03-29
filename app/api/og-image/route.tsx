import { ImageResponse } from "next/og"

export const runtime = "edge"

const WIDTH = 1200
const HEIGHT = 630
const BACKGROUND = "#264F8B"
const TEXT_COLOR = "#FFFFFF"
const DEFAULT_TITLE = "Kudo Shu Library"
const TITLE_LIMIT = 80

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const rawTitle = searchParams.get("title") ?? DEFAULT_TITLE
  const title = (rawTitle.trim() || DEFAULT_TITLE).slice(0, TITLE_LIMIT)

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: BACKGROUND,
          color: TEXT_COLOR,
          fontSize: 64,
          fontWeight: 700,
          textAlign: "center",
          padding: "64px",
          letterSpacing: -0.5,
          lineHeight: 1.2,
        }}
      >
        <div
          style={{
            maxWidth: "960px",
            wordBreak: "break-word",
            overflowWrap: "anywhere",
          }}
        >
          {title}
        </div>
      </div>
    ),
    {
      width: WIDTH,
      height: HEIGHT,
      headers: {
        "Cache-Control": "public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800",
      },
    }
  )
}
