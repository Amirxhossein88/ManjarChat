import { db } from '@/lib/db'
import { createSession, verifyPassword, safeUser } from '@/lib/auth'
import { ensureSeeded } from '@/lib/seed'
import { ok, err, readJson } from '@/lib/api'

export async function POST(req: Request) {
  await ensureSeeded()
  const body = await readJson<{ username?: string; password?: string }>(req)
  const username = (body.username || '').trim().toLowerCase()
  const password = body.password || ''

  const user = await db.user.findUnique({ where: { username } })
  if (!user || !verifyPassword(password, user.passwordHash)) {
    return err('نام کاربری یا رمز عبور اشتباه است', 401)
  }
  if (user.banned) return err('حساب شما مسدود شده است. با پشتیبانی تماس بگیرید.', 403)

  await createSession(user.id)
  return ok({ user: safeUser(user) })
}
