import { create } from 'zustand'
import { db } from './db'

export const useChatStore = create((set, get) => ({
  chats: [], activeId: null, loading: false,

  hydrate: async () => {
    try {
      const chats = await db.chats.orderBy('createdAt').reverse().toArray()
      const withMessages = await Promise.all(
        chats.map(async c => ({
          ...c,
          messages: await db.messages.where('chatId').equals(c.id).sortBy('createdAt'),
        }))
      )
      set({ chats: withMessages })
    } catch (e) { console.error('chatStore.hydrate', e) }
  },

  newChat: async () => {
    const id = await db.chats.add({ title: 'New chat', starred: false, createdAt: Date.now() })
    const chat = { id, title: 'New chat', starred: false, createdAt: Date.now(), messages: [] }
    set(s => ({ chats: [chat, ...s.chats], activeId: id }))
    return id
  },

  setActiveId: id => set({ activeId: id }),

  deleteChat: async id => {
    await db.messages.where('chatId').equals(id).delete()
    await db.chats.delete(id)
    set(s => ({ chats: s.chats.filter(c => c.id !== id), activeId: s.activeId === id ? null : s.activeId }))
  },

  renameChat: async (id, title) => {
    await db.chats.update(id, { title })
    set(s => ({ chats: s.chats.map(c => c.id === id ? { ...c, title } : c) }))
  },

  starChat: async id => {
    const chat = get().chats.find(c => c.id === id)
    if (!chat) return
    const starred = !chat.starred
    await db.chats.update(id, { starred })
    set(s => ({ chats: s.chats.map(c => c.id === id ? { ...c, starred } : c) }))
  },

  addMessage: async (chatId, msg) => {
    const msgId = await db.messages.add({ ...msg, chatId, createdAt: Date.now() })
    const fullMsg = { ...msg, id: msgId, chatId }
    const chat = get().chats.find(c => c.id === chatId)
    const isFirst = chat?.messages.length === 0 && msg.role === 'user'
    if (isFirst) {
      const title = msg.content.slice(0, 40) + (msg.content.length > 40 ? '…' : '')
      await db.chats.update(chatId, { title })
      set(s => ({ chats: s.chats.map(c => c.id === chatId ? { ...c, title, messages: [...c.messages, fullMsg] } : c) }))
    } else {
      set(s => ({ chats: s.chats.map(c => c.id === chatId ? { ...c, messages: [...c.messages, fullMsg] } : c) }))
    }
    return fullMsg
  },

  removeMessage: async (chatId, msgId) => {
    await db.messages.delete(msgId)
    set(s => ({ chats: s.chats.map(c => c.id === chatId ? { ...c, messages: c.messages.filter(m => m.id !== msgId) } : c) }))
  },

  setLoading: loading => set({ loading }),
}))

