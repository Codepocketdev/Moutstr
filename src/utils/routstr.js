import { Mint, Wallet, getDecodedToken, getEncodedTokenV4 } from '@cashu/cashu-ts'

const BASE = 'https://api.routstr.com/v1'
export const DEFAULT_MINT = 'https://mint.minibits.cash/Bitcoin'

// ── Decode token → proofs + metadata ─────────────────────────────────────────
export function decodeToken(tokenStr) {
  const decoded = getDecodedToken(tokenStr)
  return {
    mint:   decoded.mint   || DEFAULT_MINT,
    unit:   decoded.unit   || 'sat',
    proofs: decoded.proofs || [],
    sats:   (decoded.proofs || []).reduce((s, p) => s + (p.amount || 0), 0),
  }
}

// ── Encode proofs as cashuB token ─────────────────────────────────────────────
export function encodeToken(mintUrl, proofs, unit = 'sat') {
  return getEncodedTokenV4({ mint: mintUrl, proofs, unit })
}

// ── Chat — raw Bearer + capture X-Cashu change header ────────────────────────
export async function sendMessage(token, modelId, messages) {
  const res = await fetch(`${BASE}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ model: modelId, messages, stream: false }),
  })

  let data
  try { data = await res.json() } catch { data = {} }

  if (!res.ok) {
    const msg =
      typeof data?.detail === 'string' ? data.detail :
      data?.detail?.message || data?.error?.message ||
      data?.message || `Error ${res.status}`

    const err = new Error(msg)
    if (res.status === 402) {
      err.code = 402
      console.warn('[routstr] 402 detail:', JSON.stringify(data, null, 2))
    }
    throw err
  }

  const changeToken = res.headers.get('X-Cashu') || null
  console.log('[routstr] X-Cashu header:', changeToken ? `${changeToken.slice(0, 40)}...` : 'null')

  return {
    content:     data.choices?.[0]?.message?.content || '(no response)',
    changeToken,
  }
}

// ── Models — fetch from API ───────────────────────────────────────────────────
export async function fetchModels() {
  try {
    const res = await fetch(`${BASE}/models`)
    const data = await res.json()
    return data?.data || []
  } catch { return [] }
}

// ── Wallet helpers ────────────────────────────────────────────────────────────
const _walletCache = new Map()

async function getWallet(mintUrl) {
  if (_walletCache.has(mintUrl)) return _walletCache.get(mintUrl)
  const mint = new Mint(mintUrl)
  const keysetsResp = await mint.getKeySets()
  const active = (keysetsResp.keysets || []).filter(k => k.active)
  const units = [...new Set(active.map(k => k.unit))]
  const unit = units.includes('msat') ? 'msat' : 'sat'
  const wallet = new Wallet(mint, { unit })
  await wallet.loadMint()
  const entry = { wallet, unit }
  _walletCache.set(mintUrl, entry)
  setTimeout(() => _walletCache.delete(mintUrl), 10 * 60 * 1000)
  return entry
}

export async function createLightningInvoice(mintUrl, amountSats) {
  const { wallet, unit } = await getWallet(mintUrl)
  const quote = await wallet.createMintQuote(amountSats)
  return {
    bolt11:    quote.request,
    quoteId:   quote.quote,
    expiresAt: quote.expiry ? quote.expiry * 1000 : Date.now() + 60 * 60 * 1000,
    mintUrl,
    amountSats,
    unit,
  }
}

export async function mintProofsFromQuote(mintUrl, quoteId, amountSats) {
  const { wallet, unit } = await getWallet(mintUrl)
  const proofs = await wallet.mintProofs(amountSats, quoteId)
  return { proofs, unit, sats: amountSats }
}

export async function checkMintQuoteState(mintUrl, quoteId) {
  const res = await fetch(`${mintUrl}/v1/mint/quote/bolt11/${quoteId}`)
  if (!res.ok) throw new Error(`Quote check failed: ${res.status}`)
  return res.json()
}
