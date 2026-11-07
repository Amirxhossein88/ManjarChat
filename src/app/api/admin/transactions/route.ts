import { db } from '@/lib/db'
import { getCurrentUser, isAdmin } from '@/lib/auth'
import { ensureSeeded } from '@/lib/seed'
import { ok, err } from '@/lib/api'

export async function GET() {
  await ensureSeeded()
  const me = await getCurrentUser()
  if (!isAdmin(me)) return err('unauthorized', 403)
  const txs = await db.transaction.findMany({
    orderBy: { createdAt: 'desc' },
    take: 120,
    include: { user: { select: { username: true, displayName: true, avatarColor: true } } },
  })
  return ok({ transactions: txs })
}
