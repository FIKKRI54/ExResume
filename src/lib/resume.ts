import { emptyProfile } from "./defaults";
import { isPlausiblePhone } from "./resumeAI";
import type { CareerProfile, Education, Evidence, ResumeParseResult } from "./types";

const SKILL_NAMES = [
  "JavaScript", "TypeScript", "React", "Next.js", "Vue", "Angular", "Node.js", "Express",
  "Python", "Django", "Flask", "FastAPI", "Java", "Spring", "C#", ".NET", "C++", "Go",
  "Rust", "Ruby", "Rails", "PHP", "Laravel", "SQL", "PostgreSQL", "MySQL", "MongoDB",
  "Redis", "AWS", "Azure", "GCP", "Docker", "Kubernetes", "Terraform", "Git", "GitHub",
  "REST", "GraphQL", "PyTorch", "TensorFlow", "scikit-learn", "Pandas", "NumPy", "Figma",
  "Power BI", "Tableau", "Excel", "Linux", "HTML", "CSS", "Tailwind", "Svelte"
];

function cleanText(text: string): string {
  return text
    .replace(/\r/g, "")
    .replace(/[\t ]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

async function extractPdf(file: File): Promise<string> {
  const [pdfjs, workerModule] = await Promise.all([
    import("pdfjs-dist"),
    import("pdfjs-dist/build/pdf.worker.min.mjs?url")
  ]);
  pdfjs.GlobalWorkerOptions.workerSrc = workerModule.default;
  const document = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
  const pages: string[] = [];
  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
    const page = await document.getPage(pageNumber);
    const content = await page.getTextContent();
    pages.push(
      content.items
        .map((item) => ("str" in item ? `${item.str}${item.hasEOL ? "\n" : " "}` : ""))
        .join("")
    );
  }
  return cleanText(pages.join("\n\n"));
}

export async function extractResumeText(file: File): Promise<string> {
  const extension = file.name.split(".").pop()?.toLowerCase();
  if (extension === "pdf") return extractPdf(file);
  if (extension === "docx") {
    const mammoth = await import("mammoth");
    const result = await mammoth.default.extractRawText({ arrayBuffer: await file.arrayBuffer() });
    return cleanText(result.value);
  }
  if (["txt", "md", "rtf"].includes(extension ?? "") || file.type.startsWith("text/")) {
    return cleanText(await file.text());
  }
  throw new Error("Use a PDF, DOCX, TXT, MD, or RTF resume.");
}

function firstMatch(text: string, pattern: RegExp): string {
  return text.match(pattern)?.[0]?.trim() ?? "";
}

function inferName(lines: string[]): string {
  const candidate = lines.find((line) => {
    const words = line.trim().split(/\s+/);
    return words.length >= 2
      && words.length <= 7
      && line.length <= 90
      && /^[\p{L} .'-]+$/u.test(line)
      && !/resume|curriculum|vitae|profile|summary|education|experience|skills/i.test(line);
  });
  return candidate?.trim() ?? "";
}

function inferPhone(text: string): string {
  const candidates = text.match(/\+?\d[\d\s().-]{6,}\d/g) ?? [];
  return candidates
    .map((candidate) => candidate.trim())
    .find((candidate) => isPlausiblePhone(candidate)) ?? "";
}

function inferSkills(text: string): string[] {
  return SKILL_NAMES.filter((skill) => {
    const escaped = skill.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`(^|[^a-z0-9+#])${escaped}([^a-z0-9+#]|$)`, "i").test(text);
  });
}

function inferEducation(lines: string[]): Education[] {
  const headingIndex = lines.findIndex((line) => /^education(?:al background)?$/i.test(line.trim()));
  if (headingIndex < 0) return [];
  const block = lines.slice(headingIndex + 1, headingIndex + 7).filter(Boolean);
  const institution = block.find((line) => /university|college|institute|school/i.test(line)) ?? "";
  const degreeLine = block.find((line) => /bachelor|master|ph\.?d|diploma|degree|b\.?sc|m\.?sc/i.test(line)) ?? "";
  if (!institution && !degreeLine) return [];
  const field = degreeLine
    .replace(/.*?(?:in|of)\s+/i, "")
    .replace(/\b(19|20)\d{2}.*$/, "")
    .trim();
  return [{ institution, degree: degreeLine, field, startDate: "", endDate: "" }];
}

export function chunkEvidence(text: string): Evidence[] {
  const blocks = text.split(/\n\s*\n|(?=\n[A-Z][A-Z &/]{3,}\n)/).map((part) => part.trim()).filter(Boolean);
  const chunks: string[] = [];
  for (const block of blocks) {
    if (block.length <= 900) {
      chunks.push(block);
      continue;
    }
    for (let offset = 0; offset < block.length; offset += 780) chunks.push(block.slice(offset, offset + 900));
  }
  return chunks.map((chunk, index) => ({
    id: `resume-${String(index + 1).padStart(3, "0")}`,
    kind: "resume",
    label: `Resume excerpt ${index + 1}`,
    text: chunk
  }));
}

export function profileFromResumeText(
  resumeText: string,
  fileName = "Pasted resume",
  previous: CareerProfile = emptyProfile
): CareerProfile {
  const text = cleanText(resumeText);
  const lines = text.split("\n").map((line) => line.trim()).filter(Boolean);
  const email = firstMatch(text, /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  const phone = inferPhone(text);
  const urls = text.match(/https?:\/\/[^\s)]+|(?:www\.)[^\s)]+/gi) ?? [];
  const linkedin = urls.find((url) => /linkedin\.com/i.test(url)) ?? "";
  const website = urls.find((url) => !/linkedin\.com/i.test(url)) ?? "";

  return {
    ...previous,
    identity: {
      fullName: previous.identity.fullName || inferName(lines.slice(0, 12)),
      email: previous.identity.email || email,
      phone: previous.identity.phone || phone,
      location: previous.identity.location,
      linkedin: previous.identity.linkedin || linkedin,
      website: previous.identity.website || website
    },
    skills: Array.from(new Set([...previous.skills, ...inferSkills(text)])),
    education: previous.education.length ? previous.education : inferEducation(lines),
    resumeText: text,
    resumeFileName: fileName,
    evidence: chunkEvidence(text),
    updatedAt: new Date().toISOString()
  };
}

export function profileFromAIExtraction(
  resumeText: string,
  fileName: string,
  extraction: ResumeParseResult,
  previous: CareerProfile = emptyProfile
): CareerProfile {
  const text = cleanText(resumeText);
  return {
    ...emptyProfile,
    identity: extraction.identity,
    summary: extraction.summary,
    skills: extraction.skills,
    education: extraction.education,
    experience: extraction.experience,
    preferences: previous.preferences,
    resumeText: text,
    resumeFileName: fileName,
    evidence: [...chunkEvidence(text), ...extraction.evidence],
    updatedAt: new Date().toISOString()
  };
}
