import { NextResponse } from "next/server"
import { z } from "zod"
import { getSession } from "@/lib/auth"
import {
  COMMENT_BODY_MAX,
  createComment,
  fetchCommentsForPost,
} from "@/lib/comments"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function safePostId(value: string | null): string | null {
  if (!value) return null
  if (!value.startsWith("/") || value.startsWith("//")) return null
  if (value.length > 200) return null
  return value
}

export async function GET(req: Request) {
  const url = new URL(req.url)
  const postId = safePostId(url.searchParams.get("post_id"))
  if (!postId) {
    return NextResponse.json({ error: "invalid_post_id" }, { status: 400 })
  }
  const session = await getSession()
  const comments = await fetchCommentsForPost(postId, session?.subscriberId ?? null)
  return NextResponse.json({
    comments,
    viewer: {
      isLoggedIn: !!session,
      needsDisplayName: !!session && !session.displayName,
      displayName: session?.displayName ?? null,
      banned: !!session?.banned,
      isOwner: !!session?.isOwner,
    },
  })
}

const postSchema = z.object({
  postId: z
    .string()
    .min(2)
    .max(200)
    .refine((v) => v.startsWith("/") && !v.startsWith("//"), {
      message: "invalid_post_id",
    }),
  parentId: z.string().uuid().nullable().optional(),
  body: z.string().min(1, "invalid_body").max(COMMENT_BODY_MAX, "invalid_body"),
})

export async function POST(req: Request) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  let body: z.infer<typeof postSchema>
  try {
    const json = await req.json()
    const parsed = postSchema.safeParse(json)
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

  const result = await createComment({
    session,
    postId: body.postId,
    parentId: body.parentId ?? null,
    body: body.body,
  })

  if (!result.ok) {
    const status =
      result.reason === "rate_limited"
        ? 429
        : result.reason === "display_name_required"
          ? 409
          : result.reason === "banned"
            ? 403
            : result.reason === "parent_not_found" ||
                result.reason === "nesting_too_deep" ||
                result.reason === "invalid_body"
              ? 400
              : 500
    return NextResponse.json({ error: result.reason }, { status })
  }

  return NextResponse.json({ ok: true, comment: result.comment }, { status: 201 })
}
