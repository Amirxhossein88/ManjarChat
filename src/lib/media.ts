import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import { db } from './db'

export const DATA_DIR = process.env.MANJAR_DATA_DIR || path.join(process.cwd(), 'data')
export const UPLOAD_DIR = path.join(DATA_DIR, 'uploads')

const MAX_SIZE = 25 * 1024 * 1024 // 25MB

export function ensureUploadDir() {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true })
}

export type SavedMedia = { id: string; mime: string; size: number; filename: string }

export async function saveUpload(file: File, uploaderId?: string): Promise<SavedMedia> {
  if (!file || file.size === 0) throw new Error('EMPTY_FILE')
  if (file.size > MAX_SIZE) throw new Error('FILE_TOO_LARGE')
  ensureUploadDir()

  const buf = Buffer.from(await file.arrayBuffer())
  const id = crypto.randomUUID().replace(/-/g, '')
  const ext = safeExt(file.name || file.type)
  const diskPath = path.join(UPLOAD_DIR, `${id}${ext}`)
  fs.writeFileSync(diskPath, buf)

  const media = await db.media.create({
    data: {
      id,
      filename: (file.name || id).slice(0, 200),
      mime: file.type || 'application/octet-stream',
      size: buf.length,
      path: diskPath,
      uploaderId: uploaderId ?? null,
    },
  })
  return { id: media.id, mime: media.mime, size: media.size, filename: media.filename }
}

function safeExt(name: string): string {
  const ext = path.extname(name).toLowerCase()
  if (/^\.[a-z0-9]{1,10}$/.test(ext)) return ext
  return ''
}

const MIME_BY_EXT: Record<string, string> = {
  '.webm': 'audio/webm',
  '.mp4': 'video/mp4',
  '.m4a': 'audio/mp4',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.wav': 'audio/wav',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.pdf': 'application/pdf',
  '.txt': 'text/plain; charset=utf-8',
  '.zip': 'application/zip',
}

export function mimeForDiskPath(diskPath: string, fallback: string): string {
  const ext = path.extname(diskPath).toLowerCase()
  return MIME_BY_EXT[ext] || fallback
}
