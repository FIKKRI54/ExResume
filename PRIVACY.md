# Privacy

ExResume has no application backend and no telemetry in version 1.4.

## Stored locally

- Parsed resume text and evidence excerpts.
- Career identity, skills, education, experience, and saved application preferences.
- Provider model and endpoint settings.

This data is stored in the extension's local Chrome storage on the current machine and is removed when the extension is uninstalled or its storage is cleared.

API keys are stored separately for each provider in Chrome's in-memory session storage and are cleared on browser restart, extension reload/update, or disable.

## Sent to the selected provider

When the user imports a resume with a key configured or selects **Re-extract resume with AI**:

- The extracted resume text and local file name are sent to the selected provider for structured extraction.
- The provider returns proposed facts and exact supporting quotations.
- Unsupported proposals are rejected locally before the saved profile is updated.

When a scanned form contains a narrative question:

- Role title, company, location, and bounded job-description text.
- The narrative question and its length limit.
- A small set of locally retrieved resume evidence excerpts.

The full profile, unrelated browser history, raw HTML, cookies, and page credentials are not included. During resume parsing, the complete extracted resume text is included. The selected provider or custom endpoint receives the configured authorization and processes request data according to the user's agreement with that service.

Built-in services are pinned to their official API origins. A custom service receives data only after the user enters its exact endpoint and approves that origin through Chrome's permission prompt.

## Page access

ExResume requests temporary `activeTab` access only after an explicit extension action. It does not run persistently on every site.

## User control

Users can edit or remove profile data through the extension and can clear the session API key in Settings. No application is submitted by the extension.
