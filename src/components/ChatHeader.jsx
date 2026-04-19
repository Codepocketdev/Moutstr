import { useState } from 'react'
import { ModelSheet } from './ModelSheet'
import { BackIcon, DotsIcon } from '../constants/icons'

// Drop-in replacement for the header inside ChatView.
// Props match what ChatView already passes down.

export function ChatHeader({ t, model, onModelSelect, tokenInfo, onBack, onMenu, onOpenWallet }) {
  const [showModels, setShowModels] = useState(false)

  // Get display name (strip provider prefix e.g. "OpenAI: GPT-4" → "GPT-4")
  const displayName = model
    ? (model.name?.includes(':') ? model.name.split(':').slice(1).join(':').trim() : model.name || model.id)
    : 'Select model'

  return (
    <>
      {/* Header — 48px, fixed at top */}
      <div style={{
        height: 48, minHeight: 48, flexShrink: 0,
        display: 'flex', alignItems: 'center',
        padding: '0 4px',
        borderBottom: `1px solid ${t.border}`,
        background: t.bg,
        gap: 0,
      }}>
        {/* Back */}
        <button onClick={onBack} style={{
          background: 'none', border: 'none', cursor: 'pointer',
          color: t.accent, display: 'flex', padding: '8px 10px', borderRadius: 8,
          flexShrink: 0,
        }}>
          <BackIcon />
        </button>

        {/* Model picker — takes remaining space, centered */}
        <button
          onClick={() => setShowModels(true)}
          style={{
            flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
            gap: 5, background: 'none', border: 'none', cursor: 'pointer',
            color: t.text, minWidth: 0,
          }}
        >
          {/* Status dot */}
          <div style={{
            width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
            background: t.accent, boxShadow: `0 0 4px ${t.accent}`,
          }} />
          <span style={{
            fontSize: 14, fontWeight: 600,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            maxWidth: 200,
          }}>
            {displayName}
          </span>
          {/* Chevron */}
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={t.textMuted} strokeWidth="2.5" strokeLinecap="round">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>

        {/* Balance pill — tappable to open wallet */}
        {tokenInfo && (
          <button
            onClick={onOpenWallet}
            style={{
              fontFamily: "'Geist Mono',monospace", fontSize: 11,
              color: t.accent, background: t.accentDim,
              border: `1px solid ${t.accentBorder}`,
              padding: '3px 8px', borderRadius: 20, cursor: 'pointer',
              whiteSpace: 'nowrap', flexShrink: 0,
            }}
          >
            ⚡{tokenInfo.sats}
          </button>
        )}

        {/* Menu */}
        <button onClick={onMenu} style={{
          background: 'none', border: 'none', cursor: 'pointer',
          color: t.textMuted, display: 'flex', padding: '8px 10px',
          borderRadius: 8, flexShrink: 0,
        }}>
          <DotsIcon />
        </button>
      </div>

      {/* Model sheet */}
      <ModelSheet
        show={showModels}
        onClose={() => setShowModels(false)}
        selectedModel={model}
        onSelect={onModelSelect}
        t={t}
      />
    </>
  )
}

