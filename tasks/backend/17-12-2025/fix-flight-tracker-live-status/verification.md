## Verification

- Unit tests
  - Command:
    - `npx tsx --test "lib/tools/flight-tracker.test.ts"`
  - Note:
    - `env/server.ts` validates many required env vars; for this isolated run we used dummy env values.
  - Result:
    - pass 3 / fail 0
