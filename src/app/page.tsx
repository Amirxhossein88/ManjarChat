'use client'

import { useEffect, useState } from 'react'
import { useManjar } from '@/components/chat/store'
import LoginView from '@/components/chat/LoginView'
import Sidebar, { NewChatDialog } from '@/components/chat/Sidebar'
import ChatWindow from '@/components/chat/ChatWindow'
import AdminView from '@/components/chat/AdminView'
import { WalletView, ShopView, SettingsView } from '@/components/chat/Panels'
import { ThemeProvider } from 'next-themes'
import { Toaster } from 'sonner'
import { Loader2, ArrowRight as ArrowRightIcon } from 'lucide-react'

const VIEWS = ['chat', 'wallet', 'shop', 'admin', 'settings']

export default function Home() {
  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false} disableTransitionOnChange>
      <ManjarApp />
      <Toaster position="top-center" richColors closeButton dir="rtl" />
    </ThemeProvider>
  )
}

function ManjarApp() {
  const { me, booted, view, activeId, refreshMe, startPolling, stopPolling, setView } = useManjar()
  const [newChat, setNewChat] = useState(false)
  const [ready, setReady] = useState(false)

  // boot: restore session from cookie
  useEffect(() => {
    refreshMe().finally(() => setReady(true))
     
  }, [])

  // hash → view sync (mount + hashchange only; must not depend on `me`)
  useEffect(() => {
    const apply = () => {
      const h = window.location.hash.replace('#/', '')
      if (VIEWS.includes(h)) setView(h)
    }
    apply()
    window.addEventListener('hashchange', apply)
    return () => window.removeEventListener('hashchange', apply)
  }, [])

  // start/stop polling with session
  useEffect(() => {
    if (me) startPolling()
    else stopPolling()
    return () => stopPolling()
     
  }, [!!me])

  // mobile: back button in chat resets hash when leaving
  function goBackFromChat() {
    useManjar.getState().closeConversation()
  }

  if (!ready || (!me && booted && !ready)) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          { }
          <img src="/manjar-icon.svg" alt="منجرچت" className="w-20 h-20 mc-gift-float" />
          <Loader2 className="w-5 h-5 animate-spin" />
        </div>
      </div>
    )
  }

  if (!me) {
    return (
      <LoginView
        onLogin={(u) => {
          useManjar.getState().setMe(u)
          window.location.hash = '#/chat'
        }}
      />
    )
  }

  const isMobileChatOpen = view === 'chat' && activeId

  return (
    <div className="h-screen w-screen flex overflow-hidden bg-background">
      {/* sidebar: on mobile, full width unless a chat is open */}
      <div className={`${isMobileChatOpen ? 'hidden md:flex' : 'flex'} h-full w-full md:w-[330px] lg:w-[370px] shrink-0`}>
        <Sidebar onNewChat={() => setNewChat(true)} />
      </div>

      {/* main area: chat window or active panel (desktop); panels also cover mobile via flex fallback */}
      <div className={`${isMobileChatOpen ? 'flex' : 'hidden md:flex'} h-full flex-1 min-w-0 relative`}>
        {view === 'chat' ? (
          activeId ? (
            <ChatWindow onBack={goBackFromChat} />
          ) : (
            <EmptyChatState />
          )
        ) : (
          <PanelSwitch view={view} />
        )}
      </div>

      {/* mobile: full-screen panel with back button */}
      {view !== 'chat' && (
        <div className="md:hidden fixed inset-0 z-30 bg-background">
          <button
            onClick={() => {
              setView('chat')
              window.location.hash = '#/chat'
            }}
            className="absolute top-3 right-3 z-40 p-2.5 rounded-full bg-secondary text-foreground shadow"
            aria-label="بازگشت به چت‌ها"
          >
            <ArrowRightIcon className="w-5 h-5" />
          </button>
          <PanelSwitch view={view} />
        </div>
      )}

      <NewChatDialog open={newChat} onOpenChange={setNewChat} />
    </div>
  )
}

function PanelSwitch({ view }: { view: string }) {
  if (view === 'wallet') return <WalletView />
  if (view === 'shop') return <ShopView />
  if (view === 'admin') return <AdminView />
  if (view === 'settings') return <SettingsView />
  return null
}

function EmptyChatState() {
  return (
    <div className="h-full w-full flex items-center justify-center chat-pattern">
      <div className="text-center space-y-3 px-6">
        { }
        <img src="/manjar-icon.svg" alt="منجرچت" className="w-24 h-24 mx-auto mc-gift-float" />
        <h2 className="text-2xl font-extrabold">به منجرچت خوش آمدی 🪙</h2>
        <p className="text-sm text-muted-foreground leading-relaxed max-w-sm">
          یک گفتگو را از لیست انتخاب کن یا چت جدید شروع کن.
          <br />
          پیام صوتی، عکس، هدیه و پرمیوم منتظر توست!
        </p>
      </div>
    </div>
  )
}
