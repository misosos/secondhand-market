"use client";

import { useEffect, useState } from "react";
import { ReportTargetType } from "@secondhand/types";
import type { PublicUser } from "@secondhand/types";
import { ErrorMessage } from "@/components/common/ErrorMessage";
import { Spinner } from "@/components/common/Spinner";
import { ChatEntryButton } from "@/components/chat/ChatEntryButton";
import { ReportButton } from "@/components/report/ReportButton";
import { useAuth } from "@/features/auth/useAuth";
import { api } from "@/lib/api";
import styles from "./page.module.css";

export default function UserProfilePage({ params }: { params: { id: string } }) {
  const { user: currentUser } = useAuth();
  const [profile, setProfile] = useState<PublicUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .get<PublicUser>(`/users/${params.id}`, { skipAuth: true })
      .then((data) => !cancelled && setProfile(data))
      .catch((err) => !cancelled && setError(err instanceof Error ? err.message : "프로필을 불러올 수 없습니다."))
      .finally(() => !cancelled && setIsLoading(false));
    return () => {
      cancelled = true;
    };
  }, [params.id]);

  if (isLoading) return <Spinner />;
  if (error || !profile) return <ErrorMessage>{error ?? "사용자를 찾을 수 없습니다."}</ErrorMessage>;

  const isSelf = currentUser?.id === profile.id;

  return (
    <div className={styles.card}>
      <p className={styles.username}>{profile.username}</p>
      <p className={styles.meta}>가입일 {new Date(profile.createdAt).toLocaleDateString()}</p>
      <p className={styles.bio}>{profile.bio || "작성된 소개글이 없습니다."}</p>

      {!isSelf && currentUser && (
        <div style={{ display: "flex", gap: 8 }}>
          <ChatEntryButton peerId={profile.id} peerUsername={profile.username} />
          <ReportButton targetType={ReportTargetType.USER} targetId={profile.id} label="사용자 신고" />
        </div>
      )}
    </div>
  );
}
