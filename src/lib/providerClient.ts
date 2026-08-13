import { getProviderDefinition, validateProviderSettings } from "./providers";
import type { ProviderSettings } from "./types";

export interface ProviderRequest {
  url: string;
  init: RequestInit;
}

export interface AvailableModel {
  id: string;
  name: string;
}

interface CompletionOptions {
  maxTokens: number;
  temperature: number;
  json: boolean;
  compatibility?: boolean;
}

function isOpenAIReasoningModel(settings: ProviderSettings): boolean {
  if (settings.provider !== "openai") return false;
  return /^(?:gpt-5(?:[.-]|$)|o[1-9](?:[.-]|$))/i.test(settings.model);
}

function geminiThinkingConfig(model: string): { config?: Record<string, unknown>; tokenReserve: number } {
  const normalized = model.toLowerCase();
  if (/^gemini-3(?:[.-]|$)/.test(normalized)) {
    return { config: { thinkingLevel: "minimal" }, tokenReserve: 128 };
  }
  if (/^gemini-2\.5-pro(?:[.-]|$)/.test(normalized)) {
    return { config: { thinkingBudget: 128 }, tokenReserve: 128 };
  }
  if (/^gemini-2\.5(?:[.-]|$)/.test(normalized)) {
    return { config: { thinkingBudget: 0 }, tokenReserve: 0 };
  }
  return { tokenReserve: 0 };
}

function endpointFor(settings: ProviderSettings): URL {
  if (settings.provider === "custom") return new URL(settings.baseUrl);
  const base = settings.baseUrl.replace(/\/+$/, "");
  switch (settings.format) {
    case "anthropic": return new URL(`${base}/v1/messages`);
    case "gemini": return new URL(`${base}/v1beta/models/${encodeURIComponent(settings.model)}:generateContent`);
    case "cohere": return new URL(`${base}/v2/chat`);
    default: return new URL(`${base}/chat/completions`);
  }
}

function applyAuthentication(url: URL, headers: Record<string, string>, authType: ProviderSettings["authType"], apiKey: string): void {
  if (authType === "bearer") headers.Authorization = `Bearer ${apiKey}`;
  if (authType === "x-api-key") headers["x-api-key"] = apiKey;
  if (authType === "api-key") headers["api-key"] = apiKey;
  if (authType === "query-key") url.searchParams.set("key", apiKey);
}

export function buildModelListRequest(rawSettings: ProviderSettings, apiKey: string): ProviderRequest {
  const settings = validateProviderSettings(rawSettings);
  if (settings.provider === "custom") throw new Error("Custom APIs use the model ID entered by the user.");
  if (settings.authType !== "none" && !apiKey.trim()) throw new Error(`Add your ${getProviderDefinition(settings.provider).name} API key first.`);
  const base = settings.baseUrl.replace(/\/+$/, "");
  const url = settings.format === "anthropic"
    ? new URL(`${base}/v1/models`)
    : settings.format === "gemini"
      ? new URL(`${base}/v1beta/models`)
      : settings.format === "cohere"
        ? new URL(`${base}/v1/models`)
        : new URL(`${base}/models`);
  const headers: Record<string, string> = { Accept: "application/json" };
  applyAuthentication(url, headers, settings.authType, apiKey.trim());
  if (settings.format === "anthropic") headers["anthropic-version"] = "2023-06-01";
  return { url: url.toString(), init: { method: "GET", headers } };
}

export function extractAvailableModels(format: ProviderSettings["format"], body: unknown): AvailableModel[] {
  const data = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  const raw = format === "gemini"
    ? (Array.isArray(data.models) ? data.models : [])
    : (Array.isArray(data.data) ? data.data : Array.isArray(data.models) ? data.models : []);
  const models = raw.flatMap((item): AvailableModel[] => {
    if (!item || typeof item !== "object") return [];
    const record = item as Record<string, unknown>;
    if (format === "gemini" && Array.isArray(record.supportedGenerationMethods) && !record.supportedGenerationMethods.includes("generateContent")) return [];
    const rawId = String(record.id ?? record.name ?? "").trim();
    const id = format === "gemini" ? rawId.replace(/^models\//, "") : rawId;
    if (!id) return [];
    // Model-list endpoints often mix chat models with embeddings, image,
    // audio, moderation, and realtime models that cannot use this extension's
    // text chat endpoint. Keep those incompatible choices out of the picker.
    if (/(?:^|[\/_-])(?:embedding|embed|rerank|moderation|dall-e|image|sora|video|realtime|audio|speech|tts|whisper|transcrib)(?:[\/_-]|$)/i.test(id)) return [];
    const name = String(record.displayName ?? record.display_name ?? id).trim() || id;
    return [{ id, name }];
  });
  return [...new Map(models.map((model) => [model.id, model])).values()]
    .sort((a, b) => a.name.localeCompare(b.name))
    .slice(0, 500);
}

export function buildProviderRequest(
  rawSettings: ProviderSettings,
  apiKey: string,
  system: string,
  user: string,
  options: CompletionOptions
): ProviderRequest {
  const settings = validateProviderSettings(rawSettings);
  if (settings.authType !== "none" && !apiKey.trim()) throw new Error(`Add your ${getProviderDefinition(settings.provider).name} API key in Settings first.`);
  const url = endpointFor(settings);
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  applyAuthentication(url, headers, settings.authType, apiKey.trim());

  let body: Record<string, unknown>;
  if (settings.format === "anthropic") {
    headers["anthropic-version"] = "2023-06-01";
    headers["anthropic-dangerous-direct-browser-access"] = "true";
    body = {
      model: settings.model,
      system,
      messages: [{ role: "user", content: user }],
      temperature: options.temperature,
      max_tokens: options.maxTokens
    };
  } else if (settings.format === "gemini") {
    const thinking = geminiThinkingConfig(settings.model);
    const stableTemperature = !options.compatibility && !/^gemini-3(?:[.-]|$)/i.test(settings.model);
    body = {
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: "user", parts: [{ text: user }] }],
      generationConfig: {
        ...(stableTemperature ? { temperature: options.temperature } : {}),
        maxOutputTokens: options.maxTokens + thinking.tokenReserve,
        ...(thinking.config ? { thinkingConfig: thinking.config } : {}),
        ...(options.json && !options.compatibility ? { responseMimeType: "application/json" } : {})
      }
    };
  } else if (settings.format === "cohere") {
    body = {
      model: settings.model,
      messages: [{ role: "system", content: system }, { role: "user", content: user }],
      temperature: options.temperature,
      max_tokens: options.maxTokens,
      ...(options.json ? { response_format: { type: "json_object" } } : {})
    };
  } else {
    const reasoningModel = isOpenAIReasoningModel(settings);
    const modernTokenField = reasoningModel || settings.provider === "groq";
    const jsonMode = options.json && !options.compatibility && getProviderDefinition(settings.provider).jsonMode;
    const openAIReasoningEffort = reasoningModel
      ? (/^gpt-5\.[1-9]/i.test(settings.model) ? "none" : "minimal")
      : undefined;
    const groqReasoningEffort = settings.provider === "groq" && /(?:gpt-oss|qwen)/i.test(settings.model)
      ? (/qwen/i.test(settings.model) ? "none" : "low")
      : undefined;
    body = {
      model: settings.model,
      messages: [{ role: "system", content: system }, { role: "user", content: user }],
      ...(!options.compatibility && !reasoningModel ? { temperature: options.temperature } : {}),
      ...(modernTokenField ? { max_completion_tokens: options.maxTokens } : { max_tokens: options.maxTokens }),
      ...(openAIReasoningEffort ? { reasoning_effort: openAIReasoningEffort } : {}),
      ...(groqReasoningEffort ? { reasoning_effort: groqReasoningEffort } : {}),
      ...(settings.provider === "xai" && /^grok-4\.5(?:[.-]|$)/i.test(settings.model) ? { reasoning_effort: "low" } : {}),
      // DeepSeek V4 defaults to thinking mode. ExResume uses short, single-turn
      // extraction requests, so hidden reasoning can consume the entire output
      // budget and leave message.content empty unless thinking is disabled.
      ...(settings.provider === "deepseek" ? { thinking: { type: "disabled" } } : {}),
      ...(jsonMode ? { response_format: { type: "json_object" } } : {})
    };
  }
  return { url: url.toString(), init: { method: "POST", headers, body: JSON.stringify(body) } };
}

function textContent(value: unknown): string {
  if (typeof value === "string") return value;
  if (!Array.isArray(value)) return "";
  return value.map((part) => {
    if (!part || typeof part !== "object") return "";
    const record = part as Record<string, unknown>;
    return typeof record.text === "string" ? record.text : "";
  }).join("");
}

export function extractProviderText(format: ProviderSettings["format"], body: unknown): string {
  const data = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  if (format === "anthropic") return textContent(data.content).trim();
  if (format === "gemini") {
    const candidates = Array.isArray(data.candidates) ? data.candidates : [];
    const candidate = (candidates[0] ?? {}) as Record<string, unknown>;
    const content = (candidate.content ?? {}) as Record<string, unknown>;
    return textContent(content.parts).trim();
  }
  if (format === "cohere") {
    const message = (data.message ?? {}) as Record<string, unknown>;
    return textContent(message.content).trim();
  }
  const choices = Array.isArray(data.choices) ? data.choices : [];
  const choice = (choices[0] ?? {}) as Record<string, unknown>;
  const message = (choice.message ?? {}) as Record<string, unknown>;
  return textContent(message.content).trim();
}

export function parseProviderJson<T>(content: string): T {
  const unfenced = content.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  try {
    return JSON.parse(unfenced) as T;
  } catch {
    const start = unfenced.indexOf("{");
    const end = unfenced.lastIndexOf("}");
    if (start >= 0 && end > start) return JSON.parse(unfenced.slice(start, end + 1)) as T;
    throw new Error("The provider returned invalid JSON. Try again or choose another model.");
  }
}
