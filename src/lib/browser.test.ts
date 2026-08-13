import { describe, expect, it } from "vitest";
import { isRestrictedPageUrl, mergeRememberedTab } from "./browser";

describe("active page eligibility", () => {
  it("does not reject a normal tab when Chrome withholds its URL", () => {
    expect(isRestrictedPageUrl(undefined)).toBe(false);
    expect(isRestrictedPageUrl("https://www.glassdoor.com/job-listing/example")).toBe(false);
  });

  it("still blocks browser-internal pages", () => {
    expect(isRestrictedPageUrl("chrome://extensions")).toBe(true);
    expect(isRestrictedPageUrl("edge://extensions")).toBe(true);
    expect(isRestrictedPageUrl("about:blank")).toBe(true);
  });
});

describe("current tab resolution", () => {
  it("restores the URL Chrome exposed when the toolbar action was clicked", () => {
    expect(mergeRememberedTab(
      { id: 42, windowId: 7 },
      { id: 42, windowId: 7, url: "https://smartapply.indeed.com/apply" }
    )?.url).toBe("https://smartapply.indeed.com/apply");
  });

  it("never replaces the active tab with a stale remembered tab", () => {
    expect(mergeRememberedTab(
      { id: 99, windowId: 7, url: "https://current.example/apply" },
      { id: 42, windowId: 5, url: "https://stale.example/apply" }
    )?.id).toBe(99);
  });
});
