"use client";

import Link from "next/link";
import { Role } from "@secondhand/types";
import { useAuth } from "@/features/auth/useAuth";
import styles from "./NavBar.module.css";

export function NavBar() {
  const { user, isLoading, logout } = useAuth();

  return (
    <header className={styles.header}>
      <div className={`container ${styles.inner}`}>
        <Link href="/" className={styles.logo}>
          중고거래
        </Link>
        <nav className={styles.nav}>
          {!isLoading && user && (
            <>
              <Link href="/products/new">상품 등록</Link>
              <Link href="/chat">채팅</Link>
              <Link href="/mypage">마이페이지</Link>
              {user.role === Role.ADMIN && <Link href="/admin/reports">관리자</Link>}
              <button className={styles.logoutButton} onClick={() => logout()}>
                로그아웃
              </button>
            </>
          )}
          {!isLoading && !user && (
            <>
              <Link href="/login">로그인</Link>
              <Link href="/signup">회원가입</Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
