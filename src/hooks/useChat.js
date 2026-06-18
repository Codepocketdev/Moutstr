import { useCallback } from 'react'
import { useChatStore } from '../utils/chatStore'
import { useWalletStore } from '../utils/walletStore'
import { useModelStore, estimateMinSats } from '../utils/modelStore'
import { sendMessage } from '../utils/routstr'

export function useChat() {
  const chatStore = useChatStore()

  const send = useCallback(async (input, modelId) => {
    const { activeId, activeChat } = useChatStore.getState()
    const { rawToken, sats, mintUrl, applyChange } = useWalletStore.getState()

    if (!input.trim() || !activeId) return null
    if (!rawToken) return { error: 'No balance. Add funds first.' }

    // Pre-flight: check balance vs model cost before sending anything
    const models = useModelStore.getState().models
    const modelObj = models.find(m => m.id === modelId)
    const minCost = modelObj ? estimateMinSats(modelObj) : 1

    if (sats < minCost) {
      return {
        error: `Not enough balance. This model needs ~${minCost} sats, you have ${sats} sats. Top up or pick a cheaper model.`,
      }
    }

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
      const result = await sendMessage(rawToken, modelId, history, {
        availableSats: sats,
        model: modelObj,
      })

      if (result.changeToken) {
        await applyChange(result.changeToken, mintUrl)
      } else {
        console.warn('[moutstr] No X-Cashu header returned')
      }

      await chatStore.addMessage(activeId, {
        role: 'assistant',
        content: result.content,
      })

      return { success: true }

    } catch (err) {
      await chatStore.removeMessage(activeId, userMsg.id)

      if (err.code === 402) {
        // 402 = not enough balance for this model — token is NOT spent, keep it
        const currentSats = useWalletStore.getState().sats
        return {
          error: `Not enough balance for this model. You have ${currentSats} sats — try a cheaper model or top up.`,
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
