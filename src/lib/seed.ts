import crypto from 'crypto'
import { db } from './db'
import { hashPassword } from './auth'

// ────────────────────────── tunables (env overridable) ──────────────────────────

export const CONFIG = {
  ADMIN_USERNAME: process.env.ADMIN_USERNAME || 'manjar1388',
  ADMIN_PASSWORD: process.env.ADMIN_PASSWORD || '13881388',
  ADMIN_BALANCE: Number(process.env.ADMIN_BALANCE ?? 1_000_000),
  WELCOME_BONUS: Number(process.env.WELCOME_BONUS ?? 100), // «۱۰۰ منجر خودکار» برای هر کاربر جدید
  CHECKIN_BONUS: Number(process.env.CHECKIN_BONUS ?? 25),
  BOT_USERNAME: 'manjarbot',
  PUBLIC_GROUP_TITLE: 'گروه عمومی منجرچت 🌍',
}

const g = globalThis as unknown as { __manjarSeeding?: Promise<void> }

async function seed(): Promise<void> {
  // settings defaults
  const defaults: Record<string, string> = {
    welcome_bonus: String(CONFIG.WELCOME_BONUS),
    checkin_bonus: String(CONFIG.CHECKIN_BONUS),
    seeded_at: new Date().toISOString(),
  }
  for (const [key, value] of Object.entries(defaults)) {
    await db.settings.upsert({ where: { key }, update: {}, create: { key, value } })
  }

  // ── admin account: manjar1388 / full access ──
  const admin = await db.user.upsert({
    where: { username: CONFIG.ADMIN_USERNAME },
    update: { role: 'ADMIN', banned: false },
    create: {
      username: CONFIG.ADMIN_USERNAME,
      displayName: 'مدیر منجرچت 👑',
      passwordHash: hashPassword(CONFIG.ADMIN_PASSWORD),
      role: 'ADMIN',
      bio: 'مدیر و بنیان‌گذار منجرچت',
      avatarColor: '#f59e0b',
      manjarBalance: CONFIG.ADMIN_BALANCE,
    },
  })

  // official mint transaction for admin (only once)
  const adminTx = await db.transaction.findFirst({ where: { userId: admin.id, kind: 'ADMIN_MINT' } })
  if (!adminTx) {
    await db.transaction.create({
      data: { userId: admin.id, amount: CONFIG.ADMIN_BALANCE, kind: 'ADMIN_MINT', note: 'سرمایه اولیه ادمین', balanceAfter: CONFIG.ADMIN_BALANCE },
    })
  }

  // ── official bot ──
  const bot = await db.user.upsert({
    where: { username: CONFIG.BOT_USERNAME },
    update: {},
    create: {
      username: CONFIG.BOT_USERNAME,
      displayName: 'ربات منجرچت 🤖',
      passwordHash: hashPassword(crypto.randomUUID()),
      role: 'BOT',
      bio: 'ربات رسمی منجرچت — راهنما و پشتیبان',
      avatarColor: '#0ea5a4',
    },
  })

  // ── public lounge group ──
  const publicGroupSetting = await db.settings.findUnique({ where: { key: 'public_group_id' } })
  let publicGroupId = publicGroupSetting?.value
  if (publicGroupId) {
    const exists = await db.conversation.findUnique({ where: { id: publicGroupId } })
    if (!exists) publicGroupId = undefined
  }
  if (!publicGroupId) {
    const conv = await db.conversation.create({
      data: {
        type: 'GROUP',
        title: CONFIG.PUBLIC_GROUP_TITLE,
        about: 'گروه عمومی منجرچت — اینجا همه کاربرها جمع می‌شن! از فروشگاه منجر هم دیدن کن 🪙',
        avatarColor: '#0ea5a4',
        ownerId: admin.id,
        participants: {
          create: [
            { userId: admin.id, role: 'OWNER' },
            { userId: bot.id, role: 'MEMBER' },
          ],
        },
      },
    })
    publicGroupId = conv.id
    await db.settings.upsert({ where: { key: 'public_group_id' }, update: { value: conv.id }, create: { key: 'public_group_id', value: conv.id } })
    await db.message.create({
      data: {
        conversationId: conv.id,
        senderId: bot.id,
        kind: 'SYSTEM',
        content: '🎉 به گروه عمومی منجرچت خوش اومدی! قوانین: احترام، عدم اسپم، لذت بردن.',
      },
    })
  }

  // ── shop items (Manjar replaces Telegram Stars) ──
  const items = [
    { key: 'premium_30', name: 'منجر پرمیوم ۳۰ روزه', emoji: '⭐️', price: 500, kind: 'PREMIUM', description: 'نام طلایی، نشان پرمیوم، آواتار ویژه و حذف محدودیت‌ها برای ۳۰ روز', sortOrder: 1 },
    { key: 'premium_90', name: 'منجر پرمیوم ۹۰ روزه', emoji: '🌟', price: 1200, kind: 'PREMIUM', description: 'سه ماه کامل منجر پرمیوم با ۲۰٪ تخفیف', sortOrder: 2 },
    { key: 'gift_rose', name: 'رز', emoji: '🌹', price: 25, kind: 'GIFT', description: 'یک شاخه رز برای کسی که دوستش داری' },
    { key: 'gift_teddy', name: 'عروسک خرسی', emoji: '🧸', price: 100, kind: 'GIFT', description: 'هدیه‌ای نرم و دوست‌داشتنی' },
    { key: 'gift_rocket', name: 'موشک', emoji: '🚀', price: 250, kind: 'GIFT', description: 'برای کسی که همیشه بالاست' },
    { key: 'gift_diamond', name: 'الماس', emoji: '💎', price: 500, kind: 'GIFT', description: 'قیمتی‌ترین هدیه منجرچت' },
    { key: 'gift_crown', name: 'تاج شاهانه', emoji: '👑', price: 1000, kind: 'GIFT', description: 'تاج مخصوص پادشاه‌ها' },
    { key: 'gift_cake', name: 'کیک تولد', emoji: '🎂', price: 150, kind: 'GIFT', description: 'تولدت مبارک!' },
    { key: 'boost_10', name: 'بوست ۱۰ تایی گروه/کانال', emoji: '⚡️', price: 200, kind: 'BOOST', description: '۱۰ بوست به گروه یا کانال موردعلاقه‌ات اضافه کن' },
    { key: 'color_gold', name: 'رنگ طلایی', emoji: '🎨', price: 150, kind: 'COSMETIC', description: 'آواتار طلایی برای پروفایل شما', sortOrder: 90 },
    { key: 'color_neon', name: 'رنگ نئونی', emoji: '🌈', price: 120, kind: 'COSMETIC', description: 'آواتار نئونی سبز برای پروفایل شما', sortOrder: 91 },
    { key: 'color_rose', name: 'رنگ رزگلد', emoji: '🌸', price: 120, kind: 'COSMETIC', description: 'آواتار رزگلد برای پروفایل شما', sortOrder: 92 },
  ]
  for (const it of items) {
    await db.shopItem.upsert({
      where: { key: it.key },
      update: { name: it.name, emoji: it.emoji, price: it.price, kind: it.kind, description: it.description },
      create: { ...it, active: true },
    })
  }
}

/** Idempotent, race-safe seed. Survives DB wipes: re-seeds whenever the marker is missing. */
export async function ensureSeeded(): Promise<void> {
  if (g.__manjarSeeding) return g.__manjarSeeding
  g.__manjarSeeding = (async () => {
    // create tables first so a totally fresh database works instantly
    const { ensureTables } = await import('./bootstrap')
    await ensureTables()
    const marker = await db.settings.findUnique({ where: { key: 'seeded_at' } }).catch(() => null)
    if (marker) return
    await seed()
  })().finally(() => {
    g.__manjarSeeding = undefined
  })
  return g.__manjarSeeding
}

export async function getPublicGroupId(): Promise<string | null> {
  const s = await db.settings.findUnique({ where: { key: 'public_group_id' } })
  return s?.value ?? null
}
