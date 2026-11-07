import path from 'path'
import fs from 'fs'
import { PrismaClient } from '@prisma/client'

/**
 * Resolve DATABASE_URL to an absolute SQLite path and make sure its
 * directory exists — so a fresh clone / fresh container / first exe run
 * never fails with "unable to open database file".
 */
function resolveDatabaseUrl(): string {
  const raw = process.env.DATABASE_URL || 'file:./db/custom.db'
  if (raw.startsWith('file:')) {
    let p = raw.slice('file:'.length)
    let query = ''
    const q = p.indexOf('?')
    if (q >= 0) {
      query = p.slice(q)
      p = p.slice(0, q)
    }
    if (!path.isAbsolute(p)) p = path.join(process.cwd(), p)
    try {
      fs.mkdirSync(path.dirname(p), { recursive: true })
    } catch {
      /* best effort */
    }
    return 'file:' + p + query
  }
  return raw
}

const url = resolveDatabaseUrl()
process.env.DATABASE_URL = url

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasources: { db: { url } },
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
