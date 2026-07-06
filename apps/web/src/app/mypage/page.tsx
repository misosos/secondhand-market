"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/common/Button";
import { ErrorMessage } from "@/components/common/ErrorMessage";
import { Input } from "@/components/common/Input";
import { Spinner } from "@/components/common/Spinner";
import { TextArea } from "@/components/common/TextArea";
import { useAuth } from "@/features/auth/useAuth";
import { useRequireAuth } from "@/features/auth/useRequireAuth";
import { api } from "@/lib/api";
import styles from "./page.module.css";

export default function MyPage() {
  const { user, isLoading } = useRequireAuth();
  const { refreshUser } = useAuth();

  const [bio, setBio] = useState(user?.bio ?? "");
  const [bioError, setBioError] = useState<string | null>(null);
  const [bioSuccess, setBioSuccess] = useState(false);
  const [isSavingBio, setIsSavingBio] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [isSavingPassword, setIsSavingPassword] = useState(false);

  if (isLoading || !user) return <Spinner />;

  async function handleBioSubmit(event: FormEvent) {
    event.preventDefault();
    setBioError(null);
    setBioSuccess(false);
    setIsSavingBio(true);
    try {
      await api.patch("/users/me", { bio });
      await refreshUser();
      setBioSuccess(true);
    } catch (err) {
      setBioError(err instanceof Error ? err.message : "저장에 실패했습니다.");
    } finally {
      setIsSavingBio(false);
    }
  }

  async function handlePasswordSubmit(event: FormEvent) {
    event.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(false);
    setIsSavingPassword(true);
    try {
      await api.patch("/users/me/password", { currentPassword, newPassword });
      setPasswordSuccess(true);
      setCurrentPassword("");
      setNewPassword("");
    } catch (err) {
      setPasswordError(err instanceof Error ? err.message : "비밀번호 변경에 실패했습니다.");
    } finally {
      setIsSavingPassword(false);
    }
  }

  return (
    <div>
      <h1 style={{ fontSize: 20, fontWeight: 800, marginBottom: 8 }}>마이페이지</h1>
      <p className={styles.meta}>
        {user.username} · 가입일 {new Date(user.createdAt).toLocaleDateString()}
      </p>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>소개글</h2>
        <form onSubmit={handleBioSubmit}>
          <TextArea value={bio} onChange={(e) => setBio(e.target.value)} rows={4} maxLength={500} />
          {bioSuccess && <p className={styles.success}>저장되었습니다.</p>}
          <ErrorMessage>{bioError}</ErrorMessage>
          <Button type="submit" disabled={isSavingBio}>
            {isSavingBio ? "저장 중..." : "저장"}
          </Button>
        </form>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>비밀번호 변경</h2>
        <form onSubmit={handlePasswordSubmit}>
          <Input
            label="현재 비밀번호"
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
          <Input
            label="새 비밀번호 (8자 이상)"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            autoComplete="new-password"
            minLength={8}
            required
          />
          {passwordSuccess && <p className={styles.success}>비밀번호가 변경되었습니다.</p>}
          <ErrorMessage>{passwordError}</ErrorMessage>
          <Button type="submit" disabled={isSavingPassword}>
            {isSavingPassword ? "변경 중..." : "변경하기"}
          </Button>
        </form>
      </section>
    </div>
  );
}
