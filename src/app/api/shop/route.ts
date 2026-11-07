import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { ensureSeeded } from '@/lib/seed'
import { ok, err } from '@/lib/api'

export async function GET() {
  await ensureSeeded()
  const me = await getCurrentUser()
  if (!me) return err('unauthorized', 401)
  const items = await db.shopItem.findMany({ where: { active: true }, orderBy: [{ sortOrder: 'asc' }, { price: 'asc' }] })
  return ok({ items, balance: me.manjarBalance })
}
