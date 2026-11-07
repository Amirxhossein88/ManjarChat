'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { api, ApiError } from '@/lib/client'
import type { MeUser } from './store'

export default function LoginView({ onLogin }: { onLogin: (user: MeUser) => void }) {
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [username, setUsername] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      const path = mode === 'login' ? '/auth/login' : '/auth/register'
      const body = mode === 'login' ? { username, password } : { username, password, displayName }
      const res = await api<{ user: MeUser }>(path, { method: 'POST', body: JSON.stringify(body) })
      onLogin(res.user)
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'خطای غیرمنتظره رخ داد')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="h-screen w-full flex flex-col md:flex-row items-stretch bg-background">
      {/* brand side */}
      <div className="relative flex-1 flex flex-col items-center justify-center p-8 overflow-hidden bg-gradient-to-bl from-teal-600 via-teal-700 to-emerald-900 text-white">
        <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full bg-amber-400/10 blur-3xl" />
        <div className="absolute -bottom-32 -left-16 w-[28rem] h-[28rem] rounded-full bg-emerald-300/10 blur-3xl" />
        <div className="relative z-10 flex flex-col items-center gap-5 text-center max-w-md">
          { }
          <img src="/manjar-icon.svg" alt="منجرچت" className="w-28 h-28 drop-shadow-2xl mc-gift-float" />
          <h1 className="text-4xl font-extrabold tracking-tight">منجرچت</h1>
          <p className="text-lg opacity-90 leading-relaxed">
            پیام‌رسان سریع و امن با اقتصاد «منجر» 🪙
            <br />
            چت، ویس، گروه و کانال، فروشگاه، هدیه و پرمیوم — همه‌چیز یکجا
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2 mt-2 text-sm">
            {['🎙 پیام صوتی', '🪙 کیف پول منجر', '🎁 ارسال هدیه', '⭐️ منجر پرمیوم', '📣 کانال', '👥 گروه'].map((f) => (
              <span key={f} className="px-3 py-1.5 rounded-full bg-white/10 backdrop-blur border border-white/15">
                {f}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* form side */}
      <div className="w-full md:w-[440px] shrink-0 flex items-center justify-center p-6 border-s border-border">
        <Card className="w-full max-w-sm border-none shadow-none bg-transparent">
          <CardContent className="space-y-4">
            <div className="flex rounded-full bg-secondary p-1 gap-1">
              {(['login', 'register'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => {
                    setMode(m)
                    setError('')
                  }}
                  className={`flex-1 py-2 rounded-full text-sm font-semibold transition-all ${
                    mode === m ? 'bg-primary text-primary-foreground shadow' : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {m === 'login' ? 'ورود' : 'ثبت‌نام'}
                </button>
              ))}
            </div>

            <form onSubmit={submit} className="space-y-3">
              <Input
                dir="ltr"
                placeholder="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="h-11 bg-card text-left"
                autoComplete="username"
                required
              />
              {mode === 'register' && (
                <Input
                  placeholder="نام نمایشی شما"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="h-11 bg-card"
                />
              )}
              <Input
                dir="ltr"
                type="password"
                placeholder="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-11 bg-card text-left"
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                required
              />
              {error && <p className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">{error}</p>}
              <Button type="submit" className="w-full h-11 font-bold" disabled={busy}>
                {busy ? 'لطفاً صبر کنید…' : mode === 'login' ? 'ورود به منجرچت' : 'ساخت حساب + 🪙 ۱۰۰ منجر هدیه'}
              </Button>
            </form>

            {mode === 'register' && (
              <p className="text-xs text-muted-foreground text-center leading-relaxed">
                با ثبت‌نام، <b className="text-amber-500">۱۰۰ منجر هدیه خوش‌آمدگویی</b> می‌گیری و
                <br /> عضو گروه عمومی منجرچت می‌شی 🌍
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
