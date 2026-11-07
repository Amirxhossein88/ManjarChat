import { db } from '@/lib/db'
import { getCurrentUser, isAdmin } from '@/lib/auth'
import { ensureSeeded } from '@/lib/seed'
import { ok, err, readJson } from '@/lib/api'
import { serializeMessage } from '@/lib/chat'

type Params = { params: Promise<{ id: string }> }

// ── GET: history or incremental poll ──
export async function GET(req: Request, { params }: Params) {
  await ensureSeeded()
  const me = await getCurrentUser()
  if (!me) return err('unauthorized', 401)
  const { id } = await params

  const conv = await db.conversation.findUnique({ where: { id }, include: { participants: true } })
  if (!conv) return err('گفتگو پیدا نشد', 404)
  const myRow = conv.participants.find((p) => p.userId === me.id)
  if (!myRow && !isAdmin(me)) return err('به این گفتگو دسترسی نداری', 403)

  const url = new URL(req.url)
  const after = url.searchParams.get('after')
  const limit = Math.min(Number(url.searchParams.get('limit') || 80), 200)

  if (after) {
    const afterDate = new Date(after)
    if (isNaN(afterDate.getTime())) return err('after نامعتبر است')
    const [fresh, recentlyDeleted, typingRows] = await Promise.all([
      db.message.findMany({
        where: { conversationId: id, createdAt: { gt: afterDate } },
        orderBy: { createdAt: 'asc' },
        take: 100,
        include: {
          sender: { select: { id: true, username: true, displayName: true, avatarColor: true, role: true, isPremiumUntil: true } },
          parent: { include: { sender: { select: { displayName: true } } } },
          reactions: true,
        },
      }),
      db.message.findMany({
        where: { conversationId: id, deleted: true, deletedAt: { gt: new Date(Date.now() - 600_000) } },
        select: { id: true },
      }),
      db.participant.findMany({
        where: { conversationId: id, userId: { not: me.id }, typingAt: { gt: new Date(Date.now() - 5000) } },
        select: { user: { select: { displayName: true } } },
      }),
    ])
    return ok({
      messages: fresh.map((m) => serializeMessage(m, me.id)),
      deletedIds: recentlyDeleted.map((m) => m.id),
      typing: typingRows.map((t) => t.user.displayName),
    })
  }

  const latest = await db.message.findMany({
    where: { conversationId: id },
    orderBy: { createdAt: 'desc' },
    take: limit,
    include: {
      sender: { select: { id: true, username: true, displayName: true, avatarColor: true, role: true, isPremiumUntil: true } },
      parent: { include: { sender: { select: { displayName: true } } } },
      reactions: true,
    },
  })
  latest.reverse()
  return ok({
    messages: latest.map((m) => serializeMessage(m, me.id)),
    deletedIds: [],
    typing: [],
    conversation: {
      id: conv.id,
      type: conv.type,
      title: conv.title,
      about: conv.about,
      ownerId: conv.ownerId,
      boostCount: conv.boostCount,
      myRole: myRow?.role ?? (isAdmin(me) ? 'ADMIN' : null),
      members: conv.participants.map((p) => ({
        userId: p.userId,
        role: p.role,
        displayName: '',
      })),
    },
  })
}

// ── POST: send message ──
export async function POST(req: Request, { params }: Params) {
  await ensureSeeded()
  const me = await getCurrentUser()
  if (!me) return err('unauthorized', 401)
  const { id } = await params
  const body = await readJson<{
    kind?: string
    content?: string
    mediaId?: string
    durationMs?: number
    replyToId?: string
  }>(req)

  const conv = await db.conversation.findUnique({ where: { id }, include: { participants: true } })
  if (!conv) return err('گفتگو پیدا نشد', 404)
  let myRow = conv.participants.find((p) => p.userId === me.id)
  const admin = isAdmin(me)
  if (!myRow && !admin) return err('به این گفتگو دسترسی نداری', 403)

  // channel: only owner/admins can broadcast
  if (conv.type === 'CHANNEL' && myRow && !['OWNER', 'ADMIN'].includes(myRow.role) && !admin) {
    return err('در کانال فقط مدیران می‌توانند پیام بفرستند', 403)
  }
  // admin silently joins conversations they post into
  if (!myRow && admin) {
    myRow = await db.participant.create({ data: { conversationId: id, userId: me.id, role: 'ADMIN' } })
  }

  const kind = body.kind || 'TEXT'
  if (!['TEXT', 'VOICE', 'IMAGE', 'FILE'].includes(kind)) return err('نوع پیام نامعتبر است')

  const content = (body.content || '').slice(0, 4000)
  if (kind === 'TEXT' && !content.trim()) return err('متن پیام خالی است')

  let mediaId: string | null = null
  if (['VOICE', 'IMAGE', 'FILE'].includes(kind)) {
    if (!body.mediaId) return err('فایل ارسال نشده است')
    const media = await db.media.findUnique({ where: { id: body.mediaId } })
    if (!media) return err('فایل پیدا نشد')
    if (kind === 'VOICE' && !media.mime.startsWith('audio/')) return err('فایل صوتی معتبر نیست')
    mediaId = media.id
  }

  let replyToId: string | null = null
  if (body.replyToId) {
    const target = await db.message.findUnique({ where: { id: body.replyToId } })
    if (target && target.conversationId === id && !target.deleted) replyToId = target.id
  }

  const created = await db.$transaction(async (tx) => {
    const msg = await tx.message.create({
      data: {
        conversationId: id,
        senderId: me.id,
        kind,
        content,
        mediaId,
        durationMs: body.durationMs ? Math.max(0, Math.min(Math.round(body.durationMs), 600_000)) : null,
        replyToId,
      },
      include: {
        sender: { select: { id: true, username: true, displayName: true, avatarColor: true, role: true, isPremiumUntil: true } },
        parent: { include: { sender: { select: { displayName: true } } } },
        reactions: true,
      },
    })
    await tx.participant.update({
      where: { id: myRow!.id },
      data: { lastReadAt: new Date(), typingAt: null },
    })
    return msg
  })

  return ok({ message: serializeMessage(created, me.id) })
}
