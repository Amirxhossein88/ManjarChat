'use client'

import { useCallback, useEffect, useState } from 'react'
import { useManjar, type MeUser } from './store'
import { ManjarCoin, McAvatar, AVATAR_COLORS } from './bits'
import { api, ApiError, fmtDateTime, fmtNum } from '@/lib/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { toast } from 'sonner'
import { CalendarCheck, Gem, LogOut, Star, Store } from 'lucide-react'
import { useTheme } from 'next-themes'

// ═══════════════════════ WALLET ═══════════════════════

type Tx = { id: string; amount: number; kind: string; note: string; balanceAfter: number; createdAt: string }

export function WalletView() {
  const { me, setMe, refreshMe } = useManjar()
  const [txs, setTxs] = useState<Tx[]>([])
  const [canCheckin, setCanCheckin] = useState(false)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = await api<{ transactions: Tx[]; canCheckin: boolean; user: MeUser }>('/wallet')
      setTxs(res.transactions)
      setCanCheckin(res.canCheckin)
      setMe(res.user)
    } catch {
      /* ignore */
    }
  }, [setMe])

  useEffect(() => {
    load()
  }, [load])

  async function checkin() {
    setBusy(true)
    try {
      const res = await api<{ balance: number; bonus: number }>('/wallet/checkin', { method: 'POST' })
      toast.success(`📅 چک‌این انجام شد! ${fmtNum(res.bonus)} منجر گرفتی`)
      await load()
      await refreshMe()
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'خطا')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="h-full overflow-y-auto mc-scroll p-4 md:p-8 max-w-3xl mx-auto w-full space-y-5" dir="rtl">
      <h1 className="text-2xl font-extrabold flex items-center gap-2">🪙 کیف پول منجر</h1>

      <Card className="bg-gradient-to-bl from-teal-600 to-emerald-800 border-none text-white overflow-hidden relative">
        <div className="absolute -left-10 -top-10 w-48 h-48 rounded-full bg-amber-300/10 blur-2xl" />
        <CardContent className="p-6 relative">
          <p className="text-sm opacity-80">موجودی منجر شما</p>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-4xl">🪙</span>
            <span className="text-4xl font-extrabold" dir="ltr">
              {fmtNum(me?.manjarBalance ?? 0)}
            </span>
            <span className="text-lg opacity-80">منجر</span>
          </div>
          <div className="flex flex-wrap items-center gap-2 mt-4">
            <Button onClick={checkin} disabled={busy || !canCheckin} className="bg-amber-500 hover:bg-amber-600 text-amber-950 font-bold rounded-full">
              <CalendarCheck className="w-4 h-4" /> {canCheckin ? 'چک‌این روزانه (+۲۵)' : 'چک‌این امروز انجام شده ✓'}
            </Button>
            <Button variant="secondary" onClick={() => (window.location.hash = '#/shop')} className="rounded-full">
              <Store className="w-4 h-4" /> رفتن به فروشگاه
            </Button>
          </div>
          {me?.premium && (
            <p className="text-xs mt-3 bg-white/10 rounded-lg px-3 py-1.5 inline-block">
              <Star className="w-3.5 h-3.5 inline text-amber-300" /> عضویت منجر پرمیوم فعال است
            </p>
          )}
        </CardContent>
      </Card>

      <div>
        <h2 className="font-bold mb-2">گردش حساب</h2>
        {txs.length === 0 && <p className="text-sm text-muted-foreground">هنوز تراکنشی ثبت نشده</p>}
        <div className="space-y-1.5">
          {txs.map((t) => (
            <div key={t.id} className="flex items-center gap-3 rounded-xl bg-card border border-border/60 px-3.5 py-2.5">
              <span className={`font-extrabold text-sm w-24 text-center shrink-0 ${t.amount > 0 ? 'text-emerald-500' : t.amount < 0 ? 'text-destructive' : 'text-muted-foreground'}`} dir="ltr">
                {t.amount > 0 ? '+' : ''}
                {fmtNum(t.amount)}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{t.note || t.kind}</p>
                <p className="text-[11px] text-muted-foreground">{fmtDateTime(t.createdAt)}</p>
              </div>
              <span className="text-[11px] text-muted-foreground shrink-0" dir="ltr">
                🪙 {fmtNum(t.balanceAfter)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════ SHOP ═══════════════════════

type ShopItem = { id: string; key: string; name: string; emoji: string; price: number; kind: string; description: string }

export function ShopView() {
  const { me, setMe, refreshMe, conversations, refreshConversations } = useManjar()
  const [items, setItems] = useState<ShopItem[]>([])
  const [buying, setBuying] = useState<ShopItem | null>(null)
  const [recipient, setRecipient] = useState('')
  const [convId, setConvId] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = await api<{ items: ShopItem[] }>('/shop')
      setItems(res.items)
    } catch {
      /* ignore */
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const groups: [string, ShopItem[]][] = [
    ['⭐️ پرمیوم', items.filter((i) => i.kind === 'PREMIUM')],
    ['🎁 هدایا', items.filter((i) => i.kind === 'GIFT')],
    ['⚡️ بوست', items.filter((i) => i.kind === 'BOOST')],
    ['🎨 شخصی‌سازی', items.filter((i) => i.kind === 'COSMETIC')],
  ]

  async function confirmBuy() {
    if (!buying) return
    setBusy(true)
    try {
      const res = await api<{ kind: string; conversationId?: string }>('/shop/buy', {
        method: 'POST',
        body: JSON.stringify({
          itemKey: buying.key,
          recipientUsername: buying.kind === 'GIFT' ? recipient.trim().toLowerCase() : undefined,
          conversationId: buying.kind === 'BOOST' ? convId : undefined,
          note: note || undefined,
        }),
      })
      toast.success(`✅ «${buying.name}» با موفقیت خریداری شد!`)
      setBuying(null)
      setNote('')
      await Promise.all([load(), refreshMe(), refreshConversations()])
      if (res.kind === 'GIFT' && res.conversationId) {
        // open the DM where the gift landed
        window.location.hash = '#/chat'
        useManjar.getState().openConversation(res.conversationId)
      }
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'خرید ناموفق بود')
    } finally {
      setBusy(false)
    }
  }

  const groupChats = conversations.filter((c) => c.type === 'GROUP' || c.type === 'CHANNEL')

  return (
    <div className="h-full overflow-y-auto mc-scroll p-4 md:p-8 max-w-4xl mx-auto w-full space-y-6" dir="rtl">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-extrabold flex items-center gap-2">🛒 فروشگاه منجر</h1>
        <ManjarCoin amount={me?.manjarBalance ?? 0} className="text-lg bg-amber-500/10 rounded-full px-4 py-1.5 border border-amber-500/30" />
      </div>

      {groups
        .filter(([, list]) => list.length)
        .map(([title, list]) => (
          <section key={title}>
            <h2 className="font-bold mb-2.5">{title}</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {list.map((it) => (
                <Card key={it.key} className="border-border/70 hover:border-primary/50 transition-colors">
                  <CardContent className="p-4 flex flex-col items-center text-center gap-1.5">
                    <span className="text-4xl">{it.emoji}</span>
                    <p className="font-bold text-sm">{it.name}</p>
                    <p className="text-[11px] text-muted-foreground leading-relaxed min-h-8">{it.description}</p>
                    <Button
                      size="sm"
                      className="w-full mt-1 rounded-full font-bold bg-amber-500 hover:bg-amber-600 text-amber-950"
                      onClick={() => {
                        setBuying(it)
                        setRecipient('')
                        setNote('')
                        setConvId(groupChats[0]?.id || '')
                      }}
                    >
                      🪙 {fmtNum(it.price)}
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        ))}

      {/* buy dialog */}
      <Dialog open={!!buying} onOpenChange={(v) => !v && setBuying(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span className="text-3xl">{buying?.emoji}</span> خرید {buying?.name}
            </DialogTitle>
            <DialogDescription>
              قیمت: <b className="text-amber-500">🪙 {fmtNum(buying?.price ?? 0)} منجر</b> — موجودی شما: 🪙 {fmtNum(me?.manjarBalance ?? 0)}
            </DialogDescription>
          </DialogHeader>

          {buying?.kind === 'GIFT' && (
            <div className="space-y-3">
              <div>
                <label className="text-sm font-semibold">گیرنده (آیدی کاربر)</label>
                <Input dir="ltr" placeholder="username" value={recipient} onChange={(e) => setRecipient(e.target.value)} className="mt-1 text-left bg-card" />
                <p className="text-[11px] text-muted-foreground mt-1">هدیه به‌صورت پیام ویژه به چت خصوصی طرف ارسال می‌شود</p>
              </div>
              <div>
                <label className="text-sm font-semibold">پیام همراه (اختیاری)</label>
                <Input placeholder="مثلاً: تقدیم به تو 🌹" value={note} onChange={(e) => setNote(e.target.value)} className="mt-1 bg-card" />
              </div>
            </div>
          )}

          {buying?.kind === 'BOOST' && (
            <div>
              <label className="text-sm font-semibold">گروه یا کانال موردنظر</label>
              <select value={convId} onChange={(e) => setConvId(e.target.value)} className="w-full mt-1 h-10 rounded-xl bg-card border border-input px-3 text-sm">
                {groupChats.length === 0 && <option value="">هیچ گروه/کانالی نداری — اول یکی بساز</option>}
                {groupChats.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.type === 'CHANNEL' ? '📣' : '👥'} {c.title}
                  </option>
                ))}
              </select>
            </div>
          )}

          {buying?.kind === 'PREMIUM' && (
            <p className="text-sm text-muted-foreground leading-relaxed">
              با منجر پرمیوم: نام طلایی ⭐️، نشان ویژه کنار اسم، اولویت در لیست‌ها و حمایت از منجرچت ❤️
            </p>
          )}

          {buying?.kind === 'COSMETIC' && (
            <p className="text-sm text-muted-foreground">رنگ آواتار پروفایل شما بلافاصله عوض می‌شود ✨</p>
          )}

          <DialogFooter>
            <Button variant="secondary" onClick={() => setBuying(null)}>
              انصراف
            </Button>
            <Button
              onClick={confirmBuy}
              disabled={busy || (buying?.kind === 'GIFT' && !recipient.trim()) || (buying?.kind === 'BOOST' && !convId)}
              className="font-bold bg-amber-500 hover:bg-amber-600 text-amber-950"
            >
              {busy ? 'در حال پردازش…' : `پرداخت 🪙 ${fmtNum(buying?.price ?? 0)}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ═══════════════════════ SETTINGS ═══════════════════════

export function SettingsView() {
  const { me, setMe, logout } = useManjar()
  const { theme, setTheme } = useTheme()
  const [displayName, setDisplayName] = useState(me?.displayName || '')
  const [bio, setBio] = useState(me?.bio || '')
  const [color, setColor] = useState(me?.avatarColor || '#0d9488')
  const [busy, setBusy] = useState(false)

  if (!me) return null

  async function save() {
    setBusy(true)
    try {
      await api('/users/profile', { method: 'PATCH', body: JSON.stringify({ displayName, bio, avatarColor: color }) })
      toast.success('✅ پروفایل ذخیره شد')
      const res = await api<{ user: MeUser }>('/auth/me')
      setMe(res.user)
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'خطا')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="h-full overflow-y-auto mc-scroll p-4 md:p-8 max-w-2xl mx-auto w-full space-y-5" dir="rtl">
      <h1 className="text-2xl font-extrabold">⚙️ تنظیمات</h1>

      <Card>
        <CardContent className="p-5 space-y-4">
          <div className="flex items-center gap-4">
            <McAvatar name={displayName || me.username} color={color} size={72} premium={me.premium} />
            <div className="min-w-0">
              <p className="font-bold text-lg truncate">{displayName || me.username}</p>
              <p className="text-sm text-muted-foreground" dir="ltr">
                @{me.username}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {me.role === 'ADMIN' ? '👑 مدیر کل منجرچت' : 'کاربر'} {me.premium && '· ⭐️ پرمیوم'}
              </p>
            </div>
          </div>

          <div>
            <label className="text-sm font-semibold">نام نمایشی</label>
            <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} className="mt-1 bg-card" maxLength={40} />
          </div>
          <div>
            <label className="text-sm font-semibold">بیوگرافی</label>
            <Input value={bio} onChange={(e) => setBio(e.target.value)} className="mt-1 bg-card" maxLength={120} />
          </div>
          <div>
            <label className="text-sm font-semibold">رنگ آواتار</label>
            <div className="flex flex-wrap gap-2 mt-2">
              {AVATAR_COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  className={`w-9 h-9 rounded-full transition-transform hover:scale-110 ${color === c ? 'ring-2 ring-offset-2 ring-primary ring-offset-background' : ''}`}
                  style={{ background: c }}
                />
              ))}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">💡 رنگ‌های ویژه‌تر را از فروشگاه بخش «شخصی‌سازی» بخر</p>
          </div>

          <Button onClick={save} disabled={busy} className="font-bold">
            {busy ? 'در حال ذخیره…' : 'ذخیره تغییرات'}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-5 space-y-3">
          <h2 className="font-bold">ظاهر و حساب</h2>
          <div className="flex items-center justify-between">
            <span className="text-sm">حالت نمایش</span>
            <Button variant="secondary" size="sm" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} className="rounded-full">
              {theme === 'dark' ? '☀️ روشن' : '🌙 تاریک'}
            </Button>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm">خروج از حساب</span>
            <Button
              variant="destructive"
              size="sm"
              onClick={async () => {
                await logout()
                window.location.hash = ''
              }}
              className="rounded-full"
            >
              <LogOut className="w-4 h-4" /> خروج
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-5 text-sm text-muted-foreground space-y-1">
          <p className="font-bold text-foreground flex items-center gap-1.5">
            <Gem className="w-4 h-4 text-teal-500" /> درباره منجرچت
          </p>
          <p>منجرچت نسخه ۱.۰ — مسنجر مستقل با اقتصاد «منجر»؛ ساخته‌شده با Next.js و Prisma.</p>
          <p>🎙 پیام صوتی · 🖋 پیام متنی · 🖼 عکس · 📎 فایل · 👥 گروه · 📣 کانال · 🪙 کیف پول · 🛒 فروشگاه · 👑 پنل ادمین</p>
        </CardContent>
      </Card>
    </div>
  )
}
