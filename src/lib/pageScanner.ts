import type { FillResult } from "./types";

export interface ScannedFrame {
  url: string;
  pageTitle: string;
  jobTitle: string;
  company: string;
  location: string;
  description: string;
  fields: Array<{
    localId: string;
    locator: string;
    tag: string;
    inputType: string;
    label: string;
    name: string;
    placeholder: string;
    required: boolean;
    maxLength: number | null;
    options: Array<{ label: string; value: string }>;
    existingValue: string;
  }>;
}

export function scanApplicationPage(): ScannedFrame {
  const tidy = (value: string | null | undefined, limit = 500) =>
    (value ?? "").replace(/\s+/g, " ").trim().slice(0, limit);
  const escapeCss = (value: string) => {
    if (typeof CSS !== "undefined" && typeof CSS.escape === "function") return CSS.escape(value);
    return value.replace(/[^a-zA-Z0-9_-]/g, (char) => `\\${char}`);
  };
  const isVisible = (element: Element) => {
    const style = getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    return style.display !== "none" && style.visibility !== "hidden" && style.opacity !== "0" && rect.width > 0 && rect.height > 0 && element.getAttribute("aria-hidden") !== "true";
  };
  const selectorPart = (element: Element) => {
    if (element.id) return `#${escapeCss(element.id)}`;
    const name = element.getAttribute("name");
    if (name && element.ownerDocument.querySelectorAll(`[name="${escapeCss(name)}"]`).length === 1) return `[name="${escapeCss(name)}"]`;
    const parent = element.parentElement;
    const tag = element.tagName.toLowerCase();
    if (!parent) return tag;
    const siblings = Array.from(parent.children).filter((item) => item.tagName === element.tagName);
    return siblings.length > 1 ? `${tag}:nth-of-type(${siblings.indexOf(element) + 1})` : tag;
  };
  const locatorFor = (element: Element) => {
    const segments: string[] = [];
    let current: Element | null = element;
    while (current) {
      const root: Document | ShadowRoot = current.getRootNode() as Document | ShadowRoot;
      const path: string[] = [];
      let node: Element | null = current;
      while (node && node !== (root instanceof Document ? root.documentElement : null)) {
        path.unshift(selectorPart(node));
        if (node.id) break;
        node = node.parentElement;
      }
      segments.unshift(path.join(" > "));
      if (root instanceof ShadowRoot) current = root.host;
      else current = null;
    }
    return segments.filter(Boolean).join(" >>> ");
  };
  const findLabel = (element: Element) => {
    const textOf = (candidate: Element | null | undefined) => tidy(
      (candidate as HTMLElement | null)?.innerText || candidate?.textContent,
      500
    );
    const aria = element.getAttribute("aria-label");
    if (aria) return tidy(aria);
    const labelledBy = element.getAttribute("aria-labelledby");
    if (labelledBy) {
      const root = element.getRootNode() as Document | ShadowRoot;
      const text = labelledBy.split(/\s+/).map((id) => {
        const labelled = root.querySelector(`#${escapeCss(id)}`);
        return textOf(labelled);
      }).join(" ");
      if (tidy(text)) return tidy(text);
    }
    if (element.id) {
      const explicit = document.querySelector(`label[for="${escapeCss(element.id)}"]`);
      if (explicit) return tidy((explicit as HTMLElement).innerText);
    }
    const wrapping = element.closest("label");
    const ownLabel = wrapping ? tidy((wrapping as HTMLElement).innerText) : "";
    const group = element.closest("fieldset, [role='group'], [role='radiogroup']");
    const legend = group?.querySelector(":scope > legend, :scope > [role='heading']");
    const groupLabel = tidy((legend as HTMLElement | null)?.innerText || group?.getAttribute("aria-label"));
    if (groupLabel && ownLabel && groupLabel !== ownLabel) return `${groupLabel} — ${ownLabel}`;
    if (ownLabel) return ownLabel;
    const container = element.closest("[data-automation-id*='formField'], .form-field, .field, [class*='question'], [class*='field']");
    const nearby = container?.querySelector("label, legend, [class*='label'], [class*='question']");
    const containerLabel = textOf(nearby);
    if (containerLabel) return containerLabel;

    // Job boards frequently render the question as a plain div or paragraph
    // immediately before a textarea instead of using an accessible label.
    // Walk a few nearby sibling levels without pulling in the whole form.
    const candidates: string[] = [];
    let current: Element | null = element;
    for (let depth = 0; current && depth < 4; depth += 1) {
      let sibling = current.previousElementSibling;
      for (let offset = 0; sibling && offset < 3; offset += 1) {
        const text = textOf(sibling);
        if (text && text.length > 1 && !/^\d+\s*\/\s*\d+$/.test(text)) {
          if (/[?]$/.test(text) || sibling.matches("label, legend, p, [role='heading'], [class*='label'], [class*='question']")) return text;
          candidates.push(text);
        }
        sibling = sibling.previousElementSibling;
      }
      current = current.parentElement;
    }
    return candidates[0] ?? "";
  };
  const collect = (root: Document | ShadowRoot): Element[] => {
    const selector = "input, select, textarea, [contenteditable='true'], [role='textbox'], [role='combobox']";
    const found = Array.from(root.querySelectorAll(selector));
    for (const element of Array.from(root.querySelectorAll("*"))) {
      if (element.shadowRoot) found.push(...collect(element.shadowRoot));
    }
    return Array.from(new Set(found));
  };

  const elements = collect(document).filter((element) => {
    const input = element as HTMLInputElement;
    const type = (input.type || element.getAttribute("role") || element.tagName).toLowerCase();
    return isVisible(element) && !["hidden", "submit", "button", "reset", "image", "password"].includes(type) && !input.disabled && !input.readOnly;
  });

  const fields = elements.map((element, index) => {
    const input = element as HTMLInputElement;
    const select = element as HTMLSelectElement;
    const tag = element.tagName.toLowerCase();
    const inputType = tag === "textarea" ? "textarea" : tag === "select" ? "select" : (input.type || element.getAttribute("role") || tag).toLowerCase();
    const options = tag === "select"
      ? Array.from(select.options).filter((option) => option.value || option.text).map((option) => ({ label: tidy(option.text), value: option.value }))
      : inputType === "radio" || inputType === "checkbox"
        ? [{ label: findLabel(element), value: input.value || "true" }]
        : [];
    const checkedRadio = inputType === "radio" && input.name
      ? Array.from((element.getRootNode() as Document | ShadowRoot).querySelectorAll<HTMLInputElement>("input[type='radio']"))
          .find((candidate) => candidate.name === input.name && candidate.checked)
      : undefined;
    return {
      localId: `field-${index + 1}`,
      locator: locatorFor(element),
      tag,
      inputType,
      label: findLabel(element),
      name: tidy(element.getAttribute("name")),
      placeholder: tidy(element.getAttribute("placeholder")),
      required: input.required || element.getAttribute("aria-required") === "true",
      maxLength: input.maxLength > 0 ? input.maxLength : null,
      options,
      existingValue: inputType === "radio"
        ? checkedRadio?.value || ""
        : inputType === "checkbox"
          ? (input.checked ? input.value || "true" : "")
          : tidy(input.value || element.textContent, 1000)
    };
  });

  const readFirst = (selectors: string[], limit = 300) => {
    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element && isVisible(element) && tidy((element as HTMLElement).innerText || element.textContent)) return tidy((element as HTMLElement).innerText || element.textContent, limit);
    }
    return "";
  };
  const jobTitle = readFirst(["[data-automation-id='jobPostingHeader'] h1", "[data-testid*='job-title']", "[class*='job-title']", "h1"]);
  const company = readFirst(["[data-testid*='company']", "[class*='company-name']", "[class*='companyName']", "[itemprop='hiringOrganization']"])
    || tidy(document.querySelector("meta[property='og:site_name']")?.getAttribute("content"), 200);
  const locationText = readFirst(["[data-testid*='location']", "[class*='job-location']", "[class*='location']", "[itemprop='jobLocation']"]);
  const description = readFirst([
    "[data-automation-id='jobPostingDescription']", "[data-testid*='job-description']", "[class*='job-description']",
    "[class*='jobDescription']", "[itemprop='description']", "main", "article"
  ], 12_000) || tidy((document.body as HTMLElement).innerText, 12_000);

  return {
    url: location.href,
    pageTitle: document.title,
    jobTitle,
    company,
    location: locationText,
    description: description.slice(0, 12_000),
    fields
  };
}

export function fillApplicationFields(
  items: Array<{ fieldId: string; locator: string; value: string }>
): FillResult[] {
  const resolve = (locator: string): Element | null => {
    const segments = locator.split(" >>> ");
    let root: Document | ShadowRoot = document;
    let found: Element | null = null;
    for (let index = 0; index < segments.length; index += 1) {
      found = root.querySelector(segments[index]);
      if (!found) return null;
      if (index < segments.length - 1) {
        if (!found.shadowRoot) return null;
        root = found.shadowRoot;
      }
    }
    return found;
  };
  const emit = (element: Element) => {
    element.dispatchEvent(new Event("input", { bubbles: true, composed: true }));
    element.dispatchEvent(new Event("change", { bubbles: true, composed: true }));
    element.dispatchEvent(new Event("blur", { bubbles: true, composed: true }));
  };

  return items.map((item) => {
    const element = resolve(item.locator) as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | null;
    if (!element) return { fieldId: item.fieldId, success: false, reason: "Field moved or disappeared." };
    try {
      if (element instanceof HTMLSelectElement) {
        const normalized = item.value.toLowerCase().trim();
        const option = Array.from(element.options).find((candidate) => candidate.value.toLowerCase().trim() === normalized || candidate.text.toLowerCase().trim() === normalized);
        if (!option) return { fieldId: item.fieldId, success: false, reason: "Matching dropdown option not found." };
        element.value = option.value;
      } else if (element instanceof HTMLInputElement && (element.type === "checkbox" || element.type === "radio")) {
        element.checked = /^(true|yes|1|on)$/i.test(item.value);
      } else if ((element as HTMLElement).isContentEditable) {
        (element as HTMLElement).focus();
        (element as HTMLElement).textContent = item.value;
      } else {
        const prototype = element instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
        const setter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;
        if (setter) setter.call(element, item.value);
        else element.value = item.value;
      }
      emit(element);
      return { fieldId: item.fieldId, success: true };
    } catch (error) {
      return { fieldId: item.fieldId, success: false, reason: error instanceof Error ? error.message : "Could not fill field." };
    }
  });
}
