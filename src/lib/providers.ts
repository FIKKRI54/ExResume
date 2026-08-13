import type { ProviderAuth, ProviderFormat, ProviderId, ProviderSettings } from "./types";

export interface ProviderDefinition {
  id: ProviderId;
  name: string;
  description: string;
  baseUrl: string;
  defaultModel: string;
  format: ProviderFormat;
  authType: ProviderAuth;
  keyPlaceholder: string;
  jsonMode: boolean;
}

export interface ModelOption {
  id: string;
  name: string;
  note: string;
}

const MODEL_OPTIONS: Record<ProviderId, readonly ModelOption[]> = {
  deepseek: [
    { id: "deepseek-v4-flash", name: "DeepSeek V4 Flash", note: "Recommended for speed and cost" },
    { id: "deepseek-v4-pro", name: "DeepSeek V4 Pro", note: "Higher-quality writing and extraction" }
  ],
  openai: [
    { id: "gpt-5.2", name: "GPT-5.2", note: "Best general OpenAI model" },
    { id: "gpt-5-mini", name: "GPT-5 mini", note: "Faster and lower cost" },
    { id: "gpt-4.1-mini", name: "GPT-4.1 mini", note: "Fast non-reasoning model" }
  ],
  anthropic: [
    { id: "claude-sonnet-4-5", name: "Claude Sonnet 4.5", note: "Balanced quality and speed" },
    { id: "claude-opus-4-1", name: "Claude Opus 4.1", note: "Highest-quality Claude option" },
    { id: "claude-3-5-haiku-latest", name: "Claude Haiku", note: "Fast and lower cost" }
  ],
  gemini: [
    { id: "gemini-3.6-flash", name: "Gemini 3.6 Flash", note: "Current fast Gemini model" },
    { id: "gemini-2.5-pro", name: "Gemini 2.5 Pro", note: "Strong reasoning and long context" },
    { id: "gemini-2.5-flash", name: "Gemini 2.5 Flash", note: "Stable fast model" }
  ],
  xai: [
    { id: "grok-4.5", name: "Grok 4.5", note: "Frontier xAI model" },
    { id: "grok-4.3", name: "Grok 4.3", note: "Fast general-purpose model" }
  ],
  mistral: [
    { id: "mistral-small-latest", name: "Mistral Small", note: "Recommended for cost and speed" },
    { id: "mistral-medium-latest", name: "Mistral Medium", note: "Balanced model" },
    { id: "mistral-large-latest", name: "Mistral Large", note: "Highest-quality Mistral option" }
  ],
  groq: [
    { id: "llama-3.3-70b-versatile", name: "Llama 3.3 70B", note: "General writing on Groq" },
    { id: "openai/gpt-oss-120b", name: "GPT-OSS 120B", note: "Large open-weight model" }
  ],
  openrouter: [
    { id: "openai/gpt-5-mini", name: "GPT-5 mini", note: "OpenAI through OpenRouter" },
    { id: "anthropic/claude-sonnet-4.5", name: "Claude Sonnet 4.5", note: "Anthropic through OpenRouter" },
    { id: "google/gemini-2.5-flash", name: "Gemini 2.5 Flash", note: "Google through OpenRouter" }
  ],
  cohere: [
    { id: "command-a-03-2025", name: "Command A", note: "Recommended Cohere model" },
    { id: "command-r-plus-08-2024", name: "Command R+", note: "Retrieval-focused model" }
  ],
  perplexity: [
    { id: "sonar", name: "Sonar", note: "Fast and lower cost" },
    { id: "sonar-pro", name: "Sonar Pro", note: "Higher-quality responses" },
    { id: "sonar-reasoning-pro", name: "Sonar Reasoning Pro", note: "More reasoning" }
  ],
  together: [
    { id: "meta-llama/Llama-3.3-70B-Instruct-Turbo", name: "Llama 3.3 70B Turbo", note: "Recommended Together model" },
    { id: "Qwen/Qwen2.5-72B-Instruct-Turbo", name: "Qwen 2.5 72B Turbo", note: "Alternative open model" }
  ],
  fireworks: [
    { id: "accounts/fireworks/models/llama-v3p3-70b-instruct", name: "Llama 3.3 70B", note: "Recommended Fireworks model" }
  ],
  cerebras: [
    { id: "llama-3.3-70b", name: "Llama 3.3 70B", note: "Recommended Cerebras model" },
    { id: "gpt-oss-120b", name: "GPT-OSS 120B", note: "Large open-weight model" }
  ],
  custom: []
};

export const PROVIDERS: readonly ProviderDefinition[] = [
  { id: "deepseek", name: "DeepSeek", description: "DeepSeek V4 models", baseUrl: "https://api.deepseek.com", defaultModel: "deepseek-v4-flash", format: "openai", authType: "bearer", keyPlaceholder: "sk-...", jsonMode: true },
  { id: "openai", name: "OpenAI", description: "GPT models through Chat Completions", baseUrl: "https://api.openai.com/v1", defaultModel: "gpt-5-mini", format: "openai", authType: "bearer", keyPlaceholder: "sk-...", jsonMode: true },
  { id: "anthropic", name: "Anthropic Claude", description: "Claude through the Messages API", baseUrl: "https://api.anthropic.com", defaultModel: "claude-sonnet-4-5", format: "anthropic", authType: "x-api-key", keyPlaceholder: "sk-ant-...", jsonMode: false },
  { id: "gemini", name: "Google Gemini", description: "Gemini through Google AI Studio", baseUrl: "https://generativelanguage.googleapis.com", defaultModel: "gemini-2.5-flash", format: "gemini", authType: "query-key", keyPlaceholder: "AIza...", jsonMode: true },
  { id: "xai", name: "xAI", description: "Grok models through xAI", baseUrl: "https://api.x.ai/v1", defaultModel: "grok-4.5", format: "openai", authType: "bearer", keyPlaceholder: "xai-...", jsonMode: false },
  { id: "mistral", name: "Mistral AI", description: "Mistral chat models", baseUrl: "https://api.mistral.ai/v1", defaultModel: "mistral-small-latest", format: "openai", authType: "bearer", keyPlaceholder: "API key", jsonMode: true },
  { id: "groq", name: "Groq", description: "Fast OpenAI-compatible inference", baseUrl: "https://api.groq.com/openai/v1", defaultModel: "llama-3.3-70b-versatile", format: "openai", authType: "bearer", keyPlaceholder: "gsk_...", jsonMode: true },
  { id: "openrouter", name: "OpenRouter", description: "One key for many model providers", baseUrl: "https://openrouter.ai/api/v1", defaultModel: "openai/gpt-5-mini", format: "openai", authType: "bearer", keyPlaceholder: "sk-or-...", jsonMode: true },
  { id: "cohere", name: "Cohere", description: "Command models through Chat v2", baseUrl: "https://api.cohere.com", defaultModel: "command-a-03-2025", format: "cohere", authType: "bearer", keyPlaceholder: "API key", jsonMode: true },
  { id: "perplexity", name: "Perplexity", description: "Sonar models and grounded generation", baseUrl: "https://api.perplexity.ai", defaultModel: "sonar", format: "openai", authType: "bearer", keyPlaceholder: "pplx-...", jsonMode: false },
  { id: "together", name: "Together AI", description: "Open models through Together", baseUrl: "https://api.together.xyz/v1", defaultModel: "meta-llama/Llama-3.3-70B-Instruct-Turbo", format: "openai", authType: "bearer", keyPlaceholder: "API key", jsonMode: true },
  { id: "fireworks", name: "Fireworks AI", description: "Fast serverless model inference", baseUrl: "https://api.fireworks.ai/inference/v1", defaultModel: "accounts/fireworks/models/llama-v3p3-70b-instruct", format: "openai", authType: "bearer", keyPlaceholder: "fw_...", jsonMode: true },
  { id: "cerebras", name: "Cerebras", description: "High-speed OpenAI-compatible inference", baseUrl: "https://api.cerebras.ai/v1", defaultModel: "llama-3.3-70b", format: "openai", authType: "bearer", keyPlaceholder: "csk-...", jsonMode: true },
  { id: "custom", name: "Custom API", description: "Your own compatible endpoint and authentication", baseUrl: "", defaultModel: "", format: "openai", authType: "bearer", keyPlaceholder: "API key", jsonMode: false }
] as const;

export function getProviderDefinition(provider: ProviderId): ProviderDefinition {
  return PROVIDERS.find((item) => item.id === provider) ?? PROVIDERS[0];
}

export function getModelOptions(provider: ProviderId): readonly ModelOption[] {
  return MODEL_OPTIONS[provider];
}

export function settingsForProvider(provider: ProviderId): ProviderSettings {
  const definition = getProviderDefinition(provider);
  return {
    provider: definition.id,
    model: definition.defaultModel,
    baseUrl: definition.baseUrl,
    format: definition.format,
    authType: definition.authType
  };
}

export function normalizeProviderSettings(settings: ProviderSettings): ProviderSettings {
  const definition = getProviderDefinition(settings.provider);
  if (settings.provider !== "custom") {
    return {
      provider: definition.id,
      model: settings.model.trim() || definition.defaultModel,
      baseUrl: definition.baseUrl,
      format: definition.format,
      authType: definition.authType
    };
  }
  return {
    provider: "custom",
    model: settings.model.trim(),
    baseUrl: settings.baseUrl.trim(),
    format: settings.format,
    authType: settings.authType
  };
}

export function providerNeedsApiKey(settings: ProviderSettings): boolean {
  return normalizeProviderSettings(settings).authType !== "none";
}

export function validateProviderSettings(settings: ProviderSettings): ProviderSettings {
  const normalized = normalizeProviderSettings(settings);
  if (!normalized.model) throw new Error("Enter a model ID.");
  if (normalized.provider !== "custom") return normalized;
  if (!normalized.baseUrl) throw new Error("Enter the complete custom API endpoint.");
  let endpoint: URL;
  try {
    endpoint = new URL(normalized.baseUrl);
  } catch {
    throw new Error("The custom API endpoint is not a valid URL.");
  }
  if (endpoint.username || endpoint.password) throw new Error("Do not put credentials inside the endpoint URL.");
  const local = endpoint.hostname === "localhost" || endpoint.hostname === "127.0.0.1";
  if (endpoint.protocol !== "https:" && !(endpoint.protocol === "http:" && local)) {
    throw new Error("Custom endpoints must use HTTPS. Plain HTTP is allowed only for localhost.");
  }
  return normalized;
}

export function customOriginPattern(settings: ProviderSettings): string | null {
  const normalized = validateProviderSettings(settings);
  if (normalized.provider !== "custom") return null;
  return `${new URL(normalized.baseUrl).origin}/*`;
}
