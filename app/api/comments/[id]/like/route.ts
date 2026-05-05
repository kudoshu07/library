import { NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import { setLike } from "@/lib/comments"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

async function toggle(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
  liked: boolean,
) {
  const { id } = await ctx.params
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }
  const result = await setLike({ session, commentId: id, liked })
  if (!result.ok) {
    const status = result.reason === "not_found" ? 404 : 500
    return NextResponse.json({ error: result.reason }, { status })
  }
  return NextResponse.json({
    ok: true,
    liked: result.liked,
    likeCount: result.likeCount,
  })
}

export function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return toggle(req, ctx, true)
}

export function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return toggle(req, ctx, false)
}
