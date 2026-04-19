import { useState, useEffect } from 'react'
import QRCode from 'qrcode'
import { createLightningInvoice, decodeToken, DEFAULT_MINT } from '../utils/routstr'
import { db } from '../utils/db'
import {
  savePendingInvoice,
  getPendingInvoice,
  clearPendingInvoice,
} from '../hooks/useMintQuoteProcessor'

const AMOUNTS = [21, 100, 500, 1000]

export function WalletModal({ show, onClose, onConnect, totalSats, t }) {
  const [tab, setTab]             = useState('lightning')
  const [amountStr, setAmountStr] = useState('100')
  const amount = parseInt(amountStr) || 0

  const [tokenInput, setTokenInput]     = useState('')
  const [tokenPreview, setTokenPreview] = useState(null)
  const [cashuError, setCashuError]     = useState('')

  const [restored] = useState(() => getPendingInvoice())
  const [lnState, setLnState] = useState(restored ? 'waiting' : 'idle')
  const [bolt11, setBolt11]   = useState(restored?.bolt11 || '')
  const [lnError, setLnError] = useState('')
  const [copied, setCopied]   = useState(false)
  const [qrUrl, setQrUrl]     = useState('')

  useEffect(() => {
    if (!bolt11) { setQrUrl(''); return }
    QRCode.toDataURL(bolt11.toUpperCase(), {
      width: 240, margin: 2,
      color: { dark: '#000000', light: '#ffffff' },
    }).then(setQrUrl).catch(() => setQrUrl(''))
  }, [bolt11])

  useEffect(() => {
    if (!show) return
    const pending = getPendingInvoice()
    if (pending) {
      setBolt11(pending.bolt11 || '')
      setAmountStr(String(pending.amountSats || 100))
      setLnState('waiting')
      setTab('lightning')
    }
    setCashuError('')
    setTokenPreview(null)
  }, [show])

  useEffect(() => {
    const handler = () => {
      setLnState('idle')
      setBolt11('')
      onClose()
    }
    window.addEventListener('moutstr:paid', handler)
    return () => window.removeEventListener('moutstr:paid', handler)
  }, [onClose])

  if (!show) return null

  const handleGenerateInvoice = async () => {
    if (amount < 1) return
    setLnState('loading')
    setLnError('')
    try {
      const invoice = await createLightningInvoice(DEFAULT_MINT, amount)
      savePendingInvoice({
        quoteId:    invoice.quoteId,
        bolt11:     invoice.bolt11,
        mintUrl:    invoice.mintUrl,
        amountSats: invoice.amountSats,
        unit:       invoice.unit,
      })
      await db.mintQuotes.put({
        id:         invoice.quoteId,
        state:      'UNPAID',
        mintUrl:    invoice.mintUrl,
        amountSats: invoice.amountSats,
        unit:       invoice.unit,
        bolt11:     invoice.bolt11,
        expiresAt:  invoice.expiresAt,
        createdAt:  Date.now(),
      })
      setBolt11(invoice.bolt11)
      setLnState('waiting')
    } catch (err) {
      setLnState('error')
      setLnError(err.message)
    }
  }

  const copyInvoice = () => {
    navigator.clipboard.writeText(bolt11)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const cancelInvoice = async () => {
    const pending = getPendingInvoice()
    if (pending?.quoteId) await db.mintQuotes.delete(pending.quoteId)
    clearPendingInvoice()
    setLnState('idle')
    setBolt11('')
  }

  const handleTokenInput = (val) => {
    setTokenInput(val)
    setCashuError('')
    if (val.trim().startsWith('cashu')) {
      try {
        const { sats, mint } = decodeToken(val.trim())
        const mintShort = mint.replace('https://', '').split('/')[0]
        setTokenPreview(sats > 0 ? { sats, mintShort } : null)
      } catch { setTokenPreview(null) }
    } else { setTokenPreview(null) }
  }

  const handleConnect = () => {
    const raw = tokenInput.trim()
    if (!raw.startsWith('cashu')) { setCashuError('Token must start with cashu'); return }
    try {
      const { sats } = decodeToken(raw)
      if (sats === 0) { setCashuError('No sats found in token'); return }
    } catch (e) { setCashuError(`Invalid token: ${e.message}`); return }
    // Pass raw token as-is — must NOT be re-encoded before reaching walletStore
    onConnect(raw)
    setTokenInput('')
    setTokenPreview(null)
  }

  const tabBtn = active => ({
    flex: 1, padding: '9px 0', border: 'none', cursor: 'pointer',
    background: active ? t.accent : 'transparent',
    color: active ? '#000' : t.textMuted,
    fontSize: 13, fontWeight: active ? 600 : 400, borderRadius: 8,
  })

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', zIndex: 400, display: 'flex', alignItems: 'flex-end' }}>
      <div onClick={e => e.stopPropagation()} style={{ background: t.bgSecondary, border: `1px solid ${t.border}`, borderRadius: '16px 16px 0 0', padding: 24, paddingBottom: 40, width: '100%', boxShadow: t.shadow, maxHeight: '92dvh', overflowY: 'auto' }}>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{ fontFamily: "'Geist Mono',monospace", fontSize: 16, fontWeight: 500, color: t.text }}>⚡ Add Balance</div>
          {totalSats > 0 && <div style={{ fontFamily: "'Geist Mono',monospace", fontSize: 13, color: t.accent }}>{totalSats} sats</div>}
        </div>

        <div style={{ display: 'flex', gap: 4, background: t.bgTertiary, border: `1px solid ${t.border}`, borderRadius: 10, padding: 3, marginBottom: 20 }}>
          <button style={tabBtn(tab === 'lightning')} onClick={() => setTab('lightning')}>Lightning</button>
          <button style={tabBtn(tab === 'cashu')} onClick={() => setTab('cashu')}>Cashu Token</button>
        </div>

        {tab === 'lightning' && (
          <>
            {lnState === 'idle' && (
              <>
                <p style={{ fontSize: 13, color: t.textMuted, marginBottom: 14, lineHeight: 1.6 }}>
                  Pay via Lightning. Funds load instantly.
                </p>
                <div style={{ fontSize: 12, color: t.textMuted, marginBottom: 8 }}>Amount (sats)</div>
                <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                  {AMOUNTS.map(a => (
                    <button key={a} onClick={() => setAmountStr(String(a))} style={{
                      flex: 1, padding: '9px 0',
                      border: `1px solid ${amount === a ? t.accent : t.border}`,
                      background: amount === a ? t.accentDim : 'transparent',
                      borderRadius: 8, cursor: 'pointer',
                      color: amount === a ? t.accent : t.textMuted,
                      fontSize: 13, fontWeight: amount === a ? 600 : 400,
                    }}>{a}</button>
                  ))}
                </div>
                <input
                  type="number"
                  value={amountStr}
                  onChange={e => setAmountStr(e.target.value)}
                  onFocus={e => e.target.select()}
                  placeholder="Custom amount..."
                  min={1}
                  style={{ width: '100%', background: t.bgInput, border: `1px solid ${t.border}`, borderRadius: 9, padding: '10px 14px', color: t.text, fontSize: 14, outline: 'none', marginBottom: 16 }}
                />
                <div style={{ display: 'flex', gap: 10 }}>
                  <button onClick={onClose} style={{ flex: 1, padding: 11, background: 'transparent', border: `1px solid ${t.border}`, borderRadius: 9, color: t.textMuted, fontSize: 13, cursor: 'pointer' }}>Cancel</button>
                  <button onClick={handleGenerateInvoice} disabled={amount < 1} style={{ flex: 2, padding: 11, background: amount < 1 ? t.border : t.accent, border: 'none', borderRadius: 9, cursor: amount < 1 ? 'not-allowed' : 'pointer', color: '#000', fontSize: 13, fontWeight: 600 }}>Generate Invoice →</button>
                </div>
              </>
            )}

            {lnState === 'loading' && (
              <div style={{ textAlign: 'center', padding: '32px 0', color: t.textMuted, fontSize: 14 }}>Connecting to mint...</div>
            )}

            {lnState === 'waiting' && bolt11 && (
              <>
                <p style={{ fontSize: 13, color: t.textMuted, marginBottom: 12, lineHeight: 1.5 }}>
                  Scan or copy. Close this modal freely — payment is tracked in the background.
                </p>
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
                  {qrUrl
                    ? <div onClick={copyInvoice} title="Tap to copy" style={{ background: '#fff', borderRadius: 12, padding: 10, cursor: 'pointer', boxShadow: '0 2px 20px rgba(0,0,0,0.3)' }}>
                        <img src={qrUrl} alt="LN Invoice" style={{ width: 220, height: 220, display: 'block', borderRadius: 4 }} />
                      </div>
                    : <div style={{ width: 220, height: 220, background: t.bgTertiary, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', color: t.textMuted, fontSize: 12 }}>Generating QR...</div>
                  }
                </div>
                <div style={{ textAlign: 'center', marginBottom: 10 }}>
                  <span style={{ background: t.accentDim, border: `1px solid ${t.accentBorder}`, borderRadius: 20, padding: '4px 14px', fontSize: 13, color: t.accent, fontFamily: "'Geist Mono',monospace" }}>
                    {amount} sats
                  </span>
                </div>
                <div style={{ background: t.bgTertiary, border: `1px solid ${t.border}`, borderRadius: 10, padding: '9px 12px', marginBottom: 10, fontFamily: "'Geist Mono',monospace", fontSize: 10, color: t.textMuted, wordBreak: 'break-all', lineHeight: 1.5, maxHeight: 52, overflowY: 'auto' }}>
                  {bolt11}
                </div>
                <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                  <button onClick={() => { try { window.open(`lightning:${bolt11}`, '_blank') } catch {} }} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '10px 0', background: t.accent, border: 'none', borderRadius: 9, cursor: 'pointer', fontSize: 12, fontWeight: 700, color: '#000' }}>
                    ⚡ Open wallet
                  </button>
                  <button onClick={copyInvoice} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '10px 0', background: copied ? t.accentDim : t.bgTertiary, border: `1px solid ${copied ? t.accent : t.border}`, borderRadius: 9, cursor: 'pointer', fontSize: 12, fontWeight: 500, color: copied ? t.accent : t.text }}>
                    {copied ? '✓ Copied!' : 'Copy invoice'}
                  </button>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center', color: t.textMuted, fontSize: 11 }}>
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: t.accent, display: 'inline-block', animation: 'lnpulse 1.5s infinite' }} />
                  Waiting for payment...
                </div>
                <style>{`@keyframes lnpulse{0%,100%{opacity:.25}50%{opacity:1}}`}</style>
                <button onClick={cancelInvoice} style={{ display: 'block', margin: '14px auto 0', background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: t.textMuted }}>
                  Cancel invoice
                </button>
              </>
            )}

            {lnState === 'error' && (
              <>
                <div style={{ color: '#ef4444', fontSize: 13, marginBottom: 14, padding: '10px 14px', background: 'rgba(239,68,68,0.08)', borderRadius: 8, lineHeight: 1.5 }}>{lnError}</div>
                <button onClick={() => setLnState('idle')} style={{ width: '100%', padding: 11, background: t.accent, border: 'none', borderRadius: 9, cursor: 'pointer', color: '#000', fontSize: 13, fontWeight: 600 }}>Try again</button>
              </>
            )}
          </>
        )}

        {tab === 'cashu' && (
          <>
            <p style={{ fontSize: 13, color: t.textMuted, lineHeight: 1.6, marginBottom: 16 }}>
              Paste a token from <strong style={{ color: t.text }}>Minibits</strong>, Cashu.me, or any Cashu wallet.
            </p>
            {cashuError && <div style={{ color: '#ef4444', fontSize: 12, marginBottom: 10, padding: '8px 12px', background: 'rgba(239,68,68,0.08)', borderRadius: 8 }}>{cashuError}</div>}
            <textarea
              value={tokenInput}
              onChange={e => handleTokenInput(e.target.value)}
              placeholder="cashuA... or cashuB..."
              rows={3}
              autoFocus
              style={{ width: '100%', background: t.bgInput, border: `1px solid ${t.border}`, borderRadius: 10, padding: '12px 14px', color: t.text, fontSize: 12, fontFamily: "'Geist Mono',monospace", outline: 'none', resize: 'none', lineHeight: 1.5 }}
            />
            {tokenPreview && (
              <div style={{ marginTop: 8, padding: '8px 12px', background: t.accentDim, border: `1px solid ${t.accentBorder}`, borderRadius: 8, fontSize: 12, color: t.accent, fontFamily: "'Geist Mono',monospace" }}>
                ✓ {tokenPreview.sats} sats from {tokenPreview.mintShort}
              </div>
            )}
            <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
              <button onClick={onClose} style={{ flex: 1, padding: 11, background: 'transparent', border: `1px solid ${t.border}`, borderRadius: 9, color: t.textMuted, fontSize: 13, cursor: 'pointer' }}>Cancel</button>
              <button onClick={handleConnect} style={{ flex: 2, padding: 11, background: t.accent, border: 'none', borderRadius: 9, cursor: 'pointer', color: '#000', fontSize: 13, fontWeight: 600 }}>Connect →</button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
