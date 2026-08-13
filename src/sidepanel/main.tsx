import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import anthropicLogo from "@lobehub/icons-static-svg/icons/anthropic.svg";
import cerebrasLogo from "@lobehub/icons-static-svg/icons/cerebras-brand-color.svg";
import cohereLogo from "@lobehub/icons-static-svg/icons/cohere-color.svg";
import deepseekLogo from "@lobehub/icons-static-svg/icons/deepseek-color.svg";
import fireworksLogo from "@lobehub/icons-static-svg/icons/fireworks-color.svg";
import geminiLogo from "@lobehub/icons-static-svg/icons/gemini-color.svg";
import groqLogo from "@lobehub/icons-static-svg/icons/groq.svg";
import mistralLogo from "@lobehub/icons-static-svg/icons/mistral-color.svg";
import openaiLogo from "@lobehub/icons-static-svg/icons/openai.svg";
import openrouterLogo from "@lobehub/icons-static-svg/icons/openrouter-color.svg";
import perplexityLogo from "@lobehub/icons-static-svg/icons/perplexity-color.svg";
import togetherLogo from "@lobehub/icons-static-svg/icons/together-brand-color.svg";
import xaiLogo from "@lobehub/icons-static-svg/icons/xai.svg";
import { analyzeActivePage, fillSuggestions } from "../lib/browser";
import { defaultProviderSettings, emptyProfile } from "../lib/defaults";
import { profileEvidence } from "../lib/retrieval";
import { extractResumeText, profileFromAIExtraction, profileFromResumeText } from "../lib/resume";
import {
  customOriginPattern,
  getModelOptions,
  getProviderDefinition,
  PROVIDERS,
  providerNeedsApiKey,
  settingsForProvider,
  validateProviderSettings
} from "../lib/providers";
import type { AvailableModel } from "../lib/providerClient";
import { getProfile, getProviderSettings, saveProfile, saveProviderSettings } from "../lib/storage";
import { addGeneratedAnswers, initialSuggestions, sendBackground } from "../lib/suggestions";
import type {
  CareerProfile,
  Evidence,
  PageAnalysis,
  ProviderAuth,
  ProviderFormat,
  ProviderId,
  ProviderSettings,
  ResumeParseResult,
  Suggestion,
  SuggestionStatus
} from "../lib/types";
import "./styles.css";

type Tab = "apply" | "profile" | "settings";
type Toast = { kind: "success" | "error" | "info"; message: string } | null;

const statusLabels: Record<SuggestionStatus, string> = {
  direct: "Profile match",
  generated: "Draft",
  user: "Edited",
  needs_input: "Needs an answer",
  manual: "Fill manually",
  skipped: "Skipped"
};

function App() {
  const [tab, setTab] = useState<Tab>("apply");
  const [profile, setProfile] = useState<CareerProfile>(emptyProfile);
  const [settings, setSettings] = useState<ProviderSettings>(defaultProviderSettings);
  const [hasApiKey, setHasApiKey] = useState(false);
  const [analysis, setAnalysis] = useState<PageAnalysis | null>(null);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [busy, setBusy] = useState<"loading" | "analyzing" | "filling" | null>("loading");
  const [toast, setToast] = useState<Toast>(null);
  const profileHydrated = useRef(false);
  const lastSavedProfile = useRef("");

  useEffect(() => {
    void (async () => {
      try {
        const [storedProfile, storedSettings] = await Promise.all([getProfile(), getProviderSettings()]);
        const keyExists = await sendBackground<boolean>({ type: "HAS_API_KEY", provider: storedSettings.provider });
        setProfile(storedProfile);
        lastSavedProfile.current = JSON.stringify(storedProfile);
        profileHydrated.current = true;
        setSettings(storedSettings);
        setHasApiKey(keyExists);
      } catch (error) {
        setToast({ kind: "error", message: error instanceof Error ? error.message : "Could not load settings." });
      } finally {
        setBusy(null);
      }
    })();
  }, []);

  useEffect(() => {
    if (!profileHydrated.current) return;
    const serialized = JSON.stringify(profile);
    if (serialized === lastSavedProfile.current) return;
    const timer = window.setTimeout(() => {
      void saveProfile(profile).then(() => {
        lastSavedProfile.current = serialized;
      }).catch((error) => {
        setToast({ kind: "error", message: `Could not save your profile: ${error instanceof Error ? error.message : "Unknown error"}` });
      });
    }, 350);
    return () => window.clearTimeout(timer);
  }, [profile]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 4500);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const handleAnalyze = async () => {
    if (!profile.resumeText && !profile.identity.email) {
      setToast({ kind: "info", message: "Add a resume or enter your profile details first." });
      setTab("profile");
      return;
    }
    setBusy("analyzing");
    setToast(null);
    try {
      const page = await analyzeActivePage();
      const initial = initialSuggestions(page, profile);
      setAnalysis(page);
      setSuggestions(initial);
      if (aiReady && initial.some((item) => item.canonical === "long_answer")) {
        try {
          setSuggestions(await addGeneratedAnswers(page, profile, settings, initial));
        } catch (error) {
          setToast({ kind: "info", message: `The form was scanned, but written answers could not be drafted: ${error instanceof Error ? error.message : "Unknown error"}` });
        }
      }
    } catch (error) {
      setToast({ kind: "error", message: error instanceof Error ? error.message : "Could not analyze this page." });
    } finally {
      setBusy(null);
    }
  };

  const handleFill = async () => {
    if (!analysis) return;
    setBusy("filling");
    try {
      const results = await fillSuggestions(analysis.tabId, suggestions);
      const succeeded = results.filter((item) => item.success).length;
      const failed = results.length - succeeded;
      setToast({
        kind: failed ? "info" : "success",
        message: failed ? `Filled ${succeeded} fields; ${failed} need manual review.` : `Filled ${succeeded} fields. Review the page before submitting.`
      });
    } catch (error) {
      setToast({ kind: "error", message: error instanceof Error ? error.message : "Could not fill this form." });
    } finally {
      setBusy(null);
    }
  };

  const evidence = useMemo(() => profileEvidence(profile), [profile]);
  const selectedCount = suggestions.filter((item) => item.selected && item.value).length;
  const aiReady = hasApiKey || !providerNeedsApiKey(settings);
  const providerName = getProviderDefinition(settings.provider).name;

  if (busy === "loading") return <LoadingScreen />;

  return (
    <div className="app-shell">
      <Header tab={tab} setTab={setTab} />
      <main>
        {tab === "apply" && (
          <ApplyView
            profile={profile}
            hasApiKey={aiReady}
            providerName={providerName}
            analysis={analysis}
            suggestions={suggestions}
            evidence={evidence}
            busy={busy}
            onAnalyze={handleAnalyze}
            onFill={handleFill}
            onChangeSuggestions={setSuggestions}
            goTo={setTab}
            selectedCount={selectedCount}
          />
        )}
        {tab === "profile" && (
          <ProfileView
            profile={profile}
            settings={settings}
            hasApiKey={aiReady}
            onProfile={setProfile}
            goToSettings={() => setTab("settings")}
            onSaved={(saved) => {
              setProfile(saved);
              setToast({ kind: "success", message: "Profile saved in Chrome." });
            }}
          />
        )}
        {tab === "settings" && (
          <SettingsView
            settings={settings}
            hasApiKey={hasApiKey}
            onSettings={setSettings}
            onKeyState={setHasApiKey}
            onToast={setToast}
          />
        )}
      </main>
      {toast && <div className={`toast ${toast.kind}`} role="status"><span>{toast.message}</span><button onClick={() => setToast(null)} aria-label="Dismiss">x</button></div>}
    </div>
  );
}

function Header({ tab, setTab }: { tab: Tab; setTab: (tab: Tab) => void }) {
  return (
    <header className="app-header">
      <div className="brand-row">
        <div className="brand-mark" aria-hidden="true"><span>E</span></div>
        <div className="brand-name">ExResume</div>
      </div>
      <nav aria-label="Extension sections">
        {(["apply", "profile", "settings"] as Tab[]).map((item) => (
          <button className={tab === item ? "active" : ""} onClick={() => setTab(item)} key={item}>
            {item === "apply" ? "Application" : item === "profile" ? "Profile" : "Settings"}
          </button>
        ))}
      </nav>
    </header>
  );
}

function ApplyView({
  profile, hasApiKey, providerName, analysis, suggestions, evidence, busy, onAnalyze, onFill, onChangeSuggestions, goTo, selectedCount
}: {
  profile: CareerProfile;
  hasApiKey: boolean;
  providerName: string;
  analysis: PageAnalysis | null;
  suggestions: Suggestion[];
  evidence: Evidence[];
  busy: "loading" | "analyzing" | "filling" | null;
  onAnalyze: () => void;
  onFill: () => void;
  onChangeSuggestions: (items: Suggestion[]) => void;
  goTo: (tab: Tab) => void;
  selectedCount: number;
}) {
  const counts = suggestions.reduce<Record<SuggestionStatus, number>>((acc, item) => {
    acc[item.status] += 1;
    return acc;
  }, { direct: 0, generated: 0, user: 0, needs_input: 0, manual: 0, skipped: 0 });
  const ready = Boolean(profile.resumeText || profile.identity.email);

  if (!analysis) {
    return (
      <section className="empty-apply">
        <div className="section-heading">
          <h1>Review this application</h1>
          <p>Scan the open form to match profile details and prepare written answers.</p>
        </div>
        <div className="readiness-card">
          <ReadinessRow status={ready ? "ready" : "needed"} label="Profile" detail={ready ? profile.resumeFileName || "Details saved" : "Add a resume or profile details"} action={() => goTo("profile")} />
          <ReadinessRow status={hasApiKey ? "ready" : "optional"} label="Written answers" detail={hasApiKey ? `${providerName} is connected` : "AI provider is optional"} action={() => goTo("settings")} />
        </div>
        <button className="primary-button analyze-button" onClick={onAnalyze} disabled={busy === "analyzing"}>
          {busy === "analyzing" ? <><Spinner /> Scanning page...</> : <><ScanIcon /> Scan this page</>}
        </button>
        <p className="permission-note">ExResume reads only the tab opened with its toolbar button.</p>
      </section>
    );
  }

  const updateSuggestion = (fieldId: string, patch: Partial<Suggestion>) => {
    onChangeSuggestions(suggestions.map((item) => item.fieldId === fieldId ? { ...item, ...patch } : item));
  };

  return (
    <section className="results-view">
      <div className="results-topline">
        <div className="job-heading"><span>Scan results</span><h1>{analysis.job.title || "Job application"}</h1><p>{[analysis.job.company, analysis.job.location].filter(Boolean).join(" / ") || new URL(analysis.job.url).hostname}</p></div>
        <button className="secondary-button scan-again" onClick={onAnalyze} disabled={busy === "analyzing"}>Scan again</button>
      </div>
      <div className="summary-strip">
        <div><strong>{suggestions.length}</strong><span>fields</span></div>
        <div className="verified"><strong>{counts.direct + counts.user}</strong><span>Ready</span></div>
        <div className="draft"><strong>{counts.generated}</strong><span>Drafts</span></div>
        <div className="attention"><strong>{counts.needs_input + counts.manual}</strong><span>Manual</span></div>
      </div>
      <div className="safety-banner"><ShieldIcon /><span>Only selected fields are filled. ExResume never submits the form.</span></div>
      {suggestions.length > 0 ? <div className="suggestion-list">
        {suggestions.map((suggestion) => (
          <SuggestionCard
            key={suggestion.fieldId}
            suggestion={suggestion}
            evidence={evidence}
            onChange={(patch) => updateSuggestion(suggestion.fieldId, patch)}
          />
        ))}
      </div> : <div className="empty-results"><strong>No supported fields found</strong><p>Move to a page with editable application fields, then scan again.</p></div>}
      <div className="sticky-actions">
        <div><strong>{selectedCount}</strong> answers selected</div>
        <button className="primary-button" disabled={!selectedCount || busy === "filling"} onClick={onFill}>
          {busy === "filling" ? <><Spinner /> Filling...</> : "Fill selected"}
        </button>
      </div>
    </section>
  );
}

function ReadinessRow({ status, label, detail, action }: { status: "ready" | "needed" | "optional"; label: string; detail: string; action?: () => void }) {
  return (
    <button className="readiness-row" onClick={action} disabled={!action}>
      <span className="readiness-copy"><strong>{label}</strong><small>{detail}</small></span>
      <span className={`readiness-state ${status}`}>{status === "ready" ? "Ready" : status === "needed" ? "Needed" : "Optional"}</span>
    </button>
  );
}

function SuggestionCard({ suggestion, evidence, onChange }: { suggestion: Suggestion; evidence: Evidence[]; onChange: (patch: Partial<Suggestion>) => void }) {
  const [open, setOpen] = useState(false);
  const sources = suggestion.evidenceIds.map((id) => evidence.find((item) => item.id === id)).filter(Boolean) as Evidence[];
  const editable = !["manual", "skipped"].includes(suggestion.status) || Boolean(suggestion.value);
  const onValue = (value: string) => onChange({
    value,
    selected: Boolean(value),
    status: "user",
    evidenceIds: [],
    rationale: "Edited in ExResume."
  });
  return (
    <article className={`suggestion-card status-${suggestion.status} ${suggestion.selected ? "selected" : ""}`}>
      <div className="suggestion-head">
        <div className="field-title"><h3>{suggestion.label}</h3><span className={`status-badge ${suggestion.status}`}>{statusLabels[suggestion.status]}</span>{suggestion.required && <span className="required">Required</span>}<span className={`confidence-label confidence-${suggestion.confidence}`}>{suggestion.confidence} confidence</span></div>
        <button
          className={`select-button ${suggestion.selected ? "on" : ""}`}
          disabled={!editable || !suggestion.value}
          onClick={() => onChange({ selected: !suggestion.selected })}
          aria-label={suggestion.selected ? "Deselect answer" : "Select answer"}
        >{suggestion.selected ? "Selected" : "Select"}</button>
      </div>
      {editable ? (
        suggestion.value.length > 100 || suggestion.canonical === "long_answer" ? (
          <textarea value={suggestion.value} maxLength={suggestion.maxLength ?? undefined} placeholder="Type an answer" onChange={(event) => onValue(event.target.value)} />
        ) : (
          <input value={suggestion.value} placeholder="Enter an answer" onChange={(event) => onValue(event.target.value)} />
        )
      ) : (
        <div className="manual-message">{suggestion.rationale}</div>
      )}
      {editable && <p className="rationale">{suggestion.rationale}</p>}
      {sources.length > 0 && (
        <button className="sources-toggle" onClick={() => setOpen(!open)}><SourceIcon /> {open ? "Hide" : "View"} {sources.length} source{sources.length === 1 ? "" : "s"}</button>
      )}
      {open && <div className="sources-list">{sources.map((source) => <div key={source.id}><strong>{source.label}</strong><p>{source.text.slice(0, 260)}{source.text.length > 260 ? "..." : ""}</p></div>)}</div>}
      {suggestion.maxLength && editable && <div className="char-count">{suggestion.value.length}/{suggestion.maxLength}</div>}
    </article>
  );
}

function ProfileView({
  profile,
  settings,
  hasApiKey,
  onProfile,
  onSaved,
  goToSettings
}: {
  profile: CareerProfile;
  settings: ProviderSettings;
  hasApiKey: boolean;
  onProfile: (profile: CareerProfile) => void;
  onSaved: (profile: CareerProfile) => void;
  goToSettings: () => void;
}) {
  const providerName = getProviderDefinition(settings.provider).name;
  const fileRef = useRef<HTMLInputElement>(null);
  const [parsing, setParsing] = useState<"reading" | "ai" | null>(null);
  const [error, setError] = useState("");
  const [skills, setSkills] = useState(profile.skills.join(", "));
  const [parseReport, setParseReport] = useState<Pick<ResumeParseResult, "verifiedFacts" | "rejectedFacts" | "warnings"> | null>(null);

  useEffect(() => setSkills(profile.skills.join(", ")), [profile.skills]);
  const identity = (key: keyof CareerProfile["identity"], value: string) => onProfile({ ...profile, identity: { ...profile.identity, [key]: value } });
  const preference = (key: keyof CareerProfile["preferences"], value: string) => onProfile({ ...profile, preferences: { ...profile.preferences, [key]: value } });
  const education = (index: number, key: keyof CareerProfile["education"][number], value: string) => onProfile({
    ...profile,
    education: profile.education.map((item, itemIndex) => itemIndex === index ? { ...item, [key]: value } : item)
  });
  const experience = (
    index: number,
    key: keyof CareerProfile["experience"][number],
    value: string | string[]
  ) => onProfile({
    ...profile,
    experience: profile.experience.map((item, itemIndex) => itemIndex === index ? { ...item, [key]: value } : item)
  });

  const parseWithAI = async (text: string, fileName: string) => {
    setParsing("ai");
    const result = await sendBackground<ResumeParseResult>({
      type: "PARSE_RESUME",
      settings,
      resumeText: text,
      fileName
    });
    const next = profileFromAIExtraction(text, fileName, result, profile);
    onProfile(next);
    await saveProfile(next);
    setParseReport({
      verifiedFacts: result.verifiedFacts,
      rejectedFacts: result.rejectedFacts,
      warnings: result.warnings
    });
  };

  const importFile = async (file?: File) => {
    if (!file) return;
    setParsing("reading"); setError(""); setParseReport(null);
    try {
      const text = await extractResumeText(file);
      const cleanBase = { ...emptyProfile, preferences: profile.preferences };
      const localProfile = profileFromResumeText(text, file.name, cleanBase);
      onProfile(localProfile);
      // Persist the local extraction before the optional network parse so the
      // resume survives even if the panel closes or AI verification fails.
      await saveProfile(localProfile);
      if (hasApiKey) {
        try {
          await parseWithAI(text, file.name);
        } catch (reason) {
          setError(`${providerName} could not parse the resume. Basic imported details are still available: ${reason instanceof Error ? reason.message : "Unknown error"}`);
        }
      } else {
        setParseReport({
          verifiedFacts: 0,
          rejectedFacts: 0,
          warnings: ["Connect an AI provider to import experience and education from matching resume quotes."]
        });
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not read this resume.");
    } finally { setParsing(null); }
  };

  const reparseWithAI = async () => {
    if (!profile.resumeText || !profile.resumeFileName) return;
    setError(""); setParseReport(null);
    try {
      await parseWithAI(profile.resumeText, profile.resumeFileName);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "AI resume parsing failed.");
    } finally { setParsing(null); }
  };

  const save = async () => {
    let next = { ...profile, skills: skills.split(/[,\n]/).map((item) => item.trim()).filter(Boolean) };
    if (next.resumeText && next.evidence.length === 0) next = profileFromResumeText(next.resumeText, next.resumeFileName || "Pasted resume", next);
    await saveProfile(next);
    onSaved(next);
  };

  return (
    <section className="form-view">
      <div className="section-heading"><h1>Your profile</h1><p>Resume details used to match application fields. Saved in this Chrome profile.</p></div>
      <div className="upload-zone" onClick={() => fileRef.current?.click()}>
        <input ref={fileRef} type="file" accept=".pdf,.docx,.txt,.md,.rtf" onChange={(event) => void importFile(event.target.files?.[0])} />
        <UploadIcon />
        <strong>{parsing === "reading" ? "Reading document..." : parsing === "ai" ? "Checking resume details..." : profile.resumeFileName || "Choose a resume"}</strong>
        <span>PDF, DOCX, TXT, MD, or RTF. Resume text is sent only when AI parsing is used.</span>
        {profile.resumeText && <small>{profile.evidence.length} resume excerpts saved</small>}
      </div>
      {error && <p className="inline-error">{error}</p>}
      {profile.resumeText && (
        <div className="ai-parse-actions">
          {hasApiKey ? (
            <button className="secondary-button" disabled={Boolean(parsing)} onClick={() => void reparseWithAI()}>
              {parsing === "ai" ? <><Spinner /> Checking resume...</> : `Parse resume with ${providerName}`}
            </button>
          ) : (
            <button className="secondary-button" onClick={goToSettings}>Connect an AI provider to parse this resume</button>
          )}
          <span>Parsed details are kept only when a matching resume quote is found.</span>
        </div>
      )}
      {parseReport && (
        <div className={`ingestion-report ${parseReport.verifiedFacts > 0 ? "verified" : "notice"}`}>
          <div className="report-heading">
            <strong>{parseReport.verifiedFacts > 0 ? `${parseReport.verifiedFacts} resume details found` : "Basic import complete"}</strong>
            {parseReport.rejectedFacts > 0 && <span>{parseReport.rejectedFacts} rejected</span>}
          </div>
          {parseReport.warnings.map((warning) => <p key={warning}>{warning}</p>)}
          <small>Review the imported fields before saving.</small>
        </div>
      )}

      <FormSection title="Contact details" subtitle="Used for matching standard application fields.">
        <Field label="Full name" value={profile.identity.fullName} onChange={(value) => identity("fullName", value)} />
        <div className="two-column"><Field label="Email" type="email" value={profile.identity.email} onChange={(value) => identity("email", value)} /><Field label="Phone" value={profile.identity.phone} onChange={(value) => identity("phone", value)} /></div>
        <Field label="Current location" value={profile.identity.location} onChange={(value) => identity("location", value)} />
        <Field label="LinkedIn URL" value={profile.identity.linkedin} onChange={(value) => identity("linkedin", value)} />
        <Field label="Portfolio / GitHub" value={profile.identity.website} onChange={(value) => identity("website", value)} />
      </FormSection>
      <FormSection title="Resume details" subtitle="Imported details must have a matching quote in the resume.">
        <Field label="Professional summary" multiline value={profile.summary} onChange={(value) => onProfile({ ...profile, summary: value })} />
        <Field label="Skills" multiline value={skills} onChange={(value) => {
          setSkills(value);
          onProfile({ ...profile, skills: value.split(/[,\n]/).map((item) => item.trim()).filter(Boolean) });
        }} hint="Separate skills with commas." />
        <div className="imported-group">
          <div className="imported-group-heading"><strong>Education</strong><span>{profile.education.length} record{profile.education.length === 1 ? "" : "s"}</span></div>
          {profile.education.map((item, index) => (
            <div className="imported-record" key={`education-${index}`}>
              <div className="record-heading"><strong>Education {index + 1}</strong><button onClick={() => onProfile({ ...profile, education: profile.education.filter((_, itemIndex) => itemIndex !== index) })}>Remove</button></div>
              <Field label="Institution" value={item.institution} onChange={(value) => education(index, "institution", value)} />
              <Field label="Degree" value={item.degree} onChange={(value) => education(index, "degree", value)} />
              <Field label="Field of study" value={item.field} onChange={(value) => education(index, "field", value)} />
              <div className="two-column"><Field label="Start date" value={item.startDate} onChange={(value) => education(index, "startDate", value)} /><Field label="End date" value={item.endDate} onChange={(value) => education(index, "endDate", value)} /></div>
            </div>
          ))}
          <button className="add-record-button" onClick={() => onProfile({ ...profile, education: [...profile.education, { institution: "", degree: "", field: "", startDate: "", endDate: "" }] })}>+ Add education</button>
        </div>
        <div className="imported-group">
          <div className="imported-group-heading"><strong>Experience</strong><span>{profile.experience.length} record{profile.experience.length === 1 ? "" : "s"}</span></div>
          {profile.experience.map((item, index) => (
            <div className="imported-record" key={`experience-${index}`}>
              <div className="record-heading"><strong>Experience {index + 1}</strong><button onClick={() => onProfile({ ...profile, experience: profile.experience.filter((_, itemIndex) => itemIndex !== index) })}>Remove</button></div>
              <div className="two-column"><Field label="Role" value={item.role} onChange={(value) => experience(index, "role", value)} /><Field label="Company" value={item.company} onChange={(value) => experience(index, "company", value)} /></div>
              <div className="two-column"><Field label="Start date" value={item.startDate} onChange={(value) => experience(index, "startDate", value)} /><Field label="End date" value={item.endDate} onChange={(value) => experience(index, "endDate", value)} /></div>
              <Field label="Resume highlights" multiline value={item.highlights.join("\n")} onChange={(value) => experience(index, "highlights", value.split("\n").map((line) => line.trim()).filter(Boolean))} hint="Enter one resume statement per line." />
              <Field label="Technologies" value={item.technologies.join(", ")} onChange={(value) => experience(index, "technologies", value.split(",").map((part) => part.trim()).filter(Boolean))} />
            </div>
          ))}
          <button className="add-record-button" onClick={() => onProfile({ ...profile, experience: [...profile.experience, { company: "", role: "", startDate: "", endDate: "", highlights: [], technologies: [] }] })}>+ Add experience</button>
        </div>
        <Field label="Resume text" multiline large value={profile.resumeText} onChange={(value) => onProfile({ ...profile, resumeText: value, evidence: [] })} hint="Pasting is a fallback when file formatting is unusual." />
      </FormSection>
      <FormSection title="Application preferences" subtitle="These answers are used only when you enter them here.">
        <SelectField label="Authorized to work in your target country?" value={profile.preferences.workAuthorization} onChange={(value) => preference("workAuthorization", value)} />
        <SelectField label="Require employer sponsorship?" value={profile.preferences.sponsorship} onChange={(value) => preference("sponsorship", value)} />
        <SelectField label="Willing to relocate?" value={profile.preferences.relocation} onChange={(value) => preference("relocation", value)} />
        <Field label="Salary preference" value={profile.preferences.salary} onChange={(value) => preference("salary", value)} hint="Include currency and period, e.g. MYR 6,000/month." />
        <div className="two-column"><Field label="Notice period" value={profile.preferences.noticePeriod} onChange={(value) => preference("noticePeriod", value)} /><Field label="Available start date" type="date" value={profile.preferences.startDate} onChange={(value) => preference("startDate", value)} /></div>
      </FormSection>
      <button className="primary-button full-button" onClick={() => void save()}>Save profile</button>
    </section>
  );
}

function FormSection({ title, subtitle, children }: React.PropsWithChildren<{ title: string; subtitle: string }>) {
  return <section className="form-section"><div className="form-section-title"><div><h2>{title}</h2><p>{subtitle}</p></div></div><div className="form-fields">{children}</div></section>;
}

function Field({ label, value, onChange, type = "text", multiline, large, hint }: { label: string; value: string; onChange: (value: string) => void; type?: string; multiline?: boolean; large?: boolean; hint?: string }) {
  return <label className="control-label"><span>{label}</span>{multiline ? <textarea className={large ? "large" : ""} value={value} onChange={(event) => onChange(event.target.value)} /> : <input type={type} value={value} onChange={(event) => onChange(event.target.value)} />}{hint && <small>{hint}</small>}</label>;
}

function SelectField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label className="control-label"><span>{label}</span><select value={value} onChange={(event) => onChange(event.target.value)}><option value="">Not answered</option><option value="Yes">Yes</option><option value="No">No</option></select></label>;
}

function SettingsView({ settings, hasApiKey, onSettings, onKeyState, onToast }: { settings: ProviderSettings; hasApiKey: boolean; onSettings: (settings: ProviderSettings) => void; onKeyState: (value: boolean) => void; onToast: (toast: Toast) => void }) {
  const [apiKey, setApiKey] = useState("");
  const [testing, setTesting] = useState(false);
  const [loadingModels, setLoadingModels] = useState(false);
  const [availableModels, setAvailableModels] = useState<AvailableModel[]>([]);
  const [modelQuery, setModelQuery] = useState("");
  const [manualModel, setManualModel] = useState(false);
  const definition = getProviderDefinition(settings.provider);
  const needsKey = providerNeedsApiKey(settings);
  const presets = getModelOptions(settings.provider);
  const models = [...new Map([
    ...presets.map((model) => [model.id, model] as const),
    ...availableModels.map((model) => [model.id, { ...model, note: "Available to your API key" }] as const)
  ]).values()];
  const filteredModels = models.filter((model) => `${model.name} ${model.id}`.toLowerCase().includes(modelQuery.trim().toLowerCase()));
  const knownModel = models.some((model) => model.id === settings.model);
  const showManualModel = settings.provider === "custom" || manualModel || (!knownModel && Boolean(settings.model));

  const chooseProvider = async (provider: ProviderId) => {
    const next = settingsForProvider(provider);
    onSettings(next);
    setApiKey("");
    setAvailableModels([]);
    setModelQuery("");
    setManualModel(provider === "custom");
    try {
      onKeyState(await sendBackground<boolean>({ type: "HAS_API_KEY", provider }));
    } catch {
      onKeyState(false);
    }
  };

  const loadModels = async () => {
    setLoadingModels(true);
    try {
      const normalized = validateProviderSettings(settings);
      if (apiKey.trim()) {
        await sendBackground({ type: "SET_API_KEY", provider: normalized.provider, apiKey });
        setApiKey("");
        onKeyState(true);
      }
      const listed = await sendBackground<AvailableModel[]>({ type: "LIST_MODELS", settings: normalized });
      setAvailableModels(listed);
      onToast({ kind: "success", message: `${listed.length} models loaded from ${definition.name}.` });
    } catch (error) {
      onToast({ kind: "error", message: error instanceof Error ? error.message : "Could not load models." });
    } finally {
      setLoadingModels(false);
    }
  };

  const persist = async (): Promise<ProviderSettings> => {
    const normalized = validateProviderSettings(settings);
    await saveProviderSettings(normalized);
    if (apiKey.trim()) {
      await sendBackground({ type: "SET_API_KEY", provider: normalized.provider, apiKey });
      setApiKey(""); onKeyState(true);
    }
    return normalized;
  };

  const test = async () => {
    setTesting(true);
    try {
      const origin = customOriginPattern(settings);
      if (origin) {
        // Keep this as the first awaited Chrome call so it retains the click's
        // user gesture, which Chrome requires for optional host permission.
        const granted = await chrome.permissions.request({ origins: [origin] });
        if (!granted) throw new Error("Chrome needs permission for this custom API host before ExResume can connect to it.");
      }
      const normalized = await persist();
      const result = await sendBackground<{ provider: string; model: string; reply: string }>({ type: "TEST_PROVIDER", settings: normalized });
      onToast({ kind: "success", message: `${result.provider} connected with ${result.model}.` });
    } catch (error) {
      onToast({ kind: "error", message: error instanceof Error ? error.message : "Connection failed." });
    } finally { setTesting(false); }
  };

  const clear = async () => {
    await sendBackground({ type: "CLEAR_API_KEY", provider: settings.provider });
    setApiKey(""); onKeyState(false); onToast({ kind: "info", message: "Session API key cleared." });
  };

  return (
    <section className="form-view settings-view">
      <div className="section-heading"><h1>AI provider</h1><p>Choose who parses resumes and drafts written answers. Profile matching still works without AI.</p></div>
      <FormSection title="Provider" subtitle="Built-in services use their official API endpoints.">
        <div className="provider-picker" role="list" aria-label="AI providers">
          {PROVIDERS.map((provider) => (
            <button type="button" role="listitem" className={`provider-option ${settings.provider === provider.id ? "selected" : ""}`} key={provider.id} onClick={() => void chooseProvider(provider.id)}>
              <ProviderLogo provider={provider.id} />
              <span><strong>{provider.name}</strong><small>{provider.id === "custom" ? "Compatible endpoint" : provider.description}</small></span>
            </button>
          ))}
        </div>
      </FormSection>
      <FormSection title="Model" subtitle="Choose a model from the list or enter an exact model ID.">
        <div className="selected-provider"><ProviderLogo provider={settings.provider} /><span><strong>{definition.name}</strong><small>{settings.model || "No model selected"}</small></span></div>
        {models.length > 5 && <label className="control-label"><span>Find a model</span><input type="search" value={modelQuery} onChange={(event) => setModelQuery(event.target.value)} placeholder="Search model name or ID" /></label>}
        <div className="model-picker" role="listbox" aria-label={`${definition.name} models`}>
          {filteredModels.map((model) => (
            <button type="button" role="option" aria-selected={!showManualModel && settings.model === model.id} className={`model-option ${!showManualModel && settings.model === model.id ? "selected" : ""}`} key={model.id} onClick={() => { onSettings({ ...settings, model: model.id }); setManualModel(false); }}>
              <ProviderLogo provider={modelLogoProvider(settings.provider, model.id)} compact />
              <span><strong>{model.name}</strong><code>{model.id}</code><small>{model.note}</small></span>
              {model.id === definition.defaultModel && <b>Recommended</b>}
            </button>
          ))}
          <button type="button" role="option" aria-selected={showManualModel} className={`model-option custom-model-option ${showManualModel ? "selected" : ""}`} onClick={() => setManualModel(true)}>
            <ProviderLogo provider="custom" compact />
            <span><strong>Custom model ID</strong><code>Enter manually</code><small>Use any model available to your account</small></span>
          </button>
        </div>
        {settings.provider !== "custom" && <button className="secondary-button load-models-button" disabled={loadingModels || (needsKey && !hasApiKey && !apiKey.trim())} onClick={() => void loadModels()}>{loadingModels ? <><Spinner /> Loading models...</> : "Load all models from provider"}</button>}
        {showManualModel && <Field label="Custom model ID" value={settings.model} onChange={(model) => onSettings({ ...settings, model })} hint="Enter the exact API model identifier." />}
        {settings.provider === "custom" && (
          <>
            <label className="control-label"><span>API format</span><select value={settings.format} onChange={(event) => onSettings({ ...settings, format: event.target.value as ProviderFormat })}><option value="openai">OpenAI Chat Completions</option><option value="anthropic">Anthropic Messages</option><option value="gemini">Google Gemini generateContent</option><option value="cohere">Cohere Chat v2</option></select></label>
            <label className="control-label"><span>Authentication</span><select value={settings.authType} onChange={(event) => onSettings({ ...settings, authType: event.target.value as ProviderAuth })}><option value="bearer">Authorization: Bearer</option><option value="x-api-key">x-api-key header</option><option value="api-key">api-key header</option><option value="query-key">?key= query parameter</option><option value="none">No API key</option></select></label>
          </>
        )}
        <label className="control-label"><span>{settings.provider === "custom" ? "Complete API endpoint" : "Official API base"}</span><input value={settings.baseUrl} readOnly={settings.provider !== "custom"} onChange={(event) => onSettings({ ...settings, baseUrl: event.target.value })} placeholder="https://llm.example.com/v1/chat/completions" /><small>{settings.provider === "custom" ? "Use the exact inference endpoint. HTTPS is required except for localhost." : "Fixed to prevent an API key from being sent to another host."}</small></label>
      </FormSection>
      <FormSection title="Credentials" subtitle="Keys are separated by provider and cleared when Chrome closes.">
        {needsKey ? (
          <label className="control-label"><span>API key</span><div className="key-input"><input type="password" autoComplete="off" value={apiKey} onChange={(event) => setApiKey(event.target.value)} placeholder={hasApiKey ? "Session key is set" : definition.keyPlaceholder} /><span className={hasApiKey ? "key-status set" : "key-status"}>{hasApiKey ? "Set" : "Empty"}</span></div><small>The key is never written to disk or exposed to job pages.</small></label>
        ) : <p className="no-key-note">This custom endpoint is configured without authentication.</p>}
      </FormSection>
      <div className="settings-actions"><button className="secondary-button" disabled={!hasApiKey || !needsKey} onClick={() => void clear()}>Clear key</button><button className="primary-button" disabled={testing || (needsKey && !hasApiKey && !apiKey.trim())} onClick={() => void test()}>{testing ? <><Spinner /> Testing...</> : "Save and test"}</button></div>
      <div className="privacy-card"><ShieldIcon /><div><strong>Data sent to {definition.name}</strong><p>Resume text is sent only when you request AI parsing. Job details and retrieved resume excerpts are sent when drafting answers. The API key and full profile are never sent to the job page.</p></div></div>
    </section>
  );
}

function LoadingScreen() { return <div className="loading-screen"><div className="brand-mark"><span>E</span></div><Spinner /><p>Loading ExResume...</p></div>; }
function Spinner() { return <span className="spinner" aria-hidden="true" />; }

const providerLogos: Partial<Record<ProviderId, string>> = {
  deepseek: deepseekLogo,
  openai: openaiLogo,
  anthropic: anthropicLogo,
  gemini: geminiLogo,
  xai: xaiLogo,
  mistral: mistralLogo,
  groq: groqLogo,
  openrouter: openrouterLogo,
  cohere: cohereLogo,
  perplexity: perplexityLogo,
  together: togetherLogo,
  fireworks: fireworksLogo,
  cerebras: cerebrasLogo
};

function modelLogoProvider(provider: ProviderId, modelId: string): ProviderId {
  if (provider !== "openrouter") return provider;
  if (modelId.startsWith("openai/")) return "openai";
  if (modelId.startsWith("anthropic/")) return "anthropic";
  if (modelId.startsWith("google/")) return "gemini";
  if (modelId.startsWith("x-ai/")) return "xai";
  if (modelId.startsWith("mistralai/")) return "mistral";
  if (modelId.startsWith("cohere/")) return "cohere";
  return provider;
}

function ProviderLogo({ provider, compact = false }: { provider: ProviderId; compact?: boolean }) {
  const label = getProviderDefinition(provider).name;
  const source = providerLogos[provider];
  return (
    <span className={`provider-mark provider-mark-${provider}${compact ? " compact" : ""}`} role="img" aria-label={`${label} logo`}>
      {source
        ? <img src={source} alt="" />
        : <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 7 3 12l5 5M16 7l5 5-5 5M14 4l-4 16" /></svg>}
    </span>
  );
}

function ScanIcon() { return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3M8 12h8" /></svg>; }
function ShieldIcon() { return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 5.5 6v5.2c0 4.2 2.8 8 6.5 9.2 3.7-1.2 6.5-5 6.5-9.2V6L12 3Z" /><path d="m9 12 2 2 4-4" /></svg>; }
function SourceIcon() { return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3h8l3 3v15H7z" /><path d="M15 3v4h4M10 12h5M10 16h5" /></svg>; }
function UploadIcon() { return <svg className="upload-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 16V4M8 8l4-4 4 4M5 14v5h14v-5" /></svg>; }

createRoot(document.getElementById("root")!).render(<React.StrictMode><App /></React.StrictMode>);
