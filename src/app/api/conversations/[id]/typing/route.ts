import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { ok, err } from '@/lib/api'

type Params = { params: Promise<{ id: string }> }

export async function POST(_req: Request, { params }: Params) {
  const me = await getCurrentUser()
  if (!me) return err('unauthorized', 401)
  const { id } = await params
  await db.participant.updateMany({
    where: { conversationId: id, userId: me.id },
    data: { typingAt: new Date() },
  })
  return ok()
}
