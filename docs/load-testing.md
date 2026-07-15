# Load Testing the Public Submission Flow

`load-test/submit-load.mjs` (Node 18+, zero dependencies) fires concurrent
`submit_response` calls through the same PostgREST endpoint the public form
uses — anon key, full RLS and RPC validation, nothing bypassed.

## Safety rules

- It WRITES real submissions. Use a **disposable published test form**, on a
  dev/staging project if possible. Never a production form with live data.
- Hard interlock: refuses to run unless `LT_CONFIRM=yes`.
- Cleanup afterwards: soft-delete the test form in the admin UI (Trash), or
  delete its submissions in the SQL editor.

## Setup

1. Create + publish a test form (one Short Answer question is enough).
2. Grab ids (SQL editor):
   ```sql
   SELECT id FROM forms WHERE slug = 'load-test-form';
   SELECT id FROM form_questions WHERE form_id = '<form-id>' LIMIT 1;
   ```
3. Run (PowerShell):
   ```powershell
   $env:LT_FORM_ID="<form-id>"; $env:LT_QUESTION_ID="<question-id>"
   $env:LT_TOTAL="200"; $env:LT_CONCURRENCY="20"; $env:LT_CONFIRM="yes"
   npm run loadtest
   ```
   (bash: `LT_FORM_ID=… LT_CONFIRM=yes npm run loadtest`)

## Parameters

| Env | Default | Meaning |
|---|---|---|
| `LT_SUPABASE_URL` / `LT_ANON_KEY` | from `.env` | target project |
| `LT_FORM_ID` | — (required) | published test form id |
| `LT_QUESTION_ID` | none | question to answer (empty answers otherwise) |
| `LT_TOTAL` | 100 | total requests |
| `LT_CONCURRENCY` | 10 | parallel in-flight requests |
| `LT_IDEMPOTENT_PCT` | 20 | % of requests replaying an already-used idempotency key |
| `LT_CONFIRM` | — | must be `yes` |

## What each scenario proves

- **Concurrent submissions** (`LT_CONCURRENCY` > 1): RPC stability under
  parallel writers to one form.
- **Idempotent retries** (`LT_IDEMPOTENT_PCT`): replays must come back as
  `duplicate` with the ORIGINAL reference — the `duplicate` count in the
  results should roughly match the configured percentage, and `ok + unique
  keys` must equal the number of NEW submissions on the form.
- **Response limits**: set `max_responses` on the test form lower than
  `LT_TOTAL`. Expect exactly `max_responses` × `ok`, the rest
  `limit_reached` — never an over-count (verify with
  `SELECT count(*) FROM submissions WHERE form_id = '…'`).

## Reading the results

- `ok` — new submissions accepted; `duplicate` — correct idempotent replays.
- `limit_reached` / `form_closed` / `form_not_open` — expected form-gate
  rejections when you configured them; anything `http_*` or
  `network_error:*` is a real problem (check Supabase logs / quotas).
- **Latency**: p50 is the happy path; watch **p95/p99**. `submit_response`
  takes a `FOR UPDATE` lock on the form row, so submissions to ONE form are
  intentionally serialised — p95 rising roughly linearly with concurrency on
  a single form is the race-safety design, not a defect. Real traffic
  spreads across forms; per-form throughput of tens of req/s is far beyond
  realistic form-filling rates.
- **Throughput** (req/s) is end-to-end from your machine — network latency
  to the Supabase region dominates; compare runs from the same machine only.
- Free-tier Supabase projects throttle aggressively; don't interpret 429s /
  early disconnects on free tier as application defects.
