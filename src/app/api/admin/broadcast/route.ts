import { db } from '@/lib/db'
import { getCurrentUser, isAdmin } from '@/lib/auth'
import { ensureSeeded, getPublicGroupId, CONFIG } from '@/lib/seed'
import { ok, err, readJson } from '@/lib/api'

/** Broadcast a system announcement from the official bot to everyone. */
export async function POST(req: Request) {
  await ensureSeeded()
  const me = await getCurrentUser()
  if (!isAdmin(me) || !me) return err('unauthorized', 403)
  const body = await readJson<{ content?: string }>(req)
  const content = (body.content || '').trim().slice(0, 2000)
  if (content.length < 2) return err('متن اعلان خالی است')

  const bot = await db.user.findUnique({ where: { username: CONFIG.BOT_USERNAME } })
  const publicGroupId = await getPublicGroupId()

  // 1) public lounge system message
  if (publicGroupId) {
    await db.message.create({
      data: { conversationId: publicGroupId, senderId: me.id, kind: 'SYSTEM', content: `📣 ${content}` },
    })
  }

  // 2) DM copy to every user (capped)
  const users = await db.user.findMany({
    where: { role: { not: 'BOT' }, banned: false },
    select: { id: true },
    take: 500,
  })
  const { findOrCreateDm } = await import('@/lib/chat')
  if (bot) {
    for (const u of users) {
      if (u.id === me.id) continue
      const dmId = await findOrCreateDm(db, bot.id, u.id, bot.id)
      await db.message.create({
        data: { conversationId: dmId, senderId: bot.id, kind: 'TEXT', content: `📣 اعلان رسمی منجرچت:\n\n${content}` },
      })
    }
  }

  return ok({ sent: users.length })
}
