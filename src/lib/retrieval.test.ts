import { describe, expect, it } from "vitest";
import { retrieveEvidence, tokenize } from "./retrieval";
import type { Evidence, JobContext } from "./types";

const job: JobContext = {
  title: "Frontend Engineer",
  company: "Acme",
  location: "Kuala Lumpur",
  description: "Build accessible React interfaces and integrate REST APIs.",
  pageTitle: "Frontend Engineer",
  url: "https://example.test/jobs/1"
};

describe("local evidence retrieval", () => {
  it("removes filler words from the query", () => {
    expect(tokenize("Why are you a fit for the React role?")).toEqual(["fit", "react", "role"]);
  });

  it("ranks relevant career evidence above unrelated facts", () => {
    const evidence: Evidence[] = [
      { id: "react", kind: "resume", label: "Frontend project", text: "Built a React interface and connected REST APIs." },
      { id: "finance", kind: "resume", label: "Coursework", text: "Completed an accounting fundamentals course." }
    ];
    const result = retrieveEvidence({ label: "Describe your relevant frontend experience", placeholder: "" }, job, evidence);
    expect(result[0]?.id).toBe("react");
  });
});
