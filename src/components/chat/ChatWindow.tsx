'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useManjar, type ChatMessage } from './store'
import { McAvatar, TypingDots } from './bits'
import MessageBubble from './MessageBubble'
import { fmtNum, lastSeenText } from '@/lib/client'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { api, ApiError } from '@/lib/client'
import { ArrowRight, Mic, Paperclip, Send, Smile, X, Pin, Zap } from 'lucide-react'

const EMOJIS = ['😀', '😂', '🥲', '😍', '🤔', '😎', '🥳', '😴', '👍', '🙏', '👏', '💪', '🔥', '❤️', '💔', '🎉', '🎁', '🪙', '⭐️', '🚀', '🌹', '🧸', '💎', '👑', '⚡️', '🌍', '🤖', '📣']

export default function ChatWindow({ onBack }: { onBack: () => void }) {
  const { me, conversations, activeId, activeDetails, messages, typingIn, sendMessage, sendTyping, markRead, closeConversation, applyMessageAction } =
    useManjar()
  const [text, setText] = useState('')
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null)
  const [showEmoji, setShowEmoji] = useState(false)
  const [sending, setSending] = useState(false)
  const bottomRef = useRef<HTMLDivElement | null>(null)
  const fileRef = useRef<HTMLInputElement | null>(null)
  const imageRef = useRef<HTMLInputElement | null>(null)

  const conv = useMemo(() => conversations.find((c) => c.id === activeId), [conversations, activeId])

  const pinned = messages.filter((m) => m.pinned)
  const lastPinned = pinned.at(-1)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length, typingIn.length])

  // auto-read when new messages arrive while window open
  useEffect(() => {
    if (messages.length) markRead()
     
  }, [messages.length])

  if (!activeId || !conv || !me) return null

  const isChannel = conv.type === 'CHANNEL'
  const canPost = !isChannel || ['OWNER', 'ADMIN'].includes(conv.myRole || '') || me.role === 'ADMIN'

  async function doSend(kind = 'TEXT', extra: Record<string, unknown> = {}) {
    if (sending) return
    setSending(true)
    try {
      await sendMessage({ kind, content: text.trim(), replyToId: replyTo?.id ?? null, ...extra })
      setText('')
      setReplyTo(null)
    } catch (e) {
      alert(e instanceof ApiError ? e.message : 'ارسال ناموفق بود')
    } finally {
      setSending(false)
    }
  }

  async function uploadAndSend(file: File, kind: 'IMAGE' | 'FILE') {
    setSending(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await api<{ media: { id: string } }>('/upload', { method: 'POST', body: fd })
      await sendMessage({ kind, content: kind === 'FILE' ? file.name : text.trim(), mediaId: res.media.id, replyToId: replyTo?.id ?? null })
      setText('')
      setReplyTo(null)
    } catch (e) {
      alert(e instanceof ApiError ? e.message : 'آپلود ناموفق بود')
    } finally {
      setSending(false)
    }
  }

  const peer = conv.peer

  return (
    <div className="h-full flex flex-col min-w-0 flex-1 bg-background chat-pattern">
      {/* header */}
      <header className="h-14 shrink-0 flex items-center gap-3 px-3 border-b border-border bg-background/80 backdrop-blur z-10">
        <button onClick={onBack} className="md:hidden p-1.5 rounded-full hover:bg-secondary">
          <ArrowRight className="w-5 h-5" />
        </button>
        <McAvatar name={conv.title} color={conv.avatarColor} size={40} online={peer?.online} premium={peer?.premium} />
        <div className="flex-1 min-w-0">
          <p className="font-bold text-sm truncate">
            {isChannel && '📣 '}
            {conv.type === 'GROUP' && '👥 '}
            {conv.title}
          </p>
          <p className="text-xs text-muted-foreground truncate">
            {typingIn.length > 0 ? (
              <span className="text-primary flex items-center gap-1">
                <TypingDots /> {typingIn[0]} در حال نوشتن…
              </span>
            ) : conv.type === 'DM' && peer ? (
              lastSeenText(peer.online ? new Date() : conv.peer ? me.lastSeenAt : new Date(), !!peer.online)
            ) : (
              <>
                {fmtNum(conv.membersCount)} عضو
                {conv.boostCount > 0 && <span className="text-amber-500"> · ⚡️{fmtNum(conv.boostCount)} بوست</span>}
              </>
            )}
          </p>
        </div>
      </header>

      {/* pinned bar */}
      {lastPinned && (
        <div className="shrink-0 flex items-center gap-2 px-4 py-1.5 bg-amber-500/10 border-b border-amber-500/20 text-xs">
          <Pin className="w-3.5 h-3.5 text-amber-500 shrink-0" />
          <span className="truncate flex-1 text-amber-600 dark:text-amber-400">{lastPinned.content || 'پیام سنجاق‌شده'}</span>
          <button onClick={() => applyMessageAction(lastPinned.id, 'unpin').catch(() => {})} className="opacity-60 hover:opacity-100">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* messages */}
      <div className="flex-1 overflow-y-auto mc-scroll px-3 md:px-6 py-4 space-y-2.5">
        {messages.length === 0 && (
          <div className="h-full flex items-center justify-center">
            <div className="text-center text-muted-foreground space-y-2">
              <div className="text-5xl">{conv.type === 'DM' ? '👋' : '🎉'}</div>
              <p className="text-sm">
                {conv.type === 'DM' ? `به گفتگو با ${conv.title} خوش اومدی!` : 'اولین پیام را بفرست!'}
              </p>
            </div>
          </div>
        )}
        {messages.map((m) => (
          <MessageBubble key={m.id} msg={m} onReply={setReplyTo} />
        ))}
        <div ref={bottomRef} />
      </div>

      {/* reply preview */}
      {replyTo && (
        <div className="shrink-0 mx-3 mb-1 flex items-center gap-2 rounded-xl bg-secondary/80 border-r-4 border-primary px-3 py-2">
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-primary">پاسخ به {replyTo.sender?.displayName}</p>
            <p className="text-xs text-muted-foreground truncate">{replyTo.content || '…'}</p>
          </div>
          <button onClick={() => setReplyTo(null)} className="p-1 hover:text-destructive">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* composer */}
      {canPost ? (
        <Composer
          text={text}
          setText={(v) => {
            setText(v)
            sendTyping()
          }}
          onSend={() => doSend('TEXT')}
          onPickImage={(f) => uploadAndSend(f, 'IMAGE')}
          onPickFile={(f) => uploadAndSend(f, 'FILE')}
          onVoice={async (blob, ms) => {
            setSending(true)
            try {
              const fd = new FormData()
              fd.append('file', new File([blob], `voice-${Date.now()}.webm`, { type: blob.type || 'audio/webm' }))
              const res = await api<{ media: { id: string } }>('/upload', { method: 'POST', body: fd })
              await sendMessage({ kind: 'VOICE', mediaId: res.media.id, durationMs: ms, content: '' , replyToId: replyTo?.id ?? null })
              setReplyTo(null)
            } catch (e) {
              alert(e instanceof ApiError ? e.message : 'ارسال ویس ناموفق بود')
            } finally {
              setSending(false)
            }
          }}
          sending={sending}
          showEmoji={showEmoji}
          setShowEmoji={setShowEmoji}
          onEmoji={(e) => setText((t) => t + e)}
        />
      ) : (
        <div className="shrink-0 p-3 text-center text-xs text-muted-foreground border-t border-border bg-background/60">
          📣 در کانال فقط مدیران می‌توانند پیام منتشر کنند
        </div>
      )}
    </div>
  )
}

// ───────────────────────── composer + voice recorder ─────────────────────────

function Composer({
  text,
  setText,
  onSend,
  onPickImage,
  onPickFile,
  onVoice,
  sending,
  showEmoji,
  setShowEmoji,
  onEmoji,
}: {
  text: string
  setText: (v: string) => void
  onSend: () => void
  onPickImage: (f: File) => void
  onPickFile: (f: File) => void
  onVoice: (blob: Blob, durationMs: number) => Promise<void>
  sending: boolean
  showEmoji: boolean
  setShowEmoji: (v: boolean) => void
  onEmoji: (e: string) => void
}) {
  const imageRef = useRef<HTMLInputElement | null>(null)
  const fileRef = useRef<HTMLInputElement | null>(null)
  const textRef = useRef<HTMLTextAreaElement | null>(null)

  // ── voice recording ──
  const [recState, setRecState] = useState<'idle' | 'recording'>('idle')
  const [recSecs, setRecSecs] = useState(0)
  const recorder = useRef<MediaRecorder | null>(null)
  const chunks = useRef<Blob[]>([])
  const startedAt = useRef(0)
  const timer = useRef<ReturnType<typeof setInterval> | null>(null)
  const cancelled = useRef(false)
  const stream = useRef<MediaStream | null>(null)

  async function startRec() {
    try {
      const s = await navigator.mediaDevices.getUserMedia({ audio: true })
      stream.current = s
      const mime = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'].find(
        (m) => typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(m),
      )
      const rec = new MediaRecorder(s, mime ? { mimeType: mime } : undefined)
      chunks.current = []
      cancelled.current = false
      rec.ondataavailable = (e) => e.data.size > 0 && chunks.current.push(e.data)
      rec.onstop = async () => {
        s.getTracks().forEach((t) => t.stop())
        if (timer.current) clearInterval(timer.current)
        const ms = Date.now() - startedAt.current
        setRecState('idle')
        setRecSecs(0)
        if (cancelled.current || ms < 600 || chunks.current.length === 0) return
        const blob = new Blob(chunks.current, { type: rec.mimeType || 'audio/webm' })
        await onVoice(blob, ms)
      }
      recorder.current = rec
      startedAt.current = Date.now()
      rec.start()
      setRecState('recording')
      timer.current = setInterval(() => setRecSecs((s0) => s0 + 1), 250)
    } catch {
      alert('دسترسی به میکروفون داده نشد. از تنظیمات مرورگر اجازه بده 🎙')
    }
  }

  function stopRec(cancel = false) {
    cancelled.current = cancel
    recorder.current?.stop()
  }

  // ── emoji picker ──
  useEffect(() => {
    if (!showEmoji) return
    const close = () => setShowEmoji(false)
    window.addEventListener('click', close)
    return () => window.removeEventListener('click', close)
  }, [showEmoji, setShowEmoji])

  return (
    <div className="shrink-0 p-2.5 md:px-6 md:pb-4 border-t border-border bg-background/80 backdrop-blur relative">
      {showEmoji && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="absolute bottom-full mb-2 right-4 md:right-6 p-3 rounded-2xl bg-card border border-border shadow-xl grid grid-cols-7 gap-1 z-20"
        >
          {EMOJIS.map((e) => (
            <button
              key={e}
              onClick={() => {
                onEmoji(e)
                textRef.current?.focus()
              }}
              className="w-8 h-8 rounded-lg hover:bg-secondary text-xl flex items-center justify-center"
            >
              {e}
            </button>
          ))}
        </div>
      )}

      {recState === 'recording' ? (
        <div className="flex items-center gap-3 h-11 px-3 rounded-2xl bg-destructive/10 border border-destructive/30">
          <span className="w-3 h-3 rounded-full bg-destructive mc-rec-pulse" />
          <span className="font-mono font-bold text-destructive" dir="ltr">
            {Math.floor(recSecs / 60)}:{String(recSecs % 60).padStart(2, '0')}
          </span>
          <span className="text-xs text-muted-foreground flex-1">در حال ضبط پیام صوتی…</span>
          <button onClick={() => stopRec(true)} className="p-2 rounded-full hover:bg-secondary" title="لغو">
            <X className="w-5 h-5 text-destructive" />
          </button>
          <Button onClick={() => stopRec(false)} size="sm" className="rounded-full h-9 px-4 font-bold">
            <Send className="w-4 h-4 rotate-180" /> ارسال
          </Button>
        </div>
      ) : (
        <div className="flex items-end gap-1.5">
          <button
            onClick={() => setShowEmoji(!showEmoji)}
            className="p-2.5 rounded-full hover:bg-secondary text-muted-foreground hover:text-foreground shrink-0"
            title="ایموجی"
          >
            <Smile className="w-5 h-5" />
          </button>
          <button onClick={() => imageRef.current?.click()} className="p-2.5 rounded-full hover:bg-secondary text-muted-foreground hover:text-foreground shrink-0" title="عکس">
            <Paperclip className="w-5 h-5" />
          </button>
          <input
            ref={imageRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) onPickImage(f)
              e.target.value = ''
            }}
          />
          <input
            ref={fileRef}
            type="file"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) onPickFile(f)
              e.target.value = ''
            }}
          />

          <textarea
            ref={textRef}
            value={text}
            rows={1}
            onChange={(e) => {
              setText(e.target.value)
              e.target.style.height = 'auto'
              e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                if (text.trim()) onSend()
              }
            }}
            placeholder="پیامت رو بنویس… (Enter برای ارسال)"
            className="flex-1 resize-none max-h-32 rounded-2xl bg-secondary/70 border-none px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/40 placeholder:text-muted-foreground"
          />

          {text.trim() ? (
            <Button onClick={onSend} disabled={sending} size="icon" className="w-11 h-11 rounded-full shrink-0 shadow-lg">
              <Send className="w-5 h-5 rotate-180 -ml-0.5" />
            </Button>
          ) : (
            <button
              onClick={startRec}
              disabled={sending}
              className="w-11 h-11 rounded-full bg-primary text-primary-foreground flex items-center justify-center shrink-0 shadow-lg hover:brightness-110 active:scale-95 transition-transform"
              title="ضبط پیام صوتی"
            >
              <Mic className="w-5 h-5" />
            </button>
          )}
        </div>
      )}
    </div>
  )
}
