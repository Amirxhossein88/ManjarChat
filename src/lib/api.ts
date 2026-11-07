import { NextResponse } from 'next/server'

export function ok(data: Record<string, unknown> = {}) {
  return NextResponse.json({ ok: true, ...data })
}

export function err(message: string, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status })
}

export async function readJson<T = Record<string, unknown>>(req: Request): Promise<T> {
  try {
    return (await req.json()) as T
  } catch {
    return {} as T
  }
}

/** Shuffle helper for ids etc. */
export function pick<T>(arr: T[], n: number): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a.slice(0, n)
}
