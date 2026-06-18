# Moutstr

A pay-per-message AI chat frontend. Billing happens directly in Bitcoin sats via Cashu ecash, routed through the [Routstr](https://routstr.com) protocol — no accounts, no subscriptions, no stored payment method.

**Live demo:** https://moutstr.vercel.app

## Features

- **Chat UI** with conversation history, starring, and search
- **Cashu wallet** — paste an existing token or fund via Lightning invoice
- **Live model catalog** fetched from Routstr, with real per-token sats pricing
- **Pre-flight balance checks** before sending, so unaffordable requests are blocked rather than charged
- **Automatic change handling** — unspent sats returned by the API (`X-Cashu` header) are folded back into the wallet balance

## Tech Stack

- React 19, Vite
- Zustand for wallet, chat, and model state
- Dexie (IndexedDB) for local persistence
- TanStack Query for polling Lightning invoice settlement
- Cashu TS for ecash token handling

## Getting Started

```bash
npm install
npm run dev
```

The app talks directly to the Routstr API and to your Cashu mint — no backend of your own is required.

## Scripts

```bash
npm run dev      # Start dev server
npm run build    # Build production assets to dist/
npm run preview  # Preview the production build locally
npm run lint     # Lint
```

## Project Structure

- `src/pages/`: top-level views (chat list, chat view)
- `src/components/`: UI components (header, model picker, wallet modal, toasts)
- `src/hooks/`: wallet, chat, and Lightning invoice logic
- `src/utils/`: Routstr API client, Cashu helpers, Zustand stores

## Balance Safety

Three layers prevent sats from being spent without value received:

1. A pre-flight estimate (`estimateMinSats` in `src/utils/modelStore.js`) checks the selected model is affordable before anything is sent.
2. Each request is capped with `max_tokens`, computed from the user's real balance (`computeSafeMaxTokens` in `src/utils/routstr.js`), bounding worst-case cost.
3. If the provider still rejects a request (HTTP 402), the token is not spent — handled in `src/hooks/useChat.js`.
