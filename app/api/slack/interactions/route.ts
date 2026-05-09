import { NextResponse } from "next/server"
import {
  postSlackThreadReply,
  slackEscape,
  verifySlackSignature,
} from "@/lib/slack"
import {
  addDomainToBlocklist,
  banSubscriberById,
  deleteCommentById,
} from "@/lib/admin-actions"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type SlackUser = { id?: string; username?: string; name?: string }
type SlackAction = { action_id?: string; value?: string }
type SlackChannel = { id?: string }
type SlackMessage = { ts?: string }
type SlackPayload = {
  type?: string
  user?: SlackUser
  channel?: SlackChannel
  message?: SlackMessage
  actions?: SlackAction[]
}

function describeUser(user: SlackUser | undefined): string {
  if (!user) return "(unknown)"
  return user.username || user.name || user.id || "(unknown)"
}

export async function POST(req: Request) {
  const rawBody = await req.text()
  const timestamp = req.headers.get("x-slack-request-timestamp")
  const signature = req.headers.get("x-slack-signature")

  if (!timestamp || !signature) {
    return new NextResponse("missing signature headers", { status: 400 })
  }
  if (!verifySlackSignature({ rawBody, timestamp, signature })) {
    return new NextResponse("invalid signature", { status: 401 })
  }

  const params = new URLSearchParams(rawBody)
  const payloadStr = params.get("payload")
  if (!payloadStr) {
    return new NextResponse("missing payload", { status: 400 })
  }

  let payload: SlackPayload
  try {
    payload = JSON.parse(payloadStr) as SlackPayload
  } catch {
    return new NextResponse("invalid payload", { status: 400 })
  }

  if (payload.type !== "block_actions") {
    return NextResponse.json({ ok: true })
  }

  const action = payload.actions?.[0]
  const channelId = payload.channel?.id
  const threadTs = payload.message?.ts
  const actor = describeUser(payload.user)

  if (!action || !action.action_id || !channelId || !threadTs) {
    return NextResponse.json({ ok: true })
  }

  let parsedValue: Record<string, string> = {}
  if (action.value) {
    try {
      parsedValue = JSON.parse(action.value) as Record<string, string>
    } catch {
      parsedValue = {}
    }
  }

  let replyText: string

  switch (action.action_id) {
    case "ban_subscriber": {
      const subscriberId = parsedValue.subscriberId
      if (!subscriberId) {
        replyText = `:warning: BAN失敗: subscriberId 不明`
        break
      }
      const result = await banSubscriberById(subscriberId)
      if (result.ok) {
        const label = `${result.displayName ?? "(名無し)"} (${result.email})`
        replyText = `:no_entry: ${slackEscape(label)} をBANしました (by ${slackEscape(actor)})`
      } else {
        replyText = `:warning: BAN失敗: ${result.error} (by ${slackEscape(actor)})`
      }
      break
    }
    case "block_email_domain": {
      const domain = parsedValue.domain
      if (!domain) {
        replyText = `:warning: ブロックリスト追加失敗: domain 不明`
        break
      }
      const result = await addDomainToBlocklist({
        domain,
        reason: `slack:${actor}`,
      })
      if (result.ok) {
        replyText = `:no_good: ${slackEscape(result.domain)} をブロックリストに追加しました (by ${slackEscape(actor)})`
      } else {
        replyText = `:warning: ブロックリスト追加失敗: ${result.error} (by ${slackEscape(actor)})`
      }
      break
    }
    case "delete_comment": {
      const commentId = parsedValue.commentId
      if (!commentId) {
        replyText = `:warning: コメント削除失敗: commentId 不明`
        break
      }
      const result = await deleteCommentById(commentId)
      if (result.ok) {
        replyText = `:wastebasket: コメントを削除しました (${slackEscape(result.postId)}) (by ${slackEscape(actor)})`
      } else {
        replyText = `:warning: コメント削除失敗: ${result.error} (by ${slackEscape(actor)})`
      }
      break
    }
    default:
      replyText = `:question: 未対応のアクション: ${action.action_id}`
  }

  await postSlackThreadReply({ channel: channelId, threadTs, text: replyText })

  return NextResponse.json({ ok: true })
}
