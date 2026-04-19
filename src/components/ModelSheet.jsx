import { useState, useRef, useEffect } from 'react'
import { Search, X, Type, Image, Mic, Video, ChevronRight, Zap } from 'lucide-react'
import { useModelStore, estimateMinSats } from '../utils/modelStore'

// ── Modality icon ─────────────────────────────────────────────────────────────
function ModalityIcon({ type, size = 11 }) {
  const props = { size, strokeWidth: 1.8 }
  if (type === 'image') return <Image {...props} />
  if (type === 'audio') return <Mic  {...props} />
  if (type === 'video') return <Video {...props} />
  return <Type {...props} />
}

const MODALITY_COLOR = {
  text:  { bg: 'rgba(100,100,100,0.1)',  color: '#888',    border: 'rgba(100,100,100,0.15)' },
  image: { bg: 'rgba(147,51,234,0.08)', color: '#9333ea', border: 'rgba(147,51,234,0.18)' },
  audio: { bg: 'rgba(34,197,94,0.08)',  color: '#16a34a', border: 'rgba(34,197,94,0.18)'  },
  video: { bg: 'rgba(59,130,246,0.08)', color: '#2563eb', border: 'rgba(59,130,246,0.18)' },
}

function ModalityPill({ type, small }) {
  const c = MODALITY_COLOR[type] || MODALITY_COLOR.text
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 3,
      padding: small ? '1px 4px' : '2px 6px',
      borderRadius: 99, fontSize: small ? 9 : 10,
      background: c.bg, color: c.color, border: `1px solid ${c.border}`,
    }}>
      <ModalityIcon type={type} size={small ? 9 : 10} />
      {!small && type.charAt(0).toUpperCase() + type.slice(1)}
    </span>
  )
}

// ── Price dots (1-5, orange = expensive) ──────────────────────────────────────
function PriceDots({ model, accent }) {
  const cost = model.sats_pricing?.completion
  if (!cost || cost <= 0) return <span style={{ color: '#888', fontSize: 10 }}>free</span>
  // log scale: ~0.0001 (cheapest) to ~0.01 (expensive)
  const log  = Math.log10(cost)
  const dots = Math.min(5, Math.max(1, Math.round(((log + 4) / 2) * 5)))
  return (
    <span style={{ display: 'inline-flex', gap: 2, alignItems: 'center' }}>
      {[1,2,3,4,5].map(i => (
        <span key={i} style={{
          width: 5, height: 5, borderRadius: '50%',
          background: i <= dots ? accent : `${accent}22`,
        }} />
      ))}
    </span>
  )
}

// ── Model display name ─────────────────────────────────────────────────────────
function splitModelName(model) {
  if (model.name?.includes(':')) {
    const [provider, ...rest] = model.name.split(':')
    return { provider: provider.trim(), name: rest.join(':').trim() }
  }
  return { provider: '', name: model.name || model.id }
}

// ── Main sheet ─────────────────────────────────────────────────────────────────
export function ModelSheet({ show, onClose, selectedModel, onSelect, t }) {
  const { models, loading, fetch, filterModels, getModalityPairs, getInputModalities, getOutputModalities } = useModelStore()
  const [query, setQuery]         = useState('')
  const [pairFilter, setPairFilter] = useState(null)
  const searchRef = useRef(null)

  // Focus search when opened — models are already loaded by App on mount
  useEffect(() => {
    if (show) setTimeout(() => searchRef.current?.focus(), 80)
    else { setQuery(''); setPairFilter(null) }
  }, [show])

  if (!show) return null

  const pairs    = getModalityPairs()
  const filtered = filterModels(query, pairFilter)

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)',
      zIndex: 500, display: 'flex', alignItems: 'flex-end',
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: t.bgSecondary, border: `1px solid ${t.border}`,
        borderRadius: '16px 16px 0 0', width: '100%',
        maxHeight: '85dvh', display: 'flex', flexDirection: 'column',
        boxShadow: t.shadow,
      }}>

        {/* ── Handle + search + filters ── */}
        <div style={{ padding: '12px 16px 0', flexShrink: 0 }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: t.border, margin: '0 auto 14px' }} />

          {/* Search bar */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            background: t.bgTertiary, border: `1px solid ${t.border}`,
            borderRadius: 10, padding: '8px 12px', marginBottom: 10,
          }}>
            <Search size={14} color={t.textMuted} strokeWidth={1.8} />
            <input
              ref={searchRef}
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search models..."
              style={{
                flex: 1, background: 'none', border: 'none', outline: 'none',
                color: t.text, fontSize: 13,
              }}
            />
            {query && (
              <button onClick={() => setQuery('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: t.textMuted, display: 'flex' }}>
                <X size={14} />
              </button>
            )}
          </div>

          {/* Modality filter pills */}
          {pairs.length > 0 && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', paddingBottom: 10 }}>
              {pairs.map(p => {
                const active = pairFilter === p.key
                return (
                  <button key={p.key} onClick={() => setPairFilter(active ? null : p.key)} style={{
                    display: 'inline-flex', alignItems: 'center', gap: 3,
                    padding: '4px 9px', borderRadius: 99, fontSize: 11, cursor: 'pointer',
                    border: `1px solid ${active ? t.accent : t.border}`,
                    background: active ? t.accentDim : 'transparent',
                    color: active ? t.accent : t.textMuted,
                    whiteSpace: 'nowrap',
                  }}>
                    <ModalityPill type={p.input} small />
                    <ChevronRight size={9} strokeWidth={2} color={t.textMuted} />
                    <ModalityPill type={p.output} small />
                  </button>
                )
              })}
              {pairFilter && (
                <button onClick={() => setPairFilter(null)} style={{
                  padding: '4px 9px', borderRadius: 99, fontSize: 11, cursor: 'pointer',
                  border: `1px solid ${t.border}`, background: 'transparent', color: t.textMuted,
                }}>
                  Clear
                </button>
              )}
            </div>
          )}
        </div>

        {/* ── Model list ── */}
        <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 32 }}>

          {/* Loading — only shown on very first fetch before any models arrive */}
          {loading && filtered.length === 0 && (
            <div style={{ textAlign: 'center', padding: '32px 0', color: t.textMuted, fontSize: 13 }}>
              Loading models...
            </div>
          )}

          {!loading && filtered.length === 0 && (
            <div style={{ textAlign: 'center', padding: '32px 0', color: t.textMuted, fontSize: 13 }}>
              No models found
            </div>
          )}

          {filtered.map(model => {
            const isSelected = model.id === selectedModel?.id
            const { provider, name } = splitModelName(model)
            const inputs  = [...new Set(getInputModalities(model))]
            const outputs = [...new Set(getOutputModalities(model))]
            const minSats = estimateMinSats(model)

            return (
              <div
                key={model.id}
                onClick={() => { onSelect(model); onClose() }}
                style={{
                  padding: '11px 16px',
                  borderBottom: `1px solid ${t.border}`,
                  cursor: 'pointer',
                  background: isSelected ? t.accentDim : 'transparent',
                  display: 'flex', alignItems: 'center', gap: 10,
                }}
              >
                {/* Selection dot */}
                <div style={{
                  width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
                  background: isSelected ? t.accent : t.border,
                  boxShadow: isSelected ? `0 0 5px ${t.accent}` : 'none',
                }} />

                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  {provider && (
                    <div style={{ fontSize: 10, color: t.textMuted, marginBottom: 1 }}>{provider}</div>
                  )}
                  <div style={{
                    fontSize: 13, fontWeight: isSelected ? 600 : 500,
                    color: t.text, marginBottom: 4,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {name}
                  </div>
                  {/* Modality pills */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 3, flexWrap: 'wrap' }}>
                    {inputs.map(i => <ModalityPill key={i} type={i} />)}
                    <ChevronRight size={9} color={t.textMuted} strokeWidth={2} />
                    {outputs.map(o => <ModalityPill key={o} type={o} />)}
                    {model.context_length && (
                      <span style={{ fontSize: 10, color: t.textMuted, marginLeft: 4 }}>
                        {(model.context_length / 1000).toFixed(0)}K
                      </span>
                    )}
                  </div>
                </div>

                {/* Right: min sats + price dots */}
                <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 2, fontSize: 10, color: t.textMuted }}>
                    <Zap size={9} fill={t.accent} color={t.accent} />
                    {minSats}
                  </div>
                  <PriceDots model={model} accent={t.accent} />
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

