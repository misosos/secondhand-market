import sanitizeHtml from "sanitize-html";

// Bio and chat content are plain text with no rich-text UI in this MVP, so
// every tag is stripped rather than allowing a "safe" subset.
export function stripHtml(input: string): string {
  return sanitizeHtml(input, { allowedTags: [], allowedAttributes: {} });
}
