### Context reviewed
- UI at `app/admin/knowledge-base/page.tsx` calls `/api/admin/knowledge-base/delete` with **POST** JSON `{ name }`.
- API endpoint `app/api/admin/knowledge-base/delete/route.ts` only implements **DELETE** and expects `name` in query string (`?name=`).
- Deletion uses `GeminiFileManager.deleteFile(name)`; no DB involvement beyond Gemini File API.

### Problem
- Method + payload mismatch makes UI deletion fail.

### Options
1) Change frontend to issue DELETE with query param.
2) Broaden API to accept POST JSON and DELETE query param for backward compatibility (safer to avoid client cache issues).

Decision: Implement option 2 (more resilient, minimal surface area).
