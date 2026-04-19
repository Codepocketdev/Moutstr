export function parseToken(raw) {
  try {
    const b64 = raw.replace(/^cashu[AB]/, "");
    const pad = b64 + "==".slice((b64.length * 3) % 4 === 0 ? 0 : 4 - ((b64.length * 3) % 4));
    const decoded = JSON.parse(atob(pad.replace(/-/g, "+").replace(/_/g, "/")));
    let sats = 0;
    const proofs = decoded.token?.[0]?.proofs || decoded.proofs || [];
    proofs.forEach((p) => { sats += p.amount || 0; });
    const mint = decoded.token?.[0]?.mint || decoded.m || "";
    return { sats, mint: mint.replace("https://", "").split("/")[0], valid: true };
  } catch { return { sats: 0, mint: "", valid: false }; }
}
