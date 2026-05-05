import { NextResponse } from "next/server"
import { z } from "zod"
import { getSession } from "@/lib/auth"
import { setBan } from "@/lib/moderation"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const schema = z.object({
  email: z.string().trim().toLowerCase().email("invalid_email").max(254),
})

async function requireOwner() {
  const session = await getSession()
  if (!session) return { error: NextResponse.json({ error: "unauthorized" }, { status: 401 }) }
  if (!session.isOwner) return { error: NextResponse.json({ error: "forbidden" }, { status: 403 }) }
  return { session }
}

async function readBody(req: Request) {
  try {
    const json = await req.json()
    const parsed = schema.safeParse(json)
    if (!parsed.success) {
      return {
        error: NextResponse.json(
          { error: parsed.error.issues[0]?.message ?? "invalid_input" },
          { status: 400 },
        ),
      }
    }
    return { data: parsed.data }
  } catch {
    return { error: NextResponse.json({ error: "invalid_json" }, { status: 400 }) }
  }
}

export async function POST(req: Request) {
  const auth = await requireOwner()
  if ("error" in auth) return auth.error
  const body = await readBody(req)
  if ("error" in body) return body.error

  const result = await setBan({ email: body.data.email, banned: true })
  if (!result.ok) {
    const status = result.reason === "not_found" ? 404 : 500
    return NextResponse.json({ error: result.reason }, { status })
  }
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: Request) {
  const auth = await requireOwner()
  if ("error" in auth) return auth.error
  const body = await readBody(req)
  if ("error" in body) return body.error

  const result = await setBan({ email: body.data.email, banned: false })
  if (!result.ok) {
    const status = result.reason === "not_found" ? 404 : 500
    return NextResponse.json({ error: result.reason }, { status })
  }
  return NextResponse.json({ ok: true })
}
