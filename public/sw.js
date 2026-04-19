// public/sw.js
// Service Worker — polls pending Cashu mint quotes in the background
// This runs even when the browser tab is closed (as long as browser is open)

const PENDING_KEY = "moutstr_pending_quotes";
const POLL_INTERVAL = 5000; // 5s between polls

// ── Read/write localStorage from SW (via IndexedDB proxy isn't needed —
//    SW can't access localStorage directly, so we use a simple in-memory
//    store synced via postMessage from the page) ────────────────────────────

let pendingQuotes = {}; // { quoteId: { mintUrl, amountSats, unit, bolt11, quoteId, expiresAt } }
let pollingTimer = null;

// ── Message handler ───────────────────────────────────────────────────────────
self.addEventListener("message", (event) => {
  const { type, data } = event.data || {};

  if (type === "SYNC_QUOTES") {
    // Page sends all pending quotes on load / after creating an invoice
    pendingQuotes = data || {};
    startPolling();
  }

  if (type === "REMOVE_QUOTE") {
    delete pendingQuotes[data.quoteId];
  }

  if (type === "STOP_POLLING") {
    stopPolling();
  }
});

// ── Polling ───────────────────────────────────────────────────────────────────
function startPolling() {
  if (pollingTimer) return; // already running
  pollingTimer = setInterval(pollAllQuotes, POLL_INTERVAL);
}

function stopPolling() {
  if (pollingTimer) { clearInterval(pollingTimer); pollingTimer = null; }
}

async function pollAllQuotes() {
  const quoteIds = Object.keys(pendingQuotes);
  if (quoteIds.length === 0) { stopPolling(); return; }

  for (const quoteId of quoteIds) {
    const q = pendingQuotes[quoteId];
    if (!q) continue;

    // Skip expired
    if (Date.now() > q.expiresAt) {
      delete pendingQuotes[quoteId];
      notifyClients({ type: "QUOTE_EXPIRED", quoteId });
      continue;
    }

    try {
      const res = await fetch(`${q.mintUrl}/v1/mint/quote/bolt11/${quoteId}`);
      if (!res.ok) continue;
      const status = await res.json();

      if (status.state === "PAID") {
        // Mint the proofs
        const mintResult = await mintProofs(q);
        if (mintResult) {
          delete pendingQuotes[quoteId];
          notifyClients({
            type: "INVOICE_PAID",
            quoteId,
            token: mintResult.token,
            sats: q.amountSats,
            bolt11: q.bolt11,
          });
        }
      }
    } catch {
      // keep polling
    }
  }
}

async function mintProofs(q) {
  try {
    // Build blinded messages — simplified approach using the NUT-04 REST API directly
    // We need to POST to /v1/mint/bolt11 with outputs (blinded messages)
    // For simplicity we use a small helper that builds minimal blinded messages

    const outputs = buildSimpleOutputs(q.amountSats, q.unit);
    const res = await fetch(`${q.mintUrl}/v1/mint/bolt11`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ quote: q.quoteId, outputs }),
    });

    if (!res.ok) return null;
    const data = await res.json();

    // Encode as minimal cashu token
    const token = encodeCashuToken(q.mintUrl, data.signatures || [], q.unit);
    return { token };
  } catch {
    return null;
  }
}

// Minimal blinded message builder (NUT-00)
// NOTE: For production use @cashu/cashu-ts in the main thread instead.
// The SW falls back to notifying the page which then does the actual minting.
function buildSimpleOutputs(amountSats, unit) {
  // We can't do proper crypto (DLEQ) in the SW without cashu-ts
  // So instead we just notify the page and let it handle minting
  return null;
}

// Because we can't do crypto properly in the SW, we notify the page to handle minting
async function mintProofs(q) {
  // Tell the page "this quote is PAID, please mint the proofs"
  notifyClients({
    type: "QUOTE_PAID_NEEDS_MINTING",
    quoteId: q.quoteId,
    mintUrl: q.mintUrl,
    amountSats: q.amountSats,
    unit: q.unit,
    bolt11: q.bolt11,
  });
  delete pendingQuotes[q.quoteId];
  return null; // page handles the rest
}

function notifyClients(msg) {
  self.clients.matchAll({ includeUncontrolled: true, type: "window" }).then((clients) => {
    clients.forEach((client) => client.postMessage(msg));
  });
}

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

