import { db } from '@/lib/db'
import { getCurrentUser, isAdmin } from '@/lib/auth'
import { ensureSeeded } from '@/lib/seed'
import { ok, err } from '@/lib/api'

/** All conversations for moderation. */
export async function GET() {
  await ensureSeeded()
  const me = await getCurrentUser()
  if (!isAdmin(me)) return err('unauthorized', 403)

  const convs = await db.conversation.findMany({
    orderBy: { createdAt: 'desc' },
    take: 200,
    include: {
      owner: { select: { username: true, displayName: true } },
      _count: { select: { participants: true, messages: true } },
    },
  })

  return ok({
    conversations: convs.map((c) => ({
      id: c.id,
      type: c.type,
      title: c.type === 'DM' ? `گفتگوی خصوصی (${c._count.participants} نفر)` : c.title,
      owner: c.owner.displayName,
      membersCount: c._count.participants,
      messageCount: c._count.messages,
      boostCount: c.boostCount,
      createdAt: c.createdAt,
    })),
  })
}
