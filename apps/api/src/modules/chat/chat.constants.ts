// "초당 3건 초과 차단" from the spec — a plain fixed 1s window (INCR +
// PEXPIRE) is enough here; no need for the HTTP throttler's block-duration
// escalation semantics for this simple per-second cap.
export const CHAT_RATE_LIMIT_PER_WINDOW = 3;
export const CHAT_RATE_LIMIT_WINDOW_MS = 1000;

export const CHAT_HISTORY_DEFAULT_PAGE_SIZE = 30;
export const CHAT_HISTORY_MAX_PAGE_SIZE = 100;

export const MAX_MESSAGE_LENGTH = 2000;
