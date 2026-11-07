import { db } from '@/lib/db'
import { getCurrentUser, isAdmin } from '@/lib/auth'
import { ensureSeeded } from '@/lib/seed'
import { ok, err } from '@/lib/api'

type Params = { params: Promise<{ id: string }> }

/** Join a public group/channel. Admins can join anything. */
export async function POST(_req: Request, { params }: Params) {
  await ensureSeeded()
  const me = await getCurrentUser()
  if (!me) return err('unauthorized', 401)
  const { id } = await params

  const conv = await db.conversation.findUnique({ where: { id } })
  if (!conv) return err('گفتگو پیدا نشد', 404)
  if (conv.type === 'DM' && !isAdmin(me)) return err('نمی‌توانی به گفتگوی خصوصی بپیوندی', 403)

  const existing = await db.participant.findUnique({
    where: { conversationId_userId: { conversationId: id, userId: me.id } },
  })
  if (existing) return ok({ already: true })

  await db.participant.create({
    data: { conversationId: id, userId: me.id, role: isAdmin(me) ? 'ADMIN' : 'MEMBER' },
  })
  await db.message.create({
    data: {
      conversationId: id,
      senderId: me.id,
      kind: 'SYSTEM',
      content: `${me.displayName} به ${conv.type === 'CHANNEL' ? 'کانال' : 'گروه'} پیوست 👋`,
    },
  })
  return ok()
}
