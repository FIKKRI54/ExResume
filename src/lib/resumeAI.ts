import type {
  Education,
  Evidence,
  Experience,
  Identity,
  ResumeParseResult
} from "./types";

export interface RawResumeFact {
  value?: unknown;
  evidence_quote?: unknown;
  confidence?: unknown;
}

export interface RawResumeExtraction {
  identity?: Partial<Record<keyof Identity, RawResumeFact>>;
  summary?: RawResumeFact;
  skills?: RawResumeFact[];
  education?: Array<{
    institution?: RawResumeFact;
    degree?: RawResumeFact;
    field?: RawResumeFact;
    startDate?: RawResumeFact;
    endDate?: RawResumeFact;
  }>;
  experience?: Array<{
    company?: RawResumeFact;
    role?: RawResumeFact;
    startDate?: RawResumeFact;
    endDate?: RawResumeFact;
    highlights?: RawResumeFact[];
    technologies?: RawResumeFact[];
  }>;
}

type AcceptedFact = { value: string; quote: string };
type FactValidator = (value: string, quote: string) => boolean;

function normalize(value: string): string {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\u2010-\u2015]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

function digits(value: string): string {
  return value.replace(/\D/g, "");
}

function exactInQuote(value: string, quote: string): boolean {
  return normalize(quote).includes(normalize(value));
}

function validName(value: string, quote: string): boolean {
  const words = value.split(/\s+/).filter(Boolean);
  return words.length >= 2
    && words.length <= 7
    && /^[\p{L} .'-]+$/u.test(value)
    && exactInQuote(value, quote);
}

function validEmail(value: string, quote: string): boolean {
  return /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(value) && exactInQuote(value, quote);
}

export function isPlausiblePhone(value: string, quote = value): boolean {
  const number = digits(value);
  if (number.length < 8 || number.length > 15) return false;
  if (!digits(quote).includes(number)) return false;
  const years = quote.match(/\b(?:19|20)\d{2}\b/g) ?? [];
  if (years.length >= 2) return false;
  return /[+()\s.-]/.test(value) || number.length >= 9;
}

function validUrl(value: string, quote: string): boolean {
  return /^(?:https?:\/\/|www\.)\S+$/i.test(value) && exactInQuote(value, quote);
}

export function validateResumeExtraction(raw: RawResumeExtraction, resumeText: string): ResumeParseResult {
  const resume = normalize(resumeText);
  const evidence: Evidence[] = [];
  const warnings: string[] = [];
  let verifiedFacts = 0;
  let rejectedFacts = 0;

  const accept = (
    fact: RawResumeFact | undefined,
    label: string,
    validator: FactValidator = (value, quote) => exactInQuote(value, quote)
  ): AcceptedFact | null => {
    if (!fact || typeof fact.value !== "string" || !fact.value.trim()) return null;
    const value = fact.value.trim().slice(0, 2_000);
    const quote = typeof fact.evidence_quote === "string" ? fact.evidence_quote.trim().slice(0, 3_000) : "";
    const confidence = Math.max(0, Math.min(1, Number(fact.confidence) || 0));
    const quoteSupported = quote.length >= 2 && resume.includes(normalize(quote));
    if (!quoteSupported || confidence < 0.6 || !validator(value, quote)) {
      rejectedFacts += 1;
      return null;
    }
    verifiedFacts += 1;
    evidence.push({
      id: `ai-resume-${String(evidence.length + 1).padStart(3, "0")}`,
      kind: "resume",
      label,
      text: quote
    });
    return { value, quote };
  };

  const identity: Identity = {
    fullName: accept(raw.identity?.fullName, "Full name evidence", validName)?.value ?? "",
    email: accept(raw.identity?.email, "Email evidence", validEmail)?.value ?? "",
    phone: accept(raw.identity?.phone, "Phone evidence", isPlausiblePhone)?.value ?? "",
    location: accept(raw.identity?.location, "Location evidence", (value, quote) => exactInQuote(value, quote))?.value ?? "",
    linkedin: accept(raw.identity?.linkedin, "LinkedIn evidence", validUrl)?.value ?? "",
    website: accept(raw.identity?.website, "Website evidence", validUrl)?.value ?? ""
  };

  const summary = accept(raw.summary, "Professional summary evidence")?.value ?? "";
  const skills = Array.from(new Set(
    (Array.isArray(raw.skills) ? raw.skills : [])
      .slice(0, 120)
      .map((fact) => accept(fact, `Skill evidence: ${String(fact?.value ?? "").slice(0, 80)}`, (value, quote) => exactInQuote(value, quote))?.value)
      .filter((value): value is string => Boolean(value))
  ));

  const education: Education[] = (Array.isArray(raw.education) ? raw.education : [])
    .slice(0, 12)
    .map((item, index) => ({
      institution: accept(item.institution, `Education ${index + 1}: institution`, (value, quote) => exactInQuote(value, quote))?.value ?? "",
      degree: accept(item.degree, `Education ${index + 1}: degree`, (value, quote) => exactInQuote(value, quote))?.value ?? "",
      field: accept(item.field, `Education ${index + 1}: field of study`, (value, quote) => exactInQuote(value, quote))?.value ?? "",
      startDate: accept(item.startDate, `Education ${index + 1}: start date`, (value, quote) => exactInQuote(value, quote))?.value ?? "",
      endDate: accept(item.endDate, `Education ${index + 1}: end date`, (value, quote) => exactInQuote(value, quote))?.value ?? ""
    }))
    .filter((item) => Boolean(item.institution || item.degree || item.field));

  const experience: Experience[] = (Array.isArray(raw.experience) ? raw.experience : [])
    .slice(0, 20)
    .map((item, index) => ({
      company: accept(item.company, `Experience ${index + 1}: company`, (value, quote) => exactInQuote(value, quote))?.value ?? "",
      role: accept(item.role, `Experience ${index + 1}: role`, (value, quote) => exactInQuote(value, quote))?.value ?? "",
      startDate: accept(item.startDate, `Experience ${index + 1}: start date`, (value, quote) => exactInQuote(value, quote))?.value ?? "",
      endDate: accept(item.endDate, `Experience ${index + 1}: end date`, (value, quote) => exactInQuote(value, quote))?.value ?? "",
      highlights: (Array.isArray(item.highlights) ? item.highlights : [])
        .slice(0, 16)
        .map((fact, highlightIndex) => accept(fact, `Experience ${index + 1}: highlight ${highlightIndex + 1}`)?.value)
        .filter((value): value is string => Boolean(value)),
      technologies: (Array.isArray(item.technologies) ? item.technologies : [])
        .slice(0, 40)
        .map((fact) => accept(fact, `Experience ${index + 1}: technology`, (value, quote) => exactInQuote(value, quote))?.value)
        .filter((value): value is string => Boolean(value))
    }))
    .filter((item) => Boolean(item.company || item.role || item.highlights.length));

  if (!identity.fullName) warnings.push("Full name was not verified from the resume.");
  if (!identity.email) warnings.push("Email was not verified from the resume.");
  if (rejectedFacts > 0) warnings.push(`${rejectedFacts} AI-proposed fact${rejectedFacts === 1 ? " was" : "s were"} rejected because the evidence was missing, weak, or invalid.`);

  return {
    identity,
    summary,
    skills,
    education,
    experience,
    evidence,
    verifiedFacts,
    rejectedFacts,
    warnings
  };
}
