import { create } from 'zustand'
import { fetchModels } from './routstr'
import { db } from './db'

function norm(v) {
  const k = String(v ?? '').toLowerCase()
  if (['image','images','img','vision','picture','photo'].includes(k)) return 'image'
  if (['audio','sound','speech','voice'].includes(k)) return 'audio'
  if (['video','videos'].includes(k)) return 'video'
  return 'text'
}

export function estimateMinSats(model) {
  const p = model.sats_pricing
  if (!p) return 1
  return Math.ceil((p.request || 0) + (p.completion || 0) * 200) || 1
}

let _fetchPromise = null
let _pollInterval = null

export const useModelStore = create((set, get) => ({
  models: [],
  loading: false,
  lastFetched: 0,

  // Step 1 — Load from Dexie instantly on app start
  loadFromCache: async () => {
    try {
      const cached = await db.modelsCache.toArray()
      if (cached.length > 0) {
        set({ models: cached })
        console.log('[models] Loaded', cached.length, 'from cache')
      }
    } catch (e) {
      console.warn('[models] Cache load failed', e)
    }
  },

  // Step 2 — Fetch from API + save to Dexie
  fetch: async (force = false) => {
    const { lastFetched, models } = get()
    if (!force && Date.now() - lastFetched < 5 * 60 * 1000 && models.length > 0) return
    if (_fetchPromise) return _fetchPromise

    set({ loading: true })
    _fetchPromise = fetchModels()
      .then(async (raw) => {
        const models = (raw || []).filter(m => m.enabled !== false)
        if (models.length > 0) {
          try {
            await db.modelsCache.clear()
            await db.modelsCache.bulkPut(models)
          } catch (e) {
            console.warn('[models] Cache save failed', e)
          }
          set({ models, loading: false, lastFetched: Date.now() })
        } else {
          set({ loading: false })
        }
      })
      .catch(() => set({ loading: false }))
      .finally(() => { _fetchPromise = null })

    return _fetchPromise
  },

  // Step 3 — Start background polling every 10 mins
  startPolling: () => {
    if (_pollInterval) return
    _pollInterval = setInterval(() => {
      get().fetch(true)
    }, 10 * 60 * 1000)
    console.log('[models] Background polling started')
  },

  stopPolling: () => {
    if (_pollInterval) {
      clearInterval(_pollInterval)
      _pollInterval = null
    }
  },

  getInputModalities:  m => (m.architecture?.input_modalities  || ['text']).map(norm),
  getOutputModalities: m => (m.architecture?.output_modalities || ['text']).map(norm),

  // Derive unique input→output modality pairs across all loaded models
  getModalityPairs: () => {
    const pairMap = new Map()
    for (const m of get().models) {
      const inputs  = [...new Set((m.architecture?.input_modalities  || ['text']).map(norm))]
      const outputs = [...new Set((m.architecture?.output_modalities || ['text']).map(norm))]
      for (const i of inputs) {
        for (const o of outputs) {
          const key = `${i}->${o}`
          if (!pairMap.has(key)) pairMap.set(key, { key, input: i, output: o })
        }
      }
    }
    return [...pairMap.values()]
  },

  filterModels: (query = '', pairFilter = null) => {
    const q = query.toLowerCase().replace(/[^a-z0-9]/g, '')
    return get().models.filter(m => {
      if (q) {
        const name = (m.name || '').toLowerCase().replace(/[^a-z0-9]/g, '')
        const id   = (m.id   || '').toLowerCase().replace(/[^a-z0-9]/g, '')
        if (!name.includes(q) && !id.includes(q)) return false
      }
      if (pairFilter) {
        const [fi, fo] = pairFilter.split('->')
        const ins  = new Set((m.architecture?.input_modalities  || ['text']).map(norm))
        const outs = new Set((m.architecture?.output_modalities || ['text']).map(norm))
        if (!ins.has(fi) || !outs.has(fo)) return false
      }
      return true
    })
  },
}))
