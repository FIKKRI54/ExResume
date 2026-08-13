import { deterministicSuggestion } from "./classifier";
import { profileEvidence, retrieveEvidence } from "./retrieval";
import type {
  BackgroundRequest,
  BackgroundResponse,
  CareerProfile,
  GeneratedAnswer,
  PageAnalysis,
  ProviderSettings,
  Suggestion
} from "./types";

function trimToLimit(value: string, limit: number | null): string {
  if (!limit || value.length <= limit) return value;
  const clipped = value.slice(0, Math.max(0, limit - 1));
  const boundary = clipped.lastIndexOf(" ");
  return `${clipped.slice(0, boundary > limit * 0.7 ? boundary : clipped.length).trim()}...`;
}

export async function sendBackground<T>(request: BackgroundRequest): Promise<T> {
  const response = (await chrome.runtime.sendMessage(request)) as BackgroundResponse<T>;
  if (!response?.ok) throw new Error(response?.error || "The extension service worker did not respond.");
  return response.data as T;
}

export function initialSuggestions(analysis: PageAnalysis, profile: CareerProfile): Suggestion[] {
  return analysis.fields.map((field) => deterministicSuggestion(field, profile));
}

export async function addGeneratedAnswers(
  analysis: PageAnalysis,
  profile: CareerProfile,
  settings: ProviderSettings,
  suggestions: Suggestion[]
): Promise<Suggestion[]> {
  const evidence = profileEvidence(profile);
  const questions = suggestions
    .filter((suggestion) => suggestion.canonical === "long_answer")
    .map((suggestion) => {
      const field = analysis.fields.find((item) => item.id === suggestion.fieldId)!;
      return {
        fieldId: field.id,
        question: field.label || field.placeholder || field.name,
        maxLength: field.maxLength,
        evidence: retrieveEvidence(field, analysis.job, evidence, 6)
      };
    })
    .filter((question) => question.question && question.evidence.length > 0);

  if (!questions.length) return suggestions;
  const answers = await sendBackground<GeneratedAnswer[]>({
    type: "GENERATE_ANSWERS",
    settings,
    job: analysis.job,
    questions
  });
  const byField = new Map(answers.map((answer) => [answer.field_id, answer]));

  return suggestions.map((suggestion) => {
    const answer = byField.get(suggestion.fieldId);
    if (!answer?.answer || !answer.evidence_ids.length) return suggestion;
    return {
      ...suggestion,
      value: trimToLimit(answer.answer, suggestion.maxLength),
      status: "generated",
      confidence: answer.confidence >= 0.82 ? "high" : answer.confidence >= 0.58 ? "medium" : "low",
      evidenceIds: answer.evidence_ids,
      rationale: answer.unsupported_claims.length
        ? `Review this draft: ${answer.unsupported_claims.join("; ")}`
        : "Drafted from the resume excerpts shown below.",
      selected: answer.confidence >= 0.58 && answer.unsupported_claims.length === 0
    };
  });
}
