"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "./useAuth";

// Client-side route guard: this stack has no server session (tokens live
// in localStorage, not an httpOnly cookie), so protected pages can't be
// gated in middleware — they render once, then bounce to /login if the
// hydration check above resolves to signed-out.
export function useRequireAuth() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !user) {
      router.replace("/login");
    }
  }, [isLoading, user, router]);

  return { user, isLoading };
}
