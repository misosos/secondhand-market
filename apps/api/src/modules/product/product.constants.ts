export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 50;
export const MAX_IMAGES_PER_PRODUCT = 10;

// Sanity ceiling, not a real business rule — keeps a typo (e.g. an extra
// zero) from creating an unusable listing rather than enforcing pricing.
export const MAX_PRICE_WON = 100_000_000;
