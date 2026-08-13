import { describe, expect, it } from "vitest";
import { classifyField, deterministicSuggestion } from "./classifier";
import { emptyProfile } from "./defaults";
import type { CareerProfile, PageField } from "./types";

function field(overrides: Partial<PageField>): PageField {
  return {
    id: "0:field-1",
    frameId: 0,
    locator: "#field",
    tag: "input",
    inputType: "text",
    label: "",
    name: "",
    placeholder: "",
    required: false,
    maxLength: null,
    options: [],
    existingValue: "",
    ...overrides
  };
}

function profile(): CareerProfile {
  return {
    ...structuredClone(emptyProfile),
    identity: {
      ...emptyProfile.identity,
      fullName: "Amina Rahman",
      email: "amina@example.com",
      phone: "+60 12 345 6789"
    },
    preferences: {
      ...emptyProfile.preferences,
      sponsorship: "No",
      workAuthorization: "Yes"
    }
  };
}

describe("field classification", () => {
  it("maps common identity labels deterministically", () => {
    const suggestion = deterministicSuggestion(field({ label: "First name", required: true }), profile());
    expect(suggestion.canonical).toBe("first_name");
    expect(suggestion.value).toBe("Amina");
    expect(suggestion.status).toBe("direct");
    expect(suggestion.selected).toBe(true);
  });

  it("uses only explicit saved application preferences", () => {
    const known = deterministicSuggestion(field({ label: "Will you now or later require visa sponsorship?" }), profile());
    expect(known.value).toBe("No");
    expect(known.evidenceIds).toEqual(["preference-sponsorship"]);

    const missingProfile = profile();
    missingProfile.preferences.sponsorship = "";
    const missing = deterministicSuggestion(field({ label: "Will you require sponsorship?" }), missingProfile);
    expect(missing.status).toBe("needs_input");
    expect(missing.value).toBe("");
  });

  it("never guesses sensitive declarations", () => {
    const suggestion = deterministicSuggestion(field({ label: "Gender identity" }), profile());
    expect(suggestion.canonical).toBe("sensitive_declaration");
    expect(suggestion.status).toBe("skipped");
    expect(suggestion.selected).toBe(false);
  });

  it("routes narrative questions to grounded generation", () => {
    expect(classifyField(field({ tag: "textarea", inputType: "textarea", label: "Why are you a good fit?" }))).toBe("long_answer");
  });

  it("does not overwrite a value already present on the page", () => {
    const suggestion = deterministicSuggestion(field({ label: "Email", existingValue: "already@entered.test" }), profile());
    expect(suggestion.status).toBe("skipped");
    expect(suggestion.rationale).toContain("already has a value");
  });
});
