import type { QuestionType } from "@/lib/question-types";

// Shared shapes for the form builder. These mirror the DB rows exactly
// (forms / form_sections / form_questions) — the builder mutates them
// optimistically and persists via Supabase in the route component.

export type Section = {
  id: string;
  title: string;
  description: string | null;
  position: number;
};

export type QuestionConfig = {
  accept?: string[]; maxFiles?: number; maxSizeMB?: number; // file (#11)
  ratingMax?: number;                            // rating
  minLength?: number; maxLength?: number;        // text
  minSelections?: number; maxSelections?: number;// checkbox
  rows?: string[]; cols?: string[];              // grid
  media?: {
    path?: string;
    kind: "image" | "video";
    pendingDataUrl?: string;
    pendingName?: string;
    pendingType?: string;
    oldPath?: string;
  }; // #10 question media
};

export type Question = {
  id: string;
  section_id: string;
  type: QuestionType;
  label: string;
  description: string | null;
  placeholder: string | null;
  required: boolean;
  default_value: string | null;
  options: { label: string; value: string }[];
  config: QuestionConfig;
  position: number;
};

export type BuilderForm = {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  status: string;
  opens_at: string | null;
  closes_at: string | null;
  max_responses: number | null;
  responses_per_email_limit: number | null;
  allow_anonymous: boolean;
  consent_text: string | null;
  confirmation_title: string | null;
  confirmation_message: string | null;
  published_at: string | null;
};

export type BuilderPreviewDraft = {
  form: BuilderForm;
  sections: Section[];
  questions: Question[];
  createdAt: number;
};

export type SaveState = "idle" | "dirty" | "saving" | "saved" | "error";
