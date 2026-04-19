export const MODELS = [
  { id: "meta-llama/llama-3.2-1b-instruct", label: "Llama 3.2 1B", cost: "~2 sats", tier: "free" },
  { id: "meta-llama/llama-3.1-8b-instruct", label: "Llama 3.1 8B", cost: "~5 sats", tier: "free" },
  { id: "qwen/qwen3-14b", label: "Qwen 3 14B", cost: "~15 sats", tier: "free" },
  { id: "deepseek/deepseek-r1", label: "DeepSeek R1", cost: "~40 sats", tier: "plus" },
  { id: "gpt-4.1-mini", label: "GPT-4.1 Mini", cost: "~30 sats", tier: "plus" },
  { id: "gpt-4.1", label: "GPT-4.1", cost: "~200 sats", tier: "plus" },
  { id: "gemini-2.5-flash", label: "Gemini 2.5 Flash", cost: "~20 sats", tier: "plus" },
  { id: "claude-haiku-4.5", label: "Claude Haiku", cost: "~80 sats", tier: "pro" },
  { id: "claude-sonnet-4.6", label: "Claude Sonnet", cost: "~2500 sats", tier: "pro" },
  { id: "gpt-4o", label: "GPT-4o", cost: "~300 sats", tier: "pro" },
];

export const TIER_COLORS = { free: "#22c55e", plus: "#f7931a", pro: "#a855f7" };

export const SUGGESTIONS = [
  "What is Bitcoin?",
  "Explain the Lightning Network",
  "What is Cashu eCash?",
  "Who is Satoshi Nakamoto?",
];
