# Form & Section Description Display - Fixed

## Changes Made

### Issue
Form descriptions and section descriptions were potentially being shown multiple times or inconsistently.

### Requirements
1. **Form description** - Should show only ONCE at the very start of the form
2. **Section descriptions** - Should show only at the beginning of each section (not repeated for every question)

### Solution Implemented

#### In `src/routes/forms/$slug.tsx`:

**Change 1: Form description display**
- Added explicit check to only show form description on first step: `{form.description && safeStep === 0 && ...}`
- This ensures it displays only when users first see the form
- In multi-step forms, it only shows on step 1

**Change 2: Section description display**
- Already correctly implemented to show only at section start
- Section title and description are in a separate container that renders once per section
- Questions are rendered below without repeating section description

#### Behavior:

**Single-Section Form:**
```
┌─────────────────────────────────┐
│ Form Title                       │
│ Form Description (shown once)    │
├─────────────────────────────────┤
│ Section Title                   │
│ Section Description             │
├─────────────────────────────────┤
│ Question 1                      │
│ Question 2                      │
│ Question 3                      │
└─────────────────────────────────┘
```

**Multi-Section Form (Step 1):**
```
┌─────────────────────────────────┐
│ Form Title                       │
│ Form Description (shown once)    │
├─────────────────────────────────┤
│ Step 1 of 3 | Section 1         │
│ [Progress Bar]                  │
├─────────────────────────────────┤
│ Section 1 Title                 │
│ Section 1 Description           │
├─────────────────────────────────┤
│ Question 1                      │
│ Question 2                      │
└─────────────────────────────────┘
```

**Multi-Section Form (Step 2):**
```
┌─────────────────────────────────┐
│ Step 2 of 3 | Section 2         │
│ [Progress Bar]                  │
├─────────────────────────────────┤
│ Section 2 Title                 │
│ Section 2 Description           │
├─────────────────────────────────┤
│ Question 4                      │
│ Question 5                      │
└─────────────────────────────────┘
```

Note: Form description is NOT shown again on step 2+ (controlled by `safeStep === 0` check)

### Code Changes

**Before:**
```tsx
// Form description in Shell header (always shown)
{form && (
  <div>
    <h1 className="text-3xl font-bold mb-1">{form.title}</h1>
    {form.description && <p className="text-muted-foreground text-sm">{form.description}</p>}
  </div>
)}

// Form description potentially shown again in body
// (no explicit guard)
```

**After:**
```tsx
{/* Form description: Only show once at the very start (on first step or first section) */}
{form.description && safeStep === 0 && (
  <div className="space-y-2 pb-4 border-b border-border/40">
    <p className="text-sm text-muted-foreground">{form.description}</p>
  </div>
)}

{/* Section description: Only shown at the start of this section */}
<div className="border-b border-border/40 pb-2">
  <h2 className="font-semibold text-lg">{sec.title}</h2>
  {sec.description && <p className="text-sm text-muted-foreground">{sec.description}</p>}
</div>
```

### What This Fixes

✅ **Form description** - Now guaranteed to show only once on step 0 (first view)  
✅ **Section descriptions** - Confirmed to show only at section start  
✅ **Multi-step forms** - Form description hidden on subsequent steps  
✅ **Clean UI** - No description repetition cluttering the form  

### Testing

1. **Single-section form**: 
   - Load form → Should see form description once at top
   - Scroll down → Should NOT see form description repeated

2. **Multi-section form**:
   - Step 1: Should see form description at top
   - Step 2: Should NOT see form description again
   - Each step: Should see its section description once at section start

3. **View response page** (`/view-response/{referenceId}`):
   - Already correctly shows form description once
   - Section titles shown only when section changes
   - No repetition of descriptions

### Files Modified

- `src/routes/forms/$slug.tsx` - Added guard for form description display
- No database changes needed
- No new migrations needed

### Deployment

1. Push to GitHub (✓ already done)
2. Deploy to production (Netlify will auto-deploy from main)
3. Test form submission
4. No cache-busting needed (logic change only)

---

## Summary

Form and section descriptions now display correctly:
- **Form description**: Once at the very beginning
- **Section descriptions**: Once at the start of each section
- **Questions**: Below their section (no description repetition)

Clean, professional UI with no duplicate description text.

