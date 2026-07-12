"use client";

import { useCallback, useEffect, useState } from "react";
import { AccountStatus, type AdminUserDto } from "@secondhand/types";
import { api, ApiError } from "@/lib/api";

export function useAdminUsers(status: AccountStatus | "ALL") {
  const [users, setUsers] = useState<AdminUserDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const query = status === "ALL" ? "" : `?status=${status}`;
      const result = await api.get<AdminUserDto[]>(`/admin/users${query}`);
      setUsers(result);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "유저 목록을 불러오지 못했습니다.");
    } finally {
      setIsLoading(false);
    }
  }, [status]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const setUserStatus = useCallback(
    async (userId: string, nextStatus: AccountStatus) => {
      await api.patch(`/admin/users/${userId}/status`, { status: nextStatus });
      await refresh();
    },
    [refresh],
  );

  return { users, isLoading, error, setUserStatus };
}
