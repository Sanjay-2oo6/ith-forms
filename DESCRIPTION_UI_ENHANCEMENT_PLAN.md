# Implementation Plan: Section Description UI Enhancement (Auto-Expanding Single Field)

## Goal
Create a single auto-expanding description field that acts as both editor AND preview - no separate boxes, no scrolling, no mode switching. The textarea itself displays formatted text and grows automatically when you press Enter.

## Current Problem
- Small fixed-height textarea (2 rows) - must scroll to see content
- Text looks plain (no formatting preview)
- Fixed height doesn't adapt to content length
- Must click Preview button to see how it will actually look

## Desired Behavior (Single Auto-Expanding Field)
1. **Single field** - No separate textarea and preview box
2. **Auto-expanding height** - Grows automatically when you press Enter or paste multi-line text
3. **Formatted display** - Text preserves spacing, newlines while typing (like contenteditable)
4. **Minimum height** - Starts with reasonable minimum (e.g., 3 rows worth)
5. **No scrollbars** - Field expands to fit all content
6. **Styled like final output** - Uses theme colors, proper text rendering

## Visual Layout (Single Field Only)

**Before** (current - 2 rows, scrollable):
```
┌─────────────────────────────────────────────┐
│ Add an optional description...              │
│ █                                           │ ← scroll to see more
└─────────────────────────────────────────────┘
```

**After** (auto-expanding, formatted):
```
┌─────────────────────────────────────────────┐
│ Please complete your payment below.         │
│                                             │
│ After payment, upload a screenshot.         │
│                                             │
│ Thank you!                                  │
│ █                                           │ ← grows automatically
└─────────────────────────────────────────────┘
```

Key: 
- Same box for input AND display
- Grows to fit content (no scrollbar)
- Preserves newlines and spacing visually
- Styled with theme colors

## Technical Approach: Auto-Height Textarea

We'll use a standard `<textarea>` with JavaScript to auto-adjust height based on content. This is simpler and more reliable than contenteditable.

### How Auto-Height Works:
1. Set `overflow: hidden` to prevent scrollbars
2. Set `resize: none` to prevent manual resize (we control height)
3. On every input event, measure `scrollHeight` and set `height`
4. Use `white-space: pre-wrap` to preserve formatting
5. Set reasonable `min-height` for empty state

## Implementation Details

### File: `src/components/form-builder/SectionBlock.tsx`

**Current Code** (lines ~90-102):
```typescript
<textarea
  value={section.description ?? ''}
  onChange={e => onUpdate({ description: e.target.value })}
  className="bg-transparent border-none outline-none text-sm text-muted-foreground resize-none"
  placeholder="Add an optional description for this section..."
  rows={2}
/>
```

**Proposed Solution**:

Add a ref and useEffect to handle auto-resize:

```typescript
// At top of component, add ref
const descriptionRef = useRef<HTMLTextAreaElement>(null);

// Add auto-resize effect
useEffect(() => {
  const textarea = descriptionRef.current;
  if (!textarea) return;
  
  // Reset height to auto to get correct scrollHeight
  textarea.style.height = 'auto';
  // Set height to scrollHeight (content height)
  textarea.style.height = textarea.scrollHeight + 'px';
}, [section.description]);

// In JSX, update textarea
<textarea
  ref={descriptionRef}
  value={section.description ?? ''}
  onChange={e => {
    onUpdate({ description: e.target.value });
    // Trigger resize immediately on input
    if (descriptionRef.current) {
      descriptionRef.current.style.height = 'auto';
      descriptionRef.current.style.height = descriptionRef.current.scrollHeight + 'px';
    }
  }}
  className="w-full bg-card border border-border/40 rounded-lg px-3 py-2 text-sm text-muted-foreground whitespace-pre-wrap resize-none overflow-hidden min-h-[80px] focus:ring-2 focus:ring-ring focus:border-transparent outline-none"
  placeholder="Add an optional description for this section..."
  rows={3}
/>
```

**Key Changes**:
1. Add `descriptionRef` with `useRef<HTMLTextAreaElement>(null)`
2. Add `useEffect` that runs when `section.description` changes
3. Add inline resize in `onChange` for immediate feedback
4. Update className:
   - `whitespace-pre-wrap` - Preserves newlines and spaces
   - `resize-none` - Prevent manual resize
   - `overflow-hidden` - No scrollbars
   - `min-h-[80px]` - Minimum height when empty
   - Add border, padding, focus states
5. Keep `rows={3}` as initial size hint

## Complete New Code Block

```typescript
export function SectionBlock({ section, questions, canDelete, onUpdate, onDelete, onAddQuestion, onAddTemplate, onUpdateQuestion, onDeleteQuestion, atLimit, lastAddedId, onClearLastAdded, isNew, onMounted, invalid, onReorderQuestions, confirm, allQuestions, allSections }: {
  // ... props types
}) {
  const [pickerRect, setPickerRect] = useState<DOMRect | null>(null);
  const qSensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
  const containerRef = useRef<HTMLDivElement | null>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const descriptionRef = useRef<HTMLTextAreaElement>(null); // ← NEW

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: section.id });

  // ← NEW: Auto-resize effect
  useEffect(() => {
    const textarea = descriptionRef.current;
    if (!textarea) return;
    
    textarea.style.height = 'auto';
    textarea.style.height = textarea.scrollHeight + 'px';
  }, [section.description]);

  useEffect(() => {
    if (isNew) {
      containerRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      titleRef.current?.focus();
      titleRef.current?.select();
      onMounted?.();
    }
  }, []);

  return (
    <div
      id={`builder-section-${section.id}`}
      ref={node => { setNodeRef(node); containerRef.current = node; }}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.6 : 1 }}
      className={`rounded-xl border bg-card overflow-hidden ${
        invalid ? "border-destructive ring-2 ring-destructive/40" : "border-border/60"
      }`}
    >
      <div className="flex items-start gap-3 px-4 py-3 border-b border-border/40 bg-secondary/30">
        <button {...attributes} {...listeners}
          className="cursor-grab active:cursor-grabbing touch-none p-0.5 -m-0.5"
          title="Drag to reorder section">
          <GripVertical className="h-4 w-4 text-muted-foreground" />
        </button>
        <div className="flex-1 flex flex-col gap-2"> {/* Changed gap-1 to gap-2 */}
          <input
            ref={titleRef}
            value={section.title}
            onChange={e => onUpdate({ title: e.target.value })}
            className="font-semibold bg-transparent border-none outline-none text-sm"
            placeholder="Section title"
          />
          <textarea
            ref={descriptionRef} // ← NEW
            value={section.description ?? ''}
            onChange={e => {
              onUpdate({ description: e.target.value });
              // ← NEW: Immediate resize
              if (descriptionRef.current) {
                descriptionRef.current.style.height = 'auto';
                descriptionRef.current.style.height = descriptionRef.current.scrollHeight + 'px';
              }
            }}
            className="w-full bg-card border border-border/40 rounded-lg px-3 py-2 text-sm text-muted-foreground whitespace-pre-wrap resize-none overflow-hidden min-h-[80px] focus:ring-2 focus:ring-ring focus:border-transparent outline-none"
            placeholder="Add an optional description for this section..."
            rows={3}
          />
        </div>
        {canDelete && (
          <button onClick={onDelete} className="p-1 hover:text-destructive transition-colors" aria-label="Delete section">
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>
      {/* ... rest of component */}
    </div>
  );
}
```

## CSS Classes Explained

- `w-full` - Full width
- `bg-card` - Card background (theme-aware)
- `border border-border/40` - Border with 40% opacity
- `rounded-lg` - Large rounded corners
- `px-3 py-2` - Padding inside
- `text-sm text-muted-foreground` - Small text, muted color
- **`whitespace-pre-wrap`** - ✨ KEY: Preserves newlines and spaces (makes it look formatted)
- **`resize-none`** - Prevent manual resize (we control height automatically)
- **`overflow-hidden`** - No scrollbars (field grows instead)
- **`min-h-[80px]`** - Minimum height when empty (roughly 3 rows)
- `focus:ring-2 focus:ring-ring focus:border-transparent` - Focus state styling
- `outline-none` - Remove default outline

## Why This Works Better

### Advantages over Two-Box Approach:
1. ✅ **Simpler** - One field instead of two
2. ✅ **Less space** - No duplicate content taking up vertical space
3. ✅ **More intuitive** - What you see is what you get (true WYSIWYG)
4. ✅ **No confusion** - User doesn't wonder if preview is synced with textarea
5. ✅ **Cleaner UI** - No "Preview:" label needed

### How It Achieves Goal:
- **Auto-expanding** - JavaScript measures content height and updates textarea height
- **Formatted display** - `whitespace-pre-wrap` makes newlines/spaces visible while typing
- **Theme styling** - Uses theme colors (bg-card, text-muted-foreground, border-border)
- **No scrolling** - `overflow-hidden` ensures field grows instead of scrolling

## Testing Checklist

After implementation:

### Visual Tests:
- [ ] Textarea starts with minimum height (80px)
- [ ] Textarea has visible border and padding
- [ ] Textarea grows when pressing Enter (adds newline)
- [ ] Textarea grows when pasting multi-line text
- [ ] Textarea shrinks when deleting lines
- [ ] No scrollbars appear inside textarea

### Formatting Tests:
- [ ] Press Enter - newline is visible (not just whitespace)
- [ ] Type multiple spaces - spaces are preserved and visible
- [ ] Paste text with newlines - formatting preserved
- [ ] Delete content - textarea shrinks back to minimum height

### Theme Tests:
- [ ] Background matches theme card color
- [ ] Text color matches theme muted foreground
- [ ] Border matches theme border color
- [ ] Focus ring appears when clicking in field

### Integration Tests:
- [ ] Auto-save still works (600ms debounce)
- [ ] Height updates on every keystroke (no lag)
- [ ] Section can still be deleted
- [ ] Section can still be reordered (drag handle works)
- [ ] Title input above description still works
- [ ] No console errors or warnings

### Public Form Tests:
- [ ] Description displays on public form with same formatting
- [ ] Multi-line descriptions work on form
- [ ] Long descriptions wrap properly on form
- [ ] Empty descriptions don't show anything on form

### Edge Cases:
- [ ] Very long description (500+ chars) - grows appropriately
- [ ] Many newlines (10+ Enter presses) - grows appropriately
- [ ] Rapid typing - height updates smoothly
- [ ] Copy/paste large text - handles without lag

## Files Modified

### Modified (1):
- `src/components/form-builder/SectionBlock.tsx`
  - Add `descriptionRef` with `useRef`
  - Add `useEffect` for auto-resize
  - Update `onChange` with inline resize
  - Update textarea className

### No New Files
Pure UI enhancement, no new components.

## Risks & Mitigation

### Risk 1: Height calculation might be off by a few pixels
**Mitigation**: The `scrollHeight` approach is standard and reliable. Setting height to 'auto' first ensures correct measurement.

### Risk 2: Performance - height recalculated on every keystroke
**Mitigation**: Modern browsers handle this efficiently. It's just measuring scrollHeight and setting style - very fast operation.

### Risk 3: Textarea might grow too large on very long descriptions
**Mitigation**: This is actually desired behavior - we want to see all content. If needed later, we can add a max-height with scroll after X pixels.

### Risk 4: whitespace-pre-wrap might not look good in builder
**Mitigation**: This is the same CSS used on public form (`$slug.tsx` line 948), so it will match exactly.

## Rollback Plan

If issues arise:
```bash
git checkout HEAD -- src/components/form-builder/SectionBlock.tsx
```

Single file change, easily reversible.

## Success Criteria

✅ **Must Have:**
1. Single textarea (no separate preview box)
2. Textarea grows automatically when adding newlines
3. Textarea shrinks when deleting content
4. Newlines and spacing are visible while typing
5. No scrollbars inside textarea
6. Auto-save still works

✅ **Nice to Have:**
1. Smooth height transitions (could add CSS transition later)
2. Max height cap (could add later if needed)

## Time Estimate

- Implementation: 3 minutes (add ref, useEffect, update className)
- Testing: 5 minutes (type, paste, resize tests)
- Total: ~8 minutes

## Dependencies

None - pure frontend change using standard React hooks.

## Comparison to Original Plan

| Aspect | Original Plan (Two Boxes) | New Plan (Single Auto-Expanding) |
|--------|---------------------------|----------------------------------|
| Number of elements | 2 (textarea + preview) | 1 (textarea only) |
| Vertical space | More (shows content twice) | Less (content shown once) |
| Complexity | Moderate (manage two elements) | Simple (one element) |
| User confusion | Possible (which to edit?) | None (obvious single field) |
| Implementation | ~7 min | ~8 min |
| Scrolling | No (preview shows all) | No (auto-grows) |

**Verdict**: New plan is simpler and more elegant! ✨

---

**Status**: ⏳ Awaiting approval to proceed with auto-expanding single field implementation