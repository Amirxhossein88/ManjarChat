import { db } from '@/lib/db'
import { getCurrentUser, isAdmin, safeUser } from '@/lib/auth'
import { ensureSeeded } from '@/lib/seed'
import { grantManjar } from '@/lib/manjar'
import { ok, err, readJson } from '@/lib/api'

export async function GET(req: Request) {
  await ensureSeeded()
  const me = await getCurrentUser()
  if (!isAdmin(me)) return err('unauthorized', 403)
  const q = (new URL(req.url).searchParams.get('q') || '').trim().toLowerCase()

  const users = await db.user.findMany({
    where: q ? { OR: [{ username: { contains: q } }, { displayName: { contains: q } }] } : {},
    orderBy: { createdAt: 'desc' },
    take: 200,
    include: { _count: { select: { messages: true } } },
  })

  return ok({
    users: users.map((u) => ({
      ...safeUser(u),
      banned: u.banned,
      messageCount: u._count.messages,
    })),
  })
}

export async function PATCH(req: Request) {
  await ensureSeeded()
  const me = await getCurrentUser()
  if (!isAdmin(me) || !me) return err('unauthorized', 403)
  const body = await readJson<{ userId?: string; action?: string; amount?: number }>(req)
  const target = await db.user.findUnique({ where: { id: body.userId || '' } })
  if (!target) return err('کاربر پیدا نشد', 404)
  if (target.id === me.id && ['ban', 'demote'].includes(body.action || '')) {
    return err('نمی‌توانی این کار را روی خودت انجام دهی!')
  }

  switch (body.action) {
    case 'ban':
      await db.user.update({ where: { id: target.id }, data: { banned: true } })
      await db.session.deleteMany({ where: { userId: target.id } })
      return ok({ note: 'کاربر مسدود شد' })
    case 'unban':
      await db.user.update({ where: { id: target.id }, data: { banned: false } })
      return ok()
    case 'promote':
      await db.user.update({ where: { id: target.id }, data: { role: 'ADMIN' } })
      return ok({ note: 'کاربر ادمین شد 👑' })
    case 'demote':
      await db.user.update({ where: { id: target.id }, data: { role: 'USER' } })
      return ok()
    case 'mint': {
      const amount = Math.max(1, Math.min(Math.round(body.amount || 0), 10_000_000))
      const balance = await db.$transaction(async (tx) => grantManjar(tx, target.id, amount, 'ADMIN_MINT', `👑 شارژ دستی توسط @${me.username}`))
      return ok({ balance, note: `${amount.toLocaleString('fa-IR')} منجر به @${target.username} اضافه شد` })
    }
    case 'deduct': {
      const amount = Math.max(1, Math.min(Math.round(body.amount || 0), 10_000_000))
      const balance = await db.$transaction(async (tx) => grantManjar(tx, target.id, -amount, 'ADMIN_DEDUCT', `👑 کسر دستی توسط @${me.username}`))
      return ok({ balance, note: `${amount.toLocaleString('fa-IR')} منجر از @${target.username} کم شد` })
    }
    default:
      return err('action نامعتبر است')
  }
}
