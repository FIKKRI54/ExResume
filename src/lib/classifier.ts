import type { CanonicalField, CareerProfile, PageField, Suggestion } from "./types";

const PATTERNS: Array<[CanonicalField, RegExp]> = [
  ["sensitive_declaration", /\b(gender|sex|race|ethnic|disabilit|veteran|military status|criminal|felony|religion|marital|national id|social security|ssn|date of birth|birth date|age)\b/i],
  ["resume_upload", /\b(resume|cv|curriculum vitae)\b.*\b(upload|attach|file)|\b(upload|attach)\b.*\b(resume|cv)\b/i],
  ["work_authorization", /\b(legally authorized|authori[sz]ed to work|work authori[sz]ation|right to work)\b/i],
  ["sponsorship", /\b(sponsor|sponsorship|work visa|employment visa)\b/i],
  ["relocation", /\b(relocat|willing to move)\b/i],
  ["salary", /\b(salary|compensation|pay expectation|expected pay|desired pay)\b/i],
  ["notice_period", /\b(notice period|current notice|time.*leave current|weeks.*notice)\b/i],
  ["start_date", /\b(start date|available to start|earliest.*start|availability date)\b/i],
  ["linkedin", /linkedin/i],
  ["website", /\b(portfolio|personal website|github|website|web site)\b/i],
  ["email", /\b(e-?mail)\b/i],
  ["phone", /\b(phone|mobile|telephone|contact number)\b/i],
  ["first_name", /\b(first|given)\s*name\b/i],
  ["last_name", /\b(last|family|sur)\s*name\b/i],
  ["full_name", /\b(full|legal|preferred)?\s*name\b/i],
  ["location", /\b(city|current location|address|location|country of residence)\b/i],
  ["field_of_study", /\b(field|major|area)\s*(of)?\s*study\b/i],
  ["degree", /\b(degree|qualification)\b/i],
  ["school", /\b(school|university|college|institution)\b/i]
];

export function fieldText(field: Pick<PageField, "label" | "name" | "placeholder">): string {
  return [field.label, field.name, field.placeholder].filter(Boolean).join(" ").replace(/[_-]+/g, " ");
}

export function classifyField(field: PageField): CanonicalField {
  const text = fieldText(field);
  for (const [canonical, pattern] of PATTERNS) if (pattern.test(text)) return canonical;
  if (field.tag === "textarea" || field.inputType === "textarea" || /\b(describe|explain|why|tell us|example|cover letter|interest|suitable|fit)\b/i.test(text)) {
    return "long_answer";
  }
  return "unknown";
}

function names(fullName: string): { first: string; last: string } {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  return { first: parts[0] ?? "", last: parts.length > 1 ? parts.at(-1) ?? "" : "" };
}

function canonicalValue(canonical: CanonicalField, profile: CareerProfile): string {
  const name = names(profile.identity.fullName);
  const education = profile.education[0];
  const values: Partial<Record<CanonicalField, string>> = {
    first_name: name.first,
    last_name: name.last,
    full_name: profile.identity.fullName,
    email: profile.identity.email,
    phone: profile.identity.phone,
    location: profile.identity.location,
    linkedin: profile.identity.linkedin,
    website: profile.identity.website,
    school: education?.institution ?? "",
    degree: education?.degree ?? "",
    field_of_study: education?.field ?? "",
    work_authorization: profile.preferences.workAuthorization,
    sponsorship: profile.preferences.sponsorship,
    relocation: profile.preferences.relocation,
    salary: profile.preferences.salary,
    notice_period: profile.preferences.noticePeriod,
    start_date: profile.preferences.startDate
  };
  return values[canonical]?.trim() ?? "";
}

function preferenceEvidenceId(canonical: CanonicalField): string[] {
  return ["work_authorization", "sponsorship", "relocation", "salary", "notice_period", "start_date"].includes(canonical)
    ? [`preference-${canonical.replaceAll("_", "-")}`]
    : [];
}

function optionValue(value: string, field: PageField): string {
  if (!field.options.length) return value;
  const normalized = value.toLowerCase().trim();
  const exact = field.options.find((option) => [option.value, option.label].some((part) => part.toLowerCase().trim() === normalized));
  if (exact) return exact.value;
  const yes = /^(yes|true|authorized|i am|willing)/i.test(normalized);
  const no = /^(no|false|not required|i am not|unwilling)/i.test(normalized);
  const fuzzy = field.options.find((option) => {
    const text = `${option.label} ${option.value}`.toLowerCase();
    return (yes && /\byes\b|\btrue\b/.test(text)) || (no && /\bno\b|\bfalse\b/.test(text));
  });
  return fuzzy?.value ?? value;
}

export function deterministicSuggestion(field: PageField, profile: CareerProfile): Suggestion {
  const canonical = classifyField(field);
  const base = {
    fieldId: field.id,
    frameId: field.frameId,
    locator: field.locator,
    label: field.label || field.placeholder || field.name || "Unlabelled field",
    required: field.required,
    canonical,
    maxLength: field.maxLength
  };

  if (field.existingValue) {
    return { ...base, value: "", status: "skipped", confidence: "high", evidenceIds: [], rationale: "This field already has a value, so ExResume left it unchanged.", selected: false };
  }
  if (canonical === "sensitive_declaration") {
    return { ...base, value: "", status: "skipped", confidence: "high", evidenceIds: [], rationale: "Enter this sensitive information yourself.", selected: false };
  }
  if (canonical === "resume_upload" || field.inputType === "file") {
    return { ...base, value: "", status: "manual", confidence: "high", evidenceIds: [], rationale: "Browsers require you to choose files manually.", selected: false };
  }
  if (canonical === "long_answer") {
    return { ...base, value: "", status: "needs_input", confidence: "low", evidenceIds: [], rationale: "Your selected AI provider can draft this from matching resume excerpts.", selected: false };
  }
  const value = canonicalValue(canonical, profile);
  if (canonical === "unknown") {
    return { ...base, value: "", status: "skipped", confidence: "low", evidenceIds: [], rationale: "No safe field mapping found.", selected: false };
  }
  if (!value) {
    return { ...base, value: "", status: "needs_input", confidence: "high", evidenceIds: [], rationale: "This detail is missing from your profile.", selected: false };
  }

  const mapped = optionValue(value, field);
  if (field.inputType === "radio") {
    const optionText = `${field.label} ${field.options.map((item) => `${item.label} ${item.value}`).join(" ")}`.toLowerCase();
    const wanted = mapped.toLowerCase();
    const optionMatches = optionText.includes(wanted) || (/^(yes|true)/.test(wanted) && /\byes\b/.test(optionText)) || (/^(no|false)/.test(wanted) && /\bno\b/.test(optionText));
    if (!optionMatches) return { ...base, value: "", status: "skipped", confidence: "high", evidenceIds: [], rationale: "Alternate radio option.", selected: false };
  }

  return {
    ...base,
    value: field.inputType === "radio" ? "true" : mapped,
    status: "direct",
    confidence: "high",
    evidenceIds: preferenceEvidenceId(canonical),
    rationale: preferenceEvidenceId(canonical).length ? "Matched from your saved application preferences." : "Matched from your saved profile.",
    selected: true
  };
}
