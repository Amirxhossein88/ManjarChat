'use client'

import { useMemo, useState } from 'react'
import { useManjar, type ConversationItem } from './store'
import { McAvatar, ManjarCoin, TypingDots } from './bits'
import { fmtTime } from '@/lib/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { MessageSquare, Users, Radio, Search, Wallet, Store, Settings, Shield, LogOut, X, Moon, Sun } from 'lucide-react'
import { useTheme } from 'next-themes'
import { api, fmtNum, lastSeenText } from '@/lib/client'

const KIND_ICON: Record<string, string> = { VOICE: '🎙', IMAGE: '🖼', FILE: '📎', GIFT: '🎁', DELETED: '🚫' }

function lastLine(c: ConversationItem): string {
  if (c.typing.length) return 'در حال نوشتن…'
  const lm = c.lastMessage
  if (!lm) return 'بدون پیام'
  const prefix = c.type !== 'DM' && lm.senderName ? `${lm.mine ? 'شما' : lm.senderName}: ` : ''
  const icon = KIND_ICON[lm.kind] || ''
  const text = lm.kind === 'DELETED' ? 'پیام حذف شد' : lm.content || icon
  return `${prefix}${icon && lm.kind !== 'TEXT' ? icon + ' ' : ''}${text}`
}

export default function Sidebar({ onNewChat }: { onNewChat: () => void }) {
  const { me, conversations, activeId, view, setView, openConversation, closeConversation, refreshMe, logout } = useManjar()
  const [q, setQ] = useState('')
  const { theme, setTheme } = useTheme()

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase()
    if (!s) return conversations
    return conversations.filter(
      (c) => c.title.toLowerCase().includes(s) || (c.peer?.username || '').toLowerCase().includes(s) || (c.lastMessage?.content || '').toLowerCase().includes(s),
    )
  }, [conversations, q])

  const totalUnread = conversations.reduce((a, c) => a + c.unread, 0)
  const isAdmin = me?.role === 'ADMIN'

  async function handleLogout() {
    await logout()
    window.location.hash = ''
  }

  async function refreshBalance() {
    await refreshMe()
  }

  const navBtn = (key: string, icon: React.ReactNode, label: string, badge?: number, adminOnly?: boolean) =>
    (adminOnly && !isAdmin) || (key === 'chat' && false) ? null : (
      <button
        key={key}
        title={label}
        onClick={() => {
          setView(key)
          window.location.hash = `#/${key}`
          if (key === 'chat') closeConversation()
        }}
        className={`relative flex flex-col items-center justify-center gap-0.5 w-14 py-2 rounded-2xl transition-colors ${
          view === key ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
        }`}
      >
        {icon}
        {!!badge && badge > 0 && (
          <span className="absolute top-1 left-1 min-w-4 h-4 px-1 rounded-full bg-amber-500 text-[10px] text-white flex items-center justify-center font-bold">
            {badge > 99 ? '99+' : fmtNum(badge)}
          </span>
        )}
        <span className="text-[10px] font-medium">{label}</span>
      </button>
    )

  return (
    <div className="h-full w-full flex">
      {/* nav rail */}
      <nav className="w-16 shrink-0 flex flex-col items-center gap-1 py-3 border-e border-border bg-sidebar">
        <div className="mb-2">
          { }
          <img src="/manjar-icon.svg" alt="منجرچت" className="w-9 h-9" />
        </div>
        <div className="flex flex-col gap-1 flex-1">
          {navBtn('chat', <MessageSquare className="w-5 h-5" />, 'چت‌ها', totalUnread)}
          {navBtn('wallet', <Wallet className="w-5 h-5" />, 'کیف پول')}
          {navBtn('shop', <Store className="w-5 h-5" />, 'فروشگاه')}
          {navBtn('admin', <Shield className="w-5 h-5" />, 'ادمین', 0, true)}
          {navBtn('settings', <Settings className="w-5 h-5" />, 'تنظیمات')}
        </div>
        <button
          title={theme === 'dark' ? 'حالت روشن' : 'حالت تاریک'}
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          className="w-11 h-11 rounded-2xl flex items-center justify-center text-muted-foreground hover:bg-secondary hover:text-foreground"
        >
          {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
        </button>
        <button
          title="خروج"
          onClick={handleLogout}
          className="w-11 h-11 rounded-2xl flex items-center justify-center text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
        >
          <LogOut className="w-5 h-5" />
        </button>
      </nav>

      {/* conversation list */}
      <div className="flex-1 flex flex-col min-w-0 bg-sidebar border-e border-border">
        {/* profile + balance */}
        <div className="p-3 border-b border-border flex items-center gap-2.5">
          {me && <McAvatar name={me.displayName} color={me.avatarColor} size={42} online premium={me.premium} />}
          <div className="flex-1 min-w-0">
            <p className="font-bold text-sm truncate">{me?.displayName}</p>
            <button onClick={refreshBalance} className="flex items-center gap-1 text-xs hover:opacity-80" title="برای به‌روزرسانی کلیک کن">
              <ManjarCoin amount={me?.manjarBalance ?? 0} className="text-[13px]" />
            </button>
          </div>
          <Button size="sm" onClick={onNewChat} className="rounded-full h-9 px-3 font-bold gap-1">
            <span className="text-lg leading-none">＋</span> جدید
          </Button>
        </div>

        {/* search */}
        <div className="p-2.5">
          <div className="relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="جستجو در گفتگوها…" className="pr-9 h-9 bg-secondary/60 border-none rounded-xl" />
            {q && (
              <button onClick={() => setQ('')} className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* list */}
        <div className="flex-1 overflow-y-auto mc-scroll px-2 pb-2 space-y-0.5">
          {filtered.length === 0 && (
            <div className="text-center text-sm text-muted-foreground py-10 leading-relaxed">
              گفتگویی نیست 🌱
              <br />
              با دکمه «جدید» یک چت شروع کن!
            </div>
          )}
          {filtered.map((c) => {
            const active = c.id === activeId && view === 'chat'
            const isTyping = c.typing.length > 0
            return (
              <button
                key={c.id}
                onClick={() => {
                  setView('chat')
                  openConversation(c.id)
                }}
                className={`w-full flex items-center gap-3 p-2.5 rounded-2xl text-right transition-colors ${
                  active ? 'bg-primary/15' : 'hover:bg-secondary/70'
                }`}
              >
                <McAvatar name={c.title} color={c.avatarColor} size={46} online={c.peer?.online} premium={c.peer?.premium} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1">
                    <span className="font-bold text-sm truncate flex-1">
                      {c.type === 'CHANNEL' && '📣 '}
                      {c.type === 'GROUP' && '👥 '}
                      {c.title}
                    </span>
                    {c.lastMessage && <span className="text-[10px] text-muted-foreground shrink-0">{fmtTime(c.lastMessage.createdAt)}</span>}
                  </div>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    {isTyping ? (
                      <span className="text-primary flex items-center gap-1">
                        <TypingDots /> در حال نوشتن…
                      </span>
                    ) : (
                      <span className="truncate flex-1">{lastLine(c)}</span>
                    )}
                    {c.unread > 0 && (
                      <span className="min-w-5 h-5 px-1.5 rounded-full bg-emerald-500 text-white text-[10px] flex items-center justify-center font-bold shrink-0">
                        {fmtNum(c.unread)}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ───────────────────────── New chat dialog ─────────────────────────

export function NewChatDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { openConversation, refreshConversations } = useManjar()
  const [tab, setTab] = useState<'DM' | 'GROUP' | 'CHANNEL'>('DM')
  const [users, setUsers] = useState<{ username: string; displayName: string; avatarColor: string; online: boolean; premium: boolean }[]>([])
  const [q, setQ] = useState('')
  const [groupTitle, setGroupTitle] = useState('')
  const [selected, setSelected] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function loadUsers(query = '') {
    try {
      const res = await api<{ users: typeof users }>(`/users?q=${encodeURIComponent(query)}`)
      setUsers(res.users)
    } catch {
      /* ignore */
    }
  }

  function onOpenChangeWrap(v: boolean) {
    if (v) {
      setTab('DM')
      setQ('')
      setSelected([])
      setGroupTitle('')
      setError('')
      loadUsers()
    }
    onOpenChange(v)
  }

  async function startDm(username: string) {
    setBusy(true)
    try {
      const res = await api<{ conversationId: string }>('/conversations', {
        method: 'POST',
        body: JSON.stringify({ type: 'DM', peerUsername: username }),
      })
      await refreshConversations()
      onOpenChange(false)
      openConversation(res.conversationId)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'خطا')
    } finally {
      setBusy(false)
    }
  }

  async function createGroup() {
    setBusy(true)
    setError('')
    try {
      const res = await api<{ conversationId: string }>('/conversations', {
        method: 'POST',
        body: JSON.stringify({ type: tab, title: groupTitle, memberUsernames: selected }),
      })
      await refreshConversations()
      onOpenChange(false)
      openConversation(res.conversationId)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'خطا')
    } finally {
      setBusy(false)
    }
  }

  const filteredUsers = users.filter((u) => !q || u.username.includes(q.toLowerCase()) || u.displayName.includes(q))

  return (
    <Dialog open={open} onOpenChange={onOpenChangeWrap}>
      <DialogContent className="max-w-md max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>شروع گفتگوی جدید</DialogTitle>
          <DialogDescription>پیام خصوصی بده یا گروه و کانال تازه بساز</DialogDescription>
        </DialogHeader>

        <div className="flex rounded-full bg-secondary p-1 gap-1 text-sm font-semibold">
          {(
            [
              ['DM', 'پیام خصوصی', <MessageSquare key="i" className="w-4 h-4" />],
              ['GROUP', 'گروه', <Users key="i" className="w-4 h-4" />],
              ['CHANNEL', 'کانال', <Radio key="i" className="w-4 h-4" />],
            ] as const
          ).map(([k, label, icon]) => (
            <button
              key={k}
              onClick={() => {
                setTab(k)
                setError('')
                loadUsers(q)
              }}
              className={`flex-1 py-1.5 rounded-full flex items-center justify-center gap-1.5 transition-all ${
                tab === k ? 'bg-primary text-primary-foreground shadow' : 'text-muted-foreground'
              }`}
            >
              {icon}
              {label}
            </button>
          ))}
        </div>

        {(tab === 'GROUP' || tab === 'CHANNEL') && (
          <Input
            placeholder={tab === 'GROUP' ? 'نام گروه (حداقل ۲ حرف)' : 'نام کانال (حداقل ۲ حرف)'}
            value={groupTitle}
            onChange={(e) => setGroupTitle(e.target.value)}
            className="bg-card"
          />
        )}

        <Input
          placeholder="جستجوی کاربر با نام یا آیدی…"
          value={q}
          onChange={(e) => {
            setQ(e.target.value)
            loadUsers(e.target.value)
          }}
          className="bg-card"
        />

        <div className="flex-1 min-h-40 max-h-72 overflow-y-auto mc-scroll rounded-xl border border-border divide-y divide-border/50">
          {filteredUsers.length === 0 && <p className="text-center text-sm text-muted-foreground py-8">کاربری پیدا نشد</p>}
          {filteredUsers.map((u) => {
            const picked = selected.includes(u.username)
            return (
              <button
                key={u.username}
                disabled={busy}
                onClick={() => {
                  if (tab === 'DM') startDm(u.username)
                  else setSelected((prev) => (picked ? prev.filter((x) => x !== u.username) : [...prev, u.username]))
                }}
                className={`w-full flex items-center gap-3 p-2.5 text-right transition-colors ${picked ? 'bg-primary/15' : 'hover:bg-secondary/60'}`}
              >
                <McAvatar name={u.displayName} color={u.avatarColor} size={38} online={u.online} premium={u.premium} />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm truncate">
                    {u.displayName} {u.premium && '⭐️'}
                  </p>
                  <p className="text-xs text-muted-foreground" dir="ltr">
                    @{u.username}
                  </p>
                </div>
                {tab !== 'DM' && picked && <span className="text-primary text-lg">✓</span>}
              </button>
            )
          })}
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <DialogFooter>
          {tab === 'DM' ? (
            <p className="text-xs text-muted-foreground w-full text-center">برای شروع چت روی یک کاربر بزن</p>
          ) : (
            <Button onClick={createGroup} disabled={busy || groupTitle.trim().length < 2} className="w-full font-bold">
              {busy ? 'در حال ساخت…' : `ساخت ${tab === 'GROUP' ? 'گروه' : 'کانال'} با ${fmtNum(selected.length)} عضو`}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
