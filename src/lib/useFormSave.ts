/**
 * Form Builder Save & Publish Hook
 *
 * Handles: media upload, RPC calls, database updates, error handling.
 * Separated from component for easier testing.
 *
 * Usage:
 * ```
 * const { saveAll, publish, unpublish, isLoading } = useFormSave();
 * const result = await saveAll(form, sections, questions);
 * if (result.success) toast.success("Saved!");
 * ```
 */

import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Question, Section } from "@/components/form-builder/types";
import type { BuilderForm as Form } from "@/components/form-builder/types";

interface SaveResult {
  success: boolean;
  error?: string;
}

interface UseFormSaveOptions {
  onSuccess?: () => void;
  onError?: (error: string) => void;
}

export function useFormSave(options: UseFormSaveOptions = {}) {
  const queryClient = useQueryClient();

  /**
   * Upload any media attached to questions
   */
  const uploadPendingMedia = async (inputQuestions: Question[]): Promise<{ questions: Question[]; uploadedPaths: string[] }> => {
    const uploadedPaths: string[] = [];
    const updated: Question[] = [];

    for (const question of inputQuestions) {
      const media = question.config?.media;
      if (!media?.pendingDataUrl) {
        updated.push(question);
        continue;
      }

      try {
        const response = await fetch(media.pendingDataUrl);
        const blob = await response.blob();
        const safe = (media.pendingName ?? "media")
          .replace(/[^a-zA-Z0-9._-]/g, "_")
          .slice(0, 150);
        const path = `question-media/${question.id}/${Date.now()}-${safe}`;
        const file = new File([blob], safe, { type: media.pendingType || blob.type });

        const { error } = await supabase.storage.from("form-assets").upload(path, file, { upsert: true });
        if (error) throw new Error(`Media upload failed for "${question.label || "Untitled question"}": ${error.message}`);

        uploadedPaths.push(path);
        updated.push({
          ...question,
          config: {
            ...question.config,
            media: { path, kind: media.kind, oldPath: media.oldPath },
          },
        });
      } catch (err) {
        // Clean up any uploaded media on failure
        if (uploadedPaths.length > 0) {
          await supabase.storage.from("form-assets").remove(uploadedPaths);
        }
        throw err;
      }
    }

    return { questions: updated, uploadedPaths };
  };

  /**
   * Save form, sections, and questions to database
   */
  const saveAll = async (
    form: Form,
    sections: Section[],
    questions: Question[],
    savedQuestions: Question[]
  ): Promise<SaveResult> => {
    const uploadedPaths: string[] = [];

    try {
      // Upload media
      const mediaResult = await uploadPendingMedia(questions);
      uploadedPaths.push(...mediaResult.uploadedPaths);
      const questionsForSave = mediaResult.questions.map(stripPendingMedia);

      // Call save_form_builder RPC
      const { data, error } = await supabase.rpc("save_form_builder", {
        p_form_id: form.id,
        p_form: buildFormPayload(form),
        p_sections: sections,
        p_questions: questionsForSave,
      });

      if (error) throw new Error(error.message);
      if (!data?.ok) throw new Error("Save did not complete");

      // Clean up replaced/removed media
      const oldMediaPaths = mediaPaths(savedQuestions);
      const currentMediaPaths = mediaPaths(questionsForSave);
      const replacedOrRemoved = [...oldMediaPaths].filter(path => !currentMediaPaths.has(path));
      if (replacedOrRemoved.length > 0) {
        await supabase.storage.from("form-assets").remove(replacedOrRemoved);
      }

      options.onSuccess?.();
      return { success: true };
    } catch (err) {
      // Clean up uploaded media on failure
      if (uploadedPaths.length > 0) {
        await supabase.storage.from("form-assets").remove(uploadedPaths);
      }

      const errorMsg = err instanceof Error ? err.message : "Save failed";
      options.onError?.(errorMsg);

      // Invalidate cache so stale data doesn't persist
      await queryClient.invalidateQueries({ queryKey: ["form-meta", form.id] });

      return { success: false, error: errorMsg };
    }
  };

  /**
   * Publish form (set status to published)
   */
  const publish = async (form: Form): Promise<SaveResult> => {
    try {
      const patch: Partial<Form> = { status: "published" as never };
      if (!form.published_at) {
        (patch as { published_at?: string }).published_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from("forms")
        .update(patch as never)
        .eq("id", form.id);

      if (error) throw new Error(error.message);

      // Log publish action
      await supabase.from("audit_logs").insert({
        action: "form.published",
        entity: "form",
        entity_id: form.id,
        metadata: { title: form.title },
      });

      options.onSuccess?.();
      return { success: true };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Publish failed";
      options.onError?.(errorMsg);
      return { success: false, error: errorMsg };
    }
  };

  /**
   * Unpublish form (revert to draft status)
   */
  const unpublish = async (form: Form): Promise<SaveResult> => {
    try {
      const { error } = await supabase
        .from("forms")
        .update({ status: "draft", published_at: null } as never)
        .eq("id", form.id);

      if (error) throw new Error(error.message);

      // Log unpublish action
      await supabase.from("audit_logs").insert({
        action: "form.unpublished",
        entity: "form",
        entity_id: form.id,
        metadata: { title: form.title },
      });

      options.onSuccess?.();
      return { success: true };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Unpublish failed";
      options.onError?.(errorMsg);
      return { success: false, error: errorMsg };
    }
  };

  return {
    uploadPendingMedia,
    saveAll,
    publish,
    unpublish,
  };
}

// ─── Utility Functions ──────────────────────────────────────────────────

function buildFormPayload(form: Form) {
  return {
    title: form.title,
    description: form.description,
    opens_at: form.opens_at,
    closes_at: form.closes_at,
    max_responses: form.max_responses,
    allow_anonymous: form.allow_anonymous,
    consent_text: form.consent_text,
    confirmation_title: form.confirmation_title,
    confirmation_message: form.confirmation_message,
    responses_per_email_limit: form.responses_per_email_limit,
  };
}

function stripPendingMedia(question: Question): Question {
  const media = question.config?.media;
  if (!media) return question;
  const config = { ...question.config };
  config.media = media.path ? { path: media.path, kind: media.kind } : undefined;
  return { ...question, config };
}

function mediaPaths(inputQuestions: Question[]): Set<string> {
  const paths = new Set<string>();
  for (const question of inputQuestions) {
    const path = question.config?.media?.path;
    if (path) paths.add(path);
  }
  return paths;
}
