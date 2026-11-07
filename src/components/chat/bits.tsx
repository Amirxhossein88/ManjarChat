'use client'

import { cn } from '@/lib/utils'
import { fmtNum } from '@/lib/client'

/** Round avatar with initial letter */
export function McAvatar({
  name,
  color,
  size = 40,
  online,
  premium,
  className,
}: {
  name: string
  color: string
  size?: number
  online?: boolean
  premium?: boolean
  className?: string
}) {
  const letter = (name || '?').trim().charAt(0)
  return (
    <div className={cn('relative shrink-0', className)} style={{ width: size, height: size }}>
      <div
        className="w-full h-full rounded-full flex items-center justify-center text-white font-bold select-none shadow-sm"
        style={{
          background: `linear-gradient(135deg, ${color}, ${shade(color, -18)})`,
          fontSize: size * 0.42,
        }}
      >
        {letter}
      </div>
      {premium && (
        <span className="absolute -bottom-1 -left-1 text-[10px]" title="پرمیوم">
          ⭐️
        </span>
      )}
      {online && (
        <span
          className="absolute bottom-0 right-0 block rounded-full bg-emerald-400 border-2 border-background"
          style={{ width: size * 0.28, height: size * 0.28 }}
        />
      )}
    </div>
  )
}

function shade(hex: string, percent: number): string {
  try {
    const num = parseInt(hex.replace('#', ''), 16)
    const amt = Math.round(2.55 * percent)
    const r = Math.min(255, Math.max(0, (num >> 16) + amt))
    const g = Math.min(255, Math.max(0, ((num >> 8) & 0x00ff) + amt))
    const b = Math.min(255, Math.max(0, (num & 0x0000ff) + amt))
    return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`
  } catch {
    return hex
  }
}

/** Manjar coin chip */
export function ManjarCoin({ amount, className }: { amount: number; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1 font-bold text-amber-500', className)} dir="ltr">
      <span className="text-base leading-none">🪙</span>
      {fmtNum(amount)}
    </span>
  )
}

export function TypingDots() {
  return (
    <span className="inline-flex items-center gap-0.5 align-middle">
      <span className="mc-typing-dot w-1.5 h-1.5 rounded-full bg-current inline-block" />
      <span className="mc-typing-dot w-1.5 h-1.5 rounded-full bg-current inline-block" />
      <span className="mc-typing-dot w-1.5 h-1.5 rounded-full bg-current inline-block" />
    </span>
  )
}

export const AVATAR_COLORS = ['#0d9488', '#059669', '#f59e0b', '#dc2626', '#db2777', '#7c3aed', '#2563eb', '#0891b2', '#22d3ee', '#fb7185', '#84cc16', '#a16207']
