import { useState } from "react";
import { PlusIcon, ChatBubbleIcon, StarIcon, BoltIcon, SunIcon, MoonIcon, WalletIcon } from "../constants/icons";

function timeAgo(ts) {
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60000);
  const h = Math.floor(diff / 3600000);
  const d = Math.floor(diff / 86400000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  if (h < 24) return `${h}h ago`;
  if (d < 7) return `${d}d ago`;
  return new Date(ts).toLocaleDateString();
}

export function ChatList({ t, theme, setTheme, chats, onNewChat, onOpenChat, tokenInfo, onOpenWallet }) {
  const [search, setSearch] = useState("");

  const filtered = chats.filter((c) =>
    c.title.toLowerCase().includes(search.toLowerCase())
  );

  const starred = filtered.filter((c) => c.starred);
  const recent = filtered.filter((c) => !c.starred);

  return (
    <div style={{ height: "100vh", background: t.bg, color: t.text, display: "flex", flexDirection: "column" }}>

      {/* Header */}
      <div style={{ padding: "56px 20px 16px", background: t.bg }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <span style={{ fontFamily: "'Geist Mono',monospace", fontSize: 28, fontWeight: 700, letterSpacing: -1, color: t.text }}>
            moutstr
          </span>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            {tokenInfo && (
              <div onClick={onOpenWallet} style={{
                display: "flex", alignItems: "center", gap: 5,
                fontFamily: "'Geist Mono',monospace", fontSize: 12,
                color: t.accent, background: t.accentDim,
                border: `1px solid ${t.accentBorder}`,
                padding: "5px 10px", borderRadius: 20, cursor: "pointer",
              }}>
                <BoltIcon /> {tokenInfo.sats} sats
              </div>
            )}
            <button onClick={() => setTheme(theme === "dark" ? "light" : "dark")} style={{
              background: t.bgTertiary, border: `1px solid ${t.border}`,
              borderRadius: 20, padding: "6px 8px", cursor: "pointer",
              color: t.textMuted, display: "flex", alignItems: "center",
            }}>
              {theme === "dark" ? <SunIcon /> : <MoonIcon />}
            </button>
          </div>
        </div>

        {/* Search */}
        <div style={{
          display: "flex", alignItems: "center", gap: 10,
          background: t.bgTertiary, border: `1px solid ${t.border}`,
          borderRadius: 12, padding: "10px 14px",
        }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={t.textMuted} strokeWidth="2" strokeLinecap="round">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search chats..."
            style={{
              background: "transparent", border: "none", outline: "none",
              color: t.text, fontSize: 14, flex: 1,
            }}
          />
        </div>
      </div>

      {/* Chat list */}
      <div style={{ flex: 1, overflowY: "auto", padding: "0 20px 100px" }}>

        {/* Starred */}
        {starred.length > 0 && (
          <>
            <div style={{ fontSize: 11, color: t.textMuted, letterSpacing: 1, textTransform: "uppercase", fontWeight: 600, padding: "16px 0 8px" }}>
              Starred
            </div>
            {starred.map((c) => (
              <ChatRow key={c.id} chat={c} t={t} onOpen={() => onOpenChat(c.id)} />
            ))}
          </>
        )}

        {/* Recent */}
        <div style={{ fontSize: 11, color: t.textMuted, letterSpacing: 1, textTransform: "uppercase", fontWeight: 600, padding: "16px 0 8px" }}>
          {starred.length > 0 ? "Recent" : "Chats"}
        </div>
        {recent.length === 0 && (
          <div style={{ textAlign: "center", padding: "40px 0", color: t.textMuted, fontSize: 14 }}>
            No chats yet. Start a new one!
          </div>
        )}
        {recent.map((c) => (
          <ChatRow key={c.id} chat={c} t={t} onOpen={() => onOpenChat(c.id)} />
        ))}
      </div>

      {/* Wallet bar */}
      {!tokenInfo && (
        <div style={{
          position: "fixed", bottom: 90, left: 0, right: 0,
          padding: "0 20px",
        }}>
          <button onClick={onOpenWallet} style={{
            width: "100%", padding: "12px 16px",
            background: t.accentDim, border: `1px solid ${t.accentBorder}`,
            borderRadius: 12, cursor: "pointer", color: t.accent,
            fontSize: 14, display: "flex", alignItems: "center",
            justifyContent: "center", gap: 8,
          }}>
            <WalletIcon /> Connect Cashu Token to Start
          </button>
        </div>
      )}

      {/* New chat FAB */}
      <div style={{ position: "fixed", bottom: 24, right: 24 }}>
        <button onClick={onNewChat} style={{
          display: "flex", alignItems: "center", gap: 8,
          background: t.accent, color: "#000",
          border: "none", borderRadius: 28,
          padding: "14px 22px", cursor: "pointer",
          fontSize: 15, fontWeight: 600,
          boxShadow: "0 4px 20px rgba(247,147,26,0.4)",
        }}>
          <PlusIcon /> New chat
        </button>
      </div>
    </div>
  );
}

function ChatRow({ chat, t, onOpen }) {
  return (
    <div onClick={onOpen} style={{
      padding: "14px 0", borderBottom: `1px solid ${t.border}`,
      cursor: "pointer", display: "flex", alignItems: "center", gap: 12,
    }}>
      <div style={{ color: t.textMuted, flexShrink: 0 }}>
        {chat.starred
          ? <StarIcon />
          : <ChatBubbleIcon />
        }
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 15, color: t.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {chat.title}
        </div>
        <div style={{ fontSize: 12, color: t.textMuted, marginTop: 2 }}>
          {timeAgo(chat.createdAt)}
        </div>
      </div>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={t.textDim} strokeWidth="2" strokeLinecap="round">
        <polyline points="9 18 15 12 9 6"/>
      </svg>
    </div>
  );
}
