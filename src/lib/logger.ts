/**
 * Structured Logging Module
 *
 * Provides consistent logging for important events:
 * - Form submissions
 * - Rate limit violations
 * - Email validation failures
 * - File uploads
 * - Admin actions
 *
 * All logs include:
 * - Timestamp (ISO format)
 * - Environment (dev/staging/production)
 * - Event type (submission, rate_limit, etc.)
 * - Relevant IDs (form_id, user_id, etc.)
 * - Metadata (searchable, contextual info)
 *
 * Logs are sent to:
 * 1. Console (local development)
 * 2. Sentry (production, if DSN configured)
 * 3. Netlify/CloudWatch (via console.log)
 */

type LogLevel = "debug" | "info" | "warn" | "error";

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  event: string;
  environment: string;
  [key: string]: any;
}

/**
 * Format structured log entry
 */
function formatLogEntry(
  level: LogLevel,
  event: string,
  metadata?: Record<string, any>
): LogEntry {
  return {
    timestamp: new Date().toISOString(),
    level,
    event,
    environment: import.meta.env.MODE || process.env.NODE_ENV || "unknown",
    ...metadata,
  };
}

/**
 * Log helper: Send to console and capture in Sentry
 */
async function sendLog(entry: LogEntry) {
  // Always log to console (appears in Netlify Functions logs)
  const logFn =
    entry.level === "error"
      ? console.error
      : entry.level === "warn"
        ? console.warn
        : console.log;
  logFn(JSON.stringify(entry));

  // Send to Sentry for important events
  if (entry.level === "error" || entry.level === "warn") {
    try {
      const { captureMessage } =
        typeof window !== "undefined"
          ? await import("./sentry").catch(() => ({ captureMessage: null }))
          : await import("./sentry").catch(() => ({ captureMessage: null }));

      if (captureMessage) {
        // Map "warn" to "warning" for Sentry compatibility
        const sentryLevel: "error" | "warning" | "info" | "debug" = 
          entry.level === "warn" ? "warning" : entry.level;
        captureMessage(entry.event, sentryLevel, entry);
      }
    } catch (_) {
      // Silently fail if Sentry not available
    }
  }
}

/**
 * Log form submission event
 */
export async function logFormSubmission(
  formId: string,
  respondentEmail: string,
  referenceId: string,
  metadata?: Record<string, any>
) {
  const entry = formatLogEntry("info", "form_submission", {
    form_id: formId,
    respondent_email: respondentEmail,
    reference_id: referenceId,
    ...metadata,
  });
  await sendLog(entry);
}

/**
 * Log rate limit violation
 */
export async function logRateLimitViolation(
  formId: string,
  email: string,
  attemptsLastHour: number,
  metadata?: Record<string, any>
) {
  const entry = formatLogEntry("warn", "rate_limit_exceeded", {
    form_id: formId,
    email,
    attempts_last_hour: attemptsLastHour,
    ...metadata,
  });
  await sendLog(entry);
}

/**
 * Log email validation failure (tampering attempt)
 */
export async function logEmailValidationFailure(
  formId: string,
  submittedEmail: string,
  sessionEmail: string,
  userId: string,
  metadata?: Record<string, any>
) {
  const entry = formatLogEntry("warn", "email_validation_failed", {
    form_id: formId,
    submitted_email: submittedEmail,
    session_email: sessionEmail,
    user_id: userId,
    ...metadata,
  });
  await sendLog(entry);
}

/**
 * Log file upload event
 */
export async function logFileUpload(
  submissionId: string,
  formId: string,
  fileName: string,
  fileSize: number,
  mimeType: string,
  metadata?: Record<string, any>
) {
  const entry = formatLogEntry("info", "file_upload", {
    submission_id: submissionId,
    form_id: formId,
    file_name: fileName,
    file_size_bytes: fileSize,
    mime_type: mimeType,
    ...metadata,
  });
  await sendLog(entry);
}

/**
 * Log file path traversal attempt (security event)
 */
export async function logFilePathTraversalAttempt(
  submissionId: string,
  formId: string,
  attemptedPath: string,
  metadata?: Record<string, any>
) {
  const entry = formatLogEntry("error", "file_path_traversal_attempt", {
    submission_id: submissionId,
    form_id: formId,
    attempted_path: attemptedPath,
    ...metadata,
  });
  await sendLog(entry);
}

/**
 * Log admin action
 */
export async function logAdminAction(
  action: string,
  actorEmail: string,
  entityType: string,
  entityId: string,
  metadata?: Record<string, any>
) {
  const entry = formatLogEntry("info", "admin_action", {
    action,
    actor_email: actorEmail,
    entity_type: entityType,
    entity_id: entityId,
    ...metadata,
  });
  await sendLog(entry);
}

/**
 * Log generic event
 */
export async function logEvent(
  event: string,
  level: LogLevel = "info",
  metadata?: Record<string, any>
) {
  const entry = formatLogEntry(level, event, metadata);
  await sendLog(entry);
}
