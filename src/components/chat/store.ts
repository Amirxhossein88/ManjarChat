'use client'

import { create } from 'zustand'
import { api } from '@/lib/client'

export type MeUser = {
  id: string
  username: string
  displayName: string
  role: string
  bio: string
  avatarColor: string
  manjarBalance: number
  premium: boolean
  online: boolean
  lastSeenAt: string
}

export type Peer = {
  id: string
  username: string
  displayName: string
  avatarColor: string
  role: string
  premium: boolean
  online: boolean
}

export type ConversationItem = {
  id: string
  type: 'DM' | 'GROUP' | 'CHANNEL'
  title: string
  about: string
  avatarColor: string
  ownerId: string
  myRole: string
  boostCount: number
  membersCount: number
  peer: Peer | null
  unread: number
  typing: string[]
  lastMessage: {
    id: string
    kind: string
    content: string
    senderName: string
    mine: boolean
    createdAt: string
  } | null
  lastActivity: string
}

export type ChatMessage = {
  id: string
  conversationId: string
  kind: string
  content: string
  mediaId: string | null
  durationMs: number | null
  giftEmoji: string | null
  pinned: boolean
  createdAt: string
  sender: {
    id: string
    username: string
    displayName: string
    avatarColor: string
    role: string
    premium: boolean
  } | null
  replyTo: { id: string; kind: string; content: string; senderName: string } | null
  reactions: { emoji: string; count: number; mine: boolean }[]
  pending?: boolean
}

export type ConvDetails = {
  id: string
  type: 'DM' | 'GROUP' | 'CHANNEL'
  title: string
  about: string
  ownerId: string
  boostCount: number
  myRole: string | null
  members: { userId: string; role: string; displayName: string }[]
}

type ManjarState = {
  me: MeUser | null
  booted: boolean
  view: string // chat | wallet | shop | admin | settings
  conversations: ConversationItem[]
  activeId: string | null
  activeDetails: ConvDetails | null
  messages: ChatMessage[]
  typingIn: string[]
  pollTimers: { conv?: ReturnType<typeof setInterval>; msg?: ReturnType<typeof setInterval> } | null

  setMe: (u: MeUser | null) => void
  setView: (v: string) => void
  logout: () => Promise<void>

  startPolling: () => void
  stopPolling: () => void
  refreshConversations: () => Promise<void>
  refreshMe: () => Promise<void>

  openConversation: (id: string) => Promise<void>
  closeConversation: () => void
  pollMessages: () => Promise<void>

  sendMessage: (payload: {
    kind: string
    content?: string
    mediaId?: string
    durationMs?: number
    replyToId?: string | null
  }) => Promise<void>
  applyMessageAction: (id: string, action: string, extra?: Record<string, unknown>) => Promise<void>
  deleteMessage: (id: string) => Promise<void>
  sendTyping: () => Promise<void>
  markRead: () => Promise<void>
}

export const useManjar = create<ManjarState>((set, get) => ({
  me: null,
  booted: false,
  view: 'chat',
  conversations: [],
  activeId: null,
  activeDetails: null,
  messages: [],
  typingIn: [],
  pollTimers: null,

  setMe: (u) => set({ me: u, booted: true }),

  setView: (v) => set({ view: v }),

  logout: async () => {
    get().stopPolling()
    await api('/auth/logout', { method: 'POST' }).catch(() => {})
    set({ me: null, conversations: [], activeId: null, messages: [], activeDetails: null, view: 'chat' })
  },

  refreshMe: async () => {
    try {
      const res = await api<{ user: MeUser | null }>('/auth/me')
      set({ me: res.user, booted: true })
    } catch {
      set({ me: null, booted: true })
    }
  },

  startPolling: () => {
    const { pollTimers, refreshConversations } = get()
    if (pollTimers) return
    refreshConversations().catch(() => {})
    const conv = setInterval(() => {
      if (document.visibilityState === 'hidden') return
      refreshConversations().catch(() => {})
    }, 3000)
    const msg = setInterval(() => {
      if (document.visibilityState === 'hidden') return
      get()
        .pollMessages()
        .catch(() => {})
    }, 1600)
    set({ pollTimers: { conv, msg } })
  },

  stopPolling: () => {
    const t = get().pollTimers
    if (t?.conv) clearInterval(t.conv)
    if (t?.msg) clearInterval(t.msg)
    set({ pollTimers: null })
  },

  refreshConversations: async () => {
    const res = await api<{ conversations: ConversationItem[] }>('/conversations')
    set({ conversations: res.conversations })
  },

  openConversation: async (id) => {
    set({ activeId: id, messages: [], activeDetails: null, typingIn: [] })
    if (typeof window !== 'undefined' && window.location.hash !== '#/chat') {
      window.location.hash = '#/chat'
    }
    set({ view: 'chat' })
    await get().pollMessages()
    get().markRead().catch(() => {})
  },

  closeConversation: () => set({ activeId: null, messages: [], activeDetails: null }),

  pollMessages: async () => {
    const { activeId, messages } = get()
    if (!activeId) return
    // initial load → full history; otherwise incremental since newest timestamp
    const newest = messages.filter((m) => !m.pending).at(-1)
    const path = newest ? `/conversations/${activeId}/messages?after=${encodeURIComponent(newest.createdAt)}` : `/conversations/${activeId}/messages`
    const res = await api<{
      messages: ChatMessage[]
      deletedIds: string[]
      typing: string[]
      conversation?: ConvDetails
    }>(path)

    if (get().activeId !== activeId) return // switched away mid-flight

    if (!newest && res.conversation) set({ activeDetails: res.conversation })

    let list = messages
    if (newest) {
      const known = new Set(messages.map((m) => m.id))
      const fresh = res.messages.filter((m) => !known.has(m.id))
      if (fresh.length) list = [...messages.filter((m) => !m.pending), ...fresh]
      else list = messages.filter((m) => !m.pending || fresh.length > 0)
      if (res.deletedIds.length) {
        const gone = new Set(res.deletedIds)
        list = list.filter((m) => !gone.has(m.id))
      }
      set({ typingIn: res.typing })
    } else {
      list = res.messages
      set({ typingIn: [] })
    }
    set({ messages: list })
  },

  sendMessage: async (payload) => {
    const { activeId, me } = get()
    if (!activeId || !me) return
    const temp: ChatMessage = {
      id: `temp-${Date.now()}`,
      conversationId: activeId,
      kind: payload.kind,
      content: payload.content || '',
      mediaId: payload.mediaId ?? null,
      durationMs: payload.durationMs ?? null,
      giftEmoji: null,
      pinned: false,
      createdAt: new Date().toISOString(),
      sender: {
        id: me.id,
        username: me.username,
        displayName: me.displayName,
        avatarColor: me.avatarColor,
        role: me.role,
        premium: me.premium,
      },
      replyTo: null,
      reactions: [],
      pending: true,
    }
    set({ messages: [...get().messages, temp] })
    try {
      const res = await api<{ message: ChatMessage }>(`/conversations/${activeId}/messages`, {
        method: 'POST',
        body: JSON.stringify(payload),
      })
      set({ messages: [...get().messages.filter((m) => m.id !== temp.id), res.message] })
      get().refreshConversations().catch(() => {})
    } catch (e) {
      set({ messages: get().messages.filter((m) => m.id !== temp.id) })
      throw e
    }
  },

  applyMessageAction: async (id, action, extra) => {
    const res = await api<{ message: ChatMessage }>(`/messages/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ action, ...extra }),
    })
    const { messages } = get()
    if (res.message) {
      set({ messages: messages.map((m) => (m.id === id ? res.message : m)) })
    }
  },

  deleteMessage: async (id) => {
    await api(`/messages/${id}`, { method: 'DELETE' })
    set({ messages: get().messages.filter((m) => m.id !== id) })
    get().refreshConversations().catch(() => {})
  },

  sendTyping: async () => {
    const { activeId } = get()
    if (!activeId) return
    await api(`/conversations/${activeId}/typing`, { method: 'POST' }).catch(() => {})
  },

  markRead: async () => {
    const { activeId } = get()
    if (!activeId) return
    await api(`/conversations/${activeId}/read`, { method: 'POST' }).catch(() => {})
  },
}))
