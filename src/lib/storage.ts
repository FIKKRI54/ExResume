import { defaultProviderSettings, emptyProfile } from "./defaults";
import { normalizeProviderSettings } from "./providers";
import type { CareerProfile, ProviderSettings } from "./types";

const PROFILE_KEY = "careerProfile";
const SETTINGS_KEY = "providerSettings";

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export async function getProfile(): Promise<CareerProfile> {
  const result = await chrome.storage.local.get(PROFILE_KEY);
  return result[PROFILE_KEY] ? { ...clone(emptyProfile), ...result[PROFILE_KEY] } : clone(emptyProfile);
}

export async function saveProfile(profile: CareerProfile): Promise<void> {
  await chrome.storage.local.set({ [PROFILE_KEY]: { ...profile, updatedAt: new Date().toISOString() } });
}

export async function getProviderSettings(): Promise<ProviderSettings> {
  const result = await chrome.storage.local.get(SETTINGS_KEY);
  return normalizeProviderSettings({ ...defaultProviderSettings, ...(result[SETTINGS_KEY] ?? {}) });
}

export async function saveProviderSettings(settings: ProviderSettings): Promise<void> {
  await chrome.storage.local.set({ [SETTINGS_KEY]: normalizeProviderSettings(settings) });
}
