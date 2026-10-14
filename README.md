# ExResume

ExResume reviews the current job application, matches fields to a saved profile, drafts longer answers through the user's chosen BYOK provider, shows the resume excerpts used for each draft, and fills only selected answers.

It does not submit applications, guess personal declarations, or expose the API key to page scripts.

## What 1.4 includes

- Chrome Manifest V3 side panel with narrowly scoped `activeTab` access.
- Local PDF, DOCX, TXT, MD, and RTF resume text extraction.
- Evidence-validated AI resume extraction: every accepted field must match an exact quotation in the uploaded document.
- Automatic profile saving after resume import and while editing.
- Structured profile details for identity, resume history, skills, and application preferences.
- DOM/accessibility-aware form scanning across same-permission frames and open Shadow DOM.
- Deterministic matching for contact, education, link, and declaration fields.
- Local keyword retrieval of relevant resume evidence for narrative questions.
- Native OpenAI, Anthropic, Gemini, and Cohere API formats plus OpenAI-compatible providers.
- Built-in BYOK presets for DeepSeek, OpenAI, Anthropic Claude, Google Gemini, xAI, Mistral, Groq, OpenRouter, Cohere, Perplexity, Together AI, Fireworks AI, and Cerebras.
- Visual provider and model pickers with recognizable provider marks, recommended defaults, searchable model lists loaded from the selected provider, and a manual model-ID fallback.
- A custom provider with exact endpoint, model, API format, and authentication controls.
- Green/yellow/neutral confidence states, editable review cards, and per-answer selection.
- Native input/change events for React and ordinary HTML forms.
- No automatic submission.

## Quick install (Windows)

Build the extension (see below), then double-click `INSTALL_EXRESUME.cmd`. It opens the build folder and Chrome's extension page, and copies the folder path for you. Chrome requires one manual approval for any local extension: enable **Developer mode**, click **Load unpacked**, paste the copied path, and choose **Select Folder**.

The folder Chrome needs is the `dist` folder inside this repository.

## Build from source

Requirements: Node.js 20+ and Chrome 116+.

```powershell
npm install
npm run check
```

Then:

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Select **Load unpacked**.
4. Choose this project's `dist` directory.
5. Pin ExResume, open a job application, and click the toolbar icon.
6. Import a resume in **Profile**.
7. Choose an AI service in **Settings**, enter its API key and model, then select **Save and test**.
8. Return to **Application**, select **Scan this page**, review, and fill.

The API key is held in `chrome.storage.session`; it is cleared when Chrome restarts, the extension reloads, or the extension is disabled/updated.

## Try the sample application

```powershell
npm run demo
```

Open the shown localhost URL, load the extension, and analyze the sample form. You can import `demo/sample-resume.txt` for a complete synthetic test. If Chrome has an old unpacked build loaded, rebuild and select the refresh icon on `chrome://extensions`.

## Data flow

```text
Explicit toolbar click
        |
        v
active tab DOM --sanitized fields/job text--> trusted side panel
                                                |
Saved profile --local deterministic matches------+--> review cards
        |                                       |
        +--relevant evidence excerpts-----------+--> service worker
                                                        |
provider-specific session key --------------------------+--> selected AI API
                                                                |
validated JSON + known evidence IDs ----------------------------+
        |
        v
selected values --specific frame/field locators--> application form

User presses Submit.
```

Provider calls are made by the extension service worker. The injected scanner and filler receive neither the API key nor the full saved profile.

## Permissions

| Permission | Why it is needed |
| --- | --- |
| `activeTab` | Temporary access after the user invokes ExResume. |
| `scripting` | Scan and fill the current application on demand. |
| `sidePanel` | Keep review controls beside the application. |
| `storage` | Store the profile, settings, and session-only key. |
| Built-in provider API origins | Send requested parsing and drafting calls only to the selected built-in service. |
| Optional custom endpoint origin | Connect only after the user enters the endpoint and approves that exact host in Chrome. |

The broad custom-host patterns are optional permissions. ExResume requests only the exact origin entered by the user; they are not used for page scanning.

## Security model

- `storage.local` and `storage.session` are restricted to trusted extension contexts.
- API keys are separated by provider and stored only in session memory.
- Built-in provider traffic is pinned to official origins even if stored settings are modified.
- Custom endpoints require HTTPS, except for explicit localhost development, and Chrome asks the user to approve the endpoint origin.
- Page content is serialized as untrusted JSON data under a fixed system policy.
- AI answers are accepted only for requested field IDs and known evidence IDs.
- A generated candidate claim without evidence IDs is discarded.
- Sensitive declarations use explicit saved preferences or remain unanswered.
- File inputs and Submit controls are never filled.

See [SECURITY.md](SECURITY.md) and [PRIVACY.md](PRIVACY.md) for the full boundaries.

## Product boundaries

- Resume normalization extracts identity, common skills, links, and an education entry locally. Users can correct the saved profile.
- Retrieval uses structured lookup and local token ranking. It does not use a vector database.
- Closed Shadow DOM, canvas-only controls, CAPTCHAs, and some proprietary date pickers require manual handling.
- Resume file inputs must be selected by the user.
- Custom APIs must implement one of the supported wire formats: OpenAI Chat Completions, Anthropic Messages, Gemini `generateContent`, or Cohere Chat v2.
- ExResume does not assess whether applying is advisable and does not make legal, immigration, salary, demographic, or disability decisions.

## Development

```powershell
npm run dev       # Vite development page
npm run test      # unit tests
npm run build     # type-check and package dist/
npm run check     # tests, then production build
npm run package   # verify and create release/exresume-1.4.2.zip
```

Core modules:

- `src/lib/pageScanner.ts` - self-contained functions injected into a tab.
- `src/lib/classifier.ts` - deterministic canonical field policy.
- `src/lib/retrieval.ts` - local evidence ranking.
- `src/lib/resumeAI.ts` - exact-quotation validation for AI-extracted resume facts.
- `src/lib/suggestions.ts` - direct and generated suggestion orchestration.
- `src/lib/providers.ts` - provider catalog, endpoint pinning, and custom validation.
- `src/lib/providerClient.ts` - provider request/response adapters.
- `src/background.ts` - secret-bearing provider boundary and response validation.
- `src/sidepanel/main.tsx` - application review, profile, and settings UI.

The implementation follows Chrome's official guidance for [activeTab](https://developer.chrome.com/docs/extensions/develop/concepts/activeTab), [scripting](https://developer.chrome.com/docs/extensions/reference/api/scripting), [sidePanel](https://developer.chrome.com/docs/extensions/reference/api/sidePanel), [optional permissions](https://developer.chrome.com/docs/extensions/develop/concepts/declare-permissions), and [storage access levels](https://developer.chrome.com/docs/extensions/reference/api/storage). Provider adapters follow each service's official HTTP API format.
