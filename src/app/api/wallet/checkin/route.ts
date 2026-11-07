import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { ensureSeeded, CONFIG } from '@/lib/seed'
import { grantManjar } from '@/lib/manjar'
import { ok, err } from '@/lib/api'

const CHECKIN_COOLDOWN_MS = 20 * 3600_000

export async function POST() {
  await ensureSeeded()
  const me = await getCurrentUser()
  if (!me) return err('unauthorized', 401)
  const fresh = await db.user.findUnique({ where: { id: me.id } })
  if (!fresh) return err('unauthorized', 401)
  if (fresh.lastCheckinAt && fresh.lastCheckinAt.getTime() + CHECKIN_COOLDOWN_MS > Date.now()) {
    return err('چک‌این امروز انجام شده! فردا دوباره بیا 🌙')
  }
  const balance = await db.$transaction(async (tx) => {
    await tx.user.update({ where: { id: fresh.id }, data: { lastCheckinAt: new Date() } })
    return grantManjar(tx, fresh.id, CONFIG.CHECKIN_BONUS, 'CHECKIN', '📅 چک‌این روزانه')
  })
  return ok({ balance, bonus: CONFIG.CHECKIN_BONUS })
}
