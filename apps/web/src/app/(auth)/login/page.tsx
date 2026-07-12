"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { KeyRound, LogIn, User } from "lucide-react";
import { Button } from "@/components/common/Button";
import { ErrorMessage } from "@/components/common/ErrorMessage";
import { FormCard } from "@/components/common/FormCard";
import { Input } from "@/components/common/Input";
import { useAuth } from "@/features/auth/useAuth";
import styles from "../form.module.css";

export default function LoginPage() {
  const { login } = useAuth();
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
      await login(username, password);
      router.push("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "로그인에 실패했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className={styles.wrap}>
      <h1 className={styles.title}>로그인</h1>
      <FormCard>
        <form onSubmit={handleSubmit}>
          <Input
            label="아이디"
            icon={User}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            required
          />
          <Input
            label="비밀번호"
            icon={KeyRound}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
          <ErrorMessage>{error}</ErrorMessage>
          <Button type="submit" icon={LogIn} disabled={isSubmitting} style={{ width: "100%" }}>
            {isSubmitting ? "로그인 중..." : "로그인"}
          </Button>
        </form>
      </FormCard>
      <p className={styles.footer}>
        계정이 없으신가요? <Link href="/signup">회원가입</Link>
      </p>
    </div>
  );
}
