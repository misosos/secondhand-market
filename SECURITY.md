# Security design notes

This file documents deliberate security trade-offs that a checklist-style
review will flag as "missing" if read literally, along with why the current
behavior is the intended one. Each note exists because the alternative was
evaluated and rejected for a concrete reason — update this file if that
reasoning changes.

## Auth tokens: Bearer + sessionStorage, not httpOnly cookies

`apps/web/src/lib/api.ts` returns JWTs in the response body and stores them
in `sessionStorage`, sent back via an `Authorization: Bearer` header. A
cookie-based session (`httpOnly`/`Secure` flags, CSRF token) is the more
common pattern and was considered, but rejected:

- **Why not cookies:** cookies are shared across every tab of the same
  origin. Logging into a second account in another tab would silently
  overwrite the first tab's session, scrambling which account each tab acts
  as (this bit us once — see the comment in `api.ts`). `sessionStorage` is
  isolated per tab, so each tab keeps its own logged-in account.
- **CSRF:** classic CSRF exploits an ambient credential (a cookie) that the
  browser attaches automatically. Since auth here requires an explicit
  `Authorization` header that a third-party page cannot set on a
  cross-origin request and cannot read out of `sessionStorage`, CSRF tokens
  don't add protection this architecture doesn't already have structurally.
  There is intentionally no CSRF middleware.
- **Trade-off accepted:** an XSS bug on the frontend could read
  `sessionStorage` and steal a token, which an httpOnly cookie would have
  prevented. This is mitigated (not eliminated) by sanitizing all
  user-authored text server-side before it's ever stored or rendered (see
  `SanitizeHtml`/`stripHtml` applied to product fields, chat messages, bio,
  and report reasons). If this app's XSS surface grows (e.g. rich text,
  markdown rendering, third-party embeds), revisit this decision.

## WebSocket transport encryption (WSS)

`ChatGateway` does not enforce TLS itself, and there is currently no
production deployment target decided. Do not add a hard-coded "reject
non-TLS" check in application code without knowing the deployment topology
first — checking `socket.handshake.secure` directly breaks a perfectly
normal setup where a reverse proxy (nginx, an ALB, Cloudflare, etc.)
terminates TLS and forwards plain HTTP/WS internally, unless
`app.set('trust proxy', ...)` and `X-Forwarded-Proto` are wired up to match
that specific proxy's headers.

**Before going to production**, pick one and implement it then:
- Terminate TLS at a reverse proxy in front of this app and serve `wss://`
  externally (the common case) — no application code change needed beyond
  confirming the proxy is configured correctly.
- Terminate TLS in the Node process itself (pass an HTTPS server / cert to
  Nest) if there's no proxy in front of it.

`CORS_ORIGIN` and the WS gateway's CORS config (`apps/api/src/modules/chat/chat.gateway.ts`)
should be updated to the `https://`/`wss://` production origin at that point too.
