export const REPORT_REASON_MAX_LENGTH = 1000;

// Looser than login, but still bounds how fast a single account can fire
// off reports (see report.service.ts's assertReporterEligible for the
// other half of abuse mitigation).
export const REPORT_THROTTLE = { limit: 10, ttl: 60_000 };

// Minimal sockpuppet friction: a freshly created account can't immediately
// file reports. Doesn't stop an attacker who ages accounts in advance —
// see the comment in report.service.ts for why deeper collusion detection
// (IP/device fingerprinting) is out of scope for this schema.
export const MIN_REPORTER_ACCOUNT_AGE_MS = 10 * 60 * 1000;
