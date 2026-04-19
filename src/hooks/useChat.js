import { useCallback } from 'react'
import { useChatStore } from '../utils/chatStore'
import { useWalletStore } from '../utils/walletStore'
import { sendMessage } from '../utils/routstr'
import { getDecodedToken } from '@cashu/cashu-ts'

export function useChat() {
  const chatStore = useChatStore()

  const send = useCallback(async (input, modelId) => {
    const { activeId, activeChat } = useChatStore.getState()
    const { rawToken, setRawToken, mintUrl } = useWalletStore.getState()

    if (!input.trim() || !activeId) return null
    if (!rawToken) return { error: 'No balance. Add funds first.' }

    chatStore.setLoading(true)

    const userMsg = await chatStore.addMessage(activeId, {
      role: 'user',
      content: input.trim(),
    })

    const history = [
      ...(activeChat?.messages || []).map(({ role, content }) => ({ role, content })),
      { role: 'user', content: input.trim() },
    ]

    try {
      const result = await sendMessage(rawToken, modelId, history)

      if (result.changeToken) {
        try {
          const decoded = getDecodedToken(result.changeToken)
          const proofs  = decoded.proofs || decoded.token?.[0]?.proofs || []
          const newSats = proofs.reduce((s, p) => s + (p.amount || 0), 0)
          const newMint = decoded.mint || decoded.token?.[0]?.mint || mintUrl
          await setRawToken(result.changeToken, newSats, newMint)
          console.log('[moutstr] Change stored:', newSats, 'sats remaining')
        } catch (e) {
          // Came back but unparseable — keep existing token, next 402 will catch it
          console.warn('[moutstr] Could not parse change token, keeping existing:', e)
        }
      } else {
        // No X-Cashu header — could be CORS or balance hit 0.
        // Do NOT disconnect — keep token and let the next 402 tell us if it's gone.
        console.warn('[moutstr] No X-Cashu header — keeping token, will discover on next send')
      }

      await chatStore.addMessage(activeId, {
        role: 'assistant',
        content: result.content,
      })

      return { success: true }

    } catch (err) {
      await chatStore.removeMessage(activeId, userMsg.id)

      if (err.code === 402) {
        return {
          error: 'Not enough balance for this model. Try a cheaper model or top up your wallet.',
        }
      }

      return { error: err.message }

    } finally {
      chatStore.setLoading(false)
    }
  }, [chatStore])

  return {
    chats:       chatStore.chats,
    activeId:    chatStore.activeId,
    activeChat:  chatStore.chats.find(c => c.id === chatStore.activeId) ?? null,
    loading:     chatStore.loading,
    setActiveId: chatStore.setActiveId,
    newChat:     chatStore.newChat,
    deleteChat:  chatStore.deleteChat,
    renameChat:  chatStore.renameChat,
    starChat:    chatStore.starChat,
    send,
    hydrate:     chatStore.hydrate,
  }
}
