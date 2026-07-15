import { supabase } from "@/integrations/supabase/client";

/**
 * Duplicate a form: metadata + sections + questions (options, config,
 * positions) + theme. The copy is always created as a DRAFT with a unique
 * "<slug>-copy[-n]" slug and zero responses — submissions are never copied.
 *
 * Runs entirely through the admin's authenticated Supabase session, so RLS
 * (admin-only writes) applies exactly as it does in the form builder.
 * Returns the new form's id.
 */
export async function duplicateForm(formId: string): Promise<string> {
  // 1. Load everything that defines the form.
  const [fRes, sRes, qRes, tRes] = await Promise.all([
    supabase.from("forms").select("*").eq("id", formId).single(),
    supabase.from("form_sections").select("*").eq("form_id", formId).order("position"),
    supabase.from("form_questions").select("*").eq("form_id", formId).order("position"),
    supabase.from("form_themes").select("*").eq("form_id", formId).maybeSingle(),
  ]);
  if (fRes.error || !fRes.data) throw new Error(fRes.error?.message ?? "Form not found");
  const src = fRes.data as Record<string, unknown>;
  const sections = (sRes.data ?? []) as { id: string; title: string; description: string | null; position: number }[];
  const questions = (qRes.data ?? []) as Record<string, unknown>[];

  // 2. Find a free slug: <slug>-copy, then <slug>-copy-2, -copy-3, …
  //    One query fetches all candidates; the DB unique constraint still
  //    backstops any race (23505 handled by the caller's error path).
  const baseSlug = `${src.slug as string}-copy`;
  const { data: taken } = await supabase
    .from("forms")
    .select("slug")
    .like("slug", `${baseSlug}%`);
  const takenSet = new Set((taken ?? []).map(r => r.slug as string));
  let newSlug = baseSlug;
  for (let n = 2; takenSet.has(newSlug); n++) newSlug = `${baseSlug}-${n}`;

  // 3. Create the new form as a fresh draft.
  const { data: newForm, error: insErr } = await supabase
    .from("forms")
    .insert({
      title: `${src.title as string} (Copy)`,
      slug: newSlug,
      description: src.description ?? null,
      category: src.category ?? null,
      status: "draft",
      opens_at: src.opens_at ?? null,
      closes_at: src.closes_at ?? null,
      max_responses: src.max_responses ?? null,
      allow_anonymous: src.allow_anonymous ?? true,
      consent_text: src.consent_text ?? null,
      confirmation_title: src.confirmation_title ?? null,
      confirmation_message: src.confirmation_message ?? null,
    })
    .select("id")
    .single();
  if (insErr || !newForm) throw new Error(insErr?.message ?? "Failed to create the duplicate form");
  const newFormId = newForm.id as string;

  // 4. Copy the theme (every form gets a theme row at creation; fall back to
  //    the default preset if the source somehow has none).
  const t = tRes.data as Record<string, unknown> | null;
  const { error: themeErr } = await supabase.from("form_themes").insert(
    t
      ? {
          form_id: newFormId,
          preset: t.preset,
          primary_color: t.primary_color,
          background_color: t.background_color,
          card_color: t.card_color,
          font_family: t.font_family,
          border_radius: t.border_radius,
          form_width: t.form_width,
          bg_image_path: t.bg_image_path,
          bg_overlay_opacity: t.bg_overlay_opacity,
        }
      : { form_id: newFormId, preset: "ith-default" }
  );
  if (themeErr) throw new Error(themeErr.message);

  // 5. Copy sections in order, remembering old→new ids for the questions.
  const sectionIdMap = new Map<string, string>();
  for (const sec of sections) {
    const { data: newSec, error: secErr } = await supabase
      .from("form_sections")
      .insert({
        form_id: newFormId,
        title: sec.title,
        description: sec.description,
        position: sec.position,
      })
      .select("id")
      .single();
    if (secErr || !newSec) throw new Error(secErr?.message ?? `Failed to copy section "${sec.title}"`);
    sectionIdMap.set(sec.id, newSec.id as string);
  }

  // 6. Copy questions (options + config + position). question-media config
  //    paths still point at the source's uploaded assets in the public
  //    form-assets bucket — both forms share the same media object.
  if (questions.length > 0) {
    const rows = questions.map(q => ({
      form_id: newFormId,
      section_id: sectionIdMap.get(q.section_id as string) ?? [...sectionIdMap.values()][0],
      type: q.type,
      label: q.label,
      description: q.description ?? null,
      placeholder: q.placeholder ?? null,
      required: q.required ?? false,
      default_value: q.default_value ?? null,
      options: q.options ?? [],
      config: q.config ?? {},
      position: q.position ?? 0,
    }));
    let { error: qErr } = await supabase.from("form_questions").insert(rows);
    // Same graceful fallback as the builder if migration 017 (config) is absent.
    if (qErr && (qErr.code === "42703" || /config/i.test(qErr.message))) {
      const legacyRows = rows.map(({ config: _config, ...rest }) => rest);
      ({ error: qErr } = await supabase.from("form_questions").insert(legacyRows));
    }
    if (qErr) throw new Error(qErr.message);
  }

  // 7. Audit trail — 'form.created' is in the allowed action list.
  await supabase.from("audit_logs").insert({
    action: "form.created",
    entity: "form",
    entity_id: newFormId,
    metadata: { title: `${src.title as string} (Copy)`, duplicated_from: formId },
  });

  return newFormId;
}
