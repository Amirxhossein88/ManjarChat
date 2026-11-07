import { db } from '@/lib/db'
import { getCurrentUser, safeUser } from '@/lib/auth'
import { ensureSeeded } from '@/lib/seed'
import { ok, err } from '@/lib/api'

/** Directory of users for starting chats (bot and self excluded). */
export async function GET(req: Request) {
  await ensureSeeded()
  const me = await getCurrentUser()
  if (!me) return err('unauthorized', 401)
  const q = (new URL(req.url).searchParams.get('q') || '').trim().toLowerCase()

  const users = await db.user.findMany({
    where: {
      id: { not: me.id },
      role: { not: 'BOT' },
      banned: false,
      ...(q
        ? {
            OR: [{ username: { contains: q } }, { displayName: { contains: q } }],
          }
        : {}),
    },
    orderBy: { lastSeenAt: 'desc' },
    take: 60,
  })

  return ok({ users: users.map(safeUser) })
}
