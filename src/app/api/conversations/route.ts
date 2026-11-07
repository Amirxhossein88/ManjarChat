import { db } from '@/lib/db'
import { getCurrentUser, isAdmin } from '@/lib/auth'
import { ensureSeeded } from '@/lib/seed'
import { ok, err, readJson } from '@/lib/api'
import { findOrCreateDm } from '@/lib/chat'

const ONLINE_MS = 70_000

export async function GET() {
  await ensureSeeded()
  const me = await getCurrentUser()
  if (!me) return err('unauthorized', 401)

  const rows = await db.participant.findMany({
    where: { userId: me.id },
    include: {
      conversation: {
        include: {
          participants: {
            include: { user: { select: { id: true, username: true, displayName: true, avatarColor: true, role: true, lastSeenAt: true, isPremiumUntil: true } } },
          },
        },
      },
    },
  })

  const list = await Promise.all(
    rows.map(async (row) => {
      const conv = row.conversation
      const others = conv.participants.filter((p) => p.userId !== me.id)
      const peer = conv.type === 'DM' ? others[0]?.user ?? null : null

      const [unread, lastMsg, typing] = await Promise.all([
        db.message.count({
          where: { conversationId: conv.id, createdAt: { gt: row.lastReadAt }, senderId: { not: me.id }, deleted: false },
        }),
        db.message.findFirst({
          where: { conversationId: conv.id },
          orderBy: { createdAt: 'desc' },
          include: { sender: { select: { displayName: true, username: true } } },
        }),
        db.participant.findMany({
          where: { conversationId: conv.id, userId: { not: me.id }, typingAt: { gt: new Date(Date.now() - 5000) } },
          select: { user: { select: { displayName: true } } },
        }),
      ])

      return {
        id: conv.id,
        type: conv.type,
        title: conv.type === 'DM' ? peer?.displayName ?? 'گفتگوی حذف‌شده' : conv.title,
        about: conv.about,
        avatarColor: conv.type === 'DM' ? peer?.avatarColor ?? '#0d9488' : conv.avatarColor,
        ownerId: conv.ownerId,
        myRole: row.role,
        boostCount: conv.boostCount,
        membersCount: conv.participants.length,
        peer: peer
          ? {
              id: peer.id,
              username: peer.username,
              displayName: peer.displayName,
              avatarColor: peer.avatarColor,
              role: peer.role,
              premium: !!peer.isPremiumUntil && peer.isPremiumUntil.getTime() > Date.now(),
              online: Date.now() - new Date(peer.lastSeenAt).getTime() < ONLINE_MS,
            }
          : null,
        unread,
        typing: typing.map((t) => t.user.displayName),
        lastMessage: lastMsg
          ? {
              id: lastMsg.id,
              kind: lastMsg.deleted ? 'DELETED' : lastMsg.kind,
              content: lastMsg.deleted ? '' : lastMsg.content.slice(0, 90),
              senderName: lastMsg.sender?.displayName ?? '',
              mine: lastMsg.senderId === me.id,
              createdAt: lastMsg.createdAt,
            }
          : null,
        lastActivity: lastMsg?.createdAt ?? conv.createdAt,
      }
    }),
  )

  list.sort((a, b) => new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime())
  return ok({ conversations: list })
}

export async function POST(req: Request) {
  await ensureSeeded()
  const me = await getCurrentUser()
  if (!me) return err('unauthorized', 401)
  const body = await readJson<{
    type?: string
    peerUsername?: string
    title?: string
    about?: string
    memberUsernames?: string[]
  }>(req)

  const type = body.type || 'DM'
  if (!['DM', 'GROUP', 'CHANNEL'].includes(type)) return err('نوع گفتگو نامعتبر است')

  if (type === 'DM') {
    const uname = (body.peerUsername || '').trim().toLowerCase()
    const peer = await db.user.findUnique({ where: { username: uname } })
    if (!peer) return err('کاربر پیدا نشد')
    if (peer.id === me.id) return err('نمی‌توانی با خودت چت کنی 😅')
    const convId = await findOrCreateDm(db, me.id, peer.id, me.id)
    return ok({ conversationId: convId })
  }

  const title = (body.title || '').trim()
  if (title.length < 2) return err('نام گنجم/کانال حداقل ۲ حرف باشد')
  const memberUsernames = (body.memberUsernames || []).map((u) => u.trim().toLowerCase()).filter(Boolean).slice(0, 100)

  const members = memberUsernames.length
    ? await db.user.findMany({ where: { username: { in: memberUsernames } }, select: { id: true } })
    : []

  const conv = await db.conversation.create({
    data: {
      type,
      title,
      about: (body.about || '').slice(0, 500),
      avatarColor: pickColor(),
      ownerId: me.id,
      participants: {
        create: [
          { userId: me.id, role: 'OWNER' },
          ...members.filter((m) => m.id !== me.id).map((m) => ({ userId: m.id, role: 'MEMBER' as const })),
        ],
      },
    },
  })

  await db.message.create({
    data: {
      conversationId: conv.id,
      senderId: me.id,
      kind: 'SYSTEM',
      content: `${me.displayName} «${title}» را ساخت ${type === 'CHANNEL' ? '📣' : '👥'}`,
    },
  })
  return ok({ conversationId: conv.id })
}

function pickColor() {
  const colors = ['#0d9488', '#059669', '#d97706', '#dc2626', '#db2777', '#7c3aed', '#2563eb', '#0891b2']
  return colors[Math.floor(Math.random() * colors.length)]
}
