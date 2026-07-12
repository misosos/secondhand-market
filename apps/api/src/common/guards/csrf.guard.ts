import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import type { Request } from "express";
import { CSRF_COOKIE, CSRF_HEADER } from "../../modules/auth/auth.constants";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
// Session-bootstrapping endpoints: there's no established session (and
// often no CSRF cookie yet) for these to check against. Everything else —
// including /auth/logout — is protected.
const EXEMPT_PATHS = new Set(["/api/auth/signup", "/api/auth/login", "/api/auth/refresh"]);

// Double-submit cookie CSRF defense: a cross-site attacker page can ride on
// the browser's automatic cookie attachment to fire a same-origin request,
// but it can neither read this cookie's value (same-origin policy) nor set
// an arbitrary header on a simple cross-origin form/fetch — so requiring
// the header to echo the cookie proves the request came from our own
// frontend JS, not a forged cross-site submission.
@Injectable()
export class CsrfGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    // Registered as a global APP_GUARD, which also runs for WS message
    // handlers — those have their own auth (WsJwtGuard) and no cookies to
    // check, so skip anything that isn't a plain HTTP request.
    if (context.getType() !== "http") return true;

    const req = context.switchToHttp().getRequest<Request>();
    if (SAFE_METHODS.has(req.method) || EXEMPT_PATHS.has(req.path)) {
      return true;
    }

    const cookieToken = req.cookies?.[CSRF_COOKIE];
    const headerToken = req.header(CSRF_HEADER);

    if (!cookieToken || !headerToken || cookieToken !== headerToken) {
      throw new ForbiddenException("Invalid or missing CSRF token");
    }

    return true;
  }
}
