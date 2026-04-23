import { create } from 'zustand'
import { db } from './db'
import { getEncodedTokenV4, getDecodedToken } from '@cashu/cashu-ts'

export const DEFAULT_MINT = 'https://mint.minibits.cash/Bitcoin'

export const useWalletStore = create((set, get) => ({
  rawToken:  null,
  tokens:    [],
  sats:      0,
  connected: false,
  mintUrl:   DEFAULT_MINT,

  hydrate: async () => {
    try {
      const [tokensSetting, mintSetting] = await Promise.all([
        db.settings.get('tokens'),
        db.settings.get('wallet_mint'),
      ])
      let tokens = []
      if (tokensSetting?.value) {
        tokens = JSON.parse(tokensSetting.value)
      } else {
        const legacy = await db.settings.get('raw_token')
        if (legacy?.value) {
          tokens = [{ raw: legacy.value, sats: legacy.sats || 0, mintUrl: mintSetting?.value || DEFAULT_MINT }]
          await db.settings.put({ key: 'tokens', value: JSON.stringify(tokens) })
        }
      }
      const sats = tokens.reduce((s, t) => s + (t.sats || 0), 0)
      set({
        rawToken:  tokens[0]?.raw || null,
        tokens,
        sats,
        connected: tokens.length > 0,
        mintUrl:   mintSetting?.value || DEFAULT_MINT,
      })
    } catch (e) {
      console.error('walletStore.hydrate', e)
    }
  },

  _save: async (tokens, mintUrl) => {
    const sats = tokens.reduce((s, t) => s + (t.sats || 0), 0)
    const mint = mintUrl || get().mintUrl
    await db.settings.put({ key: 'tokens', value: JSON.stringify(tokens) })
    if (mintUrl) await db.settings.put({ key: 'wallet_mint', value: mintUrl })
    set({ rawToken: tokens[0]?.raw || null, tokens, sats, connected: tokens.length > 0, mintUrl: mint })
  },

  // Append token to queue — never overwrites existing
  // Used for: pasted tokens AND X-Cashu change tokens from API
  setRawToken: async (raw, sats, mintUrl) => {
    const { tokens, _save } = get()
    if (tokens.some(t => t.raw === raw)) return
    await _save([...tokens, { raw, sats, mintUrl: mintUrl || get().mintUrl }], mintUrl)
    console.log('[wallet] Token queued. Total:', get().sats, 'sats | Queue:', get().tokens.length)
  },

  // LN deposit: encode fresh proofs once, append to queue
  addProofs: async (mintUrl, proofs) => {
    try {
      const raw  = getEncodedTokenV4({ mint: mintUrl, proofs, unit: 'sat' })
      const sats = proofs.reduce((s, p) => s + (p.amount || 0), 0)
      const { tokens, _save } = get()
      if (tokens.some(t => t.raw === raw)) return
      await _save([...tokens, { raw, sats, mintUrl }], mintUrl)
      console.log('[wallet] LN deposit queued:', sats, 'sats | Total:', get().sats, 'sats')
    } catch (e) {
      console.error('walletStore.addProofs', e)
    }
  },

  // Change token from routstr: replaces slot 0, keeps rest of queue
  applyChange: async (raw, mintUrl) => {
    try {
      const decoded = getDecodedToken(raw)
      const sats    = (decoded.proofs || []).reduce((s, p) => s + (p.amount || 0), 0)
      const mint    = decoded.mint || mintUrl || get().mintUrl
      const { tokens, _save } = get()
      await _save([{ raw, sats, mintUrl: mint }, ...tokens.slice(1)], mint)
      console.log('[wallet] Change applied:', sats, 'sats | Queue:', get().tokens.length)
    } catch (e) {
      console.warn('[wallet] applyChange failed, keeping token:', e)
    }
  },

  // 402: drop exhausted slot 0, promote next
  dropActiveToken: async () => {
    const { tokens, _save } = get()
    const rest = tokens.slice(1)
    if (rest.length === 0) {
      await db.settings.delete('tokens')
      set({ rawToken: null, tokens: [], sats: 0, connected: false })
      return false
    }
    await _save(rest, rest[0]?.mintUrl)
    console.log('[wallet] Promoted next token. Queue:', rest.length)
    return true
  },

  updateAfterRefund: async (refundToken) => {
    try {
      const decoded = getDecodedToken(refundToken)
      const sats    = (decoded.proofs || []).reduce((s, p) => s + (p.amount || 0), 0)
      const mintUrl = decoded.mint || get().mintUrl
      const { tokens, _save } = get()
      await _save([{ raw: refundToken, sats, mintUrl }, ...tokens.slice(1)], mintUrl)
    } catch (e) {
      console.error('walletStore.updateAfterRefund', e)
    }
  },

  disconnect: async () => {
    await db.settings.delete('tokens')
    await db.settings.delete('raw_token')
    await db.proofs.clear()
    set({ rawToken: null, tokens: [], sats: 0, connected: false })
  },

  setMintUrl: async (url) => {
    set({ mintUrl: url })
    await db.settings.put({ key: 'wallet_mint', value: url })
  },
}))
