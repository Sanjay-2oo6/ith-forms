#!/usr/bin/env node
/**
 * Load test for the public submission flow (submit_response RPC).
 *
 * Fires concurrent submissions at ONE designated test form through the same
 * PostgREST endpoint the public form uses (anon key — RLS and RPC validation
 * fully apply; nothing is bypassed).
 *
 * SAFETY:
 *   • Writes REAL rows into the target project. Point it at a local or
 *     staging Supabase project, or at a disposable test form you will
 *     soft-delete afterwards. NEVER at a production form with live data.
 *   • Refuses to run without LT_CONFIRM=yes.
 *
 * Usage (bash):
 *   LT_FORM_ID=<uuid> LT_CONFIRM=yes node load-test/submit-load.mjs
 * Usage (PowerShell):
 *   $env:LT_FORM_ID="<uuid>"; $env:LT_CONFIRM="yes"; npm run loadtest
 *
 * Environment variables:
 *   LT_SUPABASE_URL   Supabase project URL   (default: VITE_SUPABASE_URL from .env)
 *   LT_ANON_KEY       anon key               (default: VITE_SUPABASE_ANON_KEY from .env)
 *   LT_FORM_ID        REQUIRED — id of a PUBLISHED test form
 *   LT_QUESTION_ID    optional — a short_text question id to answer
 *   LT_TOTAL          total submissions        (default 100)
 *   LT_CONCURRENCY    parallel in-flight calls (default 10)
 *   LT_IDEMPOTENT_PCT % of requests that REUSE a previous idempotency key,
 *                     exercising the replay path (default 20)
 *   LT_CONFIRM        must be "yes"
 *
 * Interpreting results (see docs/load-testing.md for detail):
 *   ok          — new submissions accepted
 *   duplicate   — idempotent replays correctly returning the original ref
 *   limit_reached / form_closed — expected rejections if the form is capped
 *   other errors — investigate; should be zero on a healthy deployment
 *   p95 latency — the practical robustness number; the FOR UPDATE row lock in
 *   submit_response serialises submissions PER FORM, so very high concurrency
 *   on one form naturally queues (that is the race-safety working as designed).
 */
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function envFromDotenv(name) {
  try {
    const content = readFileSync(resolve(root, ".env"), "utf8");
    const line = content.split(/\r?\n/).find(l => l.startsWith(`${name}=`));
    return line ? line.slice(name.length + 1).trim() : undefined;
  } catch {
    return undefined;
  }
}

const URL_BASE = process.env.LT_SUPABASE_URL ?? envFromDotenv("VITE_SUPABASE_URL");
const ANON_KEY = process.env.LT_ANON_KEY ?? envFromDotenv("VITE_SUPABASE_ANON_KEY");
const FORM_ID = process.env.LT_FORM_ID;
const QUESTION_ID = process.env.LT_QUESTION_ID ?? null;
const TOTAL = parseInt(process.env.LT_TOTAL ?? "100", 10);
const CONCURRENCY = parseInt(process.env.LT_CONCURRENCY ?? "10", 10);
const IDEMPOTENT_PCT = parseInt(process.env.LT_IDEMPOTENT_PCT ?? "20", 10);

if (process.env.LT_CONFIRM !== "yes") {
  console.error("Refusing to run: set LT_CONFIRM=yes to acknowledge this writes test submissions.");
  process.exit(1);
}
if (!URL_BASE || !ANON_KEY) {
  console.error("Missing LT_SUPABASE_URL / LT_ANON_KEY (and no .env fallback found).");
  process.exit(1);
}
if (!FORM_ID) {
  console.error("Missing LT_FORM_ID — the id of a PUBLISHED disposable test form.");
  process.exit(1);
}

const endpoint = `${URL_BASE}/rest/v1/rpc/submit_response`;
const headers = {
  "Content-Type": "application/json",
  apikey: ANON_KEY,
  Authorization: `Bearer ${ANON_KEY}`,
};

const usedKeys = [];
const latencies = [];
const outcomes = new Map(); // label -> count

function record(label, ms) {
  outcomes.set(label, (outcomes.get(label) ?? 0) + 1);
  latencies.push(ms);
}

async function fireOne(i) {
  // A slice of requests replays an old idempotency key to exercise the
  // duplicate-return path under load.
  const replay = usedKeys.length > 0 && Math.random() * 100 < IDEMPOTENT_PCT;
  const key = replay
    ? usedKeys[Math.floor(Math.random() * usedKeys.length)]
    : randomUUID();
  if (!replay) usedKeys.push(key);

  const body = {
    p_form_id: FORM_ID,
    p_name: `Load Tester ${i}`,
    p_email: `load-${i}@example.com`,
    p_idempotency_key: key,
    p_answers: QUESTION_ID ? [{ question_id: QUESTION_ID, value: `run ${i}` }] : [],
  };

  const started = performance.now();
  try {
    const res = await fetch(endpoint, { method: "POST", headers, body: JSON.stringify(body) });
    const ms = performance.now() - started;
    if (res.ok) {
      const json = await res.json();
      record(json?.duplicate ? "duplicate" : "ok", ms);
    } else {
      const text = await res.text();
      const known = ["limit_reached", "form_closed", "form_unavailable", "form_not_open", "invalid_payload"]
        .find(k => text.includes(k));
      record(known ?? `http_${res.status}`, ms);
    }
  } catch (err) {
    record(`network_error:${err?.code ?? err?.message ?? "unknown"}`, performance.now() - started);
  }
}

function percentile(sorted, p) {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[idx];
}

async function main() {
  console.log(`Target: ${endpoint}`);
  console.log(`Form: ${FORM_ID} · total=${TOTAL} · concurrency=${CONCURRENCY} · idempotent replays≈${IDEMPOTENT_PCT}%`);
  const startedAt = performance.now();

  let next = 0;
  async function worker() {
    while (next < TOTAL) {
      const i = next++;
      await fireOne(i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, TOTAL) }, worker));

  const wallMs = performance.now() - startedAt;
  const sorted = [...latencies].sort((a, b) => a - b);

  console.log("\n── Results ─────────────────────────────────");
  for (const [label, count] of [...outcomes.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${label.padEnd(24)} ${count}`);
  }
  console.log("── Latency (ms) ────────────────────────────");
  console.log(`  p50  ${percentile(sorted, 50).toFixed(0)}`);
  console.log(`  p95  ${percentile(sorted, 95).toFixed(0)}`);
  console.log(`  p99  ${percentile(sorted, 99).toFixed(0)}`);
  console.log(`  max  ${(sorted.at(-1) ?? 0).toFixed(0)}`);
  console.log("── Throughput ──────────────────────────────");
  console.log(`  ${TOTAL} requests in ${(wallMs / 1000).toFixed(1)}s → ${(TOTAL / (wallMs / 1000)).toFixed(1)} req/s`);
  console.log("\nCleanup: soft-delete the test form (or delete its submissions) when done.");
}

main();
