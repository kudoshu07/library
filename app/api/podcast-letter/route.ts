import { NextResponse } from "next/server"
import { z } from "zod"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const payloadSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "name is required")
    .max(80, "name is too long"),
  message: z
    .string()
    .trim()
    .min(1, "message is required")
    .max(2000, "message is too long"),
})

type ValidPayload = z.infer<typeof payloadSchema>

function buildNotionProperties(data: ValidPayload) {
  const now = new Date().toISOString()
  const properties: Record<string, unknown> = {
    Name: { title: [{ text: { content: data.name } }] },
    Message: { rich_text: [{ text: { content: data.message } }] },
    time: { date: { start: now } },
  }

  return properties
}

export async function POST(req: Request) {
  let parsed: ValidPayload
  try {
    const json = await req.json()
    const result = payloadSchema.safeParse(json)
    if (!result.success) {
      return NextResponse.json({ error: "invalid_input", issues: result.error.issues }, { status: 400 })
    }
    parsed = result.data
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 })
  }

  const notionToken = process.env.NOTION_API_KEY
  const databaseId = process.env.NOTION_FEEDBACK_DATABASE_ID

  if (!notionToken || !databaseId) {
    return NextResponse.json({ error: "notion_not_configured" }, { status: 500 })
  }

  const properties = buildNotionProperties(parsed)

  try {
    const notionRes = await fetch("https://api.notion.com/v1/pages", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${notionToken}`,
        "Content-Type": "application/json",
        "Notion-Version": "2022-06-28",
      },
      body: JSON.stringify({
        parent: { database_id: databaseId },
        properties,
      }),
    })

    if (!notionRes.ok) {
      const detail = await notionRes.text()
      console.error("Notion API error", notionRes.status, detail)
      return NextResponse.json(
        { error: "notion_error", status: notionRes.status, detail },
        { status: 502 }
      )
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("Notion request failed", error)
    return NextResponse.json({ error: "notion_request_failed" }, { status: 500 })
  }
}
