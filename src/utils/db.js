import Dexie from 'dexie'

export class MoutstrDB extends Dexie {
  constructor() {
    super('MoutstrDB')
    this.version(1).stores({
      proofs: 'secret, mint, amount, id',
      mintQuotes: 'id, state, mintUrl, expiresAt',
      chats: '++id, createdAt, starred',
      messages: '++id, chatId, createdAt',
      transactions: '++id, timestamp, type',
      settings: 'key',
    })
    this.version(2).stores({
      proofs: 'secret, mint, amount, id',
      mintQuotes: 'id, state, mintUrl, expiresAt',
      chats: '++id, createdAt, starred',
      messages: '++id, chatId, createdAt',
      transactions: '++id, timestamp, type',
      settings: 'key',
      modelsCache: 'id, name',
    })
  }
}

export const db = new MoutstrDB()
