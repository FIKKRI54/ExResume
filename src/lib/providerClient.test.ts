import { describe, expect, it } from "vitest";
import { buildModelListRequest, buildProviderRequest, extractAvailableModels, extractProviderText, parseProviderJson } from "./providerClient";
import { settingsForProvider } from "./providers";

describe("provider API adapters", () => {
  it("builds OpenAI-compatible requests", () => {
    const request = buildProviderRequest(settingsForProvider("openai"), "secret", "system", "user", { maxTokens: 50, temperature: 0, json: true });
    expect(request.url).toBe("https://api.openai.com/v1/chat/completions");
    expect((request.init.headers as Record<string, string>).Authorization).toBe("Bearer secret");
    expect(JSON.parse(String(request.init.body))).toMatchObject({ model: "gpt-5-mini", max_completion_tokens: 50, reasoning_effort: "minimal", response_format: { type: "json_object" } });
    expect(JSON.parse(String(request.init.body))).not.toHaveProperty("temperature");
  });

  it("disables DeepSeek thinking so short requests return final content", () => {
    const request = buildProviderRequest(settingsForProvider("deepseek"), "secret", "system", "user", { maxTokens: 12, temperature: 0, json: false });
    expect(JSON.parse(String(request.init.body))).toMatchObject({
      model: "deepseek-v4-flash",
      thinking: { type: "disabled" }
    });
  });

  it("pins built-in providers to official endpoints", () => {
    const tampered = { ...settingsForProvider("openai"), baseUrl: "https://attacker.example/v1" };
    const request = buildProviderRequest(tampered, "secret", "system", "user", { maxTokens: 10, temperature: 0, json: false });
    expect(request.url).toBe("https://api.openai.com/v1/chat/completions");
  });

  it("builds Anthropic and Gemini native requests", () => {
    const anthropic = buildProviderRequest(settingsForProvider("anthropic"), "key", "system", "user", { maxTokens: 20, temperature: 0, json: true });
    expect(anthropic.url).toBe("https://api.anthropic.com/v1/messages");
    expect((anthropic.init.headers as Record<string, string>)["x-api-key"]).toBe("key");
    const gemini = buildProviderRequest(settingsForProvider("gemini"), "key with spaces", "system", "user", { maxTokens: 20, temperature: 0, json: true });
    expect(gemini.url).toContain("models/gemini-2.5-flash:generateContent?key=key+with+spaces");
    expect(JSON.parse(String(gemini.init.body))).toMatchObject({ generationConfig: { thinkingConfig: { thinkingBudget: 0 }, maxOutputTokens: 20 } });
  });

  it("reserves final-answer tokens for Gemini Pro and minimizes Gemini 3 thinking", () => {
    const pro = buildProviderRequest({ ...settingsForProvider("gemini"), model: "gemini-2.5-pro" }, "key", "system", "user", { maxTokens: 256, temperature: 0, json: false });
    expect(JSON.parse(String(pro.init.body))).toMatchObject({ generationConfig: { thinkingConfig: { thinkingBudget: 128 }, maxOutputTokens: 384 } });
    const flash3 = buildProviderRequest({ ...settingsForProvider("gemini"), model: "gemini-3.6-flash" }, "key", "system", "user", { maxTokens: 256, temperature: 0, json: false });
    const flash3Body = JSON.parse(String(flash3.init.body));
    expect(flash3Body).toMatchObject({ generationConfig: { thinkingConfig: { thinkingLevel: "minimal" }, maxOutputTokens: 384 } });
    expect(flash3Body.generationConfig).not.toHaveProperty("temperature");
  });

  it("uses modern Groq token fields and low reasoning for GPT-OSS", () => {
    const request = buildProviderRequest({ ...settingsForProvider("groq"), model: "openai/gpt-oss-120b" }, "key", "system", "user", { maxTokens: 256, temperature: 0, json: false });
    expect(JSON.parse(String(request.init.body))).toMatchObject({ max_completion_tokens: 256, reasoning_effort: "low" });
  });

  it("removes fragile optional output controls in compatibility mode", () => {
    const request = buildProviderRequest(settingsForProvider("mistral"), "key", "system", "Return JSON", { maxTokens: 512, temperature: 0, json: true, compatibility: true });
    const body = JSON.parse(String(request.init.body));
    expect(body).not.toHaveProperty("temperature");
    expect(body).not.toHaveProperty("response_format");
    expect(body.max_tokens).toBe(512);
  });

  it("uses an exact secure custom endpoint and selected authentication", () => {
    const custom = { ...settingsForProvider("custom"), model: "my-model", baseUrl: "https://llm.example.test/v9/infer", authType: "api-key" as const };
    const request = buildProviderRequest(custom, "secret", "system", "user", { maxTokens: 20, temperature: 0, json: false });
    expect(request.url).toBe("https://llm.example.test/v9/infer");
    expect((request.init.headers as Record<string, string>)["api-key"]).toBe("secret");
  });

  it("rejects insecure remote custom endpoints", () => {
    const custom = { ...settingsForProvider("custom"), model: "model", baseUrl: "http://example.test/chat" };
    expect(() => buildProviderRequest(custom, "key", "system", "user", { maxTokens: 20, temperature: 0, json: false })).toThrow(/HTTPS/);
  });

  it("extracts native response text and tolerant JSON", () => {
    expect(extractProviderText("anthropic", { content: [{ type: "text", text: "hello" }] })).toBe("hello");
    expect(extractProviderText("gemini", { candidates: [{ content: { parts: [{ text: "world" }] } }] })).toBe("world");
    expect(extractProviderText("cohere", { message: { content: [{ type: "text", text: "cohere" }] } })).toBe("cohere");
    expect(parseProviderJson<{ ok: boolean }>("```json\n{\"ok\":true}\n```").ok).toBe(true);
  });

  it("lists and normalizes provider models", () => {
    const request = buildModelListRequest(settingsForProvider("openai"), "secret");
    expect(request.url).toBe("https://api.openai.com/v1/models");
    expect(extractAvailableModels("openai", { data: [{ id: "gpt-5-mini" }] })).toEqual([{ id: "gpt-5-mini", name: "gpt-5-mini" }]);
    expect(extractAvailableModels("gemini", { models: [{ name: "models/gemini-2.5-flash", displayName: "Gemini 2.5 Flash", supportedGenerationMethods: ["generateContent"] }] })).toEqual([{ id: "gemini-2.5-flash", name: "Gemini 2.5 Flash" }]);
  });

  it("keeps non-chat models out of provider pickers", () => {
    expect(extractAvailableModels("openai", { data: [
      { id: "gpt-5-mini" },
      { id: "text-embedding-3-small" },
      { id: "gpt-realtime" },
      { id: "sora-2" }
    ] })).toEqual([{ id: "gpt-5-mini", name: "gpt-5-mini" }]);
  });
});
