import { describe, expect, it } from "vitest";
import { chunkEvidence, profileFromResumeText } from "./resume";

describe("local resume normalization", () => {
  it("extracts identity, links, skills, and education without an AI call", () => {
    const profile = profileFromResumeText(`
Amina Rahman
amina@example.com · +60 12 345 6789
https://linkedin.com/in/amina

SKILLS
TypeScript, React, Python, Git

EDUCATION
University of Malaya
Bachelor of Computer Science
`);
    expect(profile.identity.fullName).toBe("Amina Rahman");
    expect(profile.identity.email).toBe("amina@example.com");
    expect(profile.identity.linkedin).toContain("linkedin.com");
    expect(profile.skills).toEqual(expect.arrayContaining(["TypeScript", "React", "Python", "Git"]));
    expect(profile.education[0]?.institution).toBe("University of Malaya");
  });

  it("splits long source text into traceable evidence chunks", () => {
    const chunks = chunkEvidence("A".repeat(1900));
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks[0].id).toBe("resume-001");
    expect(chunks.every((chunk) => chunk.text.length <= 900)).toBe(true);
  });

  it("does not derive a name from an email or treat date ranges as a phone", () => {
    const profile = profileFromResumeText(`
fikribukhari54@gmail.com
EXPERIENCE
2024 - 2026 2021 - 2024 2016 - 2020
`);
    expect(profile.identity.fullName).toBe("");
    expect(profile.identity.phone).toBe("");
    expect(profile.identity.email).toBe("fikribukhari54@gmail.com");
  });
});
