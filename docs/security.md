# Security Notes

## Model in brief

- **RLS everywhere.** Admin access requires an authenticated session with an
  active `admin_users` row (`is_admin()`); anon may only read published
  content. See `docs/database-schema.md` for the per-table matrix.
- **RPC-only public writes.** `submit_response` / `register_submission_file`
  (SECURITY DEFINER) are the only anon write paths — idempotent, race-safe,
  and self-validating. Direct anon INSERT policies were removed (migration
  005).
- **Files.** `submission-files` is private (admin reads via 1-hour signed
  URLs); upload paths are constrained to the submission's own folder;
  extension + size are re-validated server-side from the question config.
- **Exports.** Every cell passes formula-injection neutralisation
  (`safeCell` — leading `= + - @ | %` get a `'` prefix).
- **Auth UX hardening.** Client-side exponential backoff after 3 failed
  logins; audit rows for login/logout; session expiry redirects to login.
- **Headers.** CSP (below), `X-Frame-Options: DENY`, nosniff,
  `Referrer-Policy: strict-origin-when-cross-origin`, restrictive
  `Permissions-Policy`, HSTS with preload.

## CSP: why `script-src` has `'unsafe-inline'` and no nonce (Task 14 review)

Current policy (prod): `script-src 'self' 'unsafe-inline'`.

The review conclusion — **a nonce cannot be adopted safely on the current
stack** (TanStack Start 1.168 / Vite 8 / Nitro 3 beta):

1. TanStack Start's streaming SSR emits inline `<script>` tags for hydration
   bootstrap and streamed router state (`$_TSR` buffer pushes) as the
   response streams. The framework's server renderer in this version exposes
   **no API to stamp a per-request nonce** onto those tags (`Scripts` /
   `HeadContent` accept no nonce prop, and the streamed chunks are emitted
   outside application code).
2. Per the CSP spec, the *presence* of a nonce (or hash) in `script-src`
   makes browsers **ignore `'unsafe-inline'`**. So adding a nonce that the
   framework can't put on its own inline scripts doesn't merely warn — it
   blocks the hydration scripts and blanks the whole app. This was verified
   empirically (AwaitInner hydration crash; see the comment in
   `src/server.ts`).
3. Response-body rewriting (regex-inserting nonces into streamed HTML) was
   considered and rejected: it requires buffering/transforming the stream
   (breaking streaming), is brittle against framework output changes, and a
   malformed rewrite would fail closed on the entire app.

**Compensating controls** that keep inline-script injection low-risk here:
`default-src 'self'` (no external script hosts), `object-src 'none'`,
`base-uri 'self'`, `frame-ancestors 'none'`, `form-action 'self'`, plus no
`dangerouslySetInnerHTML`/`eval` in app code and React's default escaping.
The main XSS surface (user-provided answer text) is rendered as text nodes,
and theme URLs are sanitised before entering CSS (`theme-utils.ts`).

**Revisit when:** TanStack Start ships first-class CSP nonce support (track
the `router-core` CSP discussions). The change would be: generate a nonce per
request in `src/server.ts`, pass it through the framework API, replace
`'unsafe-inline'` with `'nonce-…'` — and delete this section.

## Known accepted risks

- Reference IDs act as capability tokens for `/view-response/…` — anyone
  with the ID sees that submission. Sequential per-form numbering makes IDs
  partially guessable; acceptable for the current use (respondent-facing
  receipts without accounts), but don't put sensitive data behind it.
- No CAPTCHA / rate limit on public submission beyond idempotency and
  `max_responses` — spam pressure is mitigated by per-form caps and the
  load characteristics of the FOR UPDATE lock. Add Supabase edge rate
  limiting or Turnstile if abuse appears.
