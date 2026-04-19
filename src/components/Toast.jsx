export function Toast({ toast }) {
  if (!toast) return null;
  const ok = toast.type === "success";
  return (
    <div style={{
      position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)",
      background: ok ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.08)",
      border: `1px solid ${ok ? "#22c55e" : "#ef4444"}`,
      color: ok ? "#22c55e" : "#ef4444",
      padding: "10px 20px", borderRadius: 9, fontSize: 13,
      zIndex: 500, maxWidth: "90vw", textAlign: "center",
    }}>
      {toast.msg}
    </div>
  );
}
