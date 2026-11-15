export const AI_PROVIDERS = ["openai", "anthropic", "google", "groq", "openrouter"] as const;
export type AiProvider = (typeof AI_PROVIDERS)[number];

export type ProviderInfo = {
  label: string;
  /** Short name for messages, e.g. "Your OpenAI account is out of credits". */
  name: string;
  /** Chat model used when the user doesn't pick one. */
  defaultModel: string;
  /** Embedding model for semantic search, or null when the provider has none. */
  embeddingModel: string | null;
  keyPlaceholder: string;
  keysUrl: string;
};

export const PROVIDERS: Record<AiProvider, ProviderInfo> = {
  openai: {
    label: "OpenAI (ChatGPT)",
    name: "OpenAI",
    defaultModel: "gpt-5.4-mini",
    embeddingModel: "text-embedding-3-small",
    keyPlaceholder: "sk-…",
    keysUrl: "https://platform.openai.com/api-keys",
  },
  anthropic: {
    label: "Anthropic (Claude)",
    name: "Anthropic",
    defaultModel: "claude-haiku-5-5",
    embeddingModel: null,
    keyPlaceholder: "sk-ant-…",
    keysUrl: "https://console.anthropic.com/settings/keys",
  },
  google: {
    label: "Google (Gemini)",
    name: "Google",
    defaultModel: "gemini-3.5-flash",
    embeddingModel: "gemini-embedding-001",
    keyPlaceholder: "AIza…",
    keysUrl: "https://aistudio.google.com/apikey",
  },
  groq: {
    label: "Groq",
    name: "Groq",
    defaultModel: "openai/gpt-oss-120b",
    embeddingModel: null,
    keyPlaceholder: "gsk_…",
    keysUrl: "https://console.groq.com/keys",
  },
  openrouter: {
    label: "OpenRouter (any model)",
    name: "OpenRouter",
    defaultModel: "openai/gpt-5.4-mini",
    embeddingModel: "openai/text-embedding-3-small",
    keyPlaceholder: "sk-or-…",
    keysUrl: "https://openrouter.ai/keys",
  },
};
