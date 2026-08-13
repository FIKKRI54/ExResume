# Security

## Trust boundaries

ExResume treats job pages as untrusted input. Page text can describe a role or a question, but cannot change extension policy, request credentials, select additional profile data, trigger provider tools, or submit a form.

The API key and saved profile are available only to trusted extension pages. Programmatically injected page functions receive a narrow argument or return a sanitized result; they never receive the key or full profile.

## Prompt-injection defenses

1. The scanner extracts visible text and form semantics rather than sending raw HTML.
2. A fixed system message labels job text, field questions, and evidence as untrusted data.
3. The model has no browser or extension tools.
4. Only requested field IDs survive response validation.
5. Only evidence IDs included in that field's request survive validation.
6. Generated text with no recognized evidence IDs is discarded.
7. Sensitive declaration categories never enter the generation path.
8. The user reviews and selects answers; ExResume never presses Submit.

These controls reduce risk but do not make model output infallible. Users must review every answer.

## Resume ingestion integrity

- The resume is sent as untrusted data under a fixed extraction policy.
- The selected provider must return each proposed value with an exact quotation from the resume.
- The extension independently normalizes and locates that quotation in the extracted document text.
- Names, email addresses, phone numbers, and URLs pass additional type-specific validation.
- Names are never derived from email usernames, and pairs of employment/education years are rejected as phone numbers.
- Low-confidence, uncited, mismatched, or malformed facts are discarded before they reach the saved profile.
- The user can review and edit identity, education, experience, skills, and source text before saving.

## Secrets

- Provider keys are isolated by provider in `chrome.storage.session` and are not persisted to disk.
- Local and session storage access levels are set to `TRUSTED_CONTEXTS`.
- Provider requests originate in the service worker.
- Built-in endpoints are pinned to their official origins in code, regardless of stored values.
- A custom endpoint requires an exact user-entered URL, HTTPS except on localhost, and explicit Chrome permission for that origin.
- Keys are never written to logs by application code.

## Responsible disclosure

Do not include a real API key, resume, or applicant personal data in a report. Provide a minimal synthetic reproduction and identify the affected module and Chrome version.
