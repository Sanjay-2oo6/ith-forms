import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { uuidv4 } from "@/lib/validation";

/**
 * Integration tests for the SECURITY DEFINER RPCs and RLS boundaries.
 * Run explicitly with `npm run test:rpc` — they talk to the REAL Supabase
 * project configured in .env and create (then soft-delete) test fixtures.
 *
 * Two capability tiers:
 *   • anon-only checks always run (authorization boundaries, RPC rejections)
 *   • fixture-based checks (successful submission, idempotency, limits,
 *     closed-form) additionally need E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD
 *     so an admin session can create a disposable published form.
 *
 * Nothing here weakens or bypasses RLS: the anon client uses the public anon
 * key exactly like the real form page, and the admin client authenticates
 * through Supabase Auth exactly like the real admin panel.
 */

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL ?? "";
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? "";

const hasEnv = !!SUPABASE_URL && !!SUPABASE_ANON_KEY;
const hasAdmin = hasEnv && ADMIN_EMAIL !== "" && ADMIN_PASSWORD !== "";

function anonClient(): SupabaseClient {
  return createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

describe.skipIf(!hasEnv)("RLS authorization boundaries (anon)", () => {
  const anon = hasEnv ? anonClient() : (null as never);

  it("anon cannot read submissions", async () => {
    const { data, error } = await anon.from("submissions").select("id").limit(1);
    // Either an explicit error or an empty result — never actual rows.
    if (error) expect(error).toBeTruthy();
    else expect(data ?? []).toHaveLength(0);
  });

  it("anon cannot read audit logs", async () => {
    const { data, error } = await anon.from("audit_logs").select("id").limit(1);
    if (error) expect(error).toBeTruthy();
    else expect(data ?? []).toHaveLength(0);
  });

  it("anon cannot INSERT into submissions directly (RPC is the only write path)", async () => {
    const { error } = await anon.from("submissions").insert({
      form_id: uuidv4(),
      status: "new",
    });
    expect(error).toBeTruthy();
  });

  it("anon cannot INSERT into audit_logs (forgeable-audit hole is closed)", async () => {
    const { error } = await anon.from("audit_logs").insert({
      action: "admin.login",
      entity: "auth",
      entity_id: "spoof",
    });
    expect(error).toBeTruthy();
  });

  it("anon cannot call the admin dashboard RPC", async () => {
    const { error } = await anon.rpc("get_dashboard_stats", { p_days: 7 });
    expect(error).toBeTruthy();
  });

  it("anon cannot call get_form_responses_tabular", async () => {
    const { error } = await anon.rpc("get_form_responses_tabular", {
      p_form_id: uuidv4(),
      p_limit: 1,
      p_offset: 0,
      p_search: null,
      p_status: null,
    });
    expect(error).toBeTruthy();
  });

  it("submit_response rejects an unknown form (form_unavailable)", async () => {
    const { error } = await anon.rpc("submit_response", {
      p_form_id: uuidv4(),
      p_name: "Nobody",
      p_email: null,
      p_idempotency_key: uuidv4(),
      p_answers: [],
    });
    expect(error?.message ?? "").toContain("form_unavailable");
  });

  it("register_submission_file rejects an unknown submission", async () => {
    const { error } = await anon.rpc("register_submission_file", {
      p_submission_id: uuidv4(),
      p_question_id: uuidv4(),
      p_file_path: `${uuidv4()}/x/file.pdf`,
      p_file_name: "file.pdf",
      p_file_size: 100,
      p_mime_type: "application/pdf",
    });
    expect(error?.message ?? "").toContain("submission_not_found");
  });
});

describe.skipIf(!hasAdmin)("submit_response against a disposable published form", () => {
  const anon = hasEnv ? anonClient() : (null as never);
  let admin: SupabaseClient;
  let formId: string;
  let questionId: string;
  const createdFormIds: string[] = [];

  beforeAll(async () => {
    admin = createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { error: authErr } = await admin.auth.signInWithPassword({
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
    });
    if (authErr) throw new Error(`Admin login failed: ${authErr.message}`);

    // Disposable published form with one section + one question.
    const slug = `rpc-test-${Date.now().toString(36)}`;
    const { data: form, error: fErr } = await admin.from("forms").insert({
      title: "RPC Integration Test",
      slug,
      status: "published",
      published_at: new Date().toISOString(),
    }).select("id").single();
    if (fErr || !form) throw new Error(fErr?.message ?? "fixture form failed");
    formId = form.id;
    createdFormIds.push(formId);

    const { data: sec, error: sErr } = await admin.from("form_sections")
      .insert({ form_id: formId, title: "Section 1", position: 0 })
      .select("id").single();
    if (sErr || !sec) throw new Error(sErr?.message ?? "fixture section failed");

    const { data: q, error: qErr } = await admin.from("form_questions")
      .insert({ form_id: formId, section_id: sec.id, type: "short_text", label: "Name", position: 0 })
      .select("id").single();
    if (qErr || !q) throw new Error(qErr?.message ?? "fixture question failed");
    questionId = q.id;
  });

  afterAll(async () => {
    // Soft-delete fixtures (submissions FK is ON DELETE RESTRICT, so hard
    // deletes of submitted-to forms are blocked by design).
    for (const id of createdFormIds) {
      await admin.from("forms")
        .update({ status: "deleted", deleted_at: new Date().toISOString() })
        .eq("id", id);
    }
    await admin.auth.signOut();
  });

  it("accepts a valid submission and returns a reference id", async () => {
    const { data, error } = await anon.rpc("submit_response", {
      p_form_id: formId,
      p_name: "Integration Tester",
      p_email: "integration@example.com",
      p_idempotency_key: uuidv4(),
      p_answers: [{ question_id: questionId, value: "hello" }],
    });
    expect(error).toBeNull();
    const result = data as { submission_id: string; reference_id: string; duplicate: boolean };
    expect(result.submission_id).toBeTruthy();
    expect(result.reference_id).toBeTruthy();
    expect(result.duplicate).toBe(false);
  });

  it("is idempotent: same key returns the SAME reference, no duplicate row", async () => {
    const key = uuidv4();
    const first = await anon.rpc("submit_response", {
      p_form_id: formId, p_name: "Idem", p_email: null,
      p_idempotency_key: key,
      p_answers: [{ question_id: questionId, value: "one" }],
    });
    expect(first.error).toBeNull();
    const ref1 = (first.data as { reference_id: string }).reference_id;

    const second = await anon.rpc("submit_response", {
      p_form_id: formId, p_name: "Idem", p_email: null,
      p_idempotency_key: key,
      p_answers: [{ question_id: questionId, value: "one" }],
    });
    expect(second.error).toBeNull();
    const r2 = second.data as { reference_id: string; duplicate: boolean };
    expect(r2.reference_id).toBe(ref1);
    expect(r2.duplicate).toBe(true);
  });

  it("rejects payloads with more than 50 answers (invalid_payload)", async () => {
    const answers = Array.from({ length: 51 }, () => ({ question_id: questionId, value: "x" }));
    const { error } = await anon.rpc("submit_response", {
      p_form_id: formId, p_name: null, p_email: null,
      p_idempotency_key: uuidv4(),
      p_answers: answers,
    });
    expect(error?.message ?? "").toContain("invalid_payload");
  });

  it("silently drops answers whose question belongs to a different form", async () => {
    const { data, error } = await anon.rpc("submit_response", {
      p_form_id: formId, p_name: "Foreign Q", p_email: null,
      p_idempotency_key: uuidv4(),
      p_answers: [{ question_id: uuidv4(), value: "should be dropped" }],
    });
    expect(error).toBeNull();
    expect((data as { submission_id: string }).submission_id).toBeTruthy();
  });

  it("enforces max_responses race-safely (limit_reached)", async () => {
    // Separate 1-response form so this test can't be poisoned by others.
    const slug = `rpc-limit-${Date.now().toString(36)}`;
    const { data: form } = await admin.from("forms").insert({
      title: "RPC Limit Test", slug, status: "published",
      published_at: new Date().toISOString(), max_responses: 1,
    }).select("id").single();
    const limitFormId = form!.id as string;
    createdFormIds.push(limitFormId);
    const { data: sec } = await admin.from("form_sections")
      .insert({ form_id: limitFormId, title: "S", position: 0 }).select("id").single();
    const { data: q } = await admin.from("form_questions")
      .insert({ form_id: limitFormId, section_id: sec!.id, type: "short_text", label: "N", position: 0 })
      .select("id").single();

    // Fire two concurrent submissions at a 1-response form: exactly one wins.
    const submit = () => anon.rpc("submit_response", {
      p_form_id: limitFormId, p_name: "Racer", p_email: null,
      p_idempotency_key: uuidv4(),
      p_answers: [{ question_id: q!.id, value: "go" }],
    });
    const [a, b] = await Promise.all([submit(), submit()]);
    const errors = [a.error, b.error].filter(Boolean);
    const successes = [a, b].filter(r => !r.error);
    expect(successes).toHaveLength(1);
    expect(errors).toHaveLength(1);
    expect(errors[0]!.message).toContain("limit_reached");

    // And a third attempt is rejected outright.
    const third = await submit();
    expect(third.error?.message ?? "").toContain("limit_reached");
  });

  it("rejects submissions to a closed form (form_closed)", async () => {
    const slug = `rpc-closed-${Date.now().toString(36)}`;
    const { data: form } = await admin.from("forms").insert({
      title: "RPC Closed Test", slug, status: "published",
      published_at: new Date().toISOString(),
      closes_at: new Date(Date.now() - 60_000).toISOString(), // closed a minute ago
    }).select("id").single();
    const closedFormId = form!.id as string;
    createdFormIds.push(closedFormId);

    const { error } = await anon.rpc("submit_response", {
      p_form_id: closedFormId, p_name: null, p_email: null,
      p_idempotency_key: uuidv4(),
      p_answers: [],
    });
    expect(error?.message ?? "").toContain("form_closed");
  });

  it("register_submission_file rejects paths outside the submission's folder", async () => {
    // Create a real submission first.
    const { data } = await anon.rpc("submit_response", {
      p_form_id: formId, p_name: "File Tester", p_email: null,
      p_idempotency_key: uuidv4(),
      p_answers: [{ question_id: questionId, value: "file path check" }],
    });
    const subId = (data as { submission_id: string }).submission_id;

    const { error } = await anon.rpc("register_submission_file", {
      p_submission_id: subId,
      p_question_id: questionId,
      p_file_path: `../../etc/passwd`,
      p_file_name: "passwd",
      p_file_size: 10,
      p_mime_type: "text/plain",
    });
    expect(error?.message ?? "").toContain("invalid_path");
  });
});
