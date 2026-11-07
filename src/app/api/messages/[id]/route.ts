import { db } from '@/lib/db'
import { getCurrentUser, isAdmin } from '@/lib/auth'
import { ok, err, readJson } from '@/lib/api'
import { serializeMessage, EMOJI_SETS } from '@/lib/chat'

type Params = { params: Promise<{ id: string }> }

async function loadMessage(id: string) {
  return db.message.findUnique({
    where: { id },
    include: {
      sender: { select: { id: true, username: true, displayName: true, avatarColor: true, role: true, isPremiumUntil: true } },
      parent: { include: { sender: { select: { displayName: true } } } },
      reactions: true,
    },
  })
}

export async function PATCH(req: Request, { params }: Params) {
  const me = await getCurrentUser()
  if (!me) return err('unauthorized', 401)
  const { id } = await params
  const body = await readJson<{ action?: string; emoji?: string; content?: string }>(req)

  const msg = await db.message.findUnique({ where: { id }, include: { conversation: { include: { participants: true } } } })
  if (!msg || msg.deleted) return err('پیام پیدا نشد', 404)
  const myRow = msg.conversation.participants.find((p) => p.userId === me.id)
  const admin = isAdmin(me)
  const isConvOwner = msg.conversation.ownerId === me.id

  switch (body.action) {
    case 'react': {
      const emoji = (body.emoji || '').slice(0, 8)
      if (!EMOJI_SETS.includes(emoji)) return err('ایموجی مجاز نیست')
      const existing = await db.reaction.findUnique({
        where: { messageId_userId: { messageId: id, userId: me.id } },
      })
      if (existing?.emoji === emoji) {
        await db.reaction.delete({ where: { id: existing.id } })
      } else if (existing) {
        await db.reaction.update({ where: { id: existing.id }, data: { emoji } })
      } else {
        await db.reaction.create({ data: { messageId: id, userId: me.id, emoji } })
      }
      break
    }
    case 'pin':
    case 'unpin': {
      const canPin = admin || isConvOwner || myRow?.role === 'OWNER' || myRow?.role === 'ADMIN' || msg.conversation.type === 'DM'
      if (!canPin) return err('اجازه سنجاق کردن نداری', 403)
      await db.message.update({ where: { id }, data: { pinned: body.action === 'pin' } })
      break
    }
    case 'edit': {
      if (msg.senderId !== me.id) return err('فقط نویسنده می‌تواند ویرایش کند', 403)
      if (msg.kind !== 'TEXT') return err('فقط پیام متنی قابل ویرایش است')
      const content = (body.content || '').slice(0, 4000).trim()
      if (!content) return err('متن خالی است')
      await db.message.update({ where: { id }, data: { content } })
      break
    }
    default:
      return err('action نامعتبر است')
  }

  const fresh = await loadMessage(id)
  return ok({ message: fresh ? serializeMessage(fresh, me.id) : null })
}

export async function DELETE(_req: Request, { params }: Params) {
  const me = await getCurrentUser()
  if (!me) return err('unauthorized', 401)
  const { id } = await params

  const msg = await db.message.findUnique({ where: { id }, include: { conversation: { include: { participants: true } } } })
  if (!msg || msg.deleted) return err('پیام پیدا نشد', 404)
  const myRow = msg.conversation.participants.find((p) => p.userId === me.id)
  const canDelete = isAdmin(me) || msg.senderId === me.id || msg.conversation.ownerId === me.id || myRow?.role === 'OWNER' || myRow?.role === 'ADMIN'
  if (!canDelete) return err('اجازه حذف این پیام را نداری', 403)

  await db.message.update({ where: { id }, data: { deleted: true, deletedAt: new Date(), pinned: false, content: '' } })
  return ok()
}
