export type Confidence = "high" | "medium" | "low";
export type SuggestionStatus = "direct" | "generated" | "user" | "needs_input" | "manual" | "skipped";

export interface Identity {
  fullName: string;
  email: string;
  phone: string;
  location: string;
  linkedin: string;
  website: string;
}

export interface Education {
  institution: string;
  degree: string;
  field: string;
  startDate: string;
  endDate: string;
}

export interface Experience {
  company: string;
  role: string;
  startDate: string;
  endDate: string;
  highlights: string[];
  technologies: string[];
}

export interface ApplicationPreferences {
  workAuthorization: string;
  sponsorship: string;
  relocation: string;
  salary: string;
  noticePeriod: string;
  startDate: string;
  preferredLocations: string;
}

export interface Evidence {
  id: string;
  kind: "resume" | "profile" | "preference" | "job";
  label: string;
  text: string;
}

export interface CareerProfile {
  identity: Identity;
  summary: string;
  skills: string[];
  education: Education[];
  experience: Experience[];
  preferences: ApplicationPreferences;
  resumeText: string;
  resumeFileName: string;
  evidence: Evidence[];
  updatedAt: string;
}

export interface ResumeParseResult {
  identity: Identity;
  summary: string;
  skills: string[];
  education: Education[];
  experience: Experience[];
  evidence: Evidence[];
  verifiedFacts: number;
  rejectedFacts: number;
  warnings: string[];
}

export type ProviderId =
  | "deepseek"
  | "openai"
  | "anthropic"
  | "gemini"
  | "xai"
  | "mistral"
  | "groq"
  | "openrouter"
  | "cohere"
  | "perplexity"
  | "together"
  | "fireworks"
  | "cerebras"
  | "custom";

export type ProviderFormat = "openai" | "anthropic" | "gemini" | "cohere";
export type ProviderAuth = "bearer" | "x-api-key" | "api-key" | "query-key" | "none";

export interface ProviderSettings {
  provider: ProviderId;
  model: string;
  baseUrl: string;
  format: ProviderFormat;
  authType: ProviderAuth;
}

export interface FieldOption {
  label: string;
  value: string;
}

export interface PageField {
  id: string;
  frameId: number;
  locator: string;
  tag: string;
  inputType: string;
  label: string;
  name: string;
  placeholder: string;
  required: boolean;
  maxLength: number | null;
  options: FieldOption[];
  existingValue: string;
}

export interface JobContext {
  title: string;
  company: string;
  location: string;
  description: string;
  pageTitle: string;
  url: string;
}

export interface PageAnalysis {
  tabId: number;
  fields: PageField[];
  job: JobContext;
}

export type CanonicalField =
  | "first_name"
  | "last_name"
  | "full_name"
  | "email"
  | "phone"
  | "location"
  | "linkedin"
  | "website"
  | "school"
  | "degree"
  | "field_of_study"
  | "work_authorization"
  | "sponsorship"
  | "relocation"
  | "salary"
  | "notice_period"
  | "start_date"
  | "resume_upload"
  | "sensitive_declaration"
  | "long_answer"
  | "unknown";

export interface Suggestion {
  fieldId: string;
  frameId: number;
  locator: string;
  label: string;
  required: boolean;
  canonical: CanonicalField;
  value: string;
  status: SuggestionStatus;
  confidence: Confidence;
  evidenceIds: string[];
  rationale: string;
  selected: boolean;
  maxLength: number | null;
}

export interface GeneratedAnswer {
  field_id: string;
  answer: string;
  evidence_ids: string[];
  confidence: number;
  unsupported_claims: string[];
}

export interface FillResult {
  fieldId: string;
  success: boolean;
  reason?: string;
}

export type BackgroundRequest =
  | { type: "SET_API_KEY"; provider: ProviderId; apiKey: string }
  | { type: "CLEAR_API_KEY"; provider: ProviderId }
  | { type: "HAS_API_KEY"; provider: ProviderId }
  | { type: "LIST_MODELS"; settings: ProviderSettings }
  | { type: "TEST_PROVIDER"; settings: ProviderSettings }
  | {
      type: "PARSE_RESUME";
      settings: ProviderSettings;
      resumeText: string;
      fileName: string;
    }
  | {
      type: "GENERATE_ANSWERS";
      settings: ProviderSettings;
      job: JobContext;
      questions: Array<{ fieldId: string; question: string; maxLength: number | null; evidence: Evidence[] }>;
    };

export interface BackgroundResponse<T = unknown> {
  ok: boolean;
  data?: T;
  error?: string;
}
