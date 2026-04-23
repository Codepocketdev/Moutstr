import { useCallback } from 'react'
import { useChatStore } from '../utils/chatStore'
import { useWalletStore } from '../utils/walletStore'
import { sendMessage } from '../utils/routstr'
import { getDecodedToken } from '@cashu/cashu-ts'

export function useChat() {
  const chatStore = useChatStore()

  const send = useCallback(async (input, modelId) => {
    const { activeId, activeChat } = useChatStore.getState()
    const { rawToken, mintUrl, applyChange, dropActiveToken } = useWalletStore.getState()

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
        const hasNext = await dropActiveToken()
        if (hasNext) {
          chatStore.setLoading(false)
          return send(input, modelId)
        }
        return { error: 'Not enough balance. Top up your wallet to continue.' }
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
