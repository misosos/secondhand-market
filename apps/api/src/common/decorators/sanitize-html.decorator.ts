import { Transform } from "class-transformer";
import { stripHtml } from "../utils/sanitize";

// Apply to any user-authored free-text DTO field (bio, chat message content)
// so XSS payloads are stripped before validation/persistence.
export function SanitizeHtml(): PropertyDecorator {
  return Transform(({ value }) => (typeof value === "string" ? stripHtml(value) : value));
}
