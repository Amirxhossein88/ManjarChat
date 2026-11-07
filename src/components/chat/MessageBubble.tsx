'use client'

import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import { useManjar, type ChatMessage } from './store'
import { McAvatar } from './bits'
import { fmtDuration, fmtTime } from '@/lib/client'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { MoreVertical, Pin, Trash2, Pencil, Reply, Play, Pause, Download, Check, X } from 'lucide-react'

const REACTIONS = ['❤️', '👍', '🔥', '😂', '😮', '😢', '🎉', '🪙']

export default function MessageBubble({ msg, onReply }: { msg: ChatMessage; onReply: (m: ChatMessage) => void }) {
  const { me, activeDetails, applyMessageAction, deleteMessage } = useManjar()
  const [editing, setEditing] = useState(false)
  const [editText, setEditText] = useState(msg.content)
  const mine = msg.sender?.id === me?.id
  const isAdmin = me?.role === 'ADMIN'
  const isOwnerOrAdmin = isAdmin || activeDetails?.ownerId === me?.id || ['OWNER', 'ADMIN'].includes(activeDetails?.myRole || '')

  if (msg.kind === 'SYSTEM') {
    return (
      <div className="flex justify-center my-2 mc-fade-up">
        <span className="px-3.5 py-1.5 rounded-full bg-secondary/80 text-xs text-muted-foreground backdrop-blur border border-border/50 text-center max-w-md">
          {msg.content}
        </span>
      </div>
    )
  }

  const canDelete = mine || isAdmin || isOwnerOrAdmin

  return (
    <div className={cn('group flex gap-2 items-end mc-fade-up', mine ? 'flex-row-reverse' : 'flex-row')}>
      <McAvatar name={msg.sender?.displayName || '?'} color={msg.sender?.avatarColor || '#666'} size={34} className="mb-1" />

      <div className={cn('max-w-[78%] md:max-w-[65%] flex flex-col', mine ? 'items-end' : 'items-start')}>
        {!mine && activeDetails?.type !== 'DM' && (
          <span className={cn('text-xs font-bold mb-0.5 px-1', msg.sender?.premium && 'premium-name')}>
            {msg.sender?.displayName} {msg.sender?.role === 'ADMIN' && '👑'}
          </span>
        )}

        <div
          className={cn(
            'relative rounded-2xl px-3 py-2 shadow-sm w-fit',
            mine ? 'bg-primary text-primary-foreground rounded-bl-md' : 'bg-card border border-border/60 rounded-br-md',
            msg.pending && 'opacity-60',
          )}
        >
          {/* reply quote */}
          {msg.replyTo && (
            <div className={cn('rounded-lg px-2 py-1 mb-1.5 text-xs border-r-2', mine ? 'bg-white/10 border-amber-300' : 'bg-secondary/70 border-primary')}>
              <p className={cn('font-bold', mine ? 'text-amber-200' : 'text-primary')}>{msg.replyTo.senderName}</p>
              <p className="line-clamp-2 opacity-80">{msg.replyTo.kind === 'DELETED' ? 'پیام حذف شد' : msg.replyTo.content || '…'}</p>
            </div>
          )}

          {/* body by kind */}
          {msg.kind === 'TEXT' && !editing && <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{msg.content}</p>}
          {msg.kind === 'TEXT' && editing && (
            <div className="flex items-center gap-1.5 min-w-56">
              <input
                autoFocus
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && editText.trim()) {
                    applyMessageAction(msg.id, 'edit', { content: editText.trim() }).catch(() => {})
                    setEditing(false)
                  }
                  if (e.key === 'Escape') setEditing(false)
                }}
                className={cn('bg-transparent outline-none text-sm flex-1 border-b', mine ? 'border-white/40' : 'border-border')}
              />
              <button
                onClick={() => {
                  if (editText.trim()) applyMessageAction(msg.id, 'edit', { content: editText.trim() }).catch(() => {})
                  setEditing(false)
                }}
                className="text-emerald-400"
              >
                <Check className="w-4 h-4" />
              </button>
              <button onClick={() => setEditing(false)} className="opacity-70">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}
          {msg.kind === 'VOICE' && <VoiceBubble msg={msg} mine={mine} />}
          {msg.kind === 'IMAGE' && <ImageBubble msg={msg} />}
          {msg.kind === 'FILE' && <FileBubble msg={msg} />}
          {msg.kind === 'GIFT' && <GiftBubble msg={msg} mine={mine} />}

          {/* meta */}
          <div className={cn('flex items-center gap-1 mt-0.5 text-[10px]', mine ? 'justify-start' : 'justify-end', mine ? 'text-white/70' : 'text-muted-foreground')}>
            {msg.pinned && <Pin className="w-3 h-3 text-amber-400" />}
            <span>{fmtTime(msg.createdAt)}</span>
            {msg.pending && <span>…</span>}
          </div>
        </div>

        {/* reactions row */}
        {msg.reactions.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1 px-1">
            {msg.reactions.map((r) => (
              <button
                key={r.emoji}
                onClick={() => applyMessageAction(msg.id, 'react', { emoji: r.emoji }).catch(() => {})}
                className={cn(
                  'px-1.5 py-0.5 rounded-full text-xs border backdrop-blur transition-all active:scale-90',
                  r.mine ? 'bg-primary/20 border-primary text-primary font-bold' : 'bg-secondary/80 border-border text-foreground',
                )}
              >
                {r.emoji} {r.count > 1 ? r.count : ''}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* hover actions */}
      <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5 mb-1">
        <button title="پاسخ" onClick={() => onReply(msg)} className="p-1.5 rounded-full hover:bg-secondary text-muted-foreground hover:text-foreground">
          <Reply className="w-4 h-4" />
        </button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="p-1.5 rounded-full hover:bg-secondary text-muted-foreground hover:text-foreground">
              <MoreVertical className="w-4 h-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align={mine ? 'end' : 'start'}>
            {REACTIONS.slice(0, 4).map((e) => (
              <DropdownMenuItem key={e} onClick={() => applyMessageAction(msg.id, 'react', { emoji: e }).catch(() => {})}>
                <span className="text-base">{e}</span> واکنش {e}
              </DropdownMenuItem>
            ))}
            <DropdownMenuItem
              onClick={() => applyMessageAction(msg.id, msg.pinned ? 'unpin' : 'pin').catch(() => {})}
              className="text-amber-500"
            >
              <Pin className="w-4 h-4" /> {msg.pinned ? 'برداشتن سنجاق' : 'سنجاق کردن'}
            </DropdownMenuItem>
            {mine && msg.kind === 'TEXT' && (
              <DropdownMenuItem onClick={() => setEditing(true)}>
                <Pencil className="w-4 h-4" /> ویرایش
              </DropdownMenuItem>
            )}
            {canDelete && (
              <DropdownMenuItem onClick={() => deleteMessage(msg.id).catch(() => {})} className="text-destructive">
                <Trash2 className="w-4 h-4" /> حذف پیام
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )
}

// ───────────────────────── voice ─────────────────────────

function VoiceBubble({ msg, mine }: { msg: ChatMessage; mine: boolean }) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [playing, setPlaying] = useState(false)
  const [progress, setProgress] = useState(0)
  const duration = (msg.durationMs && msg.durationMs > 0 ? msg.durationMs : 0) || 0
  const bars = useRef<number[]>(Array.from({ length: 24 }, () => 0.3 + Math.random() * 0.7))

  // real duration once metadata loads (webm in chrome often reports Infinity → fallback)
  const [realDuration, setRealDuration] = useState(duration)

  function toggle() {
    const el = audioRef.current
    if (!el) return
    if (playing) {
      el.pause()
    } else {
      el.play().catch(() => {})
    }
  }

  return (
    <div className="flex items-center gap-2 min-w-52 py-0.5" dir="ltr">
      <audio
        ref={audioRef}
        src={`/api/media/${msg.mediaId}`}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => {
          setPlaying(false)
          setProgress(0)
        }}
        onTimeUpdate={(e) => {
          const el = e.currentTarget
          const d = isFinite(el.duration) && el.duration > 0 ? el.duration : realDuration || duration / 1000
          if (d > 0) setProgress(Math.min(100, (el.currentTime / d) * 100))
        }}
        onLoadedMetadata={(e) => {
          const d = e.currentTarget.duration
          if (isFinite(d) && d > 0) setRealDuration(d)
        }}
      />
      <button
        onClick={toggle}
        className={cn('w-9 h-9 rounded-full flex items-center justify-center shrink-0 shadow', mine ? 'bg-white/20 text-white' : 'bg-primary text-primary-foreground')}
      >
        {playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 -mr-0.5" />}
      </button>
      <div className="flex items-center gap-[2px] flex-1 h-7">
        {bars.current.map((h, i) => (
          <span
            key={i}
            className={cn('w-[3px] rounded-full transition-colors', i / bars.current.length * 100 <= progress ? (mine ? 'bg-white' : 'bg-primary') : mine ? 'bg-white/35' : 'bg-muted-foreground/40')}
            style={{ height: `${h * 100}%` }}
          />
        ))}
      </div>
      <span className={cn('text-[11px] shrink-0 w-9 text-center', mine ? 'text-white/80' : 'text-muted-foreground')} dir="ltr">
        {fmtDuration((realDuration || duration) * (realDuration ? 1000 : 1))}
      </span>
    </div>
  )
}

// ───────────────────────── image / file / gift ─────────────────────────

function ImageBubble({ msg }: { msg: ChatMessage }) {
  const [loaded, setLoaded] = useState(false)
  return (
    <div className="relative rounded-xl overflow-hidden max-w-72">
      {!loaded && <div className="w-64 h-40 bg-secondary animate-pulse" />}
      { }
      <img
        src={`/api/media/${msg.mediaId}`}
        alt={msg.content || 'تصویر'}
        onLoad={() => setLoaded(true)}
        onClick={() => window.open(`/api/media/${msg.mediaId}`, '_blank')}
        className={cn('cursor-zoom-in max-h-80 w-auto object-cover', !loaded && 'hidden')}
      />
      {msg.content && <p className="text-sm mt-1">{msg.content}</p>}
    </div>
  )
}

function FileBubble({ msg }: { msg: ChatMessage }) {
  return (
    <a
      href={`/api/media/${msg.mediaId}`}
      download={msg.content || 'file'}
      className="flex items-center gap-2 min-w-48 py-0.5 hover:opacity-90"
    >
      <span className="w-10 h-10 rounded-full bg-black/10 dark:bg-white/10 flex items-center justify-center text-lg">📎</span>
      <div className="min-w-0">
        <p className="text-sm font-semibold truncate">{msg.content || 'فایل'}</p>
        <p className="text-[11px] opacity-70 flex items-center gap-1">
          <Download className="w-3 h-3" /> دانلود
        </p>
      </div>
    </a>
  )
}

function GiftBubble({ msg, mine }: { msg: ChatMessage; mine: boolean }) {
  return (
    <div className={cn('text-center py-2 px-2 min-w-44', mine ? 'text-primary-foreground' : '')}>
      <p className={cn('text-xs font-bold mb-1', mine ? 'text-amber-200' : 'text-amber-500')}>🎁 هدیه منجری</p>
      <span className="text-6xl mc-gift-float block my-1">{msg.giftEmoji || '🎁'}</span>
      <p className="text-sm font-bold mt-1">{msg.content}</p>
    </div>
  )
}
