import React, { useEffect, useRef } from "react";

/**
 * Auto-expanding textarea that grows/shrinks based on content.
 * Shows formatted text with preserved newlines and spacing (WYSIWYG).
 */
export function AutoExpandTextarea({
  value,
  onChange,
  placeholder,
  rows = 3,
  className = "",
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  placeholder?: string;
  rows?: number;
  className?: string;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize effect - runs when value changes
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    textarea.style.height = "auto";
    textarea.style.height = textarea.scrollHeight + "px";
  }, [value]);

  return (
    <textarea
      ref={textareaRef}
      value={value}
      onChange={(e) => {
        onChange(e);
        // Immediate resize on input
        if (textareaRef.current) {
          textareaRef.current.style.height = "auto";
          textareaRef.current.style.height = textareaRef.current.scrollHeight + "px";
        }
      }}
      placeholder={placeholder}
      rows={rows}
      className={`whitespace-pre-wrap resize-none overflow-hidden ${className}`}
      {...props}
    />
  );
}
