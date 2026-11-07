import { db } from '@/lib/db'
import { getCurrentUser, isAdmin } from '@/lib/auth'
import { ok, err } from '@/lib/api'

type Params = { params: Promise<{ id: string }> }

export async function POST(_req: Request, { params }: Params) {
  const me = await getCurrentUser()
  if (!me) return err('unauthorized', 401)
  const { id } = await params
  const row = await db.participant.findUnique({ where: { conversationId_userId: { conversationId: id, userId: me.id } } })
  if (!row && !isAdmin(me)) return err('دسترسی نداری', 403)
  await db.participant.upsert({
    where: { conversationId_userId: { conversationId: id, userId: me.id } },
    update: { lastReadAt: new Date() },
    create: { conversationId: id, userId: me.id, lastReadAt: new Date() },
  })
  return ok()
}
