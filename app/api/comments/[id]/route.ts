import { NextResponse } from "next/server"
import { z } from "zod"
import { getSession } from "@/lib/auth"
import {
  COMMENT_BODY_MAX,
  deleteCommentByAuthorOrOwner,
  updateOwnComment,
} from "@/lib/comments"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const patchSchema = z.object({
  body: z.string().min(1, "invalid_body").max(COMMENT_BODY_MAX, "invalid_body"),
})

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  let body: z.infer<typeof patchSchema>
  try {
    const json = await req.json()
    const parsed = patchSchema.safeParse(json)
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "invalid_input" },
        { status: 400 },
      )
    }
    body = parsed.data
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 })
  }

  const result = await updateOwnComment({
    session,
    commentId: id,
    body: body.body,
  })

  if (!result.ok) {
    const status =
      result.reason === "not_found"
        ? 404
        : result.reason === "forbidden" || result.reason === "banned"
          ? 403
          : result.reason === "invalid_body"
            ? 400
            : 500
    return NextResponse.json({ error: result.reason }, { status })
  }

  return NextResponse.json({ ok: true, comment: result.comment })
}

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  const result = await deleteCommentByAuthorOrOwner({ session, commentId: id })
  if (!result.ok) {
    const status =
      result.reason === "not_found" ? 404 : result.reason === "forbidden" ? 403 : 500
    return NextResponse.json({ error: result.reason }, { status })
  }
  return NextResponse.json({ ok: true })
}
