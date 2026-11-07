import { db } from './db'

type TxClient = Parameters<Parameters<typeof db.$transaction>[0]>[0]
type DbLike = typeof db | TxClient

/**
 * Atomically change a user's Manjar balance and write a ledger entry.
 * Throws when the spender cannot afford it — call inside db.$transaction.
 */
export async function grantManjar(
  client: DbLike,
  userId: string,
  amount: number,
  kind: string,
  note: string,
): Promise<number> {
  const user = await client.user.findUnique({ where: { id: userId }, select: { manjarBalance: true } })
  if (!user) throw new Error('USER_NOT_FOUND')
  const balanceAfter = user.manjarBalance + amount
  if (balanceAfter < 0) throw new Error('INSUFFICIENT_MANJAR')
  await client.user.update({ where: { id: userId }, data: { manjarBalance: balanceAfter } })
  await client.transaction.create({
    data: { userId, amount, kind, note, balanceAfter },
  })
  return balanceAfter
}

export async function spendManjar(client: DbLike, userId: string, price: number, kind: string, note: string) {
  return grantManjar(client, userId, -price, kind, note)
}

export async function getBalance(userId: string): Promise<number> {
  const u = await db.user.findUnique({ where: { id: userId }, select: { manjarBalance: true } })
  return u?.manjarBalance ?? 0
}

export function fmtManjar(n: number): string {
  return n.toLocaleString('fa-IR')
}
