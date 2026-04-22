import { useState, useRef, useEffect, useCallback, memo } from "react";
import {
  ArrowLeft, ChevronDown, MoreVertical, Send, Copy,
  Trash2, Star, Pencil, Check, Zap, MessageSquare,
} from "lucide-react";
import { SUGGESTIONS } from "../constants/models";
import { ModelSheet } from "../components/ModelSheet";

// ── Chat menu ─────────────────────────────────────────────────────────────────
function ChatMenu({ show, onClose, onRename, onStar, onDelete, starred, t }) {
  if (!show) return null;
  const items = [
    { icon: <Pencil size={15} />, label: "Rename",                  action: onRename },
    { icon: <Star size={15} />,   label: starred ? "Unstar" : "Star", action: onStar },
    { icon: <Trash2 size={15} />, label: "Delete",                  action: onDelete, danger: true },
  ];
  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 300,
      display: "flex", alignItems: "flex-start", justifyContent: "flex-end",
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: t.bgSecondary, border: `1px solid ${t.border}`,
        borderRadius: 12, margin: "56px 16px 0 0",
        minWidth: 180, overflow: "hidden", boxShadow: t.shadow,
      }}>
        {items.map(item => (
          <div key={item.label} onClick={() => { item.action(); onClose(); }} style={{
            display: "flex", alignItems: "center", gap: 12,
            padding: "13px 16px", cursor: "pointer",
            color: item.danger ? "#ef4444" : t.text,
            borderBottom: `1px solid ${t.border}`,
            fontSize: 14,
          }}>
            {item.icon} {item.label}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Rename modal ──────────────────────────────────────────────────────────────
function RenameModal({ show, currentTitle, onSave, onClose, t }) {
  const [val, setVal] = useState(currentTitle);
  useEffect(() => setVal(currentTitle), [currentTitle]);
  if (!show) return null;
  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 400,
      display: "flex", alignItems: "center", justifyContent: "center", padding: 24,
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: t.bgSecondary, border: `1px solid ${t.border}`,
        borderRadius: 14, padding: 24, width: "100%", maxWidth: 400,
      }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: t.text, marginBottom: 14 }}>Rename Chat</div>
        <input
          value={val} onChange={e => setVal(e.target.value)} autoFocus
          onKeyDown={e => e.key === "Enter" && onSave(val)}
          style={{
            width: "100%", background: t.bgInput, border: `1px solid ${t.border}`,
            borderRadius: 9, padding: "11px 14px", color: t.text, fontSize: 14, outline: "none",
          }}
        />
        <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
          <button onClick={onClose} style={{
            flex: 1, padding: 11, background: "transparent",
            border: `1px solid ${t.border}`, borderRadius: 9,
            cursor: "pointer", color: t.textMuted, fontSize: 13,
          }}>Cancel</button>
          <button onClick={() => onSave(val)} style={{
            flex: 2, padding: 11, background: t.accent, border: "none",
            borderRadius: 9, cursor: "pointer", color: "#000", fontSize: 13, fontWeight: 600,
          }}>Save</button>
        </div>
      </div>
    </div>
  );
}

function modelLabel(model) {
  if (!model) return "Select model";
  if (model.label) return model.label;
  if (model.name?.includes(":")) return model.name.split(":").slice(1).join(":").trim();
  return model.name || model.id || "Model";
}

// ── Input box — memoized so typing ONLY re-renders this component ─────────────
const ChatInput = memo(function ChatInput({ onSend, loading, hasWallet, onOpenWallet, placeholder, t }) {
  const [input, setInput] = useState("");
  const taRef = useRef(null);

  const resize = () => {
    if (!taRef.current) return;
    taRef.current.style.height = "auto";
    taRef.current.style.height = Math.min(taRef.current.scrollHeight, 140) + "px";
  };

  const handleSend = useCallback(() => {
    if (!hasWallet) { onOpenWallet(); return; }
    if (!input.trim()) return;
    const text = input;
    setInput("");
    if (taRef.current) taRef.current.style.height = "auto";
    onSend(text);
  }, [input, hasWallet, onSend, onOpenWallet]);

  return (
    <div style={{
      flexShrink: 0,
      padding: "10px 16px 28px",
      borderTop: `1px solid ${t.border}`,
      background: t.bg,
    }}>
      {!hasWallet && (
        <button onClick={onOpenWallet} style={{
          width: "100%", padding: "10px", marginBottom: 10,
          background: t.accentDim, border: `1px solid ${t.accentBorder}`,
          borderRadius: 10, cursor: "pointer", color: t.accent,
          fontSize: 13, fontWeight: 500,
          display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
        }}>
          <Zap size={13} fill={t.accent} color={t.accent} />
          Connect wallet to send messages
        </button>
      )}
      <div style={{
        display: "flex", alignItems: "flex-end", gap: 10,
        background: t.bgInput, border: `1px solid ${t.border}`,
        borderRadius: 14, padding: "10px 10px 10px 16px",
      }}>
        <textarea
          ref={taRef}
          value={input}
          onChange={e => { setInput(e.target.value); resize(); }}
          onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
          placeholder={placeholder}
          rows={1}
          style={{
            flex: 1, background: "transparent", border: "none", outline: "none",
            color: t.text, fontSize: 14, lineHeight: 1.65,
            resize: "none", maxHeight: 140, minHeight: 22,
            caretColor: t.accent,
          }}
        />
        <button onClick={handleSend} disabled={!input.trim() || loading} style={{
          width: 36, height: 36, borderRadius: 10, border: "none", flexShrink: 0,
          cursor: input.trim() && !loading ? "pointer" : "not-allowed",
          background: input.trim() && !loading ? t.accent : t.bgTertiary,
          color: input.trim() && !loading ? "#000" : t.textMuted,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <Send size={15} />
        </button>
      </div>
      <div style={{ textAlign: "center", fontSize: 10, color: t.textDim, marginTop: 8 }}>
        powered by routstr · cashu · no api keys · no kyc
      </div>
    </div>
  );
});

// ── Message list — memoized so it only re-renders when messages/loading change ─
const MessageList = memo(function MessageList({ chat, loading, label, suggestions, onSuggestion, t }) {
  const bottomRef = useRef(null);
  const [copied, setCopied] = useState(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chat?.messages, loading]);

  const copy = (content, id) => {
    navigator.clipboard.writeText(content);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: "20px 16px" }}>
      {chat?.messages.length === 0 && !loading && (
        <div style={{ textAlign: "center", paddingTop: 60 }}>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 12 }}>
            <Zap size={36} fill={t.accent} color={t.accent} />
          </div>
          <div style={{ fontSize: 18, fontWeight: 600, color: t.text, marginBottom: 6 }}>
            {chat?.title === "New chat" ? "New chat" : chat?.title}
          </div>
          <div style={{ fontSize: 13, color: t.textMuted, lineHeight: 1.7, marginBottom: 28 }}>
            Ask anything. Powered by Bitcoin.
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, maxWidth: 320, margin: "0 auto" }}>
            {suggestions.map(q => (
              <button key={q} onClick={() => onSuggestion(q)} style={{
                padding: "12px 16px", background: t.bgTertiary,
                border: `1px solid ${t.border}`, borderRadius: 10,
                cursor: "pointer", color: t.textMuted, fontSize: 13, textAlign: "left",
              }}>
                {q}
              </button>
            ))}
          </div>
        </div>
      )}

      {chat?.messages.map(msg => {
        const isUser = msg.role === "user";
        return (
          <div key={msg.id} style={{
            display: "flex", flexDirection: "column",
            alignItems: isUser ? "flex-end" : "flex-start",
            marginBottom: 12,
          }}>
            <div style={{
              fontSize: 10, color: t.textMuted, letterSpacing: 0.8,
              textTransform: "uppercase", marginBottom: 4,
              padding: "0 4px", fontWeight: 500,
            }}>
              {isUser ? "You" : label}
            </div>
            <div style={{ maxWidth: "85%" }}>
              <div style={{
                padding: "12px 16px",
                borderRadius: isUser ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
                background: isUser ? t.userBubble : t.aiBubble,
                border: `1px solid ${t.border}`,
                fontSize: 14, lineHeight: 1.75,
                whiteSpace: "pre-wrap", wordBreak: "break-word", color: t.text,
              }}>
                {msg.content}
              </div>
              <div style={{
                display: "flex", alignItems: "center", gap: 8,
                marginTop: 4, padding: "0 4px",
                justifyContent: isUser ? "flex-end" : "flex-start",
              }}>
                {msg.costSats && (
                  <span style={{ fontSize: 10, color: t.textMuted, fontFamily: "'Geist Mono',monospace" }}>
                    {msg.costSats} sats
                  </span>
                )}
                <button onClick={() => copy(msg.content, msg.id)} style={{
                  background: "none", border: "none", cursor: "pointer",
                  color: copied === msg.id ? t.accent : t.textMuted,
                  display: "flex", padding: 3,
                }}>
                  {copied === msg.id ? <Check size={13} /> : <Copy size={13} />}
                </button>
              </div>
            </div>
          </div>
        );
      })}

      {loading && (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", marginBottom: 12 }}>
          <div style={{ fontSize: 10, color: t.textMuted, letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 4, padding: "0 4px", fontWeight: 500 }}>
            {label}
          </div>
          <div style={{
            padding: "14px 18px", background: t.aiBubble,
            border: `1px solid ${t.border}`,
            borderRadius: "18px 18px 18px 4px",
            display: "flex", gap: 5,
          }}>
            {[0, 1, 2].map(i => (
              <div key={i} style={{
                width: 6, height: 6, borderRadius: "50%", background: t.accent,
                animation: `db 1.4s ${i * 0.2}s infinite both`,
              }} />
            ))}
          </div>
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  );
});

// ── Main ChatView ─────────────────────────────────────────────────────────────
export function ChatView({
  t, chat, loading, model, setModel, tokenInfo,
  onBack, onSend, onRename, onStar, onDelete, onOpenWallet,
}) {
  const [showModelSheet, setShowModelSheet] = useState(false);
  const [showMenu, setShowMenu]             = useState(false);
  const [showRename, setShowRename]         = useState(false);

  const label = modelLabel(model);

  // Stable callbacks — won't cause ChatInput to re-render
  const handleSend = useCallback((text) => onSend(text), [onSend]);
  const handleOpenWallet = useCallback(() => onOpenWallet(), [onOpenWallet]);

  // Suggestion tap — needs to send directly since input lives in ChatInput
  const handleSuggestion = useCallback((text) => onSend(text), [onSend]);

  return (
    <div style={{
      height: "100dvh", background: t.bg, color: t.text,
      display: "flex", flexDirection: "column", overflow: "hidden",
    }}>

      {/* HEADER */}
      <div style={{
        height: 48, minHeight: 48, flexShrink: 0,
        display: "flex", alignItems: "center",
        padding: "0 4px", borderBottom: `1px solid ${t.border}`,
        background: t.bg, gap: 0,
      }}>
        <button onClick={onBack} style={{
          background: "none", border: "none", cursor: "pointer",
          color: t.accent, display: "flex", alignItems: "center",
          padding: "8px 10px", borderRadius: 8, flexShrink: 0,
        }}>
          <ArrowLeft size={20} />
        </button>

        <button onClick={() => setShowModelSheet(true)} style={{
          flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
          gap: 5, background: "none", border: "none", cursor: "pointer",
          color: t.text, minWidth: 0,
        }}>
          <div style={{
            width: 7, height: 7, borderRadius: "50%", flexShrink: 0,
            background: t.accent, boxShadow: `0 0 5px ${t.accent}`,
          }} />
          <span style={{
            fontSize: 14, fontWeight: 600,
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            maxWidth: 200,
          }}>
            {label}
          </span>
          <ChevronDown size={13} color={t.textMuted} />
        </button>

        {tokenInfo && (
          <button onClick={onOpenWallet} style={{
            fontFamily: "'Geist Mono',monospace", fontSize: 11,
            color: t.accent, background: t.accentDim,
            border: `1px solid ${t.accentBorder}`,
            padding: "3px 8px", borderRadius: 20, cursor: "pointer",
            whiteSpace: "nowrap", flexShrink: 0,
            display: "flex", alignItems: "center", gap: 3,
          }}>
            <Zap size={10} fill={t.accent} color={t.accent} />
            {tokenInfo.sats}
          </button>
        )}

        <button onClick={() => setShowMenu(true)} style={{
          background: "none", border: "none", cursor: "pointer",
          color: t.textMuted, display: "flex", alignItems: "center",
          padding: "8px 10px", borderRadius: 8, flexShrink: 0,
        }}>
          <MoreVertical size={18} />
        </button>
      </div>

      {/* MESSAGES — isolated in memo, typing won't touch it */}
      <MessageList
        chat={chat}
        loading={loading}
        label={label}
        suggestions={SUGGESTIONS}
        onSuggestion={handleSuggestion}
        t={t}
      />

      {/* INPUT — isolated in memo, only this re-renders while typing */}
      <ChatInput
        onSend={handleSend}
        loading={loading}
        hasWallet={!!tokenInfo}
        onOpenWallet={handleOpenWallet}
        placeholder={`Message ${label}...`}
        t={t}
      />

      {/* Sheets + modals */}
      <ModelSheet
        show={showModelSheet}
        onClose={() => setShowModelSheet(false)}
        selectedModel={model}
        onSelect={m => { setModel(m); setShowModelSheet(false); }}
        t={t}
      />
      <ChatMenu
        show={showMenu} onClose={() => setShowMenu(false)}
        onRename={() => setShowRename(true)}
        onStar={onStar}
        onDelete={() => { onDelete(); onBack(); }}
        starred={chat?.starred} t={t}
      />
      <RenameModal
        show={showRename} currentTitle={chat?.title || ""}
        onSave={title => { onRename(title); setShowRename(false); }}
        onClose={() => setShowRename(false)} t={t}
      />
    </div>
  );
}
