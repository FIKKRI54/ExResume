import { describe, expect, it } from "vitest";
import manifest from "../../public/manifest.json";
import { customOriginPattern, getModelOptions, normalizeProviderSettings, PROVIDERS, settingsForProvider } from "./providers";

describe("provider catalog security", () => {
  it("has unique provider IDs and official HTTPS origins", () => {
    expect(new Set(PROVIDERS.map((provider) => provider.id)).size).toBe(PROVIDERS.length);
    for (const provider of PROVIDERS.filter((item) => item.id !== "custom")) {
      expect(new URL(provider.baseUrl).protocol).toBe("https:");
    }
  });

  it("declares host access for every built-in provider", () => {
    const declared = new Set(manifest.host_permissions);
    for (const provider of PROVIDERS.filter((item) => item.id !== "custom")) {
      expect(declared.has(`${new URL(provider.baseUrl).origin}/*`), provider.name).toBe(true);
    }
  });

  it("pins built-in settings and requests only the exact custom origin", () => {
    const openai = normalizeProviderSettings({ ...settingsForProvider("openai"), baseUrl: "https://wrong.example" });
    expect(openai.baseUrl).toBe("https://api.openai.com/v1");
    const custom = { ...settingsForProvider("custom"), model: "model", baseUrl: "https://gateway.example:8443/v1/chat/completions" };
    expect(customOriginPattern(custom)).toBe("https://gateway.example:8443/*");
  });

  it("offers a selectable default model for every built-in provider", () => {
    for (const provider of PROVIDERS.filter((item) => item.id !== "custom")) {
      expect(getModelOptions(provider.id).some((model) => model.id === provider.defaultModel), provider.name).toBe(true);
    }
  });
});
