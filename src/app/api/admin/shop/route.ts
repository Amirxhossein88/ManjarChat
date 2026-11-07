import { db } from '@/lib/db'
import { getCurrentUser, isAdmin } from '@/lib/auth'
import { ensureSeeded } from '@/lib/seed'
import { ok, err, readJson } from '@/lib/api'

export async function GET() {
  await ensureSeeded()
  const me = await getCurrentUser()
  if (!isAdmin(me)) return err('unauthorized', 403)
  const items = await db.shopItem.findMany({ orderBy: [{ sortOrder: 'asc' }, { price: 'asc' }] })
  return ok({ items })
}

export async function POST(req: Request) {
  await ensureSeeded()
  const me = await getCurrentUser()
  if (!isAdmin(me) || !me) return err('unauthorized', 403)
  const body = await readJson<{
    key?: string
    name?: string
    emoji?: string
    price?: number
    kind?: string
    description?: string
    active?: boolean
  }>(req)

  const key = (body.key || '').trim().toLowerCase().replace(/[^a-z0-9_]/g, '_')
  const name = (body.name || '').trim()
  const price = Math.max(0, Math.round(body.price ?? 0))
  const kind = body.kind || 'GIFT'
  if (!key || !name) return err('شناسه و نام آیتم الزامی است')
  if (!['PREMIUM', 'GIFT', 'BOOST', 'COSMETIC'].includes(kind)) return err('نوع آیتم نامعتبر است')

  const item = await db.shopItem.upsert({
    where: { key },
    update: { name, emoji: body.emoji || '🎁', price, kind, description: body.description || '', active: body.active ?? true },
    create: { key, name, emoji: body.emoji || '🎁', price, kind, description: body.description || '', active: body.active ?? true, sortOrder: 50 },
  })
  return ok({ item })
}

export async function DELETE(req: Request) {
  await ensureSeeded()
  const me = await getCurrentUser()
  if (!isAdmin(me)) return err('unauthorized', 403)
  const key = (new URL(req.url).searchParams.get('key') || '').trim()
  const item = await db.shopItem.findUnique({ where: { key } })
  if (!item) return err('آیتم پیدا نشد', 404)
  await db.shopItem.update({ where: { key }, data: { active: !item.active } })
  return ok({ active: !item.active })
}
