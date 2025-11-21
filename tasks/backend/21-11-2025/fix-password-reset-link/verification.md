Command: npx tsx --test "lib/password-reset.test.ts"

Output:
▶ normalizeBaseUrl
  ✔ adds https when protocol is missing (0.512333ms)
  ✔ trims trailing slashes (0.082792ms)
  ✔ leaves valid URL untouched (0.03825ms)
✔ normalizeBaseUrl (1.0105ms)
▶ buildResetPasswordUrl
  ✔ builds confirm URL with token and email (0.18375ms)
  ✔ uses normalized base URL and encodes token (0.097792ms)
✔ buildResetPasswordUrl (0.349417ms)
▶ resolveBaseUrl
  ✔ falls back to default when value is empty (0.122334ms)
✔ resolveBaseUrl (0.191875ms)
ℹ tests 6
ℹ suites 3
ℹ pass 6
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 137.77425
