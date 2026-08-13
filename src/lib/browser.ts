import { fillApplicationFields, scanApplicationPage, type ScannedFrame } from "./pageScanner";
import type { FillResult, JobContext, PageAnalysis, Suggestion } from "./types";

export const LAST_ACTION_TAB_KEY = "lastActionTab";

export interface RememberedTab {
  id: number;
  windowId?: number;
  url?: string;
}

export interface ResolvedTab {
  id: number;
  windowId?: number;
  url?: string;
}

export function isRestrictedPageUrl(url?: string): boolean {
  return Boolean(url && /^(chrome|edge|about|chrome-extension|devtools):/i.test(url));
}

export function mergeRememberedTab(
  tab: ResolvedTab | undefined,
  remembered: RememberedTab | undefined
): ResolvedTab | undefined {
  if (!tab) return remembered ? { id: remembered.id, windowId: remembered.windowId, url: remembered.url } : undefined;
  if (typeof tab.id !== "number") return remembered;
  if (!remembered || tab.id !== remembered.id) return { id: tab.id, windowId: tab.windowId, url: tab.url };
  return { id: tab.id, url: tab.url || remembered.url, windowId: tab.windowId ?? remembered.windowId };
}

async function rememberedActionTab(): Promise<RememberedTab | undefined> {
  const stored = await chrome.storage.session.get(LAST_ACTION_TAB_KEY);
  const value = stored[LAST_ACTION_TAB_KEY] as Partial<RememberedTab> | undefined;
  return typeof value?.id === "number"
    ? { id: value.id, windowId: value.windowId, url: value.url }
    : undefined;
}

async function activeTab(): Promise<ResolvedTab> {
  // A side panel is an extension page, so `currentWindow` can resolve from the
  // panel context instead of the browser window the user is looking at. Chrome
  // documents `lastFocusedWindow` as the reliable way to get the user's tab.
  const [queried] = await chrome.tabs.query({
    active: true,
    lastFocusedWindow: true,
    windowType: "normal"
  });
  const remembered = await rememberedActionTab();
  const queriedTab = typeof queried?.id === "number"
    ? { id: queried.id, windowId: queried.windowId, url: queried.url }
    : undefined;
  const tab = mergeRememberedTab(queriedTab, remembered);
  if (!tab?.id) throw new Error("No active browser tab found.");
  // `activeTab` does not guarantee that tabs.query exposes the URL to a side
  // panel, even though executeScript can access the tab after an action click.
  // Reject only URLs Chrome explicitly marks as restricted.
  if (isRestrictedPageUrl(tab.url)) {
    throw new Error("Open a regular job application page, then try again.");
  }
  return tab;
}

function pageLabel(tab: ResolvedTab): string {
  if (!tab.url) return "the current tab";
  try {
    return new URL(tab.url).hostname || "the current tab";
  } catch {
    return "the current tab";
  }
}

async function scanFrames(tab: ResolvedTab): Promise<chrome.scripting.InjectionResult<ScannedFrame>[]> {
  const tabId = tab.id!;
  try {
    return await chrome.scripting.executeScript({
      target: { tabId, allFrames: true },
      func: scanApplicationPage
    });
  } catch (allFramesError) {
    try {
      // Some sites contain protected third-party frames. The visible form can
      // still be scanned when it lives in the main document.
      return await chrome.scripting.executeScript({
        target: { tabId },
        func: scanApplicationPage
      });
    } catch (mainFrameError) {
      const detail = mainFrameError instanceof Error ? mainFrameError.message : String(mainFrameError || allFramesError);
      if (/cannot access|cannot be scripted|permission|extensions gallery/i.test(detail)) {
        throw new Error(`ExResume found ${pageLabel(tab)}, but Chrome has not granted access to its page content. Click the ExResume toolbar icon once on that tab, then Analyze again.`);
      }
      throw new Error(`ExResume found ${pageLabel(tab)}, but the page scanner failed: ${detail}`);
    }
  }
}

export async function analyzeActivePage(): Promise<PageAnalysis> {
  const tab = await activeTab();
  const injected = await scanFrames(tab);
  const frames = injected
    .filter((result): result is chrome.scripting.InjectionResult<ScannedFrame> & { result: ScannedFrame } => Boolean(result.result))
    .map((result) => ({ frameId: result.frameId, data: result.result }));
  if (!frames.length) throw new Error("This page could not be inspected.");
  const main = frames.find((frame) => frame.frameId === 0)?.data ?? frames[0].data;
  const jobSource = frames.map((frame) => frame.data).sort((a, b) => b.description.length - a.description.length)[0] ?? main;
  const fields = frames.flatMap(({ frameId, data }) => data.fields.map((field) => ({
    ...field,
    id: `${frameId}:${field.localId}`,
    frameId
  })));
  const job: JobContext = {
    title: main.jobTitle || jobSource.jobTitle || main.pageTitle,
    company: main.company || jobSource.company,
    location: main.location || jobSource.location,
    description: jobSource.description,
    pageTitle: main.pageTitle,
    url: main.url
  };
  return { tabId: tab.id!, fields, job };
}

export async function fillSuggestions(tabId: number, suggestions: Suggestion[]): Promise<FillResult[]> {
  const selected = suggestions.filter((item) => item.selected && item.value && ["direct", "generated", "user"].includes(item.status));
  const grouped = new Map<number, typeof selected>();
  selected.forEach((suggestion) => grouped.set(suggestion.frameId, [...(grouped.get(suggestion.frameId) ?? []), suggestion]));
  const results: FillResult[] = [];
  for (const [frameId, items] of grouped) {
    const injected = await chrome.scripting.executeScript({
      target: { tabId, frameIds: [frameId] },
      func: fillApplicationFields,
      args: [items.map(({ fieldId, locator, value }) => ({ fieldId, locator, value }))]
    });
    results.push(...(injected[0]?.result ?? []));
  }
  return results;
}
