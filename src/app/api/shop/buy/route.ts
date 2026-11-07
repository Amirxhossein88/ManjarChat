import { db } from '@/lib/db'
import { getCurrentUser, isAdmin } from '@/lib/auth'
import { ensureSeeded } from '@/lib/seed'
import { spendManjar } from '@/lib/manjar'
import { ok, err, readJson } from '@/lib/api'
import { findOrCreateDm } from '@/lib/chat'

const COSMETIC_COLORS: Record<string, string> = {
  color_gold: '#f59e0b',
  color_neon: '#22d3ee',
  color_rose: '#fb7185',
}

export async function POST(req: Request) {
  await ensureSeeded()
  const me = await getCurrentUser()
  if (!me) return err('unauthorized', 401)
  const body = await readJson<{ itemKey?: string; recipientUsername?: string; conversationId?: string; note?: string }>(req)

  const item = await db.shopItem.findUnique({ where: { key: body.itemKey || '' } })
  if (!item || !item.active) return err('این آیتم در فروشگاه موجود نیست')

  try {
    const result = await db.$transaction(async (tx) => {
      const fresh = await tx.user.findUnique({ where: { id: me.id } })
      if (!fresh) throw new Error('USER_NOT_FOUND')

      // ── PREMIUM ──
      if (item.kind === 'PREMIUM') {
        const days = item.key.endsWith('90') ? 90 : 30
        const base = fresh.isPremiumUntil && fresh.isPremiumUntil.getTime() > Date.now() ? fresh.isPremiumUntil : new Date()
        const until = new Date(base.getTime() + days * 86400_000)
        await spendManjar(tx, fresh.id, item.price, 'PURCHASE', `${item.emoji} ${item.name}`)
        await tx.user.update({ where: { id: fresh.id }, data: { isPremiumUntil: until } })
        await tx.purchase.create({
          data: { buyerId: fresh.id, itemKey: item.key, itemName: item.name, itemEmoji: item.emoji, price: item.price },
        })
        return { kind: 'PREMIUM', until }
      }

      // ── GIFT ──
      if (item.kind === 'GIFT') {
        const uname = (body.recipientUsername || '').trim().toLowerCase()
        const recipient = await tx.user.findUnique({ where: { username: uname } })
        if (!recipient) throw new Error('گیرنده پیدا نشد')
        if (recipient.id === fresh.id) throw new Error('خودت را نمی‌توانی هدیه بدهی 😅')

        await spendManjar(tx, fresh.id, item.price, 'GIFT_SENT', `${item.emoji} ${item.name} برای @${recipient.username}`)
        await tx.transaction.create({
          data: {
            userId: recipient.id,
            amount: 0,
            kind: 'GIFT_RECEIVED',
            note: `${item.emoji} ${item.name} از طرف @${fresh.username}`,
            balanceAfter: recipient.manjarBalance,
          },
        })
        await tx.purchase.create({
          data: { buyerId: fresh.id, recipientId: recipient.id, itemKey: item.key, itemName: item.name, itemEmoji: item.emoji, price: item.price },
        })

        const dmId = await findOrCreateDm(tx, fresh.id, recipient.id, fresh.id)
        await tx.message.create({
          data: {
            conversationId: dmId,
            senderId: fresh.id,
            kind: 'GIFT',
            content: body.note ? body.note.slice(0, 500) : `${item.name} برای تو`,
            giftEmoji: item.emoji,
          },
        })
        return { kind: 'GIFT', recipient: recipient.username, conversationId: dmId }
      }

      // ── BOOST ──
      if (item.kind === 'BOOST') {
        const convId = body.conversationId || ''
        const conv = await tx.conversation.findUnique({ where: { id: convId }, include: { participants: true } })
        if (!conv || !['GROUP', 'CHANNEL'].includes(conv.type)) throw new Error('گروه یا کانال انتخاب نشده')
        const member = conv.participants.some((p) => p.userId === fresh.id)
        if (!member && !isAdmin(fresh)) throw new Error('عضو این گفتگو نیستی')
        await spendManjar(tx, fresh.id, item.price, 'BOOST', `⚡️ ۱۰ بوست برای «${conv.title}»`)
        const updated = await tx.conversation.update({ where: { id: conv.id }, data: { boostCount: { increment: 10 } } })
        await tx.message.create({
          data: {
            conversationId: conv.id,
            senderId: fresh.id,
            kind: 'SYSTEM',
            content: `⚡️ ${fresh.displayName} با ${item.price} منجر، ۱۰ بوست به این ${conv.type === 'CHANNEL' ? 'کانال' : 'گروه'} شارژ کرد! (مجموع: ${updated.boostCount})`,
          },
        })
        return { kind: 'BOOST', boostCount: updated.boostCount }
      }

      // ── COSMETIC ──
      const color = COSMETIC_COLORS[item.key]
      if (!color) throw new Error('آیتم نامعتبر')
      await spendManjar(tx, fresh.id, item.price, 'PURCHASE', `${item.emoji} ${item.name}`)
      await tx.user.update({ where: { id: fresh.id }, data: { avatarColor: color } })
      await tx.purchase.create({
        data: { buyerId: fresh.id, itemKey: item.key, itemName: item.name, itemEmoji: item.emoji, price: item.price },
      })
      return { kind: 'COSMETIC', color }
    })

    return ok(result)
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'PURCHASE_FAILED'
    if (msg === 'INSUFFICIENT_MANJAR') return err('موجودی منجر کافی نیست! از چک‌این روزانه یا ادمین شارژ کن 🪙')
    return err(msg)
  }
}
