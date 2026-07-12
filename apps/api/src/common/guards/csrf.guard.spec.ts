import { ExecutionContext, ForbiddenException } from "@nestjs/common";
import { CsrfGuard } from "./csrf.guard";

describe("CsrfGuard", () => {
  const guard = new CsrfGuard();

  function contextFor(opts: {
    type?: string;
    method?: string;
    path?: string;
    cookies?: Record<string, string>;
    header?: string;
  }): ExecutionContext {
    const req = {
      method: opts.method ?? "POST",
      path: opts.path ?? "/api/products",
      cookies: opts.cookies ?? {},
      header: (name: string) => (name === "x-csrf-token" ? opts.header : undefined),
    };
    return {
      getType: () => opts.type ?? "http",
      switchToHttp: () => ({ getRequest: () => req }),
    } as unknown as ExecutionContext;
  }

  it("allows non-HTTP contexts through untouched (WS has its own auth)", () => {
    expect(guard.canActivate(contextFor({ type: "ws" }))).toBe(true);
  });

  it("allows safe methods without a token", () => {
    expect(guard.canActivate(contextFor({ method: "GET" }))).toBe(true);
  });

  it("allows the session-bootstrapping auth endpoints through", () => {
    expect(guard.canActivate(contextFor({ path: "/api/auth/login" }))).toBe(true);
    expect(guard.canActivate(contextFor({ path: "/api/auth/signup" }))).toBe(true);
    expect(guard.canActivate(contextFor({ path: "/api/auth/refresh" }))).toBe(true);
  });

  it("rejects a mutating request with no CSRF cookie/header at all", () => {
    expect(() => guard.canActivate(contextFor({}))).toThrow(ForbiddenException);
  });

  it("rejects when the header is missing even though the cookie is set", () => {
    expect(() => guard.canActivate(contextFor({ cookies: { csrfToken: "abc" } }))).toThrow(ForbiddenException);
  });

  it("rejects when header and cookie values don't match (forged/guessed header)", () => {
    expect(() =>
      guard.canActivate(contextFor({ cookies: { csrfToken: "abc" }, header: "different" })),
    ).toThrow(ForbiddenException);
  });

  it("allows a mutating request when the header echoes the cookie", () => {
    expect(guard.canActivate(contextFor({ cookies: { csrfToken: "abc" }, header: "abc" }))).toBe(true);
  });

  it("rejects logout too — it's not exempt like the bootstrapping endpoints", () => {
    expect(() => guard.canActivate(contextFor({ path: "/api/auth/logout" }))).toThrow(ForbiddenException);
  });
});
