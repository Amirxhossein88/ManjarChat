import { db } from './db'

type TxClient = Parameters<Parameters<typeof db.$transaction>[0]>[0]
type DbLike = typeof db | TxClient

/** Find the DM conversation between two users or create it. */
export async function findOrCreateDm(client: DbLike, userAId: string, userBId: string, ownerId?: string) {
  const existing = await db.conversation.findFirst({
    where: {
      type: 'DM',
      AND: [{ participants: { some: { userId: userAId } } }, { participants: { some: { userId: userBId } } }],
    },
    select: { id: true },
  })
  if (existing) return existing.id
  const conv = await client.conversation.create({
    data: {
      type: 'DM',
      ownerId: ownerId || userAId,
      participants: {
        create: [
          { userId: userAId, role: 'MEMBER' },
          { userId: userBId, role: 'MEMBER' },
        ],
      },
    },
  })
  return conv.id
}

export type MessageWithRefs = {
  id: string
  conversationId: string
  senderId: string | null
  kind: string
  content: string
  mediaId: string | null
  durationMs: number | null
  giftEmoji: string | null
  pinned: boolean
  deleted: boolean
  replyToId: string | null
  createdAt: Date
  sender?: {
    id: string
    username: string
    displayName: string
    avatarColor: string
    role: string
    isPremiumUntil: Date | null
  } | null
  parent?: {
    id: string
    kind: string
    content: string
    deleted: boolean
    sender?: { displayName: string } | null
  } | null
  reactions?: { emoji: string; userId: string }[]
}

export function serializeMessage(m: MessageWithRefs, viewerId?: string) {
  const byEmoji = new Map<string, { emoji: string; count: number; mine: boolean }>()
  for (const r of m.reactions ?? []) {
    const cur = byEmoji.get(r.emoji) || { emoji: r.emoji, count: 0, mine: false }
    cur.count++
    if (viewerId && r.userId === viewerId) cur.mine = true
    byEmoji.set(r.emoji, cur)
  }
  return {
    id: m.id,
    conversationId: m.conversationId,
    kind: m.deleted ? 'DELETED' : m.kind,
    content: m.deleted ? '' : m.content,
    mediaId: m.deleted ? null : m.mediaId,
    durationMs: m.deleted ? null : m.durationMs,
    giftEmoji: m.deleted ? null : m.giftEmoji,
    pinned: m.pinned,
    createdAt: m.createdAt,
    sender: m.sender
      ? {
          id: m.sender.id,
          username: m.sender.username,
          displayName: m.sender.displayName,
          avatarColor: m.sender.avatarColor,
          role: m.sender.role,
          premium: !!m.sender.isPremiumUntil && m.sender.isPremiumUntil.getTime() > Date.now(),
        }
      : null,
    replyTo: m.parent
      ? {
          id: m.parent.id,
          kind: m.parent.deleted ? 'DELETED' : m.parent.kind,
          content: m.parent.deleted ? '' : m.parent.content,
          senderName: m.parent.sender?.displayName || '—',
        }
      : null,
    reactions: [...byEmoji.values()],
  }
}

export const EMOJI_SETS = ['❤️', '👍', '🔥', '😂', '😮', '😢', '🎉', '🪙']
