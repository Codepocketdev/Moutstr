import { useState, useEffect } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { THEMES } from './constants/themes'
import { useToken } from './hooks/useToken'
import { useChat } from './hooks/useChat'
import { useMintQuoteProcessor, getPendingInvoice } from './hooks/useMintQuoteProcessor'
import { useModelStore } from './utils/modelStore'
import { ChatList } from './pages/ChatList'
import { ChatView } from './pages/ChatView'
import { WalletModal } from './components/WalletModal'
import { Toast } from './components/Toast'

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 0 } }
})

const link = document.createElement('link')
link.rel = 'stylesheet'
link.href = 'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600&family=Geist+Mono:wght@400;500&display=swap'
document.head.appendChild(link)

const GS = ({ t }) => (
  <style>{`
    *, *::before, *::after { margin:0; padding:0; box-sizing:border-box; }
    html, body, #root { height:100%; }
    body { font-family:'Plus Jakarta Sans',sans-serif; -webkit-font-smoothing:antialiased; }
    textarea, input, button { font-family:'Plus Jakarta Sans',sans-serif; }
    button { cursor:pointer; }
    ::-webkit-scrollbar { width:3px; }
    ::-webkit-scrollbar-track { background:transparent; }
    ::-webkit-scrollbar-thumb { background:${t.scrollbar}; border-radius:3px; }
    @keyframes db { 0%,80%,100%{opacity:.2;transform:scale(.75)} 40%{opacity:1;transform:scale(1)} }
  `}</style>
)

// Preferred cheap default models — first match found in API wins
const PREFERRED_MODEL_IDS = [
  'qwen/qwen3-14b',         // confirmed works on routstr
  'qwen/qwen3.5-9b',
  'qwen3-14b',
  'qwen3.5-9b',
  'meta-llama/llama-3.2-1b-instruct',
]

const MODEL_STORAGE_KEY = 'moutstr_selected_model'

function saveModelToStorage(model) {
  if (!model) return
  try { localStorage.setItem(MODEL_STORAGE_KEY, JSON.stringify({ id: model.id, name: model.name })) } catch {}
}

function loadModelFromStorage() {
  try { return JSON.parse(localStorage.getItem(MODEL_STORAGE_KEY) || 'null') } catch { return null }
}

function pickDefaultModel(models) {
  if (!models.length) return null
  // Try preferred list first
  for (const id of PREFERRED_MODEL_IDS) {
    const found = models.find(m => m.id === id || m.id?.toLowerCase() === id.toLowerCase())
    if (found) return found
  }
  // Fallback: cheapest text→text model
  const textModels = models.filter(m =>
    (m.architecture?.input_modalities ?? ['text']).includes('text') &&
    (m.architecture?.output_modalities ?? ['text']).includes('text')
  )
  if (!textModels.length) return models[0]
  return textModels.reduce((best, m) =>
    (m.sats_pricing?.completion ?? Infinity) < (best.sats_pricing?.completion ?? Infinity) ? m : best
  )
}

function AppInner() {
  const [theme, setTheme]     = useState('dark')
  const [view, setView]       = useState('list')
  const [toast, setToast]     = useState(null)
  const [showWallet, setShowWallet] = useState(() => !!getPendingInvoice())
  const [model, setModelState] = useState(null)

  const t = THEMES[theme]

  // Wrap setModel so every change is persisted
  const setModel = (m) => {
    setModelState(m)
    saveModelToStorage(m)
  }

  // ── Models — load cache → restore saved selection → background fetch ──────
  useEffect(() => {
    const { loadFromCache, fetch: fetchM, startPolling } = useModelStore.getState()

    const resolveModel = (models) => {
      if (!models.length) return

      // Try to restore previously selected model
      const saved = loadModelFromStorage()
      if (saved?.id) {
        const restored = models.find(m => m.id === saved.id)
        if (restored) {
          setModelState(restored)
          return
        }
      }

      // First load — pick default
      setModelState(m => m || pickDefaultModel(models))
    }

    // Step 1 — Dexie cache (instant, no network)
    loadFromCache().then(() => {
      resolveModel(useModelStore.getState().models)
    })

    // Step 2 — Fresh from API (background, updates list)
    fetchM().then(() => {
      resolveModel(useModelStore.getState().models)
    })

    // Step 3 — Poll every 10 mins
    startPolling()
    return () => useModelStore.getState().stopPolling()
  }, []) // eslint-disable-line

  // ── Wallet ────────────────────────────────────────────────────────────────
  const { sats, connected, rawToken, connect, onLightningPaid, disconnect } = useToken()

  // ── Chat ──────────────────────────────────────────────────────────────────
  const {
    chats, activeId, activeChat, loading,
    setActiveId, newChat, deleteChat,
    renameChat, starChat, send, hydrate,
  } = useChat()

  useEffect(() => { hydrate() }, []) // eslint-disable-line

  // ── Lightning payment processor ───────────────────────────────────────────
  useMintQuoteProcessor({
    onQuotePaid: ({ sats: newSats }) => {
      onLightningPaid()
      setShowWallet(false)
      toast$(`✅ ${newSats} sats added!`, 'success')
      window.dispatchEvent(new CustomEvent('moutstr:paid'))
    },
  })

  const toast$ = (msg, type = 'error') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3500)
  }

  const handleConnect = async (raw) => {
    const result = await connect(raw)
    if (result?.error) toast$(result.error)
    else {
      toast$(`✓ ${result.sats} sats added!`, 'success')
      setShowWallet(false)
    }
  }

  const handleSend = async (input) => {
    if (!connected || !rawToken) { setShowWallet(true); return }
    if (!model) { toast$('Select a model first'); return }
    const result = await send(input, model.id)
    if (result?.error) toast$(result.error)
  }

  const tokenInfo = connected ? { sats } : null

  return (
    <>
      <GS t={t} />

      {view === 'list' ? (
        <ChatList
          t={t} theme={theme} setTheme={setTheme}
          chats={chats}
          onNewChat={async () => { await newChat(); setView('chat') }}
          onOpenChat={id => { setActiveId(id); setView('chat') }}
          tokenInfo={tokenInfo}
          onOpenWallet={() => setShowWallet(true)}
        />
      ) : (
        <ChatView
          t={t} chat={activeChat} loading={loading}
          model={model} setModel={setModel}
          tokenInfo={tokenInfo}
          onBack={() => setView('list')}
          onSend={handleSend}
          onRename={title => renameChat(activeId, title)}
          onStar={() => starChat(activeId)}
          onDelete={() => { deleteChat(activeId); setView('list') }}
          onOpenWallet={() => setShowWallet(true)}
        />
      )}

      <WalletModal
        show={showWallet}
        onClose={() => setShowWallet(false)}
        onConnect={handleConnect}
        totalSats={sats}
        t={t}
      />

      <Toast toast={toast} />
    </>
  )
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppInner />
    </QueryClientProvider>
  )
}
