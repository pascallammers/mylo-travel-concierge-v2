File: lib/tools/knowledge-base-query.ts  
Lines: 1–78  
Summary: Added DI-friendly Gemini KB query helper that filters active files, sends NOT_FOUND-guarded prompt, and returns discriminated results.

File: lib/tools/knowledge-base-query.test.ts  
Lines: 1–66  
Summary: Added node:test coverage for KB helper covering empty, inactive, not-found, and happy-path responses.

File: lib/tools/knowledge-base.ts  
Lines: 1–41  
Summary: Refactored knowledge base tool to reuse helper, improve NOT_FOUND handling, and keep responses consistent.

File: app/actions.ts  
Lines: 302–329  
Summary: Updated web group instructions to prioritize knowledge_base before web_search and allow two-tool fallback when KB misses.

File: lib/tools/index.ts  
Lines: 1–24  
Summary: Exported the new knowledge-base query helper from the tools barrel.
