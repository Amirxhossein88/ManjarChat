import { ok } from '@/lib/api'

export async function GET() {
  return ok({ service: 'manjarchat', time: new Date().toISOString() })
}
