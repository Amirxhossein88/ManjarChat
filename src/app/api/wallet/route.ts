import { db } from '@/lib/db'
import { getCurrentUser, safeUser } from '@/lib/auth'
import { ensureSeeded, CONFIG } from '@/lib/seed'
import { ok, err } from '@/lib/api'

const CHECKIN_COOLDOWN_MS = 20 * 3600_000

export async function GET() {
  await ensureSeeded()
  const me = await getCurrentUser()
  if (!me) return err('unauthorized', 401)
  const fresh = await db.user.findUnique({ where: { id: me.id } })
  if (!fresh) return err('unauthorized', 401)

  const txs = await db.transaction.findMany({
    where: { userId: fresh.id },
    orderBy: { createdAt: 'desc' },
    take: 60,
  })
  const nextCheckinAt = fresh.lastCheckinAt ? new Date(fresh.lastCheckinAt.getTime() + CHECKIN_COOLDOWN_MS) : null
  const canCheckin = !nextCheckinAt || nextCheckinAt.getTime() <= Date.now()

  return ok({
    user: safeUser(fresh),
    transactions: txs,
    canCheckin,
    nextCheckinAt,
    checkinBonus: CONFIG.CHECKIN_BONUS,
  })
}
