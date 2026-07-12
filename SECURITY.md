# Security design notes

This file documents deliberate security trade-offs — either accepted
limitations or the reasoning behind a specific implementation — so a
checklist-style review doesn't have to be re-derived from scratch. Update
this file when the reasoning changes.

## Auth tokens: httpOnly cookies + double-submit CSRF (as of 2026-07-09)

`AuthController` issues `accessToken`/`refreshToken` as httpOnly cookies
(never in the JSON response body — see the comment on `IssuedTokens` in
`auth.service.ts`) instead of the sessionStorage/Bearer-header scheme this
replaced. `CsrfGuard` (global) enforces a double-submit cookie check on
every mutating request outside the auth-bootstrap endpoints: the frontend
reads the non-httpOnly `csrfToken` cookie and echoes it as `X-CSRF-Token`
(see `lib/api.ts`); a cross-origin attacker can't read that cookie to
forge the header.

**Trade-off knowingly accepted:** cookies are shared across every tab of
the same origin, unlike the sessionStorage this replaced. Logging into a
second account in another tab now overwrites the first tab's session —
this is a real, deliberate regression from the previous design (which used
sessionStorage specifically to avoid it), traded for httpOnly's XSS
protection and literal compliance with a cookie-based-session security
checklist. If multi-account-per-browser ever becomes a real use case,
revisit — the fix would need scoping sessions to something other than the
bare cookie (e.g. a per-tab session id echoed by the client).

WebSocket auth reads the same `accessToken` cookie off the handshake
(`ws-jwt.guard.ts`'s `extractTokenFromSocket`) rather than a client-sent
token, so the socket client no longer holds or transmits it manually
either.

## WebSocket transport encryption (WSS)

`ChatGateway.isSecureEnough` enforces TLS **only when `NODE_ENV=production`**:
it accepts the connection if `handshake.secure` is true (this process
terminates TLS itself) or the `X-Forwarded-Proto: https` header is present
(a reverse proxy — nginx/ALB/Cloudflare/etc. — terminated TLS in front of
it; virtually universal convention). Local dev (`NODE_ENV=development`) is
untouched since there's no TLS in front of it to require.

**Residual risk, by design:** if a production deployment sits behind a
proxy that does *not* set `X-Forwarded-Proto` (misconfigured or a proxy
that uses a different header), this check will incorrectly reject every
connection. There was no way to verify this against a real deployment
topology since none is decided yet — confirm the proxy sets this header
(nearly all default to it) before relying on this check in production, or
adjust `isSecureEnough` if a different proxy convention is in use.

## IP-based rate limiting behind an unconfirmed proxy topology (as of 2026-07-12)

The global `ThrottlerGuard` and the stricter per-endpoint throttles
(`LOGIN_THROTTLE`, `SIGNUP_THROTTLE`) all key on Express's `req.ip`, which
Express derives from the raw socket unless `app.set('trust proxy', ...)` is
configured — it currently isn't. Behind a reverse proxy (the same topology
the WSS section above already assumes for `X-Forwarded-Proto`), every
client's `req.ip` would collapse to the proxy's address, folding all
distinct users into a single rate-limit bucket. That breaks the
brute-force login defense's core assumption (one aggressive/failed-login
client would throttle every other user sharing the proxy) and makes
per-IP throttling meaningless.

**Deliberately left unconfigured:** same reasoning as the WSS section —
the correct `trust proxy` hop count depends on the real deployment
topology (single nginx? CDN + load balancer?), which isn't decided yet.
Setting the wrong hop count is actively worse than leaving it unset: it
can make `req.ip` trust a client-supplied `X-Forwarded-For` value,
letting an attacker spoof a fresh IP per request and bypass the login
lockout entirely. Configure `app.set('trust proxy', N)` (exact `N` =
number of trusted proxy hops in front of the API) once that topology is
fixed, and re-verify the login-lockout test scenario (6.2 in the dev
report) still behaves correctly through the real proxy chain.

## Signup-granted wallet balance (unrelated to auth, noted for completeness)

`SIGNUP_INITIAL_BALANCE` grants a virtual balance at signup with no real
payment gateway behind it — see the comment on `User.balance` in
`schema.prisma`.
