import { db } from '@/lib/db'
import { getCurrentUser, isAdmin } from '@/lib/auth'
import { ensureSeeded } from '@/lib/seed'
import { ok, err } from '@/lib/api'

export async function GET() {
  await ensureSeeded()
  const me = await getCurrentUser()
  if (!isAdmin(me) || !me) return err('unauthorized', 403)

  const dayAgo = new Date(Date.now() - 86400_000)
  const [users, banned, premium, messages, groups, channels, dms, balances, newUsers24h, txCount, purchases] = await Promise.all([
    db.user.count(),
    db.user.count({ where: { banned: true } }),
    db.user.count({ where: { isPremiumUntil: { gt: new Date() } } }),
    db.message.count({ where: { deleted: false } }),
    db.conversation.count({ where: { type: 'GROUP' } }),
    db.conversation.count({ where: { type: 'CHANNEL' } }),
    db.conversation.count({ where: { type: 'DM' } }),
    db.user.aggregate({ _sum: { manjarBalance: true } }),
    db.user.count({ where: { createdAt: { gte: dayAgo } } }),
    db.transaction.count(),
    db.purchase.findMany({ orderBy: { createdAt: 'desc' }, take: 10, include: { buyer: { select: { username: true, displayName: true } }, recipient: { select: { username: true, displayName: true } } } }),
  ])

  const topUsers = await db.user.findMany({ orderBy: { manjarBalance: 'desc' }, take: 5, select: { username: true, displayName: true, manjarBalance: true, avatarColor: true } })

  return ok({
    stats: {
      users,
      banned,
      premium,
      messages,
      groups,
      channels,
      dms,
      manjarInCirculation: balances._sum.manjarBalance ?? 0,
      newUsers24h,
      transactions: txCount,
    },
    topUsers,
    recentPurchases: purchases,
  })
}
