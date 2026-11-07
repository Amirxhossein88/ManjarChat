import { db } from '@/lib/db'
import { createSession, hashPassword, safeUser } from '@/lib/auth'
import { ensureSeeded, getPublicGroupId, CONFIG } from '@/lib/seed'
import { grantManjar } from '@/lib/manjar'
import { ok, err, readJson } from '@/lib/api'
import { findOrCreateDm } from '@/lib/chat'

export async function POST(req: Request) {
  await ensureSeeded()
  const body = await readJson<{ username?: string; password?: string; displayName?: string }>(req)
  const username = (body.username || '').trim().toLowerCase()
  const password = body.password || ''
  const displayName = (body.displayName || '').trim() || username

  if (!/^[a-z0-9_]{3,32}$/.test(username)) {
    return err('نام کاربری باید ۳ تا ۳۲ حرف انگلیسی، عدد یا _ باشد')
  }
  if (password.length < 6) return err('رمز عبور باید حداقل ۶ کاراکتر باشد')
  if (['manjarbot'].includes(username)) return err('این نام کاربری رزرو شده است')

  const exists = await db.user.findUnique({ where: { username } })
  if (exists) return err('این نام کاربری قبلاً ثبت شده است')

  const welcome = CONFIG.WELCOME_BONUS
  const publicGroupId = await getPublicGroupId()

  const user = await db.$transaction(async (tx) => {
    const u = await tx.user.create({
      data: {
        username,
        displayName,
        passwordHash: hashPassword(password),
        bio: 'کاربر تازه منجرچت',
      },
    })
    await grantManjar(tx, u.id, welcome, 'WELCOME', `🎁 هدیه خوش‌آمدگویی ${welcome} منجری`)
    // auto-join the public lounge
    if (publicGroupId) {
      await tx.participant
        .create({ data: { conversationId: publicGroupId, userId: u.id, role: 'MEMBER' } })
        .catch(() => {})
    }
    return u
  })

  // welcome DM from the official bot
  const bot = await db.user.findUnique({ where: { username: CONFIG.BOT_USERNAME } })
  if (bot) {
    const dmId = await findOrCreateDm(db, bot.id, user.id, bot.id)
    await db.message.create({
      data: {
        conversationId: dmId,
        senderId: bot.id,
        kind: 'TEXT',
        content: [
          `سلام ${displayName} عزیز! 👋`,
          `به منجرچت خوش اومدی — مسنجر سریع با اقتصاد «منجر» 🪙`,
          ``,
          `✅ ${welcome} منجر هدیه خوش‌آمدگویی به کیف پولت اضافه شد`,
          `📅 هر روز وارد بشی ۲۵ منجر چک‌این بگیر`,
          `🛒 توی فروشگاه می‌تونی پرمیوم، هدیه و بوست بخری`,
          `🎙 می‌تونی پیام صوتی ضبط کنی و عکس بفرستی`,
          `🌍 توی «گروه عمومی منجرچت» بقیه رو پیدا کن`,
        ].join('\n'),
      },
    })
  }

  await createSession(user.id)
  const fresh = await db.user.findUnique({ where: { id: user.id } })
  return ok({ user: fresh ? safeUser(fresh) : safeUser(user) })
}
