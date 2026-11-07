import fs from 'fs'
import { db } from '@/lib/db'
import { mimeForDiskPath } from '@/lib/media'

type Params = { params: Promise<{ id: string }> }

export async function GET(_req: Request, { params }: Params) {
  const { id } = await params
  const media = await db.media.findUnique({ where: { id } })
  if (!media || !fs.existsSync(media.path)) {
    return new Response('Not found', { status: 404 })
  }
  const buf = fs.readFileSync(media.path)
  const mime = media.mime?.startsWith('audio/') || media.mime?.startsWith('image/') || media.mime?.startsWith('video/')
    ? media.mime
    : mimeForDiskPath(media.path, media.mime || 'application/octet-stream')
  return new Response(new Uint8Array(buf), {
    headers: {
      'Content-Type': mime,
      'Content-Length': String(buf.length),
      'Cache-Control': 'public, max-age=31536000, immutable',
      'Accept-Ranges': 'none',
    },
  })
}
