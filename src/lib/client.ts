'use client'

export class ApiError extends Error {}

export async function api<T = Record<string, unknown>>(path: string, opts: RequestInit = {}): Promise<T> {
  const isForm = opts.body instanceof FormData
  const res = await fetch(`/api${path}`, {
    ...opts,
    headers: isForm ? opts.headers : { 'Content-Type': 'application/json', ...(opts.headers || {}) },
  })
  let data: Record<string, unknown> = {}
  try {
    data = await res.json()
  } catch {
    /* empty body */
  }
  if (!res.ok || data.ok === false) {
    throw new ApiError((data.error as string) || 'خطای ارتباط با سرور')
  }
  return data as T
}

export function fmtNum(n: number): string {
  return n.toLocaleString('fa-IR')
}

export function fmtTime(iso: string | Date): string {
  const d = new Date(iso)
  return d.toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' })
}

export function fmtDate(iso: string | Date): string {
  const d = new Date(iso)
  return d.toLocaleDateString('fa-IR', { month: 'long', day: 'numeric' })
}

export function fmtDateTime(iso: string | Date): string {
  const d = new Date(iso)
  return `${d.toLocaleDateString('fa-IR', { month: 'short', day: 'numeric' })} ${d.toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' })}`
}

export function fmtDuration(ms: number): string {
  const s = Math.round(ms / 1000)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

export function lastSeenText(iso: string | Date, online: boolean): string {
  if (online) return 'آنلاین'
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (mins < 1) return 'لحظه‌ای پیش'
  if (mins < 60) return `${fmtNum(mins)} دقیقه پیش`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${fmtNum(hours)} ساعت پیش`
  return fmtDate(iso)
}
