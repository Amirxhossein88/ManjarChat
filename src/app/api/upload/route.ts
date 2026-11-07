import { getCurrentUser } from '@/lib/auth'
import { saveUpload } from '@/lib/media'
import { ok, err } from '@/lib/api'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function POST(req: Request) {
  const me = await getCurrentUser()
  if (!me) return err('unauthorized', 401)
  try {
    const form = await req.formData()
    const file = form.get('file')
    if (!(file instanceof File)) return err('فایلی ارسال نشده است')
    const saved = await saveUpload(file, me.id)
    return ok({ media: saved })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'UPLOAD_FAILED'
    if (msg === 'FILE_TOO_LARGE') return err('حجم فایل بیش از ۲۵ مگابایت است')
    return err('آپلود ناموفق بود', 500)
  }
}
