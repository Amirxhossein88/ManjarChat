import { db } from '@/lib/db'
import { getCurrentUser, safeUser } from '@/lib/auth'
import { ensureSeeded } from '@/lib/seed'
import { ok } from '@/lib/api'

export async function GET() {
  await ensureSeeded()
  const user = await getCurrentUser()
  if (!user) return ok({ user: null })
  const fresh = await db.user.findUnique({ where: { id: user.id } })
  return ok({ user: fresh ? safeUser(fresh) : null })
}
