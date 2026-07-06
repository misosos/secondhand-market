"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/common/Button";
import { ErrorMessage } from "@/components/common/ErrorMessage";
import { Input } from "@/components/common/Input";
import { useAuth } from "@/features/auth/useAuth";
import styles from "../form.module.css";

export default function SignupPage() {
  const { signup, login } = useAuth();
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await signup(username, password);
      // Signup and login are separate endpoints on the API (no tokens are
      // issued at signup) — chain straight into login for a one-step UX.
      await login(username, password);
      router.push("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "회원가입에 실패했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className={styles.wrap}>
      <h1 className={styles.title}>회원가입</h1>
      <form onSubmit={handleSubmit}>
        <Input
          label="아이디 (3~20자, 영문/숫자/_)"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoComplete="username"
          required
        />
        <Input
          label="비밀번호 (8자 이상)"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password"
          minLength={8}
          required
        />
        <ErrorMessage>{error}</ErrorMessage>
        <Button type="submit" disabled={isSubmitting} style={{ width: "100%" }}>
          {isSubmitting ? "가입 중..." : "회원가입"}
        </Button>
      </form>
      <p className={styles.footer}>
        이미 계정이 있으신가요? <Link href="/login">로그인</Link>
      </p>
    </div>
  );
}
