import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const FROM_EMAIL = Deno.env.get("FROM_EMAIL") ?? "noreply@innotech-hub.com";
const WEBHOOK_SECRET = Deno.env.get("WEBHOOK_SECRET");

function escapeHtml(unsafe: string) {
  return String(unsafe)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

serve(async (req) => {
  // Verify webhook secret
  const authHeader = req.headers.get("Authorization");
  if (WEBHOOK_SECRET && authHeader !== `Bearer ${WEBHOOK_SECRET}`) {
    return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401 });
  }

  // Supabase database webhook sends a POST with the inserted row
  const payload = await req.json();
  const record = payload.record ?? payload; // handle both webhook and direct call shapes

  const { reference_id, respondent_email, respondent_name } = record;

  if (!respondent_email) {
    return new Response(JSON.stringify({ skipped: "no respondent email" }), { status: 200 });
  }
  if (!RESEND_API_KEY) {
    return new Response(JSON.stringify({ error: "RESEND_API_KEY not set" }), { status: 500 });
  }

  const name = escapeHtml(respondent_name ?? "Respondent");
  const safeRef = escapeHtml(reference_id ?? "");

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from: `ITH-FORMS <${FROM_EMAIL}>`,
      to: [respondent_email],
      subject: `Your submission is confirmed — ${safeRef}`,
      html: `
        <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px;background:#0f0f1a;color:#e2e8f0;border-radius:16px;">
          <div style="margin-bottom:24px;">
            <span style="font-size:20px;font-weight:900;color:#818cf8;">ITH</span>
            <span style="font-size:11px;color:#a5b4fc;letter-spacing:0.1em;margin-left:2px;">FORMS</span>
          </div>
          <h1 style="font-size:22px;margin:0 0 8px;">Thank you, ${name}!</h1>
          <p style="color:#94a3b8;margin:0 0 24px;">Your form submission has been received and is being reviewed.</p>
          <div style="background:#1e1e2e;border:1px solid #312e81;border-radius:12px;padding:20px;text-align:center;margin-bottom:24px;">
            <p style="font-size:11px;color:#94a3b8;margin:0 0 6px;text-transform:uppercase;letter-spacing:0.1em;">Your Reference ID</p>
            <p style="font-size:28px;font-weight:700;font-family:monospace;color:#818cf8;margin:0;letter-spacing:0.08em;">${safeRef}</p>
            <p style="font-size:11px;color:#64748b;margin:6px 0 0;">Keep this safe — you may need it for follow-up</p>
          </div>
          <p style="color:#64748b;font-size:12px;margin:0;">Powered by InnoTech-Hub · Where Innovation Meets Community</p>
        </div>
      `,
    }),
  });

  const data = await res.json();
  return new Response(JSON.stringify(data), { status: res.status });
});

