import { useRef } from 'react'
import { useQueries } from '@tanstack/react-query'
import { db } from '../utils/db'
import { mintProofsFromQuote, checkMintQuoteState } from '../utils/routstr'
import { useWalletStore } from '../utils/walletStore'

export const PENDING_INVOICE_KEY = 'moutstr_pending_invoice'

export function savePendingInvoice(data) {
  localStorage.setItem(PENDING_INVOICE_KEY, JSON.stringify({
    ...data,
    createdAt: Math.floor(Date.now() / 1000),
  }))
}

export function getPendingInvoice() {
  try {
    const p = JSON.parse(localStorage.getItem(PENDING_INVOICE_KEY) || '{}')
    if (p.quoteId && Math.floor(Date.now() / 1000) - p.createdAt < 3600) return p
  } catch {}
  return null
}

export function clearPendingInvoice() {
  localStorage.removeItem(PENDING_INVOICE_KEY)
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function getPendingQuotes() {
  try {
    const now = Date.now()
    const quotes = await db.mintQuotes
      .where('state').anyOf(['UNPAID', 'PAID'])
      .toArray()
    return quotes.filter(q => q.expiresAt > now)
  } catch { return [] }
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useMintQuoteProcessor({ onQuotePaid } = {}) {
  const addProofs = useWalletStore(s => s.addProofs)

  // Per-quote processing set — prevents double-minting without blocking other quotes
  const processingRef = useRef(new Set())

  const [{ data: pendingQuotes = [] }] = useQueries({
    queries: [{
      queryKey: ['pending-mint-quotes'],
      queryFn: getPendingQuotes,
      refetchInterval: 5000,
      refetchIntervalInBackground: true,
    }]
  })

  useQueries({
    queries: pendingQuotes.map(quote => ({
      queryKey: ['mint-quote-check', quote.id],
      queryFn: async () => {
        const status = await checkMintQuoteState(quote.mintUrl, quote.id)

        if (status.state === 'PAID' || status.state === 'ISSUED') {
          // Skip if already being processed (per-quote guard, not global)
          if (processingRef.current.has(quote.id)) return status
          processingRef.current.add(quote.id)

          try {
            const { proofs, sats } = await mintProofsFromQuote(
              quote.mintUrl, quote.id, quote.amountSats, quote.unit,
            )

            // Accumulate — never replaces existing balance
            await addProofs(quote.mintUrl, proofs)

            // Clean up
            await db.mintQuotes.update(quote.id, { state: 'ISSUED' })
            setTimeout(() => db.mintQuotes.delete(quote.id), 3000)
            clearPendingInvoice()

            await db.transactions.add({
              type: 'receive', amount: sats,
              note: 'Lightning deposit', timestamp: Date.now(),
            })

            // Dispatch event so WalletModal can close itself
            window.dispatchEvent(
              new CustomEvent('moutstr:paid', { detail: { sats, mintUrl: quote.mintUrl } })
            )

            if (onQuotePaid) onQuotePaid({ sats, mintUrl: quote.mintUrl })

          } catch (e) {
            console.error('[moutstr] mintProofs failed for', quote.id, e)
            // Remove from processing set so it can retry
            processingRef.current.delete(quote.id)
          }
          // On success: intentionally keep in processingRef so the 3s deletion
          // window doesn't trigger a second mint attempt
        }

        if (status.state === 'EXPIRED') {
          await db.mintQuotes.delete(quote.id)
          clearPendingInvoice()
        }

        return status
      },
      refetchInterval: 3000,
      refetchIntervalInBackground: true,
      retry: 2,
      enabled: pendingQuotes.length > 0,
    }))
  })
}
