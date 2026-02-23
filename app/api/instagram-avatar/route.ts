import { NextResponse, type NextRequest } from "next/server"
import { getInstagramProfileAvatar } from "@/lib/content-loader"

export async function GET(request: NextRequest) {
  const username =
    request.nextUrl.searchParams.get("username") ??
    process.env.IG_BUSINESS_USERNAME ??
    "kudoshu_vcook"

  const avatarUrl = await getInstagramProfileAvatar(username)

  return NextResponse.json(
    { avatarUrl },
    {
      headers: {
        "Cache-Control":
          "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400",
      },
    }
  )
}

