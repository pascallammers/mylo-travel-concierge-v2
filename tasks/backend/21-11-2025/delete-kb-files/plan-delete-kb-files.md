### Goal
Make knowledge-base file deletion work from the admin UI and ensure Gemini files are removed.

### Steps
1) Update delete API to accept both POST (JSON body) and DELETE (query param) to avoid breaking existing UI.
2) Validate `name` presence and call `GeminiFileManager.deleteFile(name)`.
3) Keep response shape `{ success: true }` on success; propagate clear 400/500 errors.
4) Add quick test? (route is serverless; no existing tests—skip, keep change minimal).
5) Manual verify by reading code paths; remind to test via UI after deploy.

### Risks / Notes
- Ensure no method mismatch remains.
- Keep file ≤600 lines (currently small).
