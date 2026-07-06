import type { AuthTokens } from "@secondhand/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

const ACCESS_TOKEN_KEY = "secondhand.accessToken";
const REFRESH_TOKEN_KEY = "secondhand.refreshToken";

// Tokens live in sessionStorage rather than an httpOnly cookie: the API
// issues them in the JSON response body (not Set-Cookie), so there's
// nowhere else to put them without changing the confirmed auth contract.
// Trade-off: vulnerable to XSS-based token theft in a way httpOnly cookies
// aren't — acceptable for this MVP, worth revisiting before production.
//
// sessionStorage (not localStorage) deliberately: localStorage is shared
// across every tab of the same origin, so logging into a second account in
// another tab silently overwrote the first tab's token — both tabs would
// then act as whichever account logged in last, scrambling chat sender
// identity between them. sessionStorage is isolated per tab, so each tab
// keeps its own logged-in account.
export function getAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.sessionStorage.getItem(ACCESS_TOKEN_KEY);
}

export function getRefreshToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.sessionStorage.getItem(REFRESH_TOKEN_KEY);
}

export function setTokens(tokens: AuthTokens): void {
  window.sessionStorage.setItem(ACCESS_TOKEN_KEY, tokens.accessToken);
  window.sessionStorage.setItem(REFRESH_TOKEN_KEY, tokens.refreshToken);
}

export function clearTokens(): void {
  window.sessionStorage.removeItem(ACCESS_TOKEN_KEY);
  window.sessionStorage.removeItem(REFRESH_TOKEN_KEY);
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  skipAuth?: boolean;
}

let refreshPromise: Promise<boolean> | null = null;

async function refreshAccessToken(): Promise<boolean> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return false;

  try {
    const res = await fetch(`${API_URL}/api/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    });
    if (!res.ok) {
      clearTokens();
      return false;
    }
    const tokens = (await res.json()) as AuthTokens;
    setTokens(tokens);
    return true;
  } catch {
    clearTokens();
    return false;
  }
}

async function request<T>(path: string, options: RequestOptions = {}, isRetry = false): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const token = getAccessToken();
  if (token && !options.skipAuth) {
    headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(`${API_URL}/api${path}`, {
    method: options.method ?? "GET",
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  if (res.status === 401 && !options.skipAuth && !isRetry) {
    // Single-flight refresh: concurrent 401s from parallel requests all
    // await the same in-flight refresh instead of each racing to rotate
    // the refresh token — only one rotation can win server-side (see the
    // reuse-detection logic in auth.service.ts), so a naive per-request
    // refresh would make the others fail with "no longer valid".
    if (!refreshPromise) {
      refreshPromise = refreshAccessToken().finally(() => {
        refreshPromise = null;
      });
    }
    const refreshed = await refreshPromise;
    if (refreshed) {
      return request<T>(path, options, true);
    }
    // Deliberately does not force-navigate to /login here: public pages
    // (product listing/detail) also make authenticated-optional background
    // calls, and a hard redirect would boot an anonymous visitor off a page
    // they're allowed to see. Protected pages redirect themselves via
    // useRequireAuth once `user` resolves to null.
    clearTokens();
    throw new ApiError(401, "Session expired");
  }

  if (res.status === 204) {
    return undefined as T;
  }

  const data = await res.json().catch(() => null);

  if (!res.ok) {
    const message = Array.isArray(data?.message) ? data.message.join(", ") : (data?.message ?? "Request failed");
    throw new ApiError(res.status, message);
  }

  return data as T;
}

export const api = {
  get: <T>(path: string, options?: RequestOptions) => request<T>(path, { ...options, method: "GET" }),
  post: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>(path, { ...options, method: "POST", body }),
  patch: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>(path, { ...options, method: "PATCH", body }),
  delete: <T>(path: string, options?: RequestOptions) => request<T>(path, { ...options, method: "DELETE" }),
};
