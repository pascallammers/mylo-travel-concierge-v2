### Tests
- `npx tsx --test "lib/tools/knowledge-base-query.test.ts"`

Output:
```
▶ queryKnowledgeBase
  ✔ returns empty when no files exist (0.546625ms)
  ✔ returns empty when no active files are present (0.977709ms)
  ✔ returns not_found when Gemini responds with NOT_FOUND token (case-insensitive) (0.1095ms)
  ✔ returns found with the answer text when content is present (0.066417ms)
✔ queryKnowledgeBase (2.092542ms)
ℹ tests 4
ℹ suites 1
ℹ pass 4
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 140.796417
```
