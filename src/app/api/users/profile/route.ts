import { db } from '@/lib/db'
import { getCurrentUser, safeUser } from '@/lib/auth'
import { ok, err, readJson } from '@/lib/api'

export async function PATCH(req: Request) {
  const me = await getCurrentUser()
  if (!me) return err('unauthorized', 401)
  const body = await readJson<{ displayName?: string; bio?: string; avatarColor?: string }>(req)

  const data: { displayName?: string; bio?: string; avatarColor?: string } = {}
  if (body.displayName !== undefined) {
    const dn = body.displayName.trim()
    if (dn.length < 1 || dn.length > 40) return err('نام نمایشی باید ۱ تا ۴۰ حرف باشد')
    data.displayName = dn
  }
  if (body.bio !== undefined) data.bio = body.bio.slice(0, 120)
  if (body.avatarColor !== undefined) {
    if (!/^#[0-9a-fA-F]{6}$/.test(body.avatarColor)) return err('رنگ نامعتبر است')
    data.avatarColor = body.avatarColor
  }

  const user = await db.user.update({ where: { id: me.id }, data })
  return ok({ user: safeUser(user) })
}
