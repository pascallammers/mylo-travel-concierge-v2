### Context reviewed
- Backend `knowledgeBaseTool` (`lib/tools/knowledge-base.ts`) wraps Gemini 1.5 Pro and GoogleAI File Manager. It lists files, filters state==="ACTIVE", passes them as `fileData` parts, and answers with a NOT_FOUND sentinel.
- Files are managed via admin routes (`app/api/admin/knowledge-base/*`) that call `GeminiFileManager` (`lib/gemini-file-manager.ts`). Upload saves to `/tmp`, then `uploadFile`, `list` and `delete` use Gemini server SDK.
- Search pipeline (`app/api/search/route.ts`, ~703 lines) registers `knowledge_base` in `createToolRegistry`; active tool set comes from `getGroupConfig`.
- Group config (`app/actions.ts`, `groupTools.web`) includes `knowledge_base` but system prompt makes the agent "AI web search engine" and mandates immediate tool use with web-search-centric wording. Tool choice is `auto` (model decides).
- `.env` requirements: `GOOGLE_GENERATIVE_AI_API_KEY` is mandatory at runtime; env validator enforces presence.

### Observations / suspected causes
1) Tool selection bias: System instructions lean heavily toward web search; no rule to check KB first. With `toolChoice: 'auto'`, the model likely prefers `web_search` despite KB availability.
2) No deterministic KB-first pre-check: The API never runs the KB tool before invoking the LLM; success depends on model picking the KB tool.
3) File ingestion uncertainty: We can list files via `GeminiFileManager.listFiles()`; runtime key must be set. If the key or Google files are misconfigured, the tool returns "empty" and triggers web search by design.

### Decision points for fix
- Add deterministic KB-first check in the search route (before LLM) and fall back to the regular tool stack if KB says NOT_FOUND/empty/error.
- Alternatively (or additionally) update the web-group instructions to explicitly require KB before web search to reduce tool-choice drift.

### Next steps
1) Add a lightweight KB-precheck function (reusable, DI-friendly) and call it ahead of `streamText`.
2) Tighten system instructions for `web` group to prioritize KB before web search.
3) Add unit test(s) for KB precheck behavior (mocking `GeminiFileManager` + fake model) and record test run in verification file.
