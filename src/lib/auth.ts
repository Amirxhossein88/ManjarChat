import crypto from 'crypto'
import { cookies } from 'next/headers'
import { db } from './db'

export const SESSION_COOKIE = 'manjar_session'
const SESSION_DAYS = 30

// ────────────────────────── password hashing (scrypt, no extra deps) ──────────────────────────

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex')
  const hash = crypto.scryptSync(password, salt, 64).toString('hex')
  return `${salt}:${hash}`
}

export function verifyPassword(password: string, stored: string): boolean {
  try {
    const [salt, hash] = stored.split(':')
    const check = crypto.scryptSync(password, salt, 64).toString('hex')
    return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(check, 'hex'))
  } catch {
    return false
  }
}

// ────────────────────────── sessions ──────────────────────────

export async function createSession(userId: string): Promise<string> {
  const token = crypto.randomBytes(32).toString('hex')
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86400_000)
  await db.session.create({ data: { token, userId, expiresAt } })
  const jar = await cookies()
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: false,
    maxAge: SESSION_DAYS * 86400,
    path: '/',
  })
  return token
}

export async function destroySession(): Promise<void> {
  const jar = await cookies()
  const token = jar.get(SESSION_COOKIE)?.value
  if (token) {
    await db.session.deleteMany({ where: { token } }).catch(() => {})
  }
  jar.delete(SESSION_COOKIE)
}

export async function getCurrentUser() {
  const jar = await cookies()
  const token = jar.get(SESSION_COOKIE)?.value
  if (!token) return null
  const session = await db.session.findUnique({ where: { token }, include: { user: true } })
  if (!session || session.expiresAt < new Date()) return null
  if (session.user.banned) return null
  // presence heartbeat
  const last = session.user.lastSeenAt.getTime()
  if (Date.now() - last > 30_000) {
    await db.user.update({ where: { id: session.userId }, data: { lastSeenAt: new Date() } }).catch(() => {})
  }
  return session.user
}

export function isAdmin(user: { role: string } | null | undefined): boolean {
  return user?.role === 'ADMIN'
}

// ────────────────────────── shared shapes ──────────────────────────

export function safeUser(u: {
  id: string
  username: string
  displayName: string
  role: string
  bio: string
  avatarColor: string
  manjarBalance: number
  isPremiumUntil: Date | null
  lastSeenAt: Date
  createdAt: Date
}) {
  return {
    id: u.id,
    username: u.username,
    displayName: u.displayName,
    role: u.role,
    bio: u.bio,
    avatarColor: u.avatarColor,
    manjarBalance: u.manjarBalance,
    premium: !!u.isPremiumUntil && u.isPremiumUntil.getTime() > Date.now(),
    premiumUntil: u.isPremiumUntil,
    online: Date.now() - u.lastSeenAt.getTime() < 70_000,
    lastSeenAt: u.lastSeenAt,
    createdAt: u.createdAt,
  }
}
