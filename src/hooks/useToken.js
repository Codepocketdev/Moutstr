import { useEffect, useCallback } from 'react'
import { useWalletStore } from '../utils/walletStore'
import { getDecodedToken } from '@cashu/cashu-ts'

export function useToken() {
  const store = useWalletStore()

  useEffect(() => { store.hydrate() }, []) // eslint-disable-line

  const connect = useCallback(async (rawToken) => {
    const trimmed = rawToken.trim()
    if (!trimmed.startsWith('cashu')) {
      return { error: 'Token must start with cashu' }
    }
    try {
      const decoded = getDecodedToken(trimmed)
      const proofs = decoded.proofs || decoded.token?.[0]?.proofs || []
      const sats = proofs.reduce((s, p) => s + (p.amount || 0), 0)
      const mint = decoded.mint || decoded.token?.[0]?.mint || null
      await store.setRawToken(trimmed, sats, mint)
      return { success: true, sats }
    } catch (e) {
      return { error: `Invalid token: ${e.message}` }
    }
  }, [store])

  return {
    sats:           store.sats,
    connected:      store.connected,
    mintUrl:        store.mintUrl,
    rawToken:       store.rawToken,
    connect,
    disconnect:     store.disconnect,
    refreshBalance: store.hydrate,
  }
}
