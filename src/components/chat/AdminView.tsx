'use client'

import { useCallback, useEffect, useState } from 'react'
import { api, ApiError, fmtDateTime, fmtNum } from '@/lib/client'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { McAvatar } from './bits'
import { useManjar } from './store'
import { toast } from 'sonner'
import { Ban, Coins, Crown, Megaphone, Send, Store, Trash, Unlock } from 'lucide-react'

type AdminUser = {
  id: string
  username: string
  displayName: string
  avatarColor: string
  role: string
  manjarBalance: number
  premium: boolean
  banned: boolean
  online: boolean
  messageCount: number
  createdAt: string
}

type Stats = {
  users: number
  banned: number
  premium: number
  messages: number
  groups: number
  channels: number
  dms: number
  manjarInCirculation: number
  newUsers24h: number
  transactions: number
}

type AdminTx = { id: string; amount: number; kind: string; note: string; createdAt: string; user: { username: string; displayName: string } }
type AdminShopItem = { key: string; name: string; emoji: string; price: number; kind: string; description: string; active: boolean }
type AdminConv = { id: string; type: string; title: string; owner: string; membersCount: number; messageCount: number; boostCount: number }

const TABS = [
  ['stats', '📊 آمار'],
  ['users', '👥 کاربران'],
  ['shop', '🛒 فروشگاه'],
  ['convs', '💬 گفتگوها'],
  ['txs', '📜 تراکنش‌ها'],
  ['broadcast', '📣 اعلان'],
] as const

export default function AdminView() {
  const { me, refreshConversations, openConversation, setView } = useManjar()
  const [tab, setTab] = useState<(typeof TABS)[number][0]>('stats')
  const [stats, setStats] = useState<Stats | null>(null)
  const [topUsers, setTopUsers] = useState<{ username: string; displayName: string; manjarBalance: number; avatarColor: string }[]>([])
  const [users, setUsers] = useState<AdminUser[]>([])
  const [q, setQ] = useState('')
  const [txs, setTxs] = useState<AdminTx[]>([])
  const [items, setItems] = useState<AdminShopItem[]>([])
  const [convs, setConvs] = useState<AdminConv[]>([])
  const [broadcast, setBroadcast] = useState('')
  const [busy, setBusy] = useState(false)

  const loadTab = useCallback(async (t: string) => {
    try {
      if (t === 'stats') {
        const r = await api<{ stats: Stats; topUsers: typeof topUsers }>('/admin/stats')
        setStats(r.stats)
        setTopUsers(r.topUsers)
      } else if (t === 'users') {
        const r = await api<{ users: AdminUser[] }>(`/admin/users?q=${encodeURIComponent(q)}`)
        setUsers(r.users)
      } else if (t === 'txs') {
        const r = await api<{ transactions: AdminTx[] }>('/admin/transactions')
        setTxs(r.transactions)
      } else if (t === 'shop') {
        const r = await api<{ items: AdminShopItem[] }>('/admin/shop')
        setItems(r.items)
      } else if (t === 'convs') {
        const r = await api<{ conversations: AdminConv[] }>('/admin/conversations')
        setConvs(r.conversations)
      }
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'خطا')
    }
  }, [q])

  useEffect(() => {
    loadTab(tab)
  }, [tab, loadTab])

  if (me?.role !== 'ADMIN') {
    return (
      <div className="h-full flex items-center justify-center text-muted-foreground">
        <p>دسترسی ادمین لازم است 👑</p>
      </div>
    )
  }

  async function userAction(userId: string, action: string, amount?: number) {
    try {
      const r = await api<{ note?: string }>('/admin/users', { method: 'PATCH', body: JSON.stringify({ userId, action, amount }) })
      if (r.note) toast.success(r.note)
      loadTab('users')
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'خطا')
    }
  }

  async function sendBroadcast() {
    setBusy(true)
    try {
      const r = await api<{ sent: number }>('/admin/broadcast', { method: 'POST', body: JSON.stringify({ content: broadcast }) })
      toast.success(`📣 اعلان برای ${fmtNum(r.sent)} کاربر ارسال شد`)
      setBroadcast('')
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'خطا')
    } finally {
      setBusy(false)
    }
  }

  async function enterConv(id: string) {
    await api(`/conversations/${id}/join`, { method: 'POST' }).catch(() => {})
    await refreshConversations()
    setView('chat')
    openConversation(id)
  }

  return (
    <div className="h-full flex flex-col" dir="rtl">
      <div className="shrink-0 px-4 md:px-8 pt-5 max-w-6xl mx-auto w-full">
        <h1 className="text-2xl font-extrabold mb-3">👑 پنل مدیریت منجرچت</h1>
        <div className="flex flex-wrap gap-1.5 pb-3">
          {TABS.map(([k, label]) => (
            <button
              key={k}
              onClick={() => setTab(k)}
              className={`px-3.5 py-1.5 rounded-full text-sm font-bold transition-colors ${
                tab === k ? 'bg-primary text-primary-foreground shadow' : 'bg-secondary text-muted-foreground hover:text-foreground'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto mc-scroll px-4 md:px-8 pb-8 max-w-6xl mx-auto w-full">
        {/* ── stats ── */}
        {tab === 'stats' && stats && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {(
                [
                  ['کاربران', fmtNum(stats.users), '👥'],
                  ['پیام‌ها', fmtNum(stats.messages), '💬'],
                  ['منجر در گردش', fmtNum(stats.manjarInCirculation), '🪙'],
                  ['پرمیوم‌ها', fmtNum(stats.premium), '⭐️'],
                  ['گروه‌ها', fmtNum(stats.groups), '👥'],
                  ['کانال‌ها', fmtNum(stats.channels), '📣'],
                  ['چت خصوصی', fmtNum(stats.dms), '💌'],
                  ['کاربر جدید ۲۴س', fmtNum(stats.newUsers24h), '🌱'],
                ] as const
              ).map(([label, value, icon]) => (
                <Card key={label}>
                  <CardContent className="p-4 text-center">
                    <p className="text-2xl">{icon}</p>
                    <p className="text-xl font-extrabold mt-1" dir="ltr">
                      {value}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
            <Card>
              <CardContent className="p-4">
                <h3 className="font-bold mb-2">🪙 ثروتمندترین کاربران</h3>
                <div className="space-y-1.5">
                  {topUsers.map((u, i) => (
                    <div key={u.username} className="flex items-center gap-3 text-sm">
                      <span className="w-6 font-bold text-muted-foreground">{fmtNum(i + 1)}.</span>
                      <McAvatar name={u.displayName} color={u.avatarColor} size={30} />
                      <span className="font-semibold flex-1 truncate">{u.displayName}</span>
                      <span className="font-bold text-amber-500" dir="ltr">
                        🪙 {fmtNum(u.manjarBalance)}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* ── users ── */}
        {tab === 'users' && (
          <div className="space-y-3">
            <Input placeholder="جستجوی کاربر…" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && loadTab('users')} className="bg-card" />
            <div className="space-y-2">
              {users.map((u) => (
                <Card key={u.id} className={u.banned ? 'border-destructive/40 bg-destructive/5' : ''}>
                  <CardContent className="p-3 flex flex-wrap items-center gap-3">
                    <McAvatar name={u.displayName} color={u.avatarColor} size={40} online={u.online} premium={u.premium} />
                    <div className="min-w-36 flex-1">
                      <p className="font-bold text-sm">
                        {u.displayName} {u.role === 'ADMIN' && <Crown className="w-3.5 h-3.5 inline text-amber-500" />}
                        {u.banned && <span className="text-destructive text-xs"> (مسدود)</span>}
                      </p>
                      <p className="text-xs text-muted-foreground" dir="ltr">
                        @{u.username} · 💬 {fmtNum(u.messageCount)}
                      </p>
                    </div>
                    <span className="font-bold text-amber-500 text-sm" dir="ltr">
                      🪙 {fmtNum(u.manjarBalance)}
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      <Button size="sm" variant="secondary" className="h-8 rounded-full gap-1" onClick={() => userAction(u.id, 'mint', 100)}>
                        <Coins className="w-3.5 h-3.5" /> +۱۰۰
                      </Button>
                      <Button size="sm" variant="secondary" className="h-8 rounded-full gap-1" onClick={() => userAction(u.id, 'mint', 1000)}>
                        <Coins className="w-3.5 h-3.5" /> +۱۰۰۰
                      </Button>
                      {u.role === 'ADMIN' ? (
                        <Button size="sm" variant="outline" className="h-8 rounded-full" onClick={() => userAction(u.id, 'demote')}>
                          سلب ادمین
                        </Button>
                      ) : (
                        <Button size="sm" variant="outline" className="h-8 rounded-full" onClick={() => userAction(u.id, 'promote')}>
                          <Crown className="w-3.5 h-3.5" /> ادمین
                        </Button>
                      )}
                      {u.banned ? (
                        <Button size="sm" variant="outline" className="h-8 rounded-full gap-1" onClick={() => userAction(u.id, 'unban')}>
                          <Unlock className="w-3.5 h-3.5" /> رفع مسدودی
                        </Button>
                      ) : (
                        <Button size="sm" variant="destructive" className="h-8 rounded-full gap-1" onClick={() => userAction(u.id, 'ban')}>
                          <Ban className="w-3.5 h-3.5" /> مسدود
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* ── shop ── */}
        {tab === 'shop' && <AdminShop items={items} reload={() => loadTab('shop')} />}

        {/* ── conversations ── */}
        {tab === 'convs' && (
          <div className="space-y-2">
            {convs.map((c) => (
              <Card key={c.id}>
                <CardContent className="p-3 flex flex-wrap items-center gap-3">
                  <span className="text-2xl">{c.type === 'DM' ? '💌' : c.type === 'GROUP' ? '👥' : '📣'}</span>
                  <div className="flex-1 min-w-36">
                    <p className="font-bold text-sm truncate">{c.title}</p>
                    <p className="text-xs text-muted-foreground">
                      سازنده: {c.owner} · {fmtNum(c.membersCount)} عضو · {fmtNum(c.messageCount)} پیام
                      {c.boostCount > 0 && <span className="text-amber-500"> · ⚡️{fmtNum(c.boostCount)}</span>}
                    </p>
                  </div>
                  {c.type !== 'DM' && (
                    <Button size="sm" variant="secondary" className="h-8 rounded-full" onClick={() => enterConv(c.id)}>
                      ورود به چت
                    </Button>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* ── transactions ── */}
        {tab === 'txs' && (
          <div className="space-y-1.5">
            {txs.map((t) => (
              <div key={t.id} className="flex items-center gap-3 rounded-xl bg-card border border-border/60 px-3.5 py-2">
                <span className={`font-bold text-sm w-20 text-center ${t.amount > 0 ? 'text-emerald-500' : t.amount < 0 ? 'text-destructive' : 'text-muted-foreground'}`} dir="ltr">
                  {t.amount > 0 ? '+' : ''}
                  {fmtNum(t.amount)}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm truncate">
                    <b>{t.user.displayName}</b> — {t.note || t.kind}
                  </p>
                  <p className="text-[11px] text-muted-foreground">{fmtDateTime(t.createdAt)}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── broadcast ── */}
        {tab === 'broadcast' && (
          <Card>
            <CardContent className="p-5 space-y-3">
              <h3 className="font-bold flex items-center gap-2">
                <Megaphone className="w-4 h-4" /> اعلان رسمی به همه کاربران
              </h3>
              <p className="text-xs text-muted-foreground">اعلان در گروه عمومی + پیام خصوصی از طرف ربات برای همه ارسال می‌شود.</p>
              <textarea
                value={broadcast}
                onChange={(e) => setBroadcast(e.target.value)}
                rows={4}
                placeholder="متن اعلان…"
                className="w-full rounded-xl bg-card border border-input p-3 text-sm outline-none focus:ring-2 focus:ring-primary/40"
              />
              <Button onClick={sendBroadcast} disabled={busy || broadcast.trim().length < 2} className="font-bold gap-2">
                <Send className="w-4 h-4 rotate-180" /> {busy ? 'در حال ارسال…' : 'ارسال اعلان'}
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}

// ── shop manager ──

function AdminShop({ items, reload }: { items: AdminShopItem[]; reload: () => void }) {
  const [form, setForm] = useState({ key: '', name: '', emoji: '🎁', price: 100, kind: 'GIFT', description: '' })
  const [busy, setBusy] = useState(false)

  async function save() {
    setBusy(true)
    try {
      await api('/admin/shop', { method: 'POST', body: JSON.stringify(form) })
      toast.success('🛒 آیتم ذخیره شد')
      setForm({ key: '', name: '', emoji: '🎁', price: 100, kind: 'GIFT', description: '' })
      reload()
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'خطا')
    } finally {
      setBusy(false)
    }
  }

  async function toggle(key: string) {
    await api(`/admin/shop?key=${encodeURIComponent(key)}`, { method: 'DELETE' }).catch(() => {})
    reload()
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 grid grid-cols-2 md:grid-cols-3 gap-3">
          <Input placeholder="شناسه (key) مثل gift_car" value={form.key} onChange={(e) => setForm({ ...form, key: e.target.value })} className="bg-card" dir="ltr" />
          <Input placeholder="نام آیتم" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="bg-card" />
          <Input placeholder="ایموجی" value={form.emoji} onChange={(e) => setForm({ ...form, emoji: e.target.value })} className="bg-card" />
          <Input type="number" placeholder="قیمت" value={form.price} onChange={(e) => setForm({ ...form, price: Number(e.target.value) })} className="bg-card" />
          <select value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })} className="h-9 rounded-md bg-card border border-input px-2 text-sm">
            <option value="GIFT">هدیه</option>
            <option value="PREMIUM">پرمیوم</option>
            <option value="BOOST">بوست</option>
            <option value="COSMETIC">شخصی‌سازی</option>
          </select>
          <Input placeholder="توضیح" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="bg-card" />
          <Button onClick={save} disabled={busy || !form.key || !form.name} className="col-span-2 md:col-span-3 font-bold gap-2">
            <Store className="w-4 h-4" /> افزودن / به‌روزرسانی آیتم
          </Button>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        {items.map((it) => (
          <Card key={it.key} className={it.active ? '' : 'opacity-50'}>
            <CardContent className="p-3 flex items-center gap-3">
              <span className="text-2xl">{it.emoji}</span>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-sm truncate">{it.name}</p>
                <p className="text-xs text-muted-foreground" dir="ltr">
                  {it.key} · {it.kind} · 🪙 {fmtNum(it.price)}
                </p>
              </div>
              <Button size="sm" variant={it.active ? 'destructive' : 'secondary'} className="h-8 rounded-full gap-1" onClick={() => toggle(it.key)}>
                {it.active ? (
                  <>
                    <Trash className="w-3.5 h-3.5" /> غیرفعال
                  </>
                ) : (
                  'فعال‌سازی'
                )}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
