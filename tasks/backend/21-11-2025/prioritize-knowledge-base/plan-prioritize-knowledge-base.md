### Problem
User uploads Markdown FAQs to Gemini File Search but chat queries still trigger web search; KB responses are not used.

### Goal
Make the chat pipeline prefer the Gemini Knowledge Base before web search and confirm the KB path works with tests.

### Approach
1) **Extract KB query helper**  
   - Create a small, DI-friendly helper that lists files, filters ACTIVE, sends the Gemini prompt, and returns a discriminated result (`found | not_found | empty | error`).  
   - Use it inside the existing `knowledgeBaseTool` to remove duplicate logic and ease testing.
2) **Strengthen system instructions**  
   - Update `groupInstructions.web` to explicitly require calling `knowledge_base` first and allow a web search only when KB reports no hit. Relax the “only one tool” rule accordingly.
3) **Tests**  
   - Add unit tests for the helper (mock Gemini model + file manager) covering empty, inactive, NOT_FOUND, and happy-path responses.  
   - Run `npx tsx --test "lib/tools/knowledge-base*.test.ts"` and record output.

### Risks / Notes
- Keep new helper ≤600 lines and avoid bloating `app/api/search/route.ts` (already >600).
- Tests must not require real API keys—use mocks only.
- Instruction change must remain clear to avoid conflicting tool-use rules.
