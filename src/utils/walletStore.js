import { create } from 'zustand'
import { db } from './db'
import { getEncodedTokenV4, getDecodedToken } from '@cashu/cashu-ts'

export const DEFAULT_MINT = 'https://mint.minibits.cash/Bitcoin'

export const useWalletStore = create((set, get) => ({
  sats: 0,
  connected: false,
  mintUrl: DEFAULT_MINT,
  rawToken: null,

  hydrate: async () => {
    try {
      const [tokenSetting, mintSetting] = await Promise.all([
        db.settings.get('raw_token'),
        db.settings.get('wallet_mint'),
      ])
      const rawToken = tokenSetting?.value || null
      const sats = tokenSetting?.sats || 0
      set({
        rawToken,
        sats,
        connected: !!rawToken,
        mintUrl: mintSetting?.value || DEFAULT_MINT,
      })
    } catch (e) {
      console.error('walletStore.hydrate', e)
    }
  },

  // Store token exactly as-is — used for:
  //   • pasted cashu tokens (must never be re-encoded — routstr hashes the raw string as the API key)
  //   • X-Cashu change tokens returned after API calls
  setRawToken: async (rawToken, sats, mintUrl) => {
    await db.settings.put({ key: 'raw_token', value: rawToken, sats })
    if (mintUrl) {
      await db.settings.put({ key: 'wallet_mint', value: mintUrl })
    }
    set({
      rawToken,
      sats,
      connected: !!rawToken,
      mintUrl: mintUrl || get().mintUrl,
    })
  },

  // Called after LN payment — fresh minted proofs → encode as new token → new routstr key
  addProofs: async (mintUrl, proofs) => {
    try {
      const newToken = getEncodedTokenV4({ mint: mintUrl, proofs, unit: 'sat' })
      const sats = proofs.reduce((s, p) => s + (p.amount || 0), 0)

      await db.settings.put({ key: 'raw_token', value: newToken, sats })
      await db.settings.put({ key: 'wallet_mint', value: mintUrl })

      set({ rawToken: newToken, sats, connected: true, mintUrl })
    } catch (e) {
      console.error('walletStore.addProofs', e)
    }
  },

  updateAfterRefund: async (refundToken) => {
    try {
      const decoded = getDecodedToken(refundToken)
      const proofs = decoded.proofs || []
      const sats = proofs.reduce((s, p) => s + (p.amount || 0), 0)
      const mintUrl = decoded.mint || get().mintUrl

      await db.settings.put({ key: 'raw_token', value: refundToken, sats })
      await db.settings.put({ key: 'wallet_mint', value: mintUrl })

      set({ rawToken: refundToken, sats, connected: sats > 0, mintUrl })
    } catch (e) {
      console.error('walletStore.updateAfterRefund', e)
    }
  },

  disconnect: async () => {
    await db.settings.delete('raw_token')
    await db.proofs.clear()
    set({ rawToken: null, sats: 0, connected: false })
  },

  setMintUrl: async (url) => {
    set({ mintUrl: url })
    await db.settings.put({ key: 'wallet_mint', value: url })
  },
}))
