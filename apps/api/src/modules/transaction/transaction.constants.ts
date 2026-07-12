export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 50;

// Sanity ceiling for a direct chat transfer, mirroring product.constants's
// MAX_PRICE_WON — not a real business rule, just keeps a typo from moving
// an absurd amount.
export const MAX_TRANSFER_WON = 100_000_000;
