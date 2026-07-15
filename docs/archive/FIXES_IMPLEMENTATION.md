# ITH-FORMS Fixes Implementation Guide

## Database Migration Required

**⚠️ IMPORTANT: You must run migration 007 in your Supabase Dashboard before the application will work properly.**

### How to Run Migration 007:

1. Go to your Supabase Dashboard: https://supabase.com/dashboard
2. Select your project
3. Go to **SQL Editor**
4. Click **New Query**
5. Copy the entire contents of `supabase/migrations/007_response_view_and_fixes.sql`
6. Paste into the SQL Editor
7. Click **Run** (or press Cmd/Ctrl + Enter)

This migration fixes:
- ✅ Missing RPC function for tabular responses view
- ✅ Storage policies for file downloads
- ✅ Enhanced dashboard stats with meaningful metrics
- ✅ Support for export file tracking in Files section

---

## Implementation Summary

### 1. **Responses Tabular View** ✅ (Requires Migration 007)

**New RPC Function**: `get_form_responses_tabular(form_id, limit, offset)`

Returns:
```json
{
  "submissions": [
    {
      "id": "uuid",
      "reference_id": "ITH-2026-000001",
      "status": "new",
      "respondent_name": "John Doe",
      "respondent_email": "john@example.com",
      "submitted_at": "2026-07-05T...",
      "answers": {
        "question-id-1": {
          "value": "Answer text",
          "question_label": "What is your name?",
          "question_type": "short_text",
          "question_position": 0
        }
      },
      "files": [...]
    }
  ],
  "questions": [...],
  "total_count": 42
}
```

**Frontend Implementation**: Update `src/routes/_admin/forms/$formId/responses/index.tsx`

### 2. **Dashboard Improvements** ✅ (Requires Migration 007)

**New Function**: `get_dashboard_stats(days)` - defaults to 7 days, can pass any number

Returns meaningful metrics:
- Total forms count
- Forms by status (published, draft, closed, archived)
- Submissions in period (default: 7 days)
- Active forms (forms receiving responses)
- Submission status breakdown
- Today's submissions

**Frontend Implementation**: Update `src/routes/_admin/dashboard.tsx`

### 3. **Excel Export Format** ⏳ Pending Frontend

Structure:
- Column A: Reference ID
- Columns B+: Question labels (in position order)
- Data rows: Submission answers
- Filename: `{form-slug}-responses.xlsx`
- File saved to Files section for future access

### 4. **Login Page - Show Password** ⏳ Pending Frontend

Add toggle button to show/hide password on login page.

### 5. **Form Editor Cleanup** ⏳ Pending Frontend

Remove:
- Internal Notes feature (not meaningful)
- Extra clutter
- Focus on clean, purposeful interface

### 6. **Form Status Field** ✅ Already Exists

Forms table already has `status` enum:
- `draft` - Being edited, not public
- `published` - Live and accepting responses
- `closed` - No longer accepting responses
- `archived` - Moved to archive
- `deleted` - Soft deleted

---

## Files Modified/Created

### Database:
- ✅ `supabase/migrations/007_response_view_and_fixes.sql` (NEW)

### Frontend (Pending):
- ⏳ `src/routes/_admin/forms/$formId/responses/index.tsx` - Tabular view
- ⏳ `src/routes/_admin/dashboard.tsx` - Enhanced dashboard
- ⏳ `src/routes/admin/login.tsx` - Show password toggle
- ⏳ `src/routes/_admin/forms/$formId/edit.tsx` - Remove internal notes

---

## Next Steps

1. **RUN MIGRATION 007** in Supabase Dashboard (required!)
2. Start dev server: `npm run dev`
3. Test dashboard loads correctly
4. Implement frontend changes for:
   - Tabular responses view
   - Excel export with proper structure
   - Show password on login
   - Clean up form editor

---

## Testing Checklist

After running migration and implementing frontend:

- [ ] Dashboard shows meaningful metrics
- [ ] Dashboard can toggle between 7 days and all-time
- [ ] Responses page shows data in table format
- [ ] First column is always Reference ID
- [ ] Question labels are column headers
- [ ] Excel export matches table structure
- [ ] Excel filename is `{slug}-responses.xlsx`
- [ ] Excel files appear in Files section
- [ ] Login page has show/hide password toggle
- [ ] Form editor is clean (no internal notes)
- [ ] File downloads work (no storage policy errors)
