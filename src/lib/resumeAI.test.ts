import { describe, expect, it } from "vitest";
import { isPlausiblePhone, validateResumeExtraction, type RawResumeExtraction } from "./resumeAI";

const resume = `
Mohamad Fikri Bukhari
Kuala Lumpur, Malaysia
fikribukhari54@gmail.com | +60 12-345 6789

SKILLS
React, TypeScript, Python

EXPERIENCE
Frontend Intern
Northstar Labs
2024 - 2026
- Built accessible React interfaces.
`;

function fact(value: string, evidenceQuote = value, confidence = 0.95) {
  return { value, evidence_quote: evidenceQuote, confidence };
}

describe("evidence-validated AI resume extraction", () => {
  it("accepts facts copied from exact resume quotations", () => {
    const raw: RawResumeExtraction = {
      identity: {
        fullName: fact("Mohamad Fikri Bukhari"),
        email: fact("fikribukhari54@gmail.com"),
        phone: fact("+60 12-345 6789"),
        location: fact("Kuala Lumpur, Malaysia")
      },
      skills: [fact("React", "React, TypeScript, Python"), fact("TypeScript", "React, TypeScript, Python")],
      experience: [{
        role: fact("Frontend Intern"),
        company: fact("Northstar Labs"),
        startDate: fact("2024", "2024 - 2026"),
        endDate: fact("2026", "2024 - 2026"),
        highlights: [fact("Built accessible React interfaces.", "- Built accessible React interfaces.")],
        technologies: [fact("React", "Built accessible React interfaces.")]
      }]
    };

    const result = validateResumeExtraction(raw, resume);
    expect(result.identity.fullName).toBe("Mohamad Fikri Bukhari");
    expect(result.identity.phone).toBe("+60 12-345 6789");
    expect(result.skills).toEqual(["React", "TypeScript"]);
    expect(result.experience[0]?.company).toBe("Northstar Labs");
    expect(result.rejectedFacts).toBe(0);
    expect(result.verifiedFacts).toBeGreaterThan(8);
  });

  it("rejects values that are not present in the cited resume quote", () => {
    const result = validateResumeExtraction({
      identity: {
        fullName: fact("Fikribukhari54", "fikribukhari54@gmail.com"),
        phone: fact("2024 - 2026", "2024 - 2026"),
        location: fact("Singapore", "Kuala Lumpur, Malaysia")
      },
      skills: [fact("Vue", "React, TypeScript, Python")],
      experience: [{
        highlights: [fact("Led a team of ten engineers.", "Built accessible React interfaces.")]
      }]
    }, resume);

    expect(result.identity.fullName).toBe("");
    expect(result.identity.phone).toBe("");
    expect(result.identity.location).toBe("");
    expect(result.skills).toEqual([]);
    expect(result.experience).toEqual([]);
    expect(result.rejectedFacts).toBe(5);
  });

  it("rejects employment date ranges as phone numbers", () => {
    expect(isPlausiblePhone("2024 - 2026 2021 - 2024 2016 - 2020")).toBe(false);
    expect(isPlausiblePhone("+60 12-345 6789")).toBe(true);
  });
});
