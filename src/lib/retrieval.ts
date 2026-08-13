import type { CareerProfile, Evidence, JobContext, PageField } from "./types";

const STOP_WORDS = new Set([
  "a", "an", "and", "are", "as", "at", "be", "by", "for", "from", "how", "i", "in", "is",
  "it", "of", "on", "or", "our", "that", "the", "their", "this", "to", "we", "what", "why", "with", "you", "your"
]);

export function tokenize(value: string): string[] {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9+#.]+/g, " ")
    .split(/\s+/)
    .filter((token) => token.length > 1 && !STOP_WORDS.has(token));
}

export function profileEvidence(profile: CareerProfile): Evidence[] {
  const structured: Evidence[] = [];
  if (profile.summary) structured.push({ id: "profile-summary", kind: "profile", label: "Career summary", text: profile.summary });
  if (profile.skills.length) structured.push({ id: "profile-skills", kind: "profile", label: "Verified skills", text: profile.skills.join(", ") });
  profile.experience.forEach((item, index) => structured.push({
    id: `experience-${index + 1}`,
    kind: "profile",
    label: `${item.role || "Role"} at ${item.company || "employer"}`,
    text: [item.role, item.company, item.startDate, item.endDate, ...item.highlights, ...item.technologies].filter(Boolean).join(" · ")
  }));
  profile.education.forEach((item, index) => structured.push({
    id: `education-${index + 1}`,
    kind: "profile",
    label: item.institution || `Education ${index + 1}`,
    text: [item.degree, item.field, item.institution, item.startDate, item.endDate].filter(Boolean).join(" · ")
  }));
  return [...structured, ...profile.evidence];
}

export function retrieveEvidence(
  field: Pick<PageField, "label" | "placeholder">,
  job: JobContext,
  evidence: Evidence[],
  limit = 5
): Evidence[] {
  const queryTokens = tokenize(`${field.label} ${field.placeholder} ${job.title} ${job.description.slice(0, 3500)}`);
  const queryCounts = new Map<string, number>();
  queryTokens.forEach((token) => queryCounts.set(token, (queryCounts.get(token) ?? 0) + 1));

  return evidence
    .map((item) => {
      const tokens = tokenize(`${item.label} ${item.text}`);
      const unique = new Set(tokens);
      let score = 0;
      unique.forEach((token) => {
        if (queryCounts.has(token)) score += 1 + Math.min(2, queryCounts.get(token) ?? 0) * 0.2;
      });
      if (/achievement|project|experience|challenge|why|suitable|fit|skills/i.test(field.label) && item.kind !== "resume") score += 0.8;
      return { item, score: score / Math.sqrt(Math.max(1, tokens.length)) };
    })
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ item }) => item);
}
